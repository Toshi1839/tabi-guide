/**
 * MusicVenuesScreen — Tonight in Tokyo (1.0.5 新規)
 *
 * 観光モード/音楽モード のうち音楽モード時に表示。
 * モックアップ準拠:
 *   /Volumes/Toshi SSD/開発/収益拡大戦略/UI提案/music-section-ui-1.0.5.pptx
 *
 * 機能:
 *   - 距離フィルタ 4段階（≤2km / ≤10km / ≤30km / All）デフォルト 30km
 *   - 6カテゴリ複数選択チップ
 *   - 距離順表示
 *   - 会場タップで詳細モーダル → Schedule(公式サイト) / Maps / Call の3CTA
 *   - モードトグル（観光に戻る）を上部固定
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import ModeToggle from '../components/ModeToggle';
import { Analytics } from '../services/analytics';
import { AppMode } from '../services/app-mode';
import {
  ALL_MUSIC_CATEGORIES,
  MusicCategory,
  MusicVenue,
  categoryIcon,
  categoryLabel,
  coverChargeLabel,
  distanceLabel,
  fetchNearbyMusicVenues,
} from '../services/music-venues-api';

interface Props {
  language: 'ja' | 'en';
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

type DistanceFilter = 2000 | 10000 | 30000 | -1; // -1 = All
const DISTANCE_OPTIONS: { value: DistanceFilter; labelJa: string; labelEn: string }[] = [
  { value: 2000, labelJa: '2km', labelEn: '2km' },
  { value: 10000, labelJa: '10km', labelEn: '10km' },
  { value: 30000, labelJa: '30km', labelEn: '30km' },
  { value: -1, labelJa: '全て', labelEn: 'All' },
];

// 東京駅のおおよそ（位置情報未取得時のフォールバック）
const FALLBACK_LAT = 35.6812;
const FALLBACK_LNG = 139.7671;

export default function MusicVenuesScreen({ language, appMode, onModeChange }: Props) {
  const [userLat, setUserLat] = useState<number>(FALLBACK_LAT);
  const [userLng, setUserLng] = useState<number>(FALLBACK_LNG);
  const [locationReady, setLocationReady] = useState(false);
  const [venues, setVenues] = useState<MusicVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>(30000);
  const [selectedCategories, setSelectedCategories] = useState<MusicCategory[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<MusicVenue | null>(null);

  // 位置情報取得
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
        }
      } catch (e) {
        // 取得失敗時はフォールバック座標を使用
      } finally {
        setLocationReady(true);
      }
    })();
  }, []);

  // 会場取得
  const loadVenues = useCallback(async () => {
    const radius = distanceFilter === -1 ? 200000 : distanceFilter; // All = 200km（東京近郊網羅）
    const data = await fetchNearbyMusicVenues({
      userLat,
      userLng,
      radiusMeters: radius,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      limit: 200,
    });
    setVenues(data);
  }, [userLat, userLng, distanceFilter, selectedCategories]);

  useEffect(() => {
    if (!locationReady) return;
    setLoading(true);
    loadVenues().finally(() => setLoading(false));
  }, [locationReady, loadVenues]);

  // フィルタ操作のアナリティクス
  useEffect(() => {
    if (!locationReady) return;
    Analytics.trackMusicFilter({
      distance_km: distanceFilter === -1 ? -1 : distanceFilter / 1000,
      categories: selectedCategories,
    });
  }, [distanceFilter, selectedCategories, locationReady]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVenues();
    setRefreshing(false);
  };

  const toggleCategory = (cat: MusicCategory) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const headerSubtitle = useMemo(() => {
    if (loading) return language === 'en' ? 'Loading…' : '読み込み中…';
    const count = venues.length;
    const distLabel = distanceFilter === -1
      ? (language === 'en' ? 'all areas' : '全エリア')
      : distanceFilter === 2000
        ? (language === 'en' ? 'within 2 km' : '2km圏内')
        : distanceFilter === 10000
          ? (language === 'en' ? 'within 10 km' : '10km圏内')
          : (language === 'en' ? 'within 30 km' : '30km圏内');
    return language === 'en'
      ? `${count} venues, ${distLabel}`
      : `${count}件の会場（${distLabel}）`;
  }, [loading, venues.length, distanceFilter, language]);

  const renderVenue = ({ item }: { item: MusicVenue }) => {
    const name = language === 'en' ? item.name_en : item.name;
    const desc = (language === 'en' ? item.description_en : item.description_ja) || '';
    return (
      <TouchableOpacity style={styles.venueCard} onPress={() => setSelectedVenue(item)}>
        <View style={styles.venueIcon}>
          <Text style={{ fontSize: 26 }}>{categoryIcon(item.category)}</Text>
        </View>
        <View style={styles.venueBody}>
          <Text style={styles.venueName} numberOfLines={1}>{name}</Text>
          <Text style={styles.venueMeta}>
            {distanceLabel(item.distance_m, language)} · {item.ward || ''} · {categoryLabel(item.category, language)}
          </Text>
          <Text style={styles.venueCover}>{coverChargeLabel(item, language)}</Text>
          {desc ? <Text style={styles.venueDesc} numberOfLines={2}>{desc}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ModeToggle mode={appMode} onChange={onModeChange} language={language} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tonight in Tokyo</Text>
        <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
      </View>

      {/* 距離フィルタ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {DISTANCE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.filterChip, distanceFilter === opt.value && styles.filterChipActive]}
            onPress={() => setDistanceFilter(opt.value)}
          >
            <Text style={[styles.filterText, distanceFilter === opt.value && styles.filterTextActive]}>
              {language === 'en' ? opt.labelEn : opt.labelJa}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* カテゴリフィルタ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {ALL_MUSIC_CATEGORIES.map(cat => {
          const active = selectedCategories.includes(cat);
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, active && styles.catChipActive]}
              onPress={() => toggleCategory(cat)}
            >
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                {categoryIcon(cat)} {categoryLabel(cat, language)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* リスト本体 */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#4361ee" />
        </View>
      ) : (
        <FlatList
          data={venues}
          keyExtractor={(v) => v.id}
          renderItem={renderVenue}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {language === 'en'
                  ? 'No venues found in this range. Try expanding the distance.'
                  : 'この範囲には会場がありません。距離を広げてみてください。'}
              </Text>
            </View>
          }
        />
      )}

      {/* 会場詳細モーダル */}
      <VenueDetailModal
        venue={selectedVenue}
        language={language}
        onClose={() => setSelectedVenue(null)}
      />
    </SafeAreaView>
  );
}

