/**
 * Review Prompter (1.0.5)
 *
 * SKStoreReviewController を介した OS 標準のレビュー誘導ダイアログ。
 * App Store に遷移せず、アプリ内で完結する。Apple のルール:
 *   - 年に最大 3 回までしか実表示されない（OS 側が自動制御）
 *   - 過剰表示は逆効果なので、ユーザーが成功体験を得た直後にトリガーする
 *
 * 起動条件（複数満たした時のみ requestReview を呼ぶ）:
 *   - 起動 5 回以上
 *   - 累計使用 30 分以上
 *   - 音声ガイド再生 5 回以上
 *   - 最後の表示から 180 日以上経過
 *
 * 参考: docs/monetization.md §9 「ユーザーフィードバック収集の設計」
 */

import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// AsyncStorage キー
// ============================================================
const KEY_LAUNCH_COUNT      = 'rp_launch_count';
const KEY_TOTAL_USE_SEC     = 'rp_total_use_sec';
const KEY_AUDIO_PLAY_COUNT  = 'rp_audio_play_count';
const KEY_LAST_PROMPTED_AT  = 'rp_last_prompted_at';   // ISO datetime
const KEY_SESSION_START_AT  = 'rp_session_start_at';   // ISO datetime

// ============================================================
// 閾値
// ============================================================
const THRESHOLD_LAUNCH_COUNT     = 5;
const THRESHOLD_TOTAL_USE_SEC    = 30 * 60;  // 30 分
const THRESHOLD_AUDIO_PLAY_COUNT = 5;
const COOLDOWN_DAYS_AFTER_PROMPT = 180;

// ============================================================
// 公開 API
// ============================================================

/**
 * アプリ起動時に呼ぶ。起動回数 + セッション開始時刻を記録。
 */
export async function onAppLaunch(): Promise<void> {
  try {
    const count = parseInt((await AsyncStorage.getItem(KEY_LAUNCH_COUNT)) || '0', 10) + 1;
    await AsyncStorage.setItem(KEY_LAUNCH_COUNT, String(count));
    await AsyncStorage.setItem(KEY_SESSION_START_AT, new Date().toISOString());
  } catch {}
}

/**
 * アプリがバックグラウンドに遷移する時に呼ぶ。セッション時間を累積。
 */
export async function onAppBackground(): Promise<void> {
  try {
    const startedAtStr = await AsyncStorage.getItem(KEY_SESSION_START_AT);
    if (!startedAtStr) return;
    const startedAt = new Date(startedAtStr).getTime();
    const now = Date.now();
    const sessionSec = Math.max(0, Math.floor((now - startedAt) / 1000));
    if (sessionSec === 0) return;
    const total = parseInt((await AsyncStorage.getItem(KEY_TOTAL_USE_SEC)) || '0', 10) + sessionSec;
    await AsyncStorage.setItem(KEY_TOTAL_USE_SEC, String(total));
    await AsyncStorage.removeItem(KEY_SESSION_START_AT);
  } catch {}
}

/**
 * 音声ガイド再生回数を加算（音声開始時に呼ぶ）。
 */
export async function onAudioPlay(): Promise<void> {
  try {
    const count = parseInt((await AsyncStorage.getItem(KEY_AUDIO_PLAY_COUNT)) || '0', 10) + 1;
    await AsyncStorage.setItem(KEY_AUDIO_PLAY_COUNT, String(count));
  } catch {}
}

/**
 * 成功体験直後（音声ガイド完了時など）に呼ぶ。
 * 起動条件を満たしていれば SKStoreReviewController を呼び出す。
 *
 * Apple のルールで年 3 回までしか実表示されないため、呼んでも
 * 必ず出るとは限らない。OS 側に判断を委ねる設計。
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    // クールダウン
    const lastStr = await AsyncStorage.getItem(KEY_LAST_PROMPTED_AT);
    if (lastStr) {
      const last = new Date(lastStr).getTime();
      const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS_AFTER_PROMPT) return;
    }

    // 閾値判定（全部満たす必要あり = AND 条件）
    const launchCount = parseInt((await AsyncStorage.getItem(KEY_LAUNCH_COUNT)) || '0', 10);
    const totalSec    = parseInt((await AsyncStorage.getItem(KEY_TOTAL_USE_SEC)) || '0', 10);
    const audioCount  = parseInt((await AsyncStorage.getItem(KEY_AUDIO_PLAY_COUNT)) || '0', 10);

    if (launchCount < THRESHOLD_LAUNCH_COUNT) return;
    if (totalSec    < THRESHOLD_TOTAL_USE_SEC) return;
    if (audioCount  < THRESHOLD_AUDIO_PLAY_COUNT) return;

    // 全条件 OK → OS にレビュー誘導を依頼
    await StoreReview.requestReview();
    await AsyncStorage.setItem(KEY_LAST_PROMPTED_AT, new Date().toISOString());
  } catch {
    // 失敗してもユーザー体験に影響しない（致命的でない）
  }
}

/**
 * デバッグ・テスト用: 各カウンタの現状を取得
 */
export async function getCounters(): Promise<{
  launch: number;
  totalSec: number;
  audioPlay: number;
  lastPromptedAt: string | null;
}> {
  return {
    launch:    parseInt((await AsyncStorage.getItem(KEY_LAUNCH_COUNT)) || '0', 10),
    totalSec:  parseInt((await AsyncStorage.getItem(KEY_TOTAL_USE_SEC)) || '0', 10),
    audioPlay: parseInt((await AsyncStorage.getItem(KEY_AUDIO_PLAY_COUNT)) || '0', 10),
    lastPromptedAt: await AsyncStorage.getItem(KEY_LAST_PROMPTED_AT),
  };
}
