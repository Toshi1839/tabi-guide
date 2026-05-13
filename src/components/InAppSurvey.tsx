/**
 * InAppSurvey (1.0.5)
 *
 * 継続的アンケート（ハイブリッド型・3問・30秒）。
 * 起動 10 回目に表示、スキップまたは回答後 90 日は再表示しない。
 *
 * 質問:
 *   Q1. 友人にすすめますか？（NPS 型）
 *   Q2. 一番使った機能は？（複数選択）
 *   Q3. もっと欲しい機能・改善点（自由記述、任意）
 *
 * 保存先: Supabase analytics_events, event_type='in_app_survey'
 *
 * 参考: docs/monetization.md §9
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Analytics } from '../services/analytics';

// AsyncStorage キー
const KEY_LAUNCH_COUNT_FOR_SURVEY = 'ias_launch_count';
const KEY_LAST_INTERACTED_AT      = 'ias_last_interacted_at'; // 回答 or スキップ時刻

// 設定値
const LAUNCH_THRESHOLD = 10;
const COOLDOWN_DAYS    = 90;

type NPS = 'recommend' | 'neutral' | 'not_recommend' | null;
type Feature = 'audio' | 'map' | 'restaurant' | 'ai_chat' | 'sample_tour' | 'browse';

interface Props {
  language: 'ja' | 'en';
}

// ============================================================
// 起動時に呼ぶ: 起動回数を加算し、表示すべきかを判定
// ============================================================
export async function shouldShowSurvey(): Promise<boolean> {
  try {
    const count = parseInt((await AsyncStorage.getItem(KEY_LAUNCH_COUNT_FOR_SURVEY)) || '0', 10) + 1;
    await AsyncStorage.setItem(KEY_LAUNCH_COUNT_FOR_SURVEY, String(count));

    if (count < LAUNCH_THRESHOLD) return false;

    // クールダウン判定
    const lastStr = await AsyncStorage.getItem(KEY_LAST_INTERACTED_AT);
    if (lastStr) {
      const daysSince = (Date.now() - new Date(lastStr).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS) return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function InAppSurvey({ language }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [nps, setNps] = useState<NPS>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [comment, setComment] = useState('');

  // マウント時に表示判定
  useEffect(() => {
    shouldShowSurvey().then(setVisible);
  }, []);

  const t = language === 'en'
    ? {
        title: 'Quick 30-second survey',
        subtitle: 'Your feedback helps us improve',
        q1: 'Would you recommend this app to a friend?',
        q1_yes: '😊 Yes',
        q1_neutral: '😐 Maybe',
        q1_no: '😞 Not really',
        q2: 'Which feature did you use most? (multiple OK)',
        f_audio: 'Audio guide',
        f_map: 'Map / spot finder',
        f_restaurant: 'Restaurant search',
        f_ai_chat: 'AI chat',
        f_sample_tour: 'Sample tour',
        f_browse: 'Browse all sites',
        q3: 'What would you like to see added or improved? (optional)',
        commentPlaceholder: 'Your suggestions...',
        skip: 'Skip',
        next: 'Next',
        submit: 'Submit',
        thanks: 'Thanks for your feedback! 🙏',
      }
    : {
        title: '30秒アンケート',
        subtitle: 'ご意見をアプリ改善に活用させていただきます',
        q1: 'このアプリを友人にすすめますか？',
        q1_yes: '😊 すすめる',
        q1_neutral: '😐 どちらでも',
        q1_no: '😞 すすめない',
        q2: '一番使った機能は？（複数選択可）',
        f_audio: '音声ガイド',
        f_map: '地図でスポット探し',
        f_restaurant: 'レストラン検索',
        f_ai_chat: 'AIチャット',
        f_sample_tour: 'サンプル音声ガイド',
        f_browse: '一覧から探す',
        q3: 'もっと欲しい機能・改善点は？（任意）',
        commentPlaceholder: '自由記述...',
        skip: 'スキップ',
        next: '次へ',
        submit: '送信',
        thanks: 'ご回答ありがとうございました 🙏',
      };

  const toggleFeature = (f: Feature) => {
    setFeatures(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const markInteracted = async () => {
    try {
      await AsyncStorage.setItem(KEY_LAST_INTERACTED_AT, new Date().toISOString());
    } catch {}
  };

  const handleSkip = async () => {
    await markInteracted();
    Analytics.trackEvent('in_app_survey', { action: 'skipped', step });
    setVisible(false);
  };

  const handleSubmit = async () => {
    await markInteracted();
    Analytics.trackEvent('in_app_survey', {
      action: 'submitted',
      nps,
      features,
      comment_len: comment.trim().length,
      comment: comment.trim().slice(0, 500),
    });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleSkip}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <ScrollView>
            <View style={styles.header}>
              <Text style={styles.title}>{t.title}</Text>
              <TouchableOpacity onPress={handleSkip}>
                <Text style={styles.skip}>{t.skip}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>{t.subtitle}</Text>
            <View style={styles.progress}>
              <View style={[styles.progressBar, { width: `${step * 33}%` }]} />
            </View>

            {step === 1 && (
              <>
                <Text style={styles.question}>{t.q1}</Text>
                <View style={styles.npsRow}>
                  {([['recommend', t.q1_yes], ['neutral', t.q1_neutral], ['not_recommend', t.q1_no]] as const).map(
                    ([v, label]) => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.npsButton, nps === v && styles.npsButtonActive]}
                        onPress={() => setNps(v as NPS)}
                      >
                        <Text style={[styles.npsText, nps === v && styles.npsTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.nextButton, !nps && styles.nextButtonDisabled]}
                  onPress={() => nps && setStep(2)}
                  disabled={!nps}
                >
                  <Text style={styles.nextButtonText}>{t.next}</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.question}>{t.q2}</Text>
                {([
                  ['audio', t.f_audio],
                  ['map', t.f_map],
                  ['restaurant', t.f_restaurant],
                  ['ai_chat', t.f_ai_chat],
                  ['sample_tour', t.f_sample_tour],
                  ['browse', t.f_browse],
                ] as const).map(([v, label]) => {
                  const active = features.includes(v as Feature);
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[styles.checkRow, active && styles.checkRowActive]}
                      onPress={() => toggleFeature(v as Feature)}
                    >
                      <Text style={styles.checkBox}>{active ? '☑️' : '⬜'}</Text>
                      <Text style={[styles.checkLabel, active && styles.checkLabelActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.nextButton} onPress={() => setStep(3)}>
                  <Text style={styles.nextButtonText}>{t.next}</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.question}>{t.q3}</Text>
                <TextInput
                  style={styles.input}
                  multiline
                  numberOfLines={4}
                  placeholder={t.commentPlaceholder}
                  placeholderTextColor="#A6B0C2"
                  value={comment}
                  onChangeText={setComment}
                  maxLength={500}
                />
                <TouchableOpacity style={styles.nextButton} onPress={handleSubmit}>
                  <Text style={styles.nextButtonText}>{t.submit}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A2230' },
  skip: { fontSize: 14, color: '#7A8492' },
  subtitle: { fontSize: 13, color: '#7A8492', marginTop: 4 },
  progress: {
    height: 4,
    backgroundColor: '#EEF1F5',
    borderRadius: 2,
    marginTop: 14,
    marginBottom: 18,
    overflow: 'hidden',
  },
  progressBar: { height: 4, backgroundColor: '#4361ee', borderRadius: 2 },

  question: { fontSize: 16, fontWeight: '600', color: '#1A2230', marginBottom: 14 },
  npsRow: { gap: 8, marginBottom: 6 },
  npsButton: {
    paddingVertical: 14,
    backgroundColor: '#F3F5F8',
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 4,
  },
  npsButtonActive: { backgroundColor: '#4361ee' },
  npsText: { fontSize: 15, color: '#1A2230', fontWeight: '500' },
  npsTextActive: { color: '#FFFFFF', fontWeight: '700' },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F3F5F8',
    borderRadius: 10,
    marginVertical: 4,
  },
  checkRowActive: { backgroundColor: '#E0E8FF' },
  checkBox: { fontSize: 18, marginRight: 10 },
  checkLabel: { fontSize: 15, color: '#1A2230' },
  checkLabelActive: { color: '#1A2230', fontWeight: '600' },

  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#D7DCE2',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1A2230',
    textAlignVertical: 'top',
  },

  nextButton: {
    marginTop: 22,
    backgroundColor: '#4361ee',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: { backgroundColor: '#C9CFD8' },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
