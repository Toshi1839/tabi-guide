import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Spot } from '../types';

const GEOFENCE_TASK = 'TABI_GUIDE_GEOFENCE';
const LOCATION_TASK = 'TABI_GUIDE_BACKGROUND_LOCATION';

type GeofenceCallback = (spot: Spot) => void;

let onEnterCallbacks: GeofenceCallback[] = [];

// ジオフェンスイベントのタスク定義
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Geofence task error:', error);
    return;
  }
  if (data?.eventType === Location.GeofencingEventType.Enter) {
    const region = data.region;
    onEnterCallbacks.forEach((cb) => cb(region as any));
  }
});

export const LocationService = {
  // 位置情報の権限リクエスト
  async requestPermissions(): Promise<boolean> {
    const { status: foreground } = await Location.requestForegroundPermissionsAsync();
    if (foreground !== 'granted') return false;

    const { status: background } = await Location.requestBackgroundPermissionsAsync();
    return background === 'granted';
  },

  // 現在地を取得
  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch {
      return null;
    }
  },

  // ジオフェンスを設定（最大20個）
  async startGeofencing(spots: Spot[]): Promise<void> {
    const regions: Location.LocationRegion[] = spots.slice(0, 20).map((spot) => ({
      identifier: spot.id,
      latitude: spot.latitude,
      longitude: spot.longitude,
      radius: spot.radius,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));

    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  },

  // ジオフェンス停止
  async stopGeofencing(): Promise<void> {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
    if (isRegistered) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
  },

  // 近いスポットを距離順で取得
  getNearbySpots(
    userLat: number,
    userLng: number,
    spots: Spot[],
    maxDistance: number = 2000
  ): Spot[] {
    return spots
      .map((spot) => ({
        spot,
        distance: getDistance(userLat, userLng, spot.latitude, spot.longitude),
      }))
      .filter((item) => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .map((item) => item.spot);
  },

  // ジオフェンス進入コールバック登録
  onSpotEnter(callback: GeofenceCallback): () => void {
    onEnterCallbacks.push(callback);
    return () => {
      onEnterCallbacks = onEnterCallbacks.filter((cb) => cb !== callback);
    };
  },

  // 現在地から近い上位20件でジオフェンスを動的更新
  async updateGeofences(
    userLat: number,
    userLng: number,
    allSpots: Spot[]
  ): Promise<void> {
    const nearby = this.getNearbySpots(userLat, userLng, allSpots, 5000);
    await this.startGeofencing(nearby);
  },
};

// 2点間の距離計算（Haversine formula）
function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // 地球の半径（メートル）
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export { getDistance };
