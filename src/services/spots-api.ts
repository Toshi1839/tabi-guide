import { supabase } from './supabase';
import { Spot, SpotCategory } from '../types';
import { SAMPLE_SPOTS } from '../data/sample-spots';
import { getDistance } from './location';

// Supabaseから近傍スポットを取得
export async function fetchNearbySpots(
  lat: number,
  lng: number,
  radiusM: number = 2000,
  categories?: SpotCategory[]
): Promise<Spot[]> {
  try {
    const { data, error } = await supabase.rpc('nearby_spots', {
      user_lat: lat,
      user_lng: lng,
      radius_m: radiusM,
      categories: categories && categories.length > 0 ? categories : null,
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return fallbackToLocal(lat, lng, radiusM, categories);
    }

    let spots = data || [];

    // レストランが2km以内にない場合、エリアトップ3を広範囲から取得
    if (categories?.includes('restaurant')) {
      const hasRestaurants = spots.some((s: any) => s.category === 'restaurant');
      if (!hasRestaurants) {
        const { data: topData } = await supabase.rpc('nearby_spots', {
          user_lat: lat,
          user_lng: lng,
          radius_m: 10000, // 10km範囲に拡大
          categories: ['restaurant'],
        });

        if (topData && topData.length > 0) {
          // is_area_top のものを優先、なければ距離順トップ3
          const areaTopSpots = topData
            .filter((s: any) => s.is_area_top)
            .slice(0, 10);
          const topSpots = areaTopSpots.length > 0 ? areaTopSpots : topData.slice(0, 10);
          spots = [...spots, ...topSpots];
        }
      }
    }

    if (spots.length === 0) {
      return fallbackToLocal(lat, lng, radiusM, categories);
    }

    return spots.map((row: any) => ({
      id: row.id,
      name: row.name,
      name_en: row.name_en,
      description: row.description,
      description_en: row.description_en,
      audio_text: row.audio_text,
      audio_text_en: row.audio_text_en,
      category: row.category as SpotCategory,
      latitude: row.latitude,
      longitude: row.longitude,
      radius: row.radius,
      image_url: row.image_url,
      address: row.address,
      opening_hours: row.opening_hours,
      rating: row.rating,
    }));
  } catch (e) {
    console.error('fetchNearbySpots error:', e);
    return fallbackToLocal(lat, lng, radiusM, categories);
  }
}

// オフライン時・エラー時のフォールバック
function fallbackToLocal(
  lat: number,
  lng: number,
  radiusM: number,
  categories?: SpotCategory[]
): Spot[] {
  return SAMPLE_SPOTS
    .filter((s) => !categories || categories.includes(s.category))
    .filter((s) => getDistance(lat, lng, s.latitude, s.longitude) <= radiusM)
    .sort(
      (a, b) =>
        getDistance(lat, lng, a.latitude, a.longitude) -
        getDistance(lat, lng, b.latitude, b.longitude)
    );
}
