/**
 * BrowseScreen — 1.0.5 のリテンション改善 第二の柱
 *
 * 「位置情報なしでスポット一覧を閲覧できる」UX。
 * 旅行前の下調べ用途を生み、認知価値とリテンションを両立する。
 *
 * 構成:
 *   - 上部タブ: By City / By Category
 *   - By City: 主要 8 都市から選択 → その都市近辺のスポット一覧
 *   - By Category: 7 カテゴリから選択 → 各都市横断のトップスポット一覧
 *   - スポットタップ → 詳細＋音声ガイド再生（位置情報不要）
 *
 * 参考: docs/monetization.md §9
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchNearbySpots } from '../services/spots-api';
import { SpeechService } from '../services/speech';
import { Analytics } from '../services/analytics';
import { Spot, SpotCategory } from '../types';

interface Props {
  language: 'ja' | 'en';
  onClose: () => void;
}

// 主要 8 都市 — 訪日外国人の目的地として代表的なもの
const CITIES: { id: string; name_en: string; name_ja: string; emoji: string; lat: number; lng: number }[] = [
  { id: 'tokyo',     name_en: 'Tokyo',     name_ja: '東京',     emoji: '🗼', lat: 35.682,  lng: 139.7585 },
  { id: 'kyoto',     name_en: 'Kyoto',     name_ja: '京都',     emoji: '⛩️', lat: 35.0117, lng: 135.7681 },
  { id: 'osaka',     name_en: 'Osaka',     name_ja: '大阪',     emoji: '🏯', lat: 34.6937, lng: 135.5023 },
  { id: 'nara',      name_en: 'Nara',      name_ja: '奈良',     emoji: '🦌', lat: 34.6851, lng: 135.8048 },
  { id: 'kamakura',  name_en: 'Kamakura',  name_ja: '鎌倉',     emoji: '🛕', lat: 35.3192, lng: 139.5466 },
  { id: 'hakone',    name_en: 'Hakone',    name_ja: '箱根',     emoji: '🗻', lat: 35.2330, lng: 139.0269 },
  { id: 'nikko',     name_en: 'Nikko',     name_ja: '日光',     emoji: '🌳', lat: 36.7196, lng: 139.6987 },
  { id: 'hiroshima', name_en: 'Hiroshima', name_ja: '広島',     emoji: '🕊️', lat: 34.3963, lng: 132.4596 },
];

// 観光向けカテゴリ
const SIGHTSEEING_CATEGORIES: { id: SpotCategory; name_en: string; name_ja: string; emoji: string }[] = [
  { id: 'temple',     name_en: 'Temples',         name_ja: '寺',         emoji: '🛕' },
  { id: 'historical', name_en: 'Historical Sites', name_ja: '史跡',       emoji: '🏯' },
  { id: 'heritage',   name_en: 'Heritage Sites',   name_ja: '文化遺産',   emoji: '🏛️' },
  { id: 'museum',     name_en: 'Museums',          name_ja: '美術館',     emoji: '🖼️' },
  { id: 'viewpoint',  name_en: 'Viewpoints',       name_ja: '展望スポット', emoji: '🌄' },
  { id: 'nature',     name_en: 'Nature',           name_ja: '自然',       emoji: '🌿' },
];

type Tab = 'city' | 'category';

export default function BrowseScreen({ language, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('city');
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<SpotCategory | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    Analytics.trackEvent('browse_opened', { language });
  }, [language]);

  // 都市選択でスポット取得
  useEffect(() => {
    if (!selectedCityId) {
      setSpots([]);
      return;
    }
    const city = CITIES.find(c => c.id === selectedCityId);
    if (!city) return;
    setLoading(true);
    fetchNearbySpots(city.lat, city.lng, 10000, ['temple', 'historical', 'heritage', 'museum', 'viewpoint', 'nature', 'attraction'])
      .then(data => {
        setSpots(data.slice(0, 100));
        Analytics.trackEvent('browse_by_city', { city_id: city.id, count: data.length });
      })
      .catch(() => setSpots([]))
      .finally(() => setLoading(false));
  }, [selectedCityId]);

  // カテゴリ選択でスポット取得（東京中心 + 半径50km の代表サンプル）
  useEffect(() => {
    if (!selectedCategoryId) {
      setSpots([]);
      return;
    }
    setLoading(true);
    // カテゴリ別表示は東京・京都・大阪を横断的に取得（半径100kmで疑似全国）
    fetchNearbySpots(35.5, 138.0, 200000, [selectedCategoryId])
      .then(data => {
        setSpots(data.slice(0, 100));
        Analytics.trackEvent('browse_by_category', { category: selectedCategoryId, count: data.length });
      })
      .catch(() => setSpots([]))
      .finally(() => setLoading(false));
  }, [selectedCategoryId]);

  const handleSpotTap = (spot: Spot) => {
    setSelectedSpot(spot);
    Analytics.trackEvent('browse_spot_tapped', {
      spot_id: spot.id,
      from_tab: tab,
    });
  };

  const handlePlay = async (spot: Spot) => {
    setIsPlaying(true);
    Analytics.trackEvent('browse_play_start', { spot_id: spot.id, language });
    try {
      const text = language === 'en' ? (spot.audio_text_en || spot.audio_text || '') : spot.audio_text || '';
      if (!text) throw new Error('no audio text');
      await SpeechService.speak(text, language);
      Analytics.trackEvent('browse_play_completed', { spot_id: spot.id });
    } catch {
      Analytics.trackEvent('browse_play_failed', { spot_id: spot.id });
    } finally {
      setIsPlaying(false);
    }
  };

  const handleStop = async () => {
    await SpeechService.stop();
    setIsPlaying(false);
  };

  const handleCloseModal = async () => {
    await SpeechService.stop();
    setIsPlaying(false);
    setSelectedSpot(null);
  };

  const t = language === 'en'
    ? {
        title: 'Browse',
        subtitle: 'Explore Japan without leaving home',
        byCity: 'By City',
        byCategory: 'By Category',
        back: '← Back',
        chooseCity: 'Choose a city',
        chooseCategory: 'Choose a category',
        listen: 'Listen',
        stop: 'Stop',
        noAudio: 'Audio not available for this spot yet.',
      }
    : {
        title: '一覧から探す',
        subtitle: '家でも日本の観光地を巡れる',
        byCity: '都市から',
        byCategory: 'カテゴリから',
        back: '← 戻る',
        chooseCity: '都市を選択',
        chooseCategory: 'カテゴリを選択',
        listen: '音声を聞く',
        stop: '停止',
        noAudio: 'このスポットは音声未登録です',
      };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📚 {t.title}</Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>

        {/* タブ */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'city' && styles.tabActive]}
            onPress={() => { setTab('city'); setSelectedCategoryId(null); setSpots([]); }}
          >
            <Text style={[styles.tabText, tab === 'city' && styles.tabTextActive]}>{t.byCity}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'category' && styles.tabActive]}
            onPress={() => { setTab('category'); setSelectedCityId(null); setSpots([]); }}
          >
            <Text style={[styles.tabText, tab === 'category' && styles.tabTextActive]}>{t.byCategory}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* By City: 都市選択 → スポット一覧 */}
      {tab === 'city' && (
        <View style={styles.body}>
          {!selectedCityId ? (
            <FlatList
              data={CITIES}
              keyExtractor={(c) => c.id}
              numColumns={2}
              contentContainerStyle={styles.gridContainer}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityCard}
                  onPress={() => setSelectedCityId(item.id)}
                >
                  <Text style={styles.cityEmoji}>{item.emoji}</Text>
                  <Text style={styles.cityName}>
                    {language === 'en' ? item.name_en : item.name_ja}
                  </Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <SpotList
              spots={spots}
              loading={loading}
              language={language}
              onSpotTap={handleSpotTap}
              onBack={() => { setSelectedCityId(null); setSpots([]); }}
              backLabel={t.chooseCity}
              headerLabel={CITIES.find(c => c.id === selectedCityId)?.[language === 'en' ? 'name_en' : 'name_ja'] || ''}
            />
          )}
        </View>
      )}

      {/* By Category: カテゴリ選択 → スポット一覧 */}
      {tab === 'category' && (
        <View style={styles.body}>
          {!selectedCategoryId ? (
            <FlatList
              data={SIGHTSEEING_CATEGORIES}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryRow}
                  onPress={() => setSelectedCategoryId(item.id)}
                >
                  <Text style={styles.categoryEmoji}>{item.emoji}</Text>
                  <Text style={styles.categoryName}>
                    {language === 'en' ? item.name_en : item.name_ja}
                  </Text>
                  <Text style={styles.cardChevron}>›</Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <SpotList
              spots={spots}
              loading={loading}
              language={language}
              onSpotTap={handleSpotTap}
              onBack={() => { setSelectedCategoryId(null); setSpots([]); }}
              backLabel={t.chooseCategory}
              headerLabel={
                SIGHTSEEING_CATEGORIES.find(c => c.id === selectedCategoryId)?.[
                  language === 'en' ? 'name_en' : 'name_ja'
                ] || ''
              }
            />
          )}
        </View>
      )}

      {/* スポット詳細モーダル */}
      <SpotDetailModal
        spot={selectedSpot}
        language={language}
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onStop={handleStop}
        onClose={handleCloseModal}
        listenLabel={t.listen}
        stopLabel={t.stop}
        noAudioLabel={t.noAudio}
      />
    </SafeAreaView>
  );
}

