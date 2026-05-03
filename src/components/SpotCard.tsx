import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Spot } from '../types';
import { CATEGORIES } from '../data/categories';
import { SpeechService } from '../services/speech';
import ChatModal from './ChatModal';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || '';

interface Props {
  spot: Spot;
  onAudioPress: (spot: Spot) => void;
  onDismiss: () => void;
  isPremium: boolean;
  isAiChatPremium: boolean;
  onAiChatPurchase: () => void;
  language: 'ja' | 'en';
}

async function fetchPlacePhoto(spotName: string, lat: number, lng: number, address?: string): Promise<string | null> {
  try {
    // 住所がある場合はクエリに追加して精度向上
    const query = address ? `${spotName} ${address.split(/[0-9０-９]/).shift()?.trim() || ''}`.trim() : spotName;
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.photos',
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 200,
          },
        },
        languageCode: 'ja',
        maxResultCount: 1,
      }),
    });
    const data = await response.json();
    if (data.places?.[0]?.photos?.[0]?.name) {
      const photoName = data.places[0].photos[0].name;
      const mediaRes = await fetch(
        `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&maxWidthPx=600&key=${GOOGLE_API_KEY}&skipHttpRedirect=true`
      );
      const mediaData = await mediaRes.json();
      if (mediaData.photoUri) return mediaData.photoUri;
    }
    return null;
  } catch {
    return null;
  }
}

function extractGenre(description?: string): string {
  const m = description?.match(/^([^。]+)。/);
  return m ? m[1] : '';
}

function extractRating(description?: string): string | null {
  const m = description?.match(/食べログ(\d\.\d+)/);
  return m ? m[1] : null;
}

