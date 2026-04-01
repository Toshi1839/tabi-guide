const https = require('https');

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const SUPABASE_URL = 'wnyaofugzxfnwvmqluer.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

const BATCH_SIZE = 8;
const FETCH_LIMIT = 500;

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    https.request({
      hostname: SUPABASE_URL,
      path: `/rest/v1/${path}`,
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
    }).on('error', reject).end();
  });
}

function supabasePatch(id, updates) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(updates);
    const req = https.request({
      hostname: SUPABASE_URL,
      path: `/rest/v1/spots?id=eq.${id}`,
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function callClaude(spots) {
  return new Promise((resolve) => {
    const spotList = spots.map((s, i) => {
      const ratingMatch = s.description && s.description.match(/食べログ([\d.]+)/);
      const rating = ratingMatch ? ratingMatch[1] : null;
      return [
        `[${i + 1}]`,
        `  Japanese name: ${s.name}`,
        `  Category: ${s.category}`,
        `  Japanese description: ${s.description || ''}`,
        `  Japanese audio guide: ${s.audio_text || ''}`,
        `  Address: ${s.address || ''}`,
        rating ? `  Tabelog rating: ${rating}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    const prompt = `You are a professional travel guide writer. Generate English content for spots in Kanto region, Japan.

For each spot, provide:
- "name_en": English name using Hepburn romanization (e.g., "Banmanji Temple", "Kashima Shrine"). For Western-origin names, keep as-is. For restaurants, use romanization.
- "description_en": 1 concise sentence (under 60 characters). Mention type/significance.
- "audio_text_en": 3-5 sentences for an audio guide for foreign tourists. Engaging and informative. Include historical context or interesting facts. Do NOT start with "You are approaching...".

Rules:
- Base content on the Japanese description and audio guide provided
- For temples: mention Buddhist sect or deity if known
- For shrines: mention the deity enshrined
- For restaurants: mention cuisine type and Tabelog rating if provided
- Historical facts only — do not fabricate
- Natural, engaging English for international tourists

Return a JSON array only. Each element: {"index": number, "name_en": "...", "description_en": "...", "audio_text_en": "..."}
No text outside the JSON array.

Spots:
${spotList}`;

    const body = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const response = JSON.parse(d);
          if (response.error) { console.error('Claude API error:', response.error.message); resolve([]); return; }
          const text = response.content[0].text;
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) { resolve(JSON.parse(jsonMatch[0])); }
          else { console.error('No JSON found'); resolve([]); }
        } catch (e) { console.error('Parse error:', e.message); resolve([]); }
      });
    });
    req.on('error', (e) => { console.error('Request error:', e.message); resolve([]); });
    req.write(body); req.end();
  });
}

async function main() {
  let totalUpdated = 0;
  let totalFailed = 0;
  let offset = 0;
  let grandTotal = null;

  console.log('=== 関東全域 英語コンテンツ生成 開始 ===\n');

  while (true) {
    const spots = await supabaseGet(
      `spots?name_en=is.null&select=id,name,category,description,audio_text,address` +
      `&order=category,name&limit=${FETCH_LIMIT}&offset=${offset}`
    );

    if (!spots || spots.length === 0) break;
    if (grandTotal === null) {
      // 初回のみ概算を表示
      console.log(`このバッチ: ${spots.length}件 (offset: ${offset})\n`);
    }

    for (let i = 0; i < spots.length; i += BATCH_SIZE) {
      const batch = spots.slice(i, i + BATCH_SIZE);
      const from = offset + i + 1;
      const to = offset + Math.min(i + BATCH_SIZE, spots.length);
      process.stdout.write(`[${from}〜${to}] 生成中... `);

      let results = [];
      let retries = 3;
      while (retries > 0 && results.length === 0) {
        results = await callClaude(batch);
        if (results.length === 0) {
          retries--;
          process.stdout.write(`リトライ(${3 - retries}/3)... `);
          await new Promise(r => setTimeout(r, 5000));
        }
      }

      for (const result of results) {
        const spot = batch[result.index - 1];
        if (!spot) continue;
        const status = await supabasePatch(spot.id, {
          name_en: result.name_en,
          description_en: result.description_en,
          audio_text_en: result.audio_text_en,
        });
        if (status === 204) {
          totalUpdated++;
        } else {
          totalFailed++;
        }
      }

      if (results.length === 0) totalFailed += batch.length;

      console.log(`完了 (累計: ${totalUpdated}件更新)`);
      await new Promise(r => setTimeout(r, 2000));
    }

    offset += spots.length;
    if (spots.length < FETCH_LIMIT) break;
  }

  console.log(`\n=== 完了! 更新: ${totalUpdated}件, 失敗: ${totalFailed}件 ===`);
}

main().catch(console.error);