// ============================================================
// スポット一覧（City / Category 共通）
// ============================================================
interface SpotListProps {
  spots: Spot[];
  loading: boolean;
  language: 'ja' | 'en';
  onSpotTap: (s: Spot) => void;
  onBack: () => void;
  backLabel: string;
  headerLabel: string;
}

function SpotList({ spots, loading, language, onSpotTap, onBack, backLabel, headerLabel }: SpotListProps) {
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={onBack} style={styles.subHeaderRow}>
        <Text style={styles.subHeaderBack}>‹ {backLabel}</Text>
        <Text style={styles.subHeaderTitle}>{headerLabel}</Text>
        <Text style={styles.subHeaderCount}>{spots.length}</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#4361ee" />
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const name = language === 'en' ? (item.name_en || item.name) : item.name;
            const desc = language === 'en' ? (item.description_en || item.description) : item.description;
            return (
              <TouchableOpacity style={styles.spotCard} onPress={() => onSpotTap(item)}>
                <Text style={styles.spotName} numberOfLines={1}>{name}</Text>
                {item.address ? (
                  <Text style={styles.spotMeta} numberOfLines={1}>{item.address}</Text>
                ) : null}
                {desc ? <Text style={styles.spotDesc} numberOfLines={2}>{desc}</Text> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

// ============================================================
// スポット詳細モーダル
// ============================================================
interface ModalProps {
  spot: Spot | null;
  language: 'ja' | 'en';
  isPlaying: boolean;
  onPlay: (s: Spot) => void;
  onStop: () => void;
  onClose: () => void;
  listenLabel: string;
  stopLabel: string;
  noAudioLabel: string;
}

function SpotDetailModal({
  spot, language, isPlaying, onPlay, onStop, onClose,
  listenLabel, stopLabel, noAudioLabel,
}: ModalProps) {
  if (!spot) return null;
  const name = language === 'en' ? (spot.name_en || spot.name) : spot.name;
  const desc = language === 'en' ? (spot.description_en || spot.description) : spot.description;
  const audioText = language === 'en' ? (spot.audio_text_en || spot.audio_text) : spot.audio_text;
  const hasAudio = !!(audioText && audioText.trim());

  return (
    <Modal visible={!!spot} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Text style={{ fontSize: 22 }}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.modalName}>{name}</Text>
            {spot.address ? <Text style={styles.modalAddress}>📍  {spot.address}</Text> : null}
            {desc ? <Text style={styles.modalDescription}>{desc}</Text> : null}

            {hasAudio ? (
              <TouchableOpacity
                style={[styles.playButton, isPlaying && styles.playButtonActive]}
                onPress={() => (isPlaying ? onStop() : onPlay(spot))}
              >
                <Text style={styles.playButtonIcon}>{isPlaying ? '⏹' : '▶'}</Text>
                <Text style={styles.playButtonText}>
                  {isPlaying ? stopLabel : listenLabel}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.noAudioBox}>
                <Text style={styles.noAudioText}>{noAudioLabel}</Text>
              </View>
            )}

            {audioText ? <Text style={styles.transcript}>{audioText}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E4EA',
    backgroundColor: '#FFFFFF',
  },
  backButton: { paddingVertical: 6 },
  backText: { fontSize: 14, color: '#4361ee', fontWeight: '500' },
  title: { fontSize: 22, fontWeight: '700', color: '#1A2230', marginTop: 4 },
  subtitle: { fontSize: 13, color: '#7A8492', marginTop: 4 },
  tabRow: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: '#EEF1F5',
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, color: '#7A8492', fontWeight: '500' },
  tabTextActive: { color: '#1A2230', fontWeight: '700' },

  body: { flex: 1 },
  gridContainer: { paddingHorizontal: 12, paddingTop: 12 },
  cityCard: {
    flex: 1,
    margin: 6,
    paddingVertical: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cityEmoji: { fontSize: 36 },
  cityName: { fontSize: 14, fontWeight: '600', color: '#1A2230', marginTop: 8 },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
  },
  categoryEmoji: { fontSize: 26, marginRight: 14 },
  categoryName: { flex: 1, fontSize: 16, fontWeight: '500', color: '#1A2230' },

  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E4EA',
  },
  subHeaderBack: { fontSize: 14, color: '#4361ee', fontWeight: '500', marginRight: 12 },
  subHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1A2230' },
  subHeaderCount: { fontSize: 13, color: '#7A8492' },

  spotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  spotName: { fontSize: 15, fontWeight: '600', color: '#1A2230' },
  spotMeta: { fontSize: 12, color: '#7A8492', marginTop: 2 },
  spotDesc: { fontSize: 13, color: '#52606D', marginTop: 6 },

  cardChevron: { fontSize: 24, color: '#C9CFD8', marginLeft: 8 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // モーダル
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '88%',
  },
  modalClose: { alignSelf: 'flex-end', padding: 4 },
  modalName: { fontSize: 20, fontWeight: '700', color: '#1A2230', marginTop: 4 },
  modalAddress: { fontSize: 13, color: '#52606D', marginTop: 8 },
  modalDescription: { fontSize: 14, color: '#1A2230', lineHeight: 21, marginTop: 12 },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
  },
  playButtonActive: { backgroundColor: '#E53E3E' },
  playButtonIcon: { fontSize: 18, color: '#FFFFFF', marginRight: 8 },
  playButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  noAudioBox: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F3F5F8',
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  noAudioText: { fontSize: 13, color: '#7A8492' },
  transcript: {
    fontSize: 13,
    color: '#52606D',
    lineHeight: 20,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E4EA',
  },
});
