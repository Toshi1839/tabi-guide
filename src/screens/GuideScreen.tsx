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
} from 'react-native';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';

// react-native-maps はWeb非対応のため条件付きimport
let MapView: any = View;
let Marker: any = View;
let Circle: any = View;
let PROVIDER_DEFAULT: any = undefined;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
}
import { Spot, SpotCategory } from '../types';
import { CATEGORIES } from '../data/categories';
import { LocationService, getDistance } from '../services/location';
import { SpeechService } from '../services/speech';
import { fetchNearbySpots } from '../services/spots-api';
import SpotCard from '../components/SpotCard';

interface Props {
  selectedCategories: SpotCategory[];
  onStop: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function GuideScreen({ selectedCategories, onStop }: Props) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [isGuiding, setIsGuiding] = useState(true);
  const [nearbySpots, setNearbySpots] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<any>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastFetchPos = useRef<{ lat: number; lng: number } | null>(null);

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
          accuracy: Location.Accuracy.High,
          distanceInterval: 20, // 20m移動ごとに更新
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

    // 200m以上移動したらスポットを再取得
    const shouldFetch =
      !lastFetchPos.current ||
      getDistance(
        latitude,
        longitude,
        lastFetchPos.current.lat,
        lastFetchPos.current.lng
      ) > 200;

    if (shouldFetch && !isLoading) {
      setIsLoading(true);
      lastFetchPos.current = { lat: latitude, lng: longitude };

      fetchNearbySpots(latitude, longitude, 2000, selectedCategories)
        .then((spots) => {
          setNearbySpots(spots);
        })
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
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/notification.wav'),
        { volume: 0.8, shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (e) {
      // 音声ファイルがない場合は無視
    }
  }, []);

  // スポットカードの表示
  const triggerSpot = useCallback((spot: Spot, isAuto: boolean = false) => {
    setActiveSpot(spot);
    setVisitedIds((prev) => new Set(prev).add(spot.id));

    // 自動表示の場合は通知音を鳴らす
    if (isAuto) {
      playNotificationSound();
    }

    // カードをスライドアップ
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  }, [slideAnim, playNotificationSound]);

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
    SpeechService.speak(spot.audio_text);
  }, []);

  const getCategoryInfo = (category: SpotCategory) =>
    CATEGORIES.find((c) => c.id === category);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
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
                  <Text style={styles.markerLabel}>{spot.name}</Text>
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
          <Text style={styles.visitCount}>
            {visitedIds.size}/{nearbySpots.length}
          </Text>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={onStop}
          >
            <Text style={styles.stopButtonText}>終了</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>


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
  visitCount: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
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