// ============================================================
// 会場詳細モーダル
// ============================================================
interface ModalProps {
  venue: MusicVenue | null;
  language: 'ja' | 'en';
  onClose: () => void;
}

function VenueDetailModal({ venue, language, onClose }: ModalProps) {
  if (!venue) return null;
  const name = language === 'en' ? venue.name_en : venue.name;
  const desc = (language === 'en' ? venue.description_en : venue.description_ja) || '';
  const walkInLabel = (() => {
    if (!venue.walk_in) return null;
    const ja = { high: 'ふらっと入店◎', medium: '予約推奨', low: '要事前予約' };
    const en = { high: 'Walk-in: High', medium: 'Walk-in: Medium', low: 'Walk-in: Low' };
    return language === 'en' ? en[venue.walk_in] : ja[venue.walk_in];
  })();

  const handleSchedule = async () => {
    if (!venue.official_url) return;
    Analytics.trackMusicScheduleClick({ id: venue.id, name: venue.name, category: venue.category });
    try {
      await Linking.openURL(venue.official_url);
    } catch {
      Alert.alert(language === 'en' ? 'Cannot open URL' : 'URLを開けません');
    }
  };

  const handleMaps = async () => {
    Analytics.trackMusicMapsClick({ id: venue.id, name: venue.name, category: venue.category });
    const query = encodeURIComponent(`${venue.name} ${venue.address ?? ''}`.trim());
    const fallback = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const ios = `comgooglemaps://?q=${query}`;
    try {
      const can = Platform.OS === 'ios' ? await Linking.canOpenURL(ios) : false;
      await Linking.openURL(can ? ios : fallback);
    } catch {
      try { await Linking.openURL(fallback); } catch {}
    }
  };

  const handleCall = async () => {
    if (!venue.phone) return;
    Analytics.trackMusicCallClick({ id: venue.id, name: venue.name, category: venue.category });
    const tel = venue.phone.replace(/[^0-9+]/g, '');
    try {
      await Linking.openURL(`tel:${tel}`);
    } catch {
      Alert.alert(language === 'en' ? 'Cannot place call' : '電話を発信できません');
    }
  };

  return (
    <Modal visible={!!venue} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Text style={{ fontSize: 18 }}>✕</Text>
            </TouchableOpacity>

            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 36 }}>{categoryIcon(venue.category)}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>{name}</Text>
                <Text style={styles.modalCategory}>
                  {categoryLabel(venue.category, language)}
                  {walkInLabel ? `  ·  ${walkInLabel}` : ''}
                </Text>
              </View>
            </View>

            {desc ? <Text style={styles.modalDesc}>{desc}</Text> : null}

            <View style={styles.modalInfoBlock}>
              {venue.address ? (
                <Text style={styles.modalInfoLine}>
                  📍  {venue.address}  ·  {distanceLabel(venue.distance_m, language)}
                </Text>
              ) : null}
              <Text style={styles.modalInfoLine}>
                💴  {coverChargeLabel(venue, language)}
              </Text>
            </View>

            {/* 3 CTA ボタン */}
            <View style={styles.ctaRow}>
              <TouchableOpacity
                style={[styles.ctaBtn, !venue.official_url && styles.ctaBtnDisabled]}
                onPress={handleSchedule}
                disabled={!venue.official_url}
              >
                <Text style={styles.ctaBtnIcon}>🎟</Text>
                <Text style={styles.ctaBtnLabel}>
                  {language === 'en' ? 'Schedule' : '公式'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.ctaBtn} onPress={handleMaps}>
                <Text style={styles.ctaBtnIcon}>🗺</Text>
                <Text style={styles.ctaBtnLabel}>Maps</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ctaBtn, !venue.phone && styles.ctaBtnDisabled]}
                onPress={handleCall}
                disabled={!venue.phone}
              >
                <Text style={styles.ctaBtnIcon}>📞</Text>
                <Text style={styles.ctaBtnLabel}>
                  {language === 'en' ? 'Call' : '電話'}
                </Text>
              </TouchableOpacity>
            </View>
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
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1A2230' },
  headerSubtitle: { fontSize: 13, color: '#7A8492', marginTop: 4 },
  filterRow: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#EEF1F5', marginHorizontal: 4,
  },
  filterChipActive: { backgroundColor: '#4361ee' },
  filterText: { fontSize: 13, color: '#52606D', fontWeight: '500' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '600' },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#EEF1F5', marginHorizontal: 4,
  },
  catChipActive: { backgroundColor: '#1A2230' },
  catChipText: { fontSize: 12, color: '#52606D', fontWeight: '500' },
  catChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  listContent: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 24 },
  venueCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 12, marginVertical: 5,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  venueIcon: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: '#EEF1F5',
    alignItems: 'center', justifyContent: 'center',
  },
  venueBody: { flex: 1, marginLeft: 12 },
  venueName: { fontSize: 15, fontWeight: '600', color: '#1A2230' },
  venueMeta: { fontSize: 12, color: '#7A8492', marginTop: 2 },
  venueCover: { fontSize: 12, color: '#4361ee', marginTop: 2, fontWeight: '500' },
  venueDesc: { fontSize: 12, color: '#52606D', marginTop: 4 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#7A8492', textAlign: 'center', fontSize: 14 },

  // モーダル
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 20, paddingTop: 16, maxHeight: '85%',
  },
  modalClose: { alignSelf: 'flex-end', padding: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A2230' },
  modalCategory: { fontSize: 13, color: '#7A8492', marginTop: 2 },
  modalDesc: { fontSize: 14, color: '#1A2230', lineHeight: 20, marginTop: 12 },
  modalInfoBlock: { marginTop: 16 },
  modalInfoLine: { fontSize: 13, color: '#52606D', marginVertical: 3 },
  ctaRow: { flexDirection: 'row', marginTop: 20, gap: 8 },
  ctaBtn: {
    flex: 1, paddingVertical: 14, backgroundColor: '#4361ee', borderRadius: 12,
    alignItems: 'center', marginHorizontal: 4,
  },
  ctaBtnDisabled: { backgroundColor: '#C9CFD8' },
  ctaBtnIcon: { fontSize: 18, marginBottom: 2 },
  ctaBtnLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
