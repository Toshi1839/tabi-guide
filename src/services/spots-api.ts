import { supabase } from './supabase';
import { Spot, SpotCategory } from '../types';
import { SAMPLE_SPOTS } from '../data/sample-spots';
import { getDistance } from './location';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || '';

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

    // レストランは最低10件を確保（段階的に半径拡大）
    const MIN_RESTAURANTS = 10;
    if (categories?.includes('restaurant')) {
      const currentRestaurants = spots.filter((s: any) => s.category === 'restaurant');

      if (currentRestaurants.length < MIN_RESTAURANTS) {
        // 段階的に半径を拡大して最低10件を確保
        const expandRadii = [10000, 20000, 30000];
        for (const r of expandRadii) {
          if (r <= radiusM) continue; // 既に検索済みの半径はスキップ
          const restaurantCount = spots.filter((s: any) => s.category === 'restaurant').length;
          if (restaurantCount >= MIN_RESTAURANTS) break;

          const { data: widerData } = await supabase.rpc('nearby_spots', {
            user_lat: lat,
            user_lng: lng,
            radius_m: r,
            categories: ['restaurant'],
          });

          if (widerData && widerData.length > 0) {
            const existingIds = new Set(spots.map((s: any) => s.id));
            const newSpots = widerData.filter((s: any) => !existingIds.has(s.id));
            spots = [...spots, ...newSpots];
          }
        }

        // 評価順にソートし、3.5以上を優先 → 不足分を3.5未満で補充
        const restaurants = spots.filter((s: any) => s.category === 'restaurant');
        const getRating = (s: any) => s.rating || s.tabelog_rating || 0;
        const above35 = restaurants.filter((s: any) => getRating(s) >= 3.5)
          .sort((a: any, b: any) => getRating(b) - getRating(a));
        const below35 = restaurants.filter((s: any) => getRating(s) < 3.5)
          .sort((a: any, b: any) => getRating(b) - getRating(a));
        const topRestaurants = [...above35, ...below35].slice(0, Math.max(MIN_RESTAURANTS, above35.length));
        const topIds = new Set(topRestaurants.map((s: any) => s.id));

        // レストラン以外のスポット + 選別されたレストラン
        const nonRestaurants = spots.filter((s: any) => s.category !== 'restaurant');
        // フォールバックで取得したレストランにフラグを付与
        const originalIds = new Set((data || []).filter((s: any) => s.category === 'restaurant').map((s: any) => s.id));
        const selectedRestaurants = topRestaurants.map((s: any) => ({
          ...s,
          _isFallback: !originalIds.has(s.id),
        }));
        spots = [...nonRestaurants, ...selectedRestaurants];
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

// Google Places APIでクラフトビール店を検索
// 単一クエリ「クラフトビール ビアバー ブルワリー」だとlocationBias下でも全国上位が返り
// ローカル店がtop20に入らない問題があるため、3クエリに分けて結果をマージする
export async function fetchCraftBeerSpots(
  lat: number,
  lng: number,
  radiusM: number = 5000
): Promise<Spot[]> {
  if (!GOOGLE_API_KEY) return [];

  const queries = ['クラフトビール', 'ビアバー', 'ブルワリー'];

  async function searchOne(query: string): Promise<any[]> {
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri,places.editorialSummary',
        },
        body: JSON.stringify({
          textQuery: query,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radiusM,
            },
          },
          languageCode: 'ja',
          maxResultCount: 20,
        }),
      });
      const data = await response.json();
      return data.places || [];
    } catch (e) {
      console.warn(`fetchCraftBeerSpots[${query}] error:`, e);
      return [];
    }
  }

  try {
    const results = await Promise.all(queries.map(q => searchOne(q)));
    const merged = new Map<string, any>();
    for (const list of results) {
      for (const p of list) {
        if (!p.id || !p.location) continue;
        const dist = getDistance(lat, lng, p.location.latitude, p.location.longitude);
        if (dist > radiusM) continue;
        if (!merged.has(p.id)) merged.set(p.id, p);
      }
    }
    return [...merged.values()].map((p: any) => ({
      id: `gp_craft_${p.id}`,
      name: p.displayName?.text || '',
      description: `クラフトビール・ビアバー。${p.rating ? `Google ${p.rating}` : ''}`,
      audio_text: p.editorialSummary?.text || `${p.displayName?.text || ''}はクラフトビールが楽しめるお店です。`,
      category: 'restaurant' as SpotCategory,
      latitude: p.location.latitude,
      longitude: p.location.longitude,
      radius: 100,
      address: p.formattedAddress,
      rating: p.rating,
      tabelog_url: p.googleMapsUri,
      _isCraftBeer: true,
    }));
  } catch (e) {
    console.warn('fetchCraftBeerSpots error:', e);
    return [];
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
