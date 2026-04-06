import { CategoryInfo } from '../types';

export interface GenreInfo {
  id: string;
  label: string;
  label_en: string;
  icon: string;
}

export const RESTAURANT_GENRES: GenreInfo[] = [
  { id: 'washoku',    label: '和食',           label_en: 'Japanese',    icon: '🍱' },
  { id: 'sushi',      label: '寿司',           label_en: 'Sushi',       icon: '🍣' },
  { id: 'soba',       label: '蕎麦・うどん',   label_en: 'Soba/Udon',  icon: '🍵' },
  { id: 'ramen',      label: 'ラーメン',       label_en: 'Ramen',       icon: '🍜' },
  { id: 'yakiniku',   label: '焼肉',           label_en: 'BBQ',         icon: '🥩' },
  { id: 'yakitori',   label: '焼き鳥',         label_en: 'Yakitori',    icon: '🍗' },
  { id: 'izakaya',    label: '居酒屋',         label_en: 'Izakaya',     icon: '🍺' },
  { id: 'chinese',    label: '中華',           label_en: 'Chinese',     icon: '🥟' },
  { id: 'italian',    label: 'イタリアン',     label_en: 'Italian',     icon: '🍝' },
  { id: 'french',     label: 'フレンチ',       label_en: 'French',      icon: '🥂' },
  { id: 'ethnic',     label: 'エスニック',     label_en: 'Ethnic',      icon: '🌏' },
  { id: 'cafe',       label: 'カフェ',         label_en: 'Cafe',        icon: '☕' },
  { id: 'sweets',     label: 'スイーツ',       label_en: 'Sweets',      icon: '🍰' },
  { id: 'craft_beer',  label: 'クラフトビール', label_en: 'Craft Beer',  icon: '🍺' },
  { id: 'vegetarian', label: 'ベジタリアン',   label_en: 'Vegetarian',  icon: '🥗' },
  { id: 'other',      label: 'その他',         label_en: 'Other',       icon: '🍽️' },
];

export const CATEGORIES: CategoryInfo[] = [
  { id: 'shrine_history', label: '史跡・寺社', label_en: 'History & Shrine', icon: '🏯' },
  { id: 'attraction',     label: '観光名所',   label_en: 'Attractions',     icon: '🗺️' },
  { id: 'restaurant',     label: 'グルメ',     label_en: 'Food',            icon: '🍜' },
  { id: 'heritage',       label: '文化遺産',   label_en: 'Heritage',        icon: '🏛️' },
];
