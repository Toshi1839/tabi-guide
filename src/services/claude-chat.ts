import AsyncStorage from '@react-native-async-storage/async-storage';
import { Spot } from '../types';

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY || '';
const FREE_DAILY_LIMIT = 3;

// Wikipedia APIからスポット情報を取得
async function fetchWikipedia(name: string, lang: 'ja' | 'en'): Promise<string> {
  try {
    const encoded = encodeURIComponent(name);
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    if (data.type === 'disambiguation' || !data.extract) return '';
    // 最初の500文字に絞る（トークン節約）
    return data.extract.substring(0, 500);
  } catch {
    return '';
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 今日の日付キー
function todayKey(): string {
  return `chat_count_${new Date().toISOString().slice(0, 10)}`;
}

// 無料ユーザーの残り質問数を取得
export async function getRemainingQuestions(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(todayKey());
    const used = val ? parseInt(val, 10) : 0;
    return Math.max(0, FREE_DAILY_LIMIT - used);
  } catch {
    return FREE_DAILY_LIMIT;
  }
}

// 使用回数をインクリメント
async function incrementUsage(): Promise<void> {
  try {
    const key = todayKey();
    const val = await AsyncStorage.getItem(key);
    const used = val ? parseInt(val, 10) : 0;
    await AsyncStorage.setItem(key, String(used + 1));
  } catch {}
}

// Claude API に問い合わせ
export async function sendChatMessage(
  userMessage: string,
  spot: Spot,
  history: ChatMessage[],
  language: 'ja' | 'en',
  isPremium: boolean
): Promise<{ reply: string; error?: string }> {

  // 無料ユーザーの制限チェック
  if (!isPremium) {
    const remaining = await getRemainingQuestions();
    if (remaining <= 0) {
      return {
        reply: '',
        error: language === 'en'
          ? 'You have reached the daily limit (3 questions). Upgrade to Premium for unlimited questions.'
          : '本日の無料質問回数（3回）を使い切りました。プレミアムにアップグレードすると無制限で質問できます。',
      };
    }
  }

  // Wikipedia情報を取得（最初のメッセージ時のみ、履歴が空 = 初回）
  let wikiContext = '';
  if (history.length === 0) {
    const wikiName = language === 'en' ? (spot.name_en || spot.name) : spot.name;
    wikiContext = await fetchWikipedia(wikiName, language);
    // 英語でヒットしない場合は日本語でも試みる
    if (!wikiContext && language === 'en') {
      wikiContext = await fetchWikipedia(spot.name, 'ja');
    }
  }

  // ジャンル・評価をdescriptionから抽出
  const isCraftBeer = !!(spot as any)._isCraftBeer;
  const ratingMatch = spot.description?.match(/食べログ([\d.]+)/);
  const rating = spot.rating ?? (ratingMatch ? parseFloat(ratingMatch[1]) : null);
  const genreMatch = spot.description?.match(/^([^。]+)。/);
  const genre = genreMatch ? genreMatch[1] : null;
  const isRestaurant = spot.category === 'restaurant';
  const ratingSource = isCraftBeer ? 'Google Maps' : '食べログ';

  // 食べログ評価をdescriptionから除去してAIに渡す
  const cleanDesc = (text?: string) => text?.replace(/食べログ[\d.]+[。.]?\s*/g, '').trim() || '';

  // スポット情報をコンテキストとして組み込む
  const spotContext = language === 'en'
    ? [
        `Name: ${spot.name_en || spot.name}`,
        `Category: ${spot.category}`,
        genre ? `Cuisine/Type: ${genre}` : '',
        isCraftBeer && rating ? `Google Maps rating: ${rating} / 5.0` : '',
        `Description: ${cleanDesc(spot.description_en || spot.description)}`,
        `Audio guide: ${spot.audio_text_en || spot.audio_text}`,
        spot.address ? `Address: ${spot.address}` : '',
        wikiContext ? `\nWikipedia:\n${wikiContext}` : '',
      ].filter(Boolean).join('\n')
    : [
        `スポット名: ${spot.name}`,
        `カテゴリ: ${spot.category}`,
        genre ? `ジャンル: ${genre}` : '',
        isCraftBeer && rating ? `Google Maps評価: ${rating} / 5.0` : '',
        `説明: ${cleanDesc(spot.description)}`,
        `音声ガイド: ${spot.audio_text}`,
        spot.address ? `住所: ${spot.address}` : '',
        wikiContext ? `\nWikipedia情報:\n${wikiContext}` : '',
      ].filter(Boolean).join('\n');

  // カテゴリ別の専門知識プロンプト
  const categoryGuidance: Record<string, string> = {
    restaurant: isCraftBeer
      ? `クラフトビール・ビアバーの専門家として:
- 店舗の特徴・提供しているビールの傾向（IPA、スタウト、ピルスナー等）
- Google Maps評価${rating ? rating + '点' : ''}を踏まえた店舗の質の説明
- クラフトビール初心者向けのおすすめ、注文のコツ
- 価格帯の目安、フードメニューの傾向、雰囲気
- 予約の必要性、混雑時間帯、入店のコツなど実用的な情報`
      : `料理・飲食店の専門家として:
- ジャンルの特徴・食材・調理法・代表的なメニューを具体的に説明
- 価格帯の目安（ジャンルから推測）、注文方法のコツ、人気メニューの傾向
- 予約の必要性、混雑時間帯、入店のコツなど実用的な情報
- 食べログの評価点数には絶対に言及しないこと`,
    temple: `寺社仏閣・神社・寺の専門家として:
- 創建の経緯・時代背景・関連する歴史上の人物・出来事
- 祀られている神仏・本尊・御利益の詳細な説明
- 参拝方法・礼拝の作法・お守り・おみくじの種類
- 境内の見どころ・隠れた名所・季節ごとの見どころ（桜・紅葉など）`,
    historical: `日本史・文化遺産の専門家として:
- その場所が持つ歴史的意義・関連した歴史的事件・人物
- 建築様式・使われた技術・時代の特徴
- 現在の保存状態・発掘された遺物・研究の成果
- 周辺の関連スポット・散策ルートの提案`,
    heritage: `世界遺産・文化遺産の専門家として:
- 世界遺産登録の理由・顕著な普遍的価値
- 建造・創建の歴史・関連する文明・文化
- 保存活動・修復の歴史・現在の課題
- 観光のベストシーズン・見学のポイント`,
    museum: `美術館・博物館の専門家として:
- 収蔵品の特徴・代表的な展示物・見どころ
- 設立の経緯・コレクションの成り立ち
- 建物・設計の特徴（著名な建築家の作品など）
- 効率的な見学順路・所要時間の目安`,
    nature: `自然・環境の専門家として:
- 地形・植生・生態系の特徴
- 季節ごとの見どころ（花・紅葉・雪景色など）
- 散策コース・所要時間・難易度
- 周辺の観光スポットとの組み合わせ`,
    viewpoint: `景観・展望スポットの専門家として:
- 見える景色・ランドマークの説明
- ベストな撮影時間（朝・夕・夜景）・天気の選び方
- アクセス方法・混雑時間帯の回避策
- 周辺施設・食事処の情報`,
    shopping: `ショッピング・商業施設の専門家として:
- 販売している商品・特産品・お土産の特徴
- 地域の伝統工芸・名産品の背景
- 価格帯・購入のコツ・おすすめ商品
- 営業時間・定休日・アクセス情報`,
    entertainment: `観光・エンターテイメントの専門家として:
- 体験できるアクティビティ・見どころ
- 料金・所要時間・年齢制限などの実用情報
- 混雑回避のコツ・予約の必要性
- 周辺スポットとの組み合わせ方`,
  };

  const guidance = categoryGuidance[spot.category] || categoryGuidance['historical'];

  const systemPrompt = language === 'en'
    ? `You are an expert AI travel guide for Japan, specializing in ${spot.category}. The user is standing at:

${spotContext}

YOUR ROLE: Use the spot info above as a starting point, then EXPAND with your deep knowledge about Japan.
- Go BEYOND the description. Add context, history, insider tips, cultural background.
- For restaurants: explain the cuisine in detail, typical dishes, price range estimate, dining culture.
- For temples/shrines: explain the deity, ritual practices, architectural style, legends.
- NEVER say "check the website" or "see Tabelog." Answer directly with your knowledge.
- Real-time info only (today's wait, current hours): admit you don't know.
- If the user asks about other historical sites, monuments, statues, or cultural features AT THIS LOCATION or NEARBY, answer them with your knowledge — they are part of the same place.
- Only redirect if the question is truly unrelated (e.g. weather, news, general trivia not connected to this place or area).
- 2-4 sentences, specific and engaging. Always respond in English.`
    : `あなたは日本の${spot.category}に深く精通したAIガイドです。ユーザーはこのスポットに立っています:

${spotContext}

【重要】上記の説明文はあくまで出発点。そこから大幅に踏み込んだ知識で回答してください。

${guidance}

禁止事項:
- 「食べログを確認してください」「公式サイトをご覧ください」は絶対NG
- 説明文をそのまま言い換えるだけの回答はNG
- 「詳細は〜でご確認を」という逃げ回答はNG
- 同じ場所や周辺にある別の史跡・記念碑・石碑・像・建造物などに関する質問は、あなたの知識で積極的に回答する（同じ場所の一部として扱う）
- 拒否するのは本当に無関係な質問のみ（天気・ニュース・このエリアと無関係な一般知識等）

OK:
- 説明文に書かれていない具体的な情報を追加する
- 一般知識で価格・特徴・歴史を補完する
- リアルタイム情報（本日の待ち時間・今日の営業状況）のみ「わかりません」と伝える

回答は2〜4文、具体的かつ役に立つ内容で。常に日本語で回答する。`;

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { reply: '', error: data.error.message };
    }

    const reply = data.content?.[0]?.text || '';

    // 使用回数を記録（無料ユーザーのみ）
    if (!isPremium) {
      await incrementUsage();
    }

    return { reply };
  } catch (e: any) {
    return { reply: '', error: e.message };
  }
}