export default function SpotCard({ spot, onAudioPress, onDismiss, isPremium, isAiChatPremium, onAiChatPurchase, language }: Props) {
  const category = CATEGORIES.find((c) => c.id === spot.category);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [chatVisible, setChatVisible] = useState(false);

  const isRestaurant = spot.category === 'restaurant';
  const displayName = language === 'en' && spot.name_en ? spot.name_en : spot.name;
  const displayDescription = language === 'en' && spot.description_en ? spot.description_en : spot.description;
  const displayAudioText = language === 'en' && spot.audio_text_en ? spot.audio_text_en : spot.audio_text;
  const genre = extractGenre(displayDescription);
  const rating = extractRating(spot.description); // 評価は日本語フィールドから取得

  useEffect(() => {
    setPhotoLoading(true);
    setPhotoUrl(null);
    fetchPlacePhoto(spot.name, spot.latitude, spot.longitude, spot.address).then((url) => {
      setPhotoUrl(url);
      setPhotoLoading(false);
    });
  }, [spot.id]);

  const handleAudioToggle = () => {
    if (isSpeaking) {
      SpeechService.stop();
      setIsSpeaking(false);
    } else {
      onAudioPress(spot);
      setIsSpeaking(true);
      const checkInterval = setInterval(async () => {
        const speaking = await SpeechService.isSpeaking();
        if (!speaking) {
          setIsSpeaking(false);
          clearInterval(checkInterval);
        }
      }, 500);
    }
  };

  const handleDismiss = () => {
    SpeechService.stop();
    setIsSpeaking(false);
    onDismiss();
  };

  const isCraftBeer = !!spot._isCraftBeer;

  const openTabelog = () => {
    let url = spot.tabelog_url || '';
    if (!isCraftBeer && language === 'en' && url) {
      // tabelog.com/chiba/... → tabelog.com/en/chiba/...
      url = url.replace('tabelog.com/', 'tabelog.com/en/');
    }
    Linking.openURL(url);
  };

  const openGoogleMap = async () => {
    // トイレや住所なしスポットは座標で開く（名前だと不特定の結果になるため）
    const useCoords = spot.category === 'toilet' || !spot.address;
    const q = useCoords
      ? `${spot.latitude},${spot.longitude}`
      : encodeURIComponent(`${spot.name} ${spot.address}`);
    // Google Mapsアプリを直接起動（ダイアログ不要）
    const googleMapsApp = `comgooglemaps://?q=${q}`;
    const appleMaps = `maps://?q=${q}`;
    const canOpenGoogle = await Linking.canOpenURL(googleMapsApp);
    if (canOpenGoogle) {
      Linking.openURL(googleMapsApp);
    } else {
      Linking.openURL(appleMaps);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.categoryIcon}>{category?.icon}</Text>
        <Text style={styles.categoryLabel}>{category?.label}</Text>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>x</Text>
        </TouchableOpacity>
      </View>

      {photoLoading ? (
        <View style={styles.photoPlaceholder}>
          <ActivityIndicator size="small" color="#4361ee" />
        </View>
      ) : photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : null}

      <Text style={styles.name}>{displayName}</Text>

      {/* レストラン：有料版のみジャンル・評価を表示 */}
      {isRestaurant && isPremium && genre ? (
        <Text style={styles.genreRating}>
          {genre}
        </Text>
      ) : null}

      {/* 非レストランは説明表示 */}
      {!isRestaurant && displayDescription && (
        <Text style={styles.genreRating}>
          {displayDescription.replace(/([^。.]+)[。.].*/, '$1')}
        </Text>
      )}

      <ScrollView style={styles.descriptionScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>{displayAudioText}</Text>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.audioButton, isSpeaking && styles.stopButton]}
          onPress={handleAudioToggle}
        >
          <Text style={styles.audioButtonText}>
            {isSpeaking
              ? (language === 'en' ? 'Stop Audio' : '音声を停止')
              : (language === 'en' ? 'Play Audio Guide' : '音声ガイドを聞く')
            }
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => setChatVisible(true)}
        >
          <Text style={styles.chatButtonText}>
            {language === 'en' ? '🤖 Ask AI' : '🤖 AIに質問'}
          </Text>
        </TouchableOpacity>
      </View>

      <ChatModal
        visible={chatVisible}
        spot={spot}
        isAiChatPremium={isAiChatPremium}
        onAiChatPurchase={onAiChatPurchase}
        language={language}
        onClose={() => setChatVisible(false)}
      />

      {/* リンク行 */}
      <View style={styles.linkRow}>
        <TouchableOpacity onPress={openGoogleMap}>
          <Text style={styles.mapLinkText}>Google Map</Text>
        </TouchableOpacity>

        {/* 食べログURLがある全レストランで表示（無料版でも詳細リンクは表示。グルメパックの差別化は表示件数・ジャンル数で行う） */}
        {isRestaurant && spot.tabelog_url && (
          <TouchableOpacity onPress={openTabelog} style={styles.tabelogButton}>
            <Text style={styles.tabelogButtonText}>
              {isCraftBeer
                ? 'Google Maps'
                : (language === 'en' ? 'View Details' : '詳細を見る')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    maxHeight: 540,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIcon: { fontSize: 20, marginRight: 6 },
  categoryLabel: { fontSize: 13, color: '#4361ee', fontWeight: '600', flex: 1 },
  dismissButton: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },
  dismissText: { fontSize: 16, color: '#999' },
  photo: { width: '100%', height: 160, borderRadius: 12, marginBottom: 12 },
  photoPlaceholder: {
    width: '100%', height: 160, borderRadius: 12,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  genreRating: { fontSize: 14, fontWeight: '600', color: '#e67e22', marginBottom: 8 },
  genreOnly: { fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 8 },
  descriptionScroll: { maxHeight: 120, marginBottom: 8 },
  description: { fontSize: 15, color: '#444', lineHeight: 22 },
  actions: { flexDirection: 'row', marginBottom: 10, gap: 8 },
  audioButton: {
    flex: 1, backgroundColor: '#4361ee', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center',
  },
  chatButton: {
    flex: 1, backgroundColor: '#f0f4ff', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#4361ee',
  },
  chatButtonText: { color: '#4361ee', fontSize: 15, fontWeight: 'bold' },
  stopButton: { backgroundColor: '#e63946' },
  audioButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  mapLinkText: { fontSize: 14, color: '#4361ee', fontWeight: '600', textDecorationLine: 'underline' },
  tabelogButton: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabelogButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
