/**
 * Music Venues API
 *
 * Supabase の `music_venues` テーブルから RPC `nearby_music_venues` 経由で
 * ユーザー位置から距離順に会場を取得する。
 *
 * 1.0.5 (Tonight in Tokyo) で導入。
 * 参考: docs/monetization.md セクション 5
 *      supabase/migrations/20260506000001_create_music_venues.sql
 */

import { supabase } from './supabase';

export type MusicCategory =
  | 'classical'
  | 'jazz_live'
  | 'vinyl_bar'
  | 'live_house'
  | 'free_concert'
  | 'hougaku';

export const ALL_MUSIC_CATEGORIES: MusicCategory[] = [
  'classical',
  'jazz_live',
  'vinyl_bar',
  'live_house',
  'free_concert',
  'hougaku',
];

export interface MusicVenue {
  id: string;
  category: MusicCategory;
  name: string;
  name_en: string;
  address: string | null;
  ward: string | null;
  latitude: number;
  longitude: number;
  official_url: string | null;
  phone: string | null;
  cover_min: number | null;
  cover_max: number | null;
  walk_in: 'high' | 'medium' | 'low' | null;
  description_ja: string | null;
  description_en: string | null;
  genre_tags: string | null;
  distance_m: number;
}

export interface FetchOptions {
  userLat: number;
  userLng: number;
  radiusMeters?: number;
  categories?: MusicCategory[]; // undefined / 空配列 = 全カテゴリ
  limit?: number;
}

export async function fetchNearbyMusicVenues(opts: FetchOptions): Promise<MusicVenue[]> {
  const { userLat, userLng, radiusMeters = 30000, categories, limit = 100 } = opts;

  const { data, error } = await supabase.rpc('nearby_music_venues', {
    user_lat: userLat,
    user_lng: userLng,
    radius_meters: radiusMeters,
    categories: categories && categories.length > 0 ? categories : null,
    result_limit: limit,
  });

  if (error) {
    console.warn('[music-venues-api] fetchNearbyMusicVenues error:', error.message);
    return [];
  }

  return (data ?? []) as MusicVenue[];
}

// カテゴリ表示用ラベル（言語別）
export function categoryLabel(category: MusicCategory, language: 'ja' | 'en'): string {
  const ja: Record<MusicCategory, string> = {
    classical: 'クラシック',
    jazz_live: 'ジャズ',
    vinyl_bar: 'レコードバー',
    live_house: 'ライブハウス',
    free_concert: '無料コンサート',
    hougaku: '邦楽',
  };
  const en: Record<MusicCategory, string> = {
    classical: 'Classical',
    jazz_live: 'Jazz Live',
    vinyl_bar: 'Vinyl Bar',
    live_house: 'Live House',
    free_concert: 'Free Concert',
    hougaku: 'Hougaku',
  };
  return language === 'en' ? en[category] : ja[category];
}

export function categoryIcon(category: MusicCategory): string {
  const map: Record<MusicCategory, string> = {
    classical: '🎻',
    jazz_live: '🎷',
    vinyl_bar: '🎵',
    live_house: '🎸',
    free_concert: '🆓',
    hougaku: '🎭',
  };
  return map[category];
}

// 料金表示文字列
export function coverChargeLabel(
  v: Pick<MusicVenue, 'cover_min' | 'cover_max'>,
  language: 'ja' | 'en'
): string {
  const { cover_min, cover_max } = v;
  if (cover_min === null && cover_max === null) {
    return language === 'en' ? 'Cover unknown' : '料金不明';
  }
  if ((cover_min === 0 && cover_max === 0) || (cover_min === 0 && cover_max === null)) {
    return language === 'en' ? 'Free' : '無料';
  }
  const fmt = (n: number) =>
    language === 'en' ? `¥${n.toLocaleString('en-US')}` : `¥${n.toLocaleString('ja-JP')}`;
  if (cover_min !== null && cover_max !== null && cover_min !== cover_max) {
    return `${fmt(cover_min)} - ${fmt(cover_max)}`;
  }
  if (cover_min !== null) return fmt(cover_min);
  if (cover_max !== null) return fmt(cover_max);
  return '';
}

// 距離表示文字列（メートル → m / km）
export function distanceLabel(meters: number, language: 'ja' | 'en'): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return language === 'en' ? `${km.toFixed(1)} km` : `${km.toFixed(1)} km`;
}
