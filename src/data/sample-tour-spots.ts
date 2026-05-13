/**
 * Sample Tour Spots — 1.0.5 の中核機能
 *
 * 訪日外国人向けの「DL 後の初回 30 秒で価値を理解」体験設計。
 * 位置情報なしで家・カフェ・電車内でも音声ガイドを再生可能にする。
 *
 * 選定基準 (docs/monetization.md §9):
 *  - 訪日外国人の認知度が高く、即座に「日本旅行の本物」と感じる
 *  - 5箇所で「日本の主要体験」を網羅（寺・神社・現代都市・神社の千本鳥居・建築美）
 *
 * 設計方針:
 *  - キュレーション済みコンテンツ（DB の auto-generated 文ではない）
 *  - 1スポット 1分前後の音声（~140-160語）
 *  - expo-speech (iOS native English voice) で読み上げ
 *  - 訪日客が「これは行こう」と思える具体性 + 物語性
 */

export interface SampleTourSpot {
  id: string;
  name: string;
  name_en: string;
  category: 'temple' | 'shrine' | 'modern' | 'architecture';
  city: 'Tokyo' | 'Kyoto';
  emoji: string;
  latitude: number;
  longitude: number;
  // ホーム画面で見える1行ヘッダー (英語)
  tagline_en: string;
  tagline_ja: string;
  // 詳細画面の説明（短文、200字以内）
  description_en: string;
  description_ja: string;
  // 音声ガイドの本文（1分前後の朗読、最重要）
  audio_text_en: string;
  audio_text_ja: string;
}

