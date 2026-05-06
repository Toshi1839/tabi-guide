// Edge Function: Claude API のプロキシ
//
// 役割:
//   - Anthropic API キーをサーバー側 (Supabase secrets) に隠蔽
//   - クライアントからのリクエストを Anthropic に転送
//   - 簡易レート制限（IP あたり）
//
// 配信中アプリ (1.0.3 以前) には影響しない（旧キーは Revoke 済みで動作不能）。
// 1.0.4 以降のアプリがこの Edge Function を呼ぶ。
//
// 環境変数 (Supabase secrets で設定):
//   - ANTHROPIC_API_KEY: 新規発行する Claude API キー
//
// デプロイ:
//   supabase functions deploy claude-chat --project-ref <ref>
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <ref>

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ALLOWED_MODELS = ['claude-haiku-4-5', 'claude-haiku-4-5-20251001'];
const MAX_TOKENS_LIMIT = 1024;
const RATE_LIMIT_PER_IP_PER_MIN = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// 簡易レート制限（プロセスメモリ、コールドスタートでリセット）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_IP_PER_MIN) return false;
  entry.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';

  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute.' }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: API key not set' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { model, max_tokens, system, messages } = body;

  if (!model || !ALLOWED_MODELS.includes(model)) {
    return new Response(
      JSON.stringify({ error: `Model not allowed. Allowed: ${ALLOWED_MODELS.join(', ')}` }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const safeMaxTokens = Math.min(
    typeof max_tokens === 'number' ? max_tokens : 512,
    MAX_TOKENS_LIMIT,
  );

  try {
    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: safeMaxTokens,
        system,
        messages,
      }),
    });

    const data = await anthropicRes.json();
    return new Response(JSON.stringify(data), {
      status: anthropicRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Upstream error' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
