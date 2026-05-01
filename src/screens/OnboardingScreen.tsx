import React, { useRef, useState } from 'react';
import { Analytics } from '../services/analytics';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

export const SURVEY_KEY = 'user_survey';

const { width } = Dimensions.get('window');

export const ONBOARDING_KEY = 'onboarding_completed';

interface Props {
  language: 'ja' | 'en';
  onComplete: () => void;
  isReplay?: boolean; // 使い方から再表示する場合はtrue（AsyncStorage書き込みをスキップ）
}

// ── スライド固有コンポーネント ──────────────────────────

function Slide1({ language }: { language: 'ja' | 'en' }) {
  const isJa = language === 'ja';
  return (
    <ScrollView
      style={styles.slideScroll}
      contentContainerStyle={styles.slideScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.icon}>🗾</Text>
      <Text style={styles.title}>
        {isJa ? 'AI街歩きガイドへようこそ' : 'Welcome to AI Street Guide'}
      </Text>
      <Text style={styles.description}>
        {isJa
          ? '歩くだけで、一歩踏み込んだ旅の体験を。'
          : 'Just walk and discover deeper travel experiences.'}
      </Text>
      <View style={styles.box}>
        <Text style={styles.boxSectionTitle}>
          {isJa ? '対象カテゴリ' : 'Categories'}
        </Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>🏯 {isJa ? '史跡・寺社' : 'History & Shrine'}</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>🗺️ {isJa ? '観光名所' : 'Attractions'}</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>🏛️ {isJa ? '文化遺産' : 'Heritage'}</Text></View>
          <View style={[styles.badge, styles.badgeOrange]}><Text style={styles.badgeText}>🍜 {isJa ? 'グルメ' : 'Food'}</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>🚻 {isJa ? 'トイレ' : 'Toilet'}</Text></View>
        </View>
        <Text style={[styles.boxSectionTitle, { marginTop: 14 }]}>
          {isJa ? '対象地域' : 'Coverage'}
        </Text>
        <Text style={styles.boxBodyText}>
          📍 {isJa ? '関東（東京・神奈川・埼玉・千葉・茨城・栃木・群馬）' : 'Kanto (Tokyo / Kanagawa / Saitama / Chiba / Ibaraki / Tochigi / Gunma)'}
          {'\n'}📍 {isJa ? '関西（大阪・京都・奈良）' : 'Kansai (Osaka / Kyoto / Nara)'}
          {'\n'}📍 {isJa ? '東海（名古屋）' : 'Tokai (Nagoya)'}
          {'\n'}📍 {isJa ? '北陸（金沢）' : 'Hokuriku (Kanazawa)'}
          {'\n'}📍 {isJa ? '東北（仙台・松島）' : 'Tohoku (Sendai / Matsushima)'}
          {'\n'}📍 {isJa ? '九州・中国（福岡・広島）' : 'Kyushu / Chugoku (Fukuoka / Hiroshima)'}
          {'\n'}📍 {isJa ? '北海道（札幌）' : 'Hokkaido (Sapporo)'}
        </Text>
        <View style={styles.boxDivider} />
        <Text style={styles.spotCount}>
          <Text style={styles.spotCountNum}>120,000+</Text>
          <Text style={styles.spotCountLabel}> {isJa ? 'スポット収録' : 'spots'}</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

function Slide2({ language }: { language: 'ja' | 'en' }) {
  const isJa = language === 'ja';
  return (
    <View style={styles.slide}>
      <Text style={styles.icon}>🔊</Text>
      <Text style={styles.title}>
        {isJa ? 'スポットに近づくと\n自動で音声ガイド' : 'Auto Audio Guide\nWhen You Approach'}
      </Text>
      <Text style={styles.description}>
        {isJa
          ? 'スポットの半径内に入ると、音声ガイドが自動で再生されます。スマホを見なくても、歩きながら情報が得られます。'
          : "Audio guides play automatically when you enter a spot's radius. Get information while walking without looking at your phone."}
      </Text>
      <View style={styles.box}>
        <Text style={styles.boxSectionTitle}>
          {isJa ? '表示範囲' : 'Display Range'}
        </Text>
        <Text style={styles.boxSubTitle}>
          {isJa
            ? '現在位置から下記半径の範囲のスポットのみ表示'
            : 'Only shows spots within the radius below from your location'}
        </Text>
        <View style={styles.planRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>📍 2km</Text></View>
          <Text style={styles.planText}>{isJa ? '史跡・寺社・観光名所・文化遺産' : 'History & Shrine / Attractions / Heritage'}</Text>
        </View>
        <View style={styles.planRow}>
          <View style={[styles.badge, styles.badgeOrange]}><Text style={styles.badgeText}>📍 5km〜</Text></View>
          <Text style={styles.planText}>{isJa ? 'グルメ（周辺に少ない場合は自動で範囲を拡大）' : 'Food (auto-expands if few nearby)'}</Text>
        </View>
        <View style={styles.planRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>📍 500m</Text></View>
          <Text style={styles.planText}>{isJa ? 'トイレ' : 'Toilet'}</Text>
        </View>
      </View>
    </View>
  );
}

function Slide3({ language }: { language: 'ja' | 'en' }) {
  const isJa = language === 'ja';
  return (
    <View style={styles.slide}>
      <Text style={styles.icon}>🤖</Text>
      <Text style={styles.title}>
        {isJa ? 'AIに質問しよう' : 'Ask the AI'}
      </Text>
      <Text style={styles.description}>
        {isJa
          ? '今いるスポットについてAIに質問できます。歴史・見どころ・グルメ情報など、深い知識を瞬時に。'
          : 'Ask the AI anything about the spot. History, highlights, food info — deep knowledge instantly.'}
      </Text>
      <View style={styles.box}>
        <View style={styles.claudeRow}>
          <Text style={styles.claudeEmoji}>🤝</Text>
          <Text style={styles.claudeText}>
            {isJa ? 'Anthropic社の ' : "Powered by Anthropic's "}
            <Text style={styles.claudeBold}>Claude</Text>
            {isJa ? ' を搭載。\n世界トップクラスのAIが回答します。' : '.\nWorld-class AI answers your questions.'}
          </Text>
        </View>
        <View style={styles.boxDivider} />
        <View style={styles.planRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>{isJa ? '無料' : 'Free'}</Text></View>
          <Text style={styles.planText}>{isJa ? '1日3回まで利用可能' : 'Up to 3 questions/day'}</Text>
        </View>
        <View style={styles.planRow}>
          <View style={[styles.badge, styles.badgePurple]}><Text style={styles.badgeText}>¥100/{isJa ? '月' : 'mo'}</Text></View>
          <Text style={styles.planText}>{isJa ? 'AIチャット無制限' : 'Unlimited AI chat'}</Text>
        </View>
      </View>
    </View>
  );
}

function Slide4({ language }: { language: 'ja' | 'en' }) {
  const isJa = language === 'ja';
  return (
    <View style={styles.slide}>
      <Text style={styles.icon}>🍜</Text>
      <Text style={styles.title}>
        {isJa ? 'プランについて' : 'Plans'}
      </Text>
      <View style={styles.box}>
        <View style={styles.planRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>{isJa ? '無料' : 'Free'}</Text></View>
          <Text style={styles.planText}>
            {isJa
              ? '全スポット＋ラーメン店情報\nGoogle Mapリンク付き'
              : 'All spots + Ramen shops\nWith Google Map links'}
          </Text>
        </View>
        <View style={styles.planRow}>
          <View style={[styles.badge, styles.badgeOrange]}><Text style={styles.badgeText}>¥500</Text></View>
          <Text style={styles.planText}>
            {isJa
              ? 'グルメパック：全ジャンル（カテゴリー選択可）\nグルメサイトの店舗情報＋リンク付き（買切）'
              : 'Gourmet Pack: All genres (selectable)\nRestaurant info + links (one-time)'}
          </Text>
        </View>
        <View style={styles.planRow}>
          <View style={[styles.badge, styles.badgePurple]}><Text style={styles.badgeText}>¥100/{isJa ? '月' : 'mo'}</Text></View>
          <Text style={styles.planText}>
            {isJa
              ? 'AIチャット無制限（独立オプション）'
              : 'Unlimited AI chat (standalone option)'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// アンケートスライド（マーケティング情報収集）
function Slide5Survey({ language, onAnswer }: { language: 'ja' | 'en'; onAnswer: (key: string, value: string) => void }) {
  const isJa = language === 'ja';
  const [travelStyle, setTravelStyle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [gender, setGender] = useState('');
  const [region, setRegion] = useState('');

  const styleOptions = isJa
    ? [{ v: 'solo', l: '一人旅' }, { v: 'couple', l: 'カップル' }, { v: 'family', l: '家族' }, { v: 'friends', l: '友人グループ' }]
    : [{ v: 'solo', l: 'Solo' }, { v: 'couple', l: 'Couple' }, { v: 'family', l: 'Family' }, { v: 'friends', l: 'Friends' }];

  const purposeOptions = isJa
    ? [{ v: 'sightseeing', l: '観光・史跡' }, { v: 'food', l: 'グルメ' }, { v: 'heritage', l: '文化遺産' }, { v: 'all', l: 'すべて' }]
    : [{ v: 'sightseeing', l: 'Sightseeing' }, { v: 'food', l: 'Food' }, { v: 'heritage', l: 'Heritage' }, { v: 'all', l: 'All' }];

  const ageOptions = isJa
    ? [{ v: 'teens', l: '10代' }, { v: '20s', l: '20代' }, { v: '30s', l: '30代' }, { v: '40s', l: '40代' }, { v: '50s', l: '50代' }, { v: '60s', l: '60代' }, { v: '70plus', l: '70代以上' }]
    : [{ v: 'teens', l: 'Teens' }, { v: '20s', l: '20s' }, { v: '30s', l: '30s' }, { v: '40s', l: '40s' }, { v: '50s', l: '50s' }, { v: '60s', l: '60s' }, { v: '70plus', l: '70+' }];

  const genderOptions = isJa
    ? [{ v: 'male', l: '男性' }, { v: 'female', l: '女性' }, { v: 'other', l: 'その他' }, { v: 'no_answer', l: '回答しない' }]
    : [{ v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }, { v: 'other', l: 'Other' }, { v: 'no_answer', l: 'No answer' }];

  const regionOptions = isJa
    ? [
        { v: 'kanto', l: '関東' }, { v: 'kansai', l: '関西' }, { v: 'chubu', l: '中部' },
        { v: 'kyushu', l: '九州' }, { v: 'tohoku', l: '東北' }, { v: 'hokkaido', l: '北海道' },
        { v: 'chugoku', l: '中国・四国' }, { v: 'overseas', l: '海外' },
      ]
    : [
        { v: 'kanto', l: 'Kanto' }, { v: 'kansai', l: 'Kansai' }, { v: 'chubu', l: 'Chubu' },
        { v: 'kyushu', l: 'Kyushu' }, { v: 'tohoku', l: 'Tohoku' }, { v: 'hokkaido', l: 'Hokkaido' },
        { v: 'chugoku', l: 'Chugoku/Shikoku' }, { v: 'overseas', l: 'Overseas' },
      ];

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ width, alignItems: 'center', paddingHorizontal: 36, paddingTop: 16, paddingBottom: 120 }}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
      scrollEventThrottle={16}
      bounces={true}
      directionalLockEnabled={true}
    >
      <Text style={styles.icon}>📊</Text>
      <Text style={styles.title}>
        {isJa ? 'あなたについて教えてください' : 'Tell Us About You'}
      </Text>
      <Text style={styles.description}>
        {isJa ? 'アプリ改善のためご協力ください（任意）' : 'Help us improve the app (optional)'}
      </Text>
      <View style={[styles.box, { width: '100%' }]}>
        {/* 年代 */}
        <Text style={styles.surveyQ}>{isJa ? '年代' : 'Age group'}</Text>
        <View style={styles.optionRow}>
          {ageOptions.map(o => (
            <TouchableOpacity key={o.v}
              style={[styles.optionBtn, ageGroup === o.v && styles.optionBtnActive]}
              onPress={() => { setAgeGroup(o.v); onAnswer('age_group', o.v); }}>
              <Text style={[styles.optionText, ageGroup === o.v && styles.optionTextActive]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* 性別 */}
        <Text style={[styles.surveyQ, { marginTop: 12 }]}>{isJa ? '性別' : 'Gender'}</Text>
        <View style={styles.optionRow}>
          {genderOptions.map(o => (
            <TouchableOpacity key={o.v}
              style={[styles.optionBtn, gender === o.v && styles.optionBtnActive]}
              onPress={() => { setGender(o.v); onAnswer('gender', o.v); }}>
              <Text style={[styles.optionText, gender === o.v && styles.optionTextActive]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* 居住地域 */}
        <Text style={[styles.surveyQ, { marginTop: 12 }]}>{isJa ? '住んでいる地域' : 'Where you live'}</Text>
        <View style={styles.optionRow}>
          {regionOptions.map(o => (
            <TouchableOpacity key={o.v}
              style={[styles.optionBtn, region === o.v && styles.optionBtnActive]}
              onPress={() => { setRegion(o.v); onAnswer('region', o.v); }}>
              <Text style={[styles.optionText, region === o.v && styles.optionTextActive]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* 旅行スタイル */}
        <Text style={[styles.surveyQ, { marginTop: 12 }]}>{isJa ? '旅行スタイル' : 'Travel style'}</Text>
        <View style={styles.optionRow}>
          {styleOptions.map(o => (
            <TouchableOpacity key={o.v}
              style={[styles.optionBtn, travelStyle === o.v && styles.optionBtnActive]}
              onPress={() => { setTravelStyle(o.v); onAnswer('travel_style', o.v); }}>
              <Text style={[styles.optionText, travelStyle === o.v && styles.optionTextActive]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* 主な目的 */}
        <Text style={[styles.surveyQ, { marginTop: 12 }]}>{isJa ? '主な目的' : 'Main purpose'}</Text>
        <View style={styles.optionRow}>
          {purposeOptions.map(o => (
            <TouchableOpacity key={o.v}
              style={[styles.optionBtn, purpose === o.v && styles.optionBtnActive]}
              onPress={() => { setPurpose(o.v); onAnswer('purpose', o.v); }}>
              <Text style={[styles.optionText, purpose === o.v && styles.optionTextActive]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Slide6({ language }: { language: 'ja' | 'en' }) {
  const isJa = language === 'ja';
  return (
    <View style={styles.slide}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.title}>
        {isJa ? '位置情報の許可' : 'Location Permission'}
      </Text>
      <Text style={styles.description}>
        {isJa
          ? '近くのスポットを検出するために、位置情報へのアクセスが必要です。\n\n次の画面で「常に許可」を選択してください。'
          : 'Location access is required to detect nearby spots.\n\nPlease select "Always Allow" on the next screen.'}
      </Text>
    </View>
  );
}

const SLIDE_KEYS = ['1', '2', '3', '4', '5', '6'];

// ── メインコンポーネント ──────────────────────────────

export default function OnboardingScreen({ language, onComplete, isReplay = false }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // flatListRef removed - using conditional rendering instead
  const surveyData = useRef<Record<string, string>>({});

  const isLast = currentIndex === SLIDE_KEYS.length - 1;

  const handleSurveyAnswer = (key: string, value: string) => {
    surveyData.current[key] = value;
  };

  const handleNext = async () => {
    if (isLast) {
      await handleComplete();
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  const handleComplete = async () => {
    if (!isReplay) {
      // アンケート結果を保存
      if (Object.keys(surveyData.current).length > 0) {
        await AsyncStorage.setItem(SURVEY_KEY, JSON.stringify(surveyData.current));
        Analytics.trackSurvey(surveyData.current);
      }
      // 初回のみ: 位置情報許可 + フラグ保存
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch {}
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    }
    onComplete();
  };

  const renderSlide = ({ item }: { item: string }) => {
    switch (item) {
      case '1': return <Slide1 language={language} />;
      case '2': return <Slide2 language={language} />;
      case '3': return <Slide3 language={language} />;
      case '4': return <Slide4 language={language} />;
      case '5': return <Slide5Survey language={language} onAnswer={handleSurveyAnswer} />;
      case '6': return <Slide6 language={language} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* スキップ / 閉じるボタン */}
      {!isLast && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>
            {isReplay
              ? (language === 'en' ? 'Close' : '閉じる')
              : (language === 'en' ? 'Skip' : 'スキップ')}
          </Text>
        </TouchableOpacity>
      )}

      {/* スライド（FlatList廃止、条件分岐で表示） */}
      <View style={styles.flatList}>
        {renderSlide({ item: SLIDE_KEYS[currentIndex], index: currentIndex })}
      </View>

      {/* ページインジケーター */}
      <View style={styles.dotsContainer}>
        {SLIDE_KEYS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* ボタン */}
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>
          {isLast
            ? (language === 'en' ? (isReplay ? 'Close' : 'Get Started') : (isReplay ? '閉じる' : 'はじめる'))
            : (language === 'en' ? 'Next' : '次へ')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ── スタイル ─────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: 16,
    marginTop: 8,
    marginRight: 8,
  },
  skipText: {
    color: '#90A4AE',
    fontSize: 16,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 24,
  },
  slideScroll: {
    width,
    flex: 1,
  },
  slideScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    paddingHorizontal: 36,
    paddingBottom: 24,
  },
  icon: {
    fontSize: 88,
    marginBottom: 24,
    lineHeight: 100,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2B4A',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 32,
  },
  description: {
    fontSize: 15,
    color: '#455A64',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 8,
  },
  // ── ボックス ──
  box: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  boxSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 8,
  },
  boxSubTitle: {
    fontSize: 11,
    color: '#90A4AE',
    marginBottom: 10,
  },
  boxBodyText: {
    fontSize: 13,
    color: '#455A64',
    lineHeight: 22,
  },
  boxDivider: {
    height: 1,
    backgroundColor: '#E0F0F0',
    marginVertical: 12,
  },
  // ── アンケート ──
  surveyQ: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  optionBtnActive: {
    borderColor: '#4DBFBD',
    backgroundColor: '#E0F7F7',
  },
  optionText: {
    fontSize: 13,
    color: '#64748B',
  },
  optionTextActive: {
    color: '#1A2B4A',
    fontWeight: '600',
  },
  // ── バッジ ──
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#4DBFBD',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeOrange: {
    backgroundColor: '#FF8C42',
  },
  badgePurple: {
    backgroundColor: '#7C4DFF',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  // ── プラン行 ──
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  planText: {
    fontSize: 14,
    color: '#455A64',
    lineHeight: 20,
    flex: 1,
  },
  // ── Claude行 ──
  claudeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  claudeEmoji: {
    fontSize: 18,
    marginTop: 2,
  },
  claudeText: {
    fontSize: 13,
    color: '#455A64',
    lineHeight: 20,
    flex: 1,
  },
  claudeBold: {
    fontWeight: '700',
    color: '#1A2B4A',
  },
  // ── スポット数 ──
  spotCount: {
    textAlign: 'center',
  },
  spotCountNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4DBFBD',
  },
  spotCountLabel: {
    fontSize: 13,
    color: '#455A64',
  },
  // ── ナビゲーション ──
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  dotActive: {
    backgroundColor: '#4DBFBD',
    width: 26,
  },
  dotInactive: {
    backgroundColor: '#B0BEC5',
    width: 10,
  },
  nextButton: {
    backgroundColor: '#4DBFBD',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 30,
    marginBottom: 36,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});
