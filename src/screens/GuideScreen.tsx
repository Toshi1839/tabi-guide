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
import { SAMPLE_SPOTS } from '../data/sample-spots';
import { CATEGORIES } from '../data/categories';
import { LocationService, getDistance } from '../services/location';
import { SpeechService } from '../services/speech';
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
  const mapRef = useRef<any>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // フィルタリングされたスポット
  const filteredSpots = SAMPLE_SPOTS.filter((s) =>
    selectedCategories.includes(s.category)
  );

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

  // 位置が変わるたびに近接チェック
  useEffect(() => {
    if (!location || !isGuiding || activeSpot) return;

    const { latitude, longitude } = location.coords;

    for (const spot of filteredSpots) {
      if (visitedIds.has(spot.id)) continue;

      const distance = getDistance(latitude, longitude, spot.latitude, spot.longitude);
      if (distance <= spot.radius) {
        triggerSpot(spot);
        break;
      }
    }
  }, [location, isGuiding, activeSpot, visitedIds]);

  // スポットカードの表示
  const triggerSpot = useCallback((spot: Spot) => {
    setActiveSpot(spot);
    setVisitedIds((prev) => new Set(prev).add(spot.id));

    // カードをスライドアップ
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();

    // 自動音声ガイド
    SpeechService.speak(spot.audio_text);
  }, [slideAnim]);

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
        {filteredSpots.map((spot) => {
          const cat = getCategoryInfo(spot.category);
          const isVisited = visitedIds.has(spot.id);
          return (
            <React.Fragment key={spot.id}>
              <Marker
                coordinate={{
                  latitude: spot.latitude,
                  longitude: spot.longitude,
                }}
                title={spot.name}
                description={spot.description}
                opacity={isVisited ? 0.5 : 1}
              >
                <View style={styles.markerContainer}>
                  <Text style={styles.markerEmoji}>{cat?.icon}</Text>
                </View>
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
              {isGuiding ? 'ガイド中' : '一時停止'}
            </Text>
          </View>
          <Text style={styles.visitCount}>
            {visitedIds.size}/{filteredSpots.length}
          </Text>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={onStop}
          >
            <Text style={styles.stopButtonText}>終了</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

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
  cardContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
  },
});
