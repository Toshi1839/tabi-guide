import { supabase } from './supabase';
import { Spot, SpotCategory } from '../types';
import { SAMPLE_SPOTS } from '../data/sample-spots';
import { getDistance } from './location';

// Supabaseから近傍スポットを取得
// shrine_history → historical + temple に展開
function expandCategories(categories?: SpotCategory[]): string[] | null {
  if (!categories || categories.length === 0) return null;
  const expanded: string[] = [];
  for (const cat of categories) {
    if (cat === 'shrine_history') {
      expanded.push('historical', 'temple');
    } else if (cat === 'attraction') {
      expanded.push('nature', 'museum', 'viewpoint');
    } else {
      expanded.push(cat);
    }
  }
  return expanded;
}

export async function fetchNearbySpots(
  lat: number,
  lng: number,
  radiusM: number = 2000,
  categories?: SpotCategory[]
): Promise<Spot[]> {
  try {
    const expandedCategories = expandCategories(categories);
    const { data, error } = await supabase.rpc('nearby_spots', {
      user_lat: lat,
      user_lng: lng,
      radius_m: radiusM,
      categories: expandedCategories,
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return fallbackToLocal(lat, lng, radiusM, categories);
    }

    let spots = data || [];

    // レストランは5km範囲で追加取得
    if (categories?.includes('restaurant')) {
      const restaurantsIn2km = spots.filter((s: any) => s.category === 'restaurant');

      if (restaurantsIn2km.length < 3) {
        // 5km範囲でレストランを追加取得
        const { data: widerData } = await supabase.rpc('nearby_spots', {
          user_lat: lat,
          user_lng: lng,
          radius_m: 5000,
          categories: ['restaurant'],
        });

        if (widerData && widerData.length > 0) {
          const existingIds = new Set(spots.map((s: any) => s.id));
          const newSpots = widerData.filter((s: any) => !existingIds.has(s.id));
          spots = [...spots, ...newSpots];
        }

        // 5km以内にもない場合、10km範囲のトップ10
        const totalRestaurants = spots.filter((s: any) => s.category === 'restaurant').length;
        if (totalRestaurants === 0) {
          const { data: topData } = await supabase.rpc('nearby_spots', {
            user_lat: lat,
            user_lng: lng,
            radius_m: 10000,
            categories: ['restaurant'],
          });

          if (topData && topData.length > 0) {
            const areaTopSpots = topData
              .filter((s: any) => s.is_area_top)
              .slice(0, 10);
            const topSpots = areaTopSpots.length > 0 ? areaTopSpots : topData.slice(0, 10);
            const existingIds = new Set(spots.map((s: any) => s.id));
            const newTopSpots = topSpots.filter((s: any) => !existingIds.has(s.id));
            spots = [...spots, ...newTopSpots];
          }
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
      // historical・templeはアプリ上でshrine_historyに統合
      category: (row.category === 'historical' || row.category === 'temple')
        ? 'shrine_history' as SpotCategory
        : (row.category === 'nature' || row.category === 'museum' || row.category === 'viewpoint')
        ? 'attraction' as SpotCategory
        : row.category as SpotCategory,
      latitude: row.latitude,
      longitude: row.longitude,
      radius: row.radius,
      image_url: row.image_url,
      address: row.address,
      opening_hours: row.opening_hours,
      rating: row.rating,
      tabelog_url: row.tabelog_url,
      audio_url: row.audio_url,
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
  const expanded = expandCategories(categories);
  return SAMPLE_SPOTS
    .filter((s) => !expanded || expanded.includes(s.category))
    .map((s) => ({
      ...s,
      category: (s.category === 'historical' || s.category === 'temple')
        ? 'shrine_history' as SpotCategory
        : (s.category === 'nature' || s.category === 'museum' || s.category === 'viewpoint')
        ? 'attraction' as SpotCategory
        : s.category,
    }))
    .filter((s) => getDistance(lat, lng, s.latitude, s.longitude) <= radiusM)
    .sort(
      (a, b) =>
        getDistance(lat, lng, a.latitude, a.longitude) -
        getDistance(lat, lng, b.latitude, b.longitude)
    );
}
