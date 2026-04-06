import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';

// react-native-maps はWeb非対応のため条件付きimport
let MapView: any = View;
let Marker: any = View;
let Circle: any = View;
let PROVIDER_GOOGLE: any = undefined;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}
import { Spot, SpotCategory } from '../types';
import { CATEGORIES, RESTAURANT_GENRES } from '../data/categories';
import { LocationService, getDistance } from '../services/location';
import { SpeechService } from '../services/speech';
import { fetchNearbySpots } from '../services/spots-api';
import SpotCard from '../components/SpotCard';
import { Analytics } from '../services/analytics';

interface Props {
  selectedCategories: SpotCategory[];
  selectedGenres: string[];
  isPremium: boolean;
  isAiChatPremium: boolean;
  onAiChatPurchase: () => void;
  onStop: () => void;
  language: 'ja' | 'en';
}

// ジャンルIDから説明文のキーワードへのマッピング
const GENRE_KEYWORDS: Record<string, string[]> = {
  washoku:  ['和食', '日本料理', '割烹', '懐石', '会席', '鉄板焼'],
  sushi:    ['寿司', '鮨', 'すし'],
  ramen:    ['ラーメン', 'らーめん', '中華そば'],
  yakiniku: ['焼肉', '焼き肉'],
  yakitori: ['焼き鳥', '焼鳥', '串焼'],
  izakaya:  ['居酒屋'],
  chinese:  ['中華', '中国料理', '餃子', '担々麺'],
  italian:  ['イタリアン', 'イタリア料理', 'ピッツァ', 'パスタ'],
  french:   ['フレンチ', 'フランス料理'],
  cafe:     ['カフェ', '喫茶', 'コーヒー'],
  soba:       ['蕎麦', 'そば', 'うどん'],
  craft_beer: ['クラフトビール', 'ブルワリー', 'ビアバー', 'ビール'],
  sweets:     ['スイーツ', '和菓子', '洋菓子', 'パティスリー', 'ケーキ', 'チョコレート', 'アイスクリーム', 'パフェ', 'たい焼き', 'どら焼き', '甘味'],
  ethnic:     ['エスニック', 'タイ料理', 'ベトナム料理', 'インド料理', 'メキシカン', 'メキシコ料理', 'トルコ料理', '韓国料理', 'ネパール料理', 'インドネシア料理', '東南アジア', '中東料理', 'アジア料理'],
  vegetarian: ['ベジタリアン', 'ヴィーガン', 'vegan', 'vegetarian', '菜食', '植物性', 'オーガニック'],
  other:      [],
};

// 説明文がいずれかの既知ジャンルキーワードに一致するか（'other'除く）
function matchesAnyKnownGenre(description: string | undefined): boolean {
  if (!description) return false;
  const desc = description.toLowerCase();
  return Object.entries(GENRE_KEYWORDS).some(([id, keywords]) => {
    if (id === 'other') return false;
    return keywords.some(kw => desc.includes(kw.toLowerCase()));
  });
}