export const SAMPLE_TOUR_SPOTS: SampleTourSpot[] = [
  // 1. 浅草寺 — 訪日 No.1 訪問地、東京最古の寺
  {
    id: 'sample_sensoji',
    name: '浅草寺',
    name_en: 'Sensoji Temple',
    category: 'temple',
    city: 'Tokyo',
    emoji: '⛩️',
    latitude: 35.7148,
    longitude: 139.7967,
    tagline_en: "Tokyo's oldest temple, founded in 645 AD",
    tagline_ja: '東京最古の寺院、645年創建',
    description_en:
      "Tokyo's oldest and most visited temple. Walk through the iconic Kaminarimon Gate with its giant red lantern, then down Nakamise shopping street to reach the main hall.",
    description_ja:
      '東京最古かつ最も訪問者の多い寺院。雷門の巨大な赤提灯をくぐり、仲見世通りを抜けて本堂へ。',
    audio_text_en:
      "Welcome to Sensoji Temple, Tokyo's oldest Buddhist temple, founded in the year 645. " +
      "You're standing in front of the Kaminarimon, the Thunder Gate, with its massive red lantern weighing nearly 700 kilograms. " +
      "Walk through and you'll find Nakamise, a 250-meter shopping street that has served pilgrims and visitors for over 300 years. " +
      "Try the freshly baked ningyo-yaki cakes or pick up a traditional folding fan. " +
      "At the end of the street stands the Hozomon Gate, and beyond it, the Main Hall, where you can offer incense and a prayer to Kannon, the goddess of mercy. " +
      "The five-story pagoda on your left was rebuilt after World War II and now stands 53 meters tall. " +
      "Best visited early morning or after sunset, when the crowds thin and the lanterns glow. " +
      "Sensoji isn't just a temple. It's the heart of old Tokyo, still beating after fourteen centuries.",
    audio_text_ja:
      '浅草寺へようこそ。東京最古の仏教寺院で、645年に創建されました。' +
      '目の前にあるのが雷門。重さ約700キログラムの巨大な赤提灯が目を引きます。' +
      'くぐり抜けると仲見世通り。長さ250メートル、300年以上にわたり参拝者を迎えてきました。' +
      '焼きたての人形焼きや伝統的な扇子を試してみてください。' +
      '通りの先には宝蔵門、その奥に本堂が見えます。本尊は観音菩薩、慈悲の女神です。' +
      '左手の五重塔は第二次大戦後に再建され、高さ53メートル。' +
      '訪問は朝早く、または夕暮れ後がおすすめ。人波が減り、提灯が美しく灯ります。' +
      '浅草寺は単なる寺ではなく、14世紀にわたり東京の鼓動を支えてきた場所です。',
  },

  // 2. 明治神宮 — 東京最大の神社、原宿/渋谷からアクセス良
  {
    id: 'sample_meiji_jingu',
    name: '明治神宮',
    name_en: 'Meiji Shrine',
    category: 'shrine',
    city: 'Tokyo',
    emoji: '⛩️',
    latitude: 35.6764,
    longitude: 139.6993,
    tagline_en: 'A 70-hectare forest sanctuary in the heart of Tokyo',
    tagline_ja: '東京の中心にある70ヘクタールの森の社',
    description_en:
      "A vast Shinto shrine dedicated to Emperor Meiji and Empress Shoken. Walk through 70 hectares of man-made forest planted with 120,000 trees donated from all over Japan.",
    description_ja:
      '明治天皇と昭憲皇太后を祀る広大な神社。全国から寄進された12万本の樹木が作る70ヘクタールの人工森。',
    audio_text_en:
      "You're entering Meiji Shrine, dedicated to Emperor Meiji and his wife Empress Shoken, both of whom passed away in the early 1900s. " +
      "What looks like an ancient forest is actually entirely man-made. " +
      "When the shrine was completed in 1920, citizens donated 120,000 trees from every corner of Japan. " +
      "A century later, it's a thriving ecosystem of 234 species. " +
      "Pass under the giant torii gate, made from a 1500-year-old cypress tree. " +
      "On your right, you'll see walls of sake barrels, donated by Japanese brewers; on your left, burgundy wine barrels from France, honoring the Emperor's love of Western culture. " +
      "At the main shrine, take a moment for the traditional bow: two bows, two claps, one bow. " +
      "Make a wish, write a prayer on an ema wooden plaque, or simply enjoy the silence. " +
      "Five minutes from Harajuku Station, this is Tokyo's most surprising secret. A primeval forest hidden in the world's largest city.",
    audio_text_ja:
      '明治神宮にようこそ。明治天皇と昭憲皇太后を祀る神社で、両陛下は1900年代初頭に崩御されました。' +
      '古代から続くように見えるこの森は、実は完全に人工のものです。' +
      '1920年の完成時、全国から12万本の樹木が寄進されました。' +
      '100年後、234種の生物が住む豊かな生態系になっています。' +
      '巨大な鳥居は樹齢1500年の檜から作られました。' +
      '右手には日本酒の酒樽が並びます。蔵元からの献納。左手にはフランスのワイン樽。明治天皇の西洋文化への関心を示すものです。' +
      '本殿では伝統的な参拝を。二礼二拍手一礼。' +
      '願い事を込めて絵馬を奉納するのもよいでしょう。' +
      '原宿駅から5分。東京の中心に隠された原生林、世界最大の都市が抱える最大の意外性です。',
  },

  // 3. 渋谷スクランブル交差点 — 現代日本の象徴、Instagram必至
  {
    id: 'sample_shibuya_crossing',
    name: '渋谷スクランブル交差点',
    name_en: 'Shibuya Scramble Crossing',
    category: 'modern',
    city: 'Tokyo',
    emoji: '🌆',
    latitude: 35.6595,
    longitude: 139.7005,
    tagline_en: "The world's busiest pedestrian crossing",
    tagline_ja: '世界一忙しい歩行者交差点',
    description_en:
      "Up to 3,000 people cross at once during peak hours. The intersection has become an iconic symbol of modern Tokyo, surrounded by huge video screens and neon.",
    description_ja:
      'ピーク時には一度に最大3,000人が渡る交差点。巨大なビジョンとネオンに囲まれ、現代東京の象徴となっています。',
    audio_text_en:
      "You're standing at Shibuya Scramble, the world's busiest pedestrian crossing. " +
      "Every two minutes, when the lights turn red for cars in all directions, up to 3,000 people cross at once, weaving through each other without collision. " +
      "It looks like chaos, but it's actually one of the most efficient intersections on Earth. " +
      "Around you, towering screens flash advertisements and music videos at five-second intervals. " +
      "Look up: the Shibuya Sky observation deck, 230 meters above, gives a bird's-eye view of this human flow. " +
      "Look northwest: a small statue of a dog named Hachiko. " +
      "In the 1920s, Hachiko waited at this station every day for his owner, even years after the owner died. " +
      "Today, it's Tokyo's most popular meeting spot. " +
      "For the best photo of the scramble, head to the second-floor Starbucks across the intersection. " +
      "What you're witnessing isn't just a crossing. It's the rhythm of 21st-century Tokyo, captured in 90 seconds.",
    audio_text_ja:
      '渋谷スクランブル交差点へようこそ。世界一忙しい歩行者交差点です。' +
      '2分ごとに全方向の信号が赤になり、最大3,000人が一斉に渡ります。互いをよけながらぶつからずに通り抜けます。' +
      '一見カオスですが、世界で最も効率的な交差点の一つです。' +
      '周囲には巨大なビジョンが5秒間隔で広告と音楽ビデオを流しています。' +
      '上を見上げてください。地上230メートルの渋谷スカイ展望台から、この人流を俯瞰できます。' +
      '北西を見ると、小さな犬の像があります。ハチ公です。' +
      '1920年代、ハチ公は飼い主が亡くなった後も毎日この駅で待ち続けました。' +
      '今では東京で最も人気の待ち合わせスポット。' +
      'スクランブルの最高の写真ポイントは、交差点向かいの2階のスターバックス。' +
      'これは単なる交差点ではなく、21世紀東京のリズムが90秒に凝縮された場所です。',
  },

  // 4. 伏見稲荷大社 — 京都、Instagram映え、千本鳥居
  {
    id: 'sample_fushimi_inari',
    name: '伏見稲荷大社',
    name_en: 'Fushimi Inari Taisha',
    category: 'shrine',
    city: 'Kyoto',
    emoji: '⛩️',
    latitude: 34.9671,
    longitude: 135.7727,
    tagline_en: '10,000 vermillion torii gates winding up the mountain',
    tagline_ja: '山を登る朱色の千本鳥居',
    description_en:
      "Kyoto's most photographed shrine. A trail of around 10,000 bright orange torii gates leads 233 meters up Mount Inari, with smaller shrines along the way.",
    description_ja:
      '京都で最も撮影される神社。約1万基の朱色の鳥居が稲荷山の233メートルを登り、途中に多数の小祠があります。',
    audio_text_en:
      "Welcome to Fushimi Inari Taisha, the head shrine of all 30,000 Inari shrines across Japan. " +
      "You're about to walk through one of Japan's most photographed sights: a tunnel of vermillion torii gates climbing Mount Inari. " +
      "Each gate was donated by an individual or business as an offering, with the donor's name carved into the back. " +
      "Walking the full loop to the summit takes about two hours and rewards you with city views from 233 meters up. " +
      "But you don't need to go all the way. " +
      "About 30 minutes in, at the Yotsutsuji intersection, the crowds thin and the forest feels ancient. " +
      "Inari is the Shinto god of rice, sake, and prosperity, and you'll see fox statues everywhere. Foxes are believed to be Inari's messengers. " +
      "Some hold keys to rice storehouses in their mouths. Some hold scrolls of wisdom. " +
      "Try a kitsune udon noodle bowl at the foot of the mountain — sweet fried tofu, the foxes' favorite. " +
      "Visit at dawn or after sunset for nearly empty paths and the most magical light.",
    audio_text_ja:
      '伏見稲荷大社にようこそ。日本全国3万社ある稲荷神社の総本宮です。' +
      'これから日本で最も撮影される風景、稲荷山を登る朱色の鳥居のトンネルを歩きます。' +
      '各鳥居は個人や企業の奉納によるもの。背面に寄進者の名が刻まれています。' +
      '山頂までの一周は約2時間。233メートルの高さから京都市街を一望できます。' +
      'ただし全部歩く必要はありません。' +
      '30分ほど登った四ツ辻で人波が薄まり、森の古さを感じられます。' +
      '稲荷神は米、酒、商売繁盛の神様。境内には狐像が至る所にあります。狐は稲荷神の使いとされています。' +
      '口に鍵をくわえた狐は米蔵の鍵。巻物を持つ狐は知恵の象徴。' +
      '山麓では狐うどんを試してみてください。狐の好物、甘く煮た油揚げが乗っています。' +
      '夜明けか夕暮れ後の参拝がおすすめ。人がほぼおらず、最も幻想的な光に包まれます。',
  },

  // 5. 金閣寺 — 京都クラシック、建築美
  {
    id: 'sample_kinkakuji',
    name: '金閣寺',
    name_en: 'Kinkakuji (Temple of the Golden Pavilion)',
    category: 'architecture',
    city: 'Kyoto',
    emoji: '🏯',
    latitude: 35.0394,
    longitude: 135.7292,
    tagline_en: 'A three-story pavilion covered in pure gold leaf',
    tagline_ja: '純金箔で覆われた三層の楼閣',
    description_en:
      "A Zen Buddhist temple whose top two floors are entirely covered in gold leaf. Originally built as a retirement villa for the shogun in 1397, now reflected in a mirror pond.",
    description_ja:
      '上の二層が金箔で覆われた禅宗の寺。1397年に将軍の隠居所として建てられ、鏡湖池に映ります。',
    audio_text_en:
      "You're looking at Kinkakuji, the Temple of the Golden Pavilion, one of Japan's most iconic images. " +
      "The top two floors are covered in pure gold leaf, designed to reflect perfectly on the mirror pond before you. " +
      "Originally built in 1397 as a retirement villa for the shogun Ashikaga Yoshimitsu, it was converted into a Zen Buddhist temple after his death. " +
      "Each of the three floors is a different architectural style: " +
      "the first floor in classical Heian residential style; " +
      "the second, samurai warrior style; " +
      "and the top, Chinese Zen style, crowned with a golden phoenix. " +
      "What you see today is a 1955 reconstruction. " +
      "In 1950, a young monk obsessed with the temple's beauty burned it down, an event later made famous by Yukio Mishima's novel. " +
      "The phoenix on top symbolized the pavilion's rebirth from ashes. " +
      "Walk the gardens clockwise, the traditional path, past the tea house and a stone statue where visitors toss coins for luck. " +
      "Visit early to beat the crowds and catch the gold glowing in morning light.",
    audio_text_ja:
      '目の前にあるのが金閣寺。日本で最も象徴的な景観の一つです。' +
      '上の二層は純金箔で覆われ、目の前の鏡湖池に完璧に映るよう設計されています。' +
      '1397年、将軍足利義満の隠居所として建てられ、義満没後に禅宗の寺に転じました。' +
      '各層は異なる建築様式です。' +
      '一層は平安時代の貴族住宅様式。' +
      '二層は武家様式。' +
      '最上層は中国禅宗様式で、頂部には金色の鳳凰が立ちます。' +
      '今見ている建物は1955年の再建です。' +
      '1950年、金閣寺の美しさに取り憑かれた若い僧侶が放火し、焼失しました。三島由紀夫の小説で広く知られる事件です。' +
      '頂部の鳳凰は灰からの再生の象徴です。' +
      '伝統的な順路に従い時計回りに庭園を巡ります。茶室と硬貨を投げる石仏を通り抜けます。' +
      '朝早い参拝がおすすめ。人波を避け、金箔が朝日に輝く瞬間を捉えられます。',
  },
];
