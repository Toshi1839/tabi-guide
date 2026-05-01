// スポットのカテゴリ
export type SpotCategory =
  | 'historical'    // 史跡・歴史的建造物
  | 'restaurant'    // レストラン・飲食店
  | 'shopping'      // ショッピング
  | 'nature'        // 自然・公園
  | 'temple'        // 寺社仏閣
  | 'museum'        // 美術館・博物館
  | 'entertainment' // エンターテイメント
  | 'viewpoint'     // 展望・景観スポット
  | 'heritage'      // 文化遺産
  | 'toilet'        // トイレ・公衆便所
  | 'shrine_history' // 史跡・寺社（統合カテゴリ）
  | 'attraction';   // 観光名所（nature + museum + viewpoint 統合カテゴリ）

export interface CategoryInfo {
  id: SpotCategory;
  label: string;
  label_en: string;
  icon: string; // emoji for MVP, replace with icons later
}

// スポットデータ
export interface Spot {
  id: string;
  name: string;
  name_en?: string;
  description: string;
  description_en?: string;
  audio_text: string;        // TTS用のガイドテキスト
  audio_text_en?: string;
  category: SpotCategory;
  latitude: number;
  longitude: number;
  radius: number;            // ジオフェンス半径（メートル）
  image_url?: string;
  address?: string;
  opening_hours?: string;
  rating?: number;
  tabelog_url?: string;
  audio_url?: string;      // WaveNet TTS音声ファイルURL
  _isFallback?: boolean;   // 半径拡大フォールバックで取得（ジャンルフィルタースキップ用）
  _isCraftBeer?: boolean;  // Google Places APIから取得したクラフトビール店
}

// ユーザーの選択状態
export interface UserPreferences {
  selectedCategories: SpotCategory[];
  notificationRadius: number;  // 通知距離（メートル）
  audioEnabled: boolean;
  language: 'ja' | 'en';
}

// ジオフェンスイベント
export interface GeofenceEvent {
  spot: Spot;
  timestamp: number;
  type: 'enter' | 'exit';
}

// 訪問履歴
export interface VisitRecord {
  spotId: string;
  spot: Spot;
  visitedAt: number;
}