function matchesGenre(description: string | undefined, genreIds: string[]): boolean {
  if (!description || genreIds.length === 0) return true;

  const selectedWithoutOther = genreIds.filter(g => g !== 'other');
  const hasOther = genreIds.includes('other');

  // 指定ジャンルに一致するか
  if (selectedWithoutOther.length > 0) {
    const desc = description.toLowerCase();
    const matchesSelected = selectedWithoutOther.some(id => {
      const keywords = GENRE_KEYWORDS[id] || [];
      return keywords.some(kw => desc.includes(kw.toLowerCase()));
    });
    if (matchesSelected) return true;
  }

  // 「その他」選択時：どの既知ジャンルにも一致しない店を表示
  if (hasOther && !matchesAnyKnownGenre(description)) return true;

  return false;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function GuideScreen({ selectedCategories, selectedGenres, isPremium, isAiChatPremium, onAiChatPurchase, onStop, language }: Props) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [isGuiding, setIsGuiding] = useState(true);
  const [nearbySpots, setNearbySpots] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const mapRef = useRef<any>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastFetchPos = useRef<{ lat: number; lng: number } | null>(null);
  const lastFetchTime = useRef<number>(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // 音声ON/OFF設定を読み込み
  useEffect(() => {
    AsyncStorage.getItem('audio_enabled').then(val => {
      if (val === 'false') setAudioEnabled(false);
    });
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled(prev => {
      const next = !prev;
      AsyncStorage.setItem('audio_enabled', String(next));
      if (!next) SpeechService.stop();
      return next;
    });
  }, []);

  // 位置情報の監視開始
  useEffect(() => {
    let mounted = true;

    const startWatching = async () => {
      const hasPermission = await LocationService.requestPermissions();
      if (!hasPermission) {
        Alert.alert('位置情報の許可が必要です', 'アプリの設定から位置情報を許可してください。');
        return;
      }

      // 現在地を取得
      const current = await LocationService.getCurrentLocation();
      if (current && mounted) {
        setLocation(current);
        // 地図を現在地に移動
        mapRef.current?.animateToRegion({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }

      // 位置情報の継続監視（近接検知用）
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50, // 50m移動ごとに更新
          timeInterval: 3000,   // 最短3秒間隔
        },
        (loc) => {
          if (!mounted) return;
          setLocation(loc);
        }
      );
    };

    startWatching();

    return () => {
      mounted = false;
      watchRef.current?.remove();
      SpeechService.stop();
    };
  }, []);

  // 位置が変わるたびにスポットを取得 + 近接チェック
  useEffect(() => {
    if (!location) return;

    const { latitude, longitude } = location.coords;

    // 移動距離と速度に基づいてスポットを再取得
    const distFromLast = lastFetchPos.current
      ? getDistance(latitude, longitude, lastFetchPos.current.lat, lastFetchPos.current.lng)
      : Infinity;
    const timeSinceLast = Date.now() - lastFetchTime.current;

    // 速度推定（m/s）：高速移動中は取得を抑制
    const speed = location.coords.speed ?? 0;
    const isHighSpeed = speed > 14; // 約50km/h以上

    const shouldFetch =
      !lastFetchPos.current ||
      (distFromLast > 500 && timeSinceLast > 10000) || // 500m+移動 かつ 10秒経過
      (distFromLast > 200 && timeSinceLast > 5000 && !isHighSpeed); // 200m+移動 かつ 5秒経過 かつ 低速

    if (shouldFetch && !isLoading) {
      // 前のリクエストをキャンセル
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
      fetchAbortRef.current = new AbortController();

      setIsLoading(true);
      lastFetchPos.current = { lat: latitude, lng: longitude };
      lastFetchTime.current = Date.now();

      // レストランは5km、その他は2kmで取得
      const nonRestaurantCategories = selectedCategories.filter(c => c !== 'restaurant');
      const hasRestaurant = selectedCategories.includes('restaurant');

      const promises = [];
      if (nonRestaurantCategories.length > 0) {
        promises.push(fetchNearbySpots(latitude, longitude, 2000, nonRestaurantCategories));
      }
      if (hasRestaurant) {
        promises.push(fetchNearbySpots(latitude, longitude, 5000, ['restaurant']));
      }
      if (promises.length === 0) {
        promises.push(fetchNearbySpots(latitude, longitude, 2000, selectedCategories));
      }

      Promise.all(promises)
        .then((results) => {
          const spots = results.flat();
          // 重複除去
          const unique = spots.filter((s, i) => spots.findIndex(x => x.id === s.id) === i);
          if (!fetchAbortRef.current?.signal.aborted) {
            // レストランフィルター:
            //   無料版 → ラーメンのみ（tabelog_url不要）
            //   有料版 → 全レストラン + ジャンルフィルター（tabelog_urlなしも表示）
            const filtered = unique.filter(s => {
              if (s.category !== 'restaurant') return true;
              if (!isPremium) return matchesGenre(s.description, ['ramen']);
              if (selectedGenres.length > 0) return matchesGenre(s.description, selectedGenres);
              return true;
            });

            // カテゴリ別に件数上限を適用（距離順）
            // レストランのみ選択時は20件、他カテゴリと併用時は30件
            const restaurantOnly =
              selectedCategories.includes('restaurant') &&
              selectedCategories.filter(c => c !== 'restaurant').length === 0;
            const LIMITS: Partial<Record<SpotCategory, number>> = {
              shrine_history: 20,
              attraction: 15,
              heritage: 15,
              restaurant: restaurantOnly ? 20 : 30,
            };
            const countByCategory: Partial<Record<SpotCategory, number>> = {};
            const limited = filtered.filter(s => {
              const limit = LIMITS[s.category];
              if (limit === undefined) return true;
              const count = (countByCategory[s.category] ?? 0) + 1;
              countByCategory[s.category] = count;
              return count <= limit;
            });

            // IDが変わらない場合は再描画をスキップ（マーカー点滅防止）
            setNearbySpots(prev => {
              const prevIds = prev.map(s => s.id).join(',');
              const newIds = limited.map(s => s.id).join(',');
              if (prevIds === newIds) return prev;
              return limited;
            });
          }
        })
        .catch(() => {}) // ネットワークエラーを無視
        .finally(() => setIsLoading(false));
    }

    // 近接チェック
    if (!isGuiding || activeSpot) return;
    for (const spot of nearbySpots) {
      if (visitedIds.has(spot.id)) continue;

      const distance = getDistance(latitude, longitude, spot.latitude, spot.longitude);
      if (distance <= spot.radius) {
        triggerSpot(spot, true);
        break;
      }
    }
  }, [location, isGuiding, activeSpot, visitedIds, selectedCategories]);

  // オーディオモード設定（イヤホン対応）
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  }, []);

  // 通知音を再生
  const playNotificationSound = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: 1, // DoNotMix
        interruptionModeAndroid: 1,
      });
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/notification.wav'),
        { volume: 1.0, shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (e) {
      console.log('Notification sound error:', e);
    }
  }, []);

  // スポットカードの表示
  const triggerSpot = useCallback((spot: Spot, isAuto: boolean = false) => {
    setActiveSpot(spot);
    setVisitedIds((prev) => new Set(prev).add(spot.id));
    Analytics.trackSpotView(spot);

    // 自動表示の場合は通知音 + 音声ガイド自動再生（音声ONの場合のみ）
    if (isAuto && audioEnabled) {
      playNotificationSound().then(() => {
        const text = spot.audio_text;
        const audioUrl = spot.audio_url;
        SpeechService.speak(text, 'ja', audioUrl);
      });
    }

    // カードをスライドアップ
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  }, [slideAnim, playNotificationSound, audioEnabled]);

  // スポットカードを閉じる
  const dismissSpot = useCallback(() => {
    SpeechService.stop();
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setActiveSpot(null);
    });
  }, [slideAnim]);

  // 音声ガイド再生
  const handleAudioPress = useCallback((spot: Spot) => {
    SpeechService.stop();
    const text = language === 'en' && spot.audio_text_en ? spot.audio_text_en : spot.audio_text;
    // 日本語の場合はWaveNet audio_urlを優先使用
    const audioUrl = language === 'ja' ? spot.audio_url : undefined;
    SpeechService.speak(text, language, audioUrl);
  }, [language]);

  const getCategoryInfo = (category: SpotCategory) =>
    CATEGORIES.find((c) => c.id === category);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        language={language === 'en' ? 'en' : 'ja'}
        showsUserLocation
        showsMyLocationButton
        initialRegion={
          location
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }
            : {
                // デフォルト: 東京駅
                latitude: 35.6812,
                longitude: 139.7671,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
        }
      >
        {nearbySpots.map((spot) => {
          const cat = getCategoryInfo(spot.category);
          const isVisited = visitedIds.has(spot.id);
          return (
            <React.Fragment key={spot.id}>
              <Marker
                coordinate={{
                  latitude: spot.latitude,
                  longitude: spot.longitude,
                }}
                opacity={isVisited ? 0.5 : 1}
                tracksViewChanges={false}
                onPress={() => {
                  setActiveSpot(null);
                  setTimeout(() => triggerSpot(spot), 100);
                }}
              >
                <TouchableOpacity
                  style={styles.markerContainer}
                  activeOpacity={0.7}
                >
                  <Text style={styles.markerEmoji}>{cat?.icon}</Text>
                  <Text style={styles.markerLabel}>
                    {language === 'en' ? (cat?.label_en ?? cat?.label) : cat?.label}
                  </Text>
                </TouchableOpacity>
              </Marker>
              <Circle
                center={{
                  latitude: spot.latitude,
                  longitude: spot.longitude,
                }}
                radius={spot.radius}
                fillColor="rgba(67, 97, 238, 0.1)"
                strokeColor="rgba(67, 97, 238, 0.3)"
                strokeWidth={1}
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {/* ステータスバー */}
      <SafeAreaView style={styles.statusBar}>
        <View style={styles.statusContent}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, isGuiding && styles.statusDotActive]} />
            <Text style={styles.statusText}>
              {isLoading ? '読込中...' : isGuiding ? 'ガイド中' : '一時停止'}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryScrollContent}>
            {selectedCategories.length === CATEGORIES.length && selectedGenres.length === 0 ? (
              <Text style={styles.categoryIcon}>
                {language === 'en' ? 'All' : '全カテゴリ'}
              </Text>
            ) : (
              selectedCategories.map(cat => {
                const info = getCategoryInfo(cat);
                if (!info) return null;
                const shortLabels: Record<string, string> = {
                  'shrine_history': '史跡',
                  'attraction': '観光',
                  'restaurant': 'グルメ',
                  'heritage': '遺産',
                };
                const shortLabelsEn: Record<string, string> = {
                  'shrine_history': 'Hist',
                  'attraction': 'Attr',
                  'restaurant': 'Food',
                  'heritage': 'Hrtg',
                };
                if (cat === 'restaurant' && selectedGenres.length > 0) {
                  return selectedGenres.map(genreId => {
                    const genre = RESTAURANT_GENRES.find(g => g.id === genreId);
                    return genre ? (
                      <Text key={genreId} style={styles.categoryIcon}>
                        {language === 'en' ? genre.label_en : genre.label}
                      </Text>
                    ) : null;
                  });
                }
                return (
                  <Text key={cat} style={styles.categoryIcon}>
                    {language === 'en' ? (shortLabelsEn[cat] || info.label_en) : (shortLabels[cat] || info.label)}
                  </Text>
                );
              })
            )}
          </ScrollView>
          <Text style={styles.visitCount}>
            {visitedIds.size}/{nearbySpots.length}
          </Text>
          <TouchableOpacity
            style={styles.audioToggleButton}
            onPress={toggleAudio}
          >
            <Text style={styles.audioToggleIcon}>
              {audioEnabled ? '🔊' : '🔇'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={onStop}
          >
            <Text style={styles.stopButtonText}>終了</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>


      {/* 北向きリセットボタン */}
      {!activeSpot && (
        <TouchableOpacity
          style={styles.northButton}
          onPress={() => {
            mapRef.current?.animateCamera({ heading: 0 }, { duration: 500 });
          }}
        >
          <Text style={styles.northIcon}>↑N</Text>
        </TouchableOpacity>
      )}

      {/* 現在地ボタン */}
      {!activeSpot && location && (
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={() => {
            if (mapRef.current && location) {
              mapRef.current.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              }, 500);
            }
          }}
        >
          <Text style={styles.myLocationIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {/* スポットカード（ボトムシート） */}
      {activeSpot && (
        <Animated.View
          style={[
            styles.cardContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <SpotCard
            spot={activeSpot}
            onAudioPress={handleAudioPress}
            onDismiss={dismissSpot}
            isPremium={isPremium}
            isAiChatPremium={isAiChatPremium}
            onAiChatPurchase={onAiChatPurchase}
            language={language}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ccc',
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryIcons: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    flex: 1,
    gap: 4,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  categoryScroll: {
    flex: 1,
    marginHorizontal: 6,
  },
  categoryScrollContent: {
    alignItems: 'center',
    gap: 4,
  },
  categoryIcon: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#4DBFBD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  visitCount: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  audioToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  audioToggleIcon: {
    fontSize: 18,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stopButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  markerContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#4361ee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerEmoji: {
    fontSize: 20,
  },
  markerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    maxWidth: 80,
    textAlign: 'center',
  },
  northButton: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  northIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  myLocationIcon: {
    fontSize: 24,
    color: '#4361ee',
  },
  cardContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
  },
});
