/**
 * App Mode service
 *
 * 観光モード / 音楽モード の切替状態を AsyncStorage に永続化。
 * 1.0.5 の音楽ライブセクション「Tonight in Tokyo」で導入。
 *
 * 参考: docs/monetization.md セクション 5
 *      /Volumes/Toshi SSD/開発/収益拡大戦略/UI提案/music-section-ui-1.0.5.pptx (Slide 2)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppMode = 'sightseeing' | 'music';

export const DEFAULT_APP_MODE: AppMode = 'sightseeing';

const STORAGE_KEY = 'app_mode_v1';

export async function loadAppMode(): Promise<AppMode> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    if (val === 'music') return 'music';
    return 'sightseeing';
  } catch {
    return DEFAULT_APP_MODE;
  }
}

export async function saveAppMode(mode: AppMode): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // 失敗しても致命的ではない（UI 上は反映済み、次回起動時にデフォルト復帰）
  }
}
