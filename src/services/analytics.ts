import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'analytics_device_id';

// 匿名デバイスID（初回起動時に生成、以降固定）
async function getDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

// イベント送信（非同期、エラーは無視）
async function trackEvent(eventType: string, eventData: Record<string, any> = {}): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await supabase.from('analytics_events').insert({
      device_id: deviceId,
      event_type: eventType,
      event_data: eventData,
    });
  } catch {
    // アナリティクスのエラーはアプリに影響させない
  }
}

export const Analytics = {
  // アンケート回答
  trackSurvey(data: Record<string, string>) {
    trackEvent('survey', data);
  },

  // グルメパック購入
  trackGourmetPurchase() {
    trackEvent('purchase_gourmet');
  },

  // AIチャットサブスク購入
  trackAiChatPurchase() {
    trackEvent('purchase_aichat');
  },

  // スポット閲覧
  trackSpotView(spot: { name: string; category: string; latitude: number; longitude: number }) {
    trackEvent('spot_view', {
      name: spot.name,
      category: spot.category,
      lat: spot.latitude,
      lng: spot.longitude,
    });
  },

  // カテゴリ選択（ガイド開始時）
  trackGuideStart(categories: string[], genres: string[]) {
    trackEvent('guide_start', { categories, genres });
  },

  // アプリ起動
  trackAppLaunch() {
    trackEvent('app_launch');
  },

  // ===== 1.0.5: Tonight in Tokyo（音楽ライブセクション）=====

  // 観光/音楽 モード切替
  trackModeSwitch(mode: 'sightseeing' | 'music') {
    trackEvent('mode_switch', { mode });
  },

  // 音楽会場の公式サイト遷移
  trackMusicScheduleClick(venue: { id: string; name: string; category: string }) {
    trackEvent('schedule_url_click', venue);
  },

  // 音楽会場の Maps 遷移
  trackMusicMapsClick(venue: { id: string; name: string; category: string }) {
    trackEvent('maps_click', venue);
  },

  // 音楽会場への電話発信
  trackMusicCallClick(venue: { id: string; name: string; category: string }) {
    trackEvent('call_click', venue);
  },

  // 音楽会場フィルタ操作
  trackMusicFilter(filters: { distance_km?: number; categories?: string[]; tonight_only?: boolean }) {
    trackEvent('music_filter', filters);
  },

  // 任意イベント（拡張用）
  trackEvent(eventType: string, eventData: Record<string, any> = {}) {
    trackEvent(eventType, eventData);
  },
};
