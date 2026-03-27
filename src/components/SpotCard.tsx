import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Spot } from '../types';
import { CATEGORIES } from '../data/categories';
import { SpeechService } from '../services/speech';

const GOOGLE_API_KEY = 'AIzaSyCvkihno2FlwCxO9AW1a4SrmVeSbNASwH4';

interface Props {
  spot: Spot;
  onAudioPress: (spot: Spot) => void;
  onDismiss: () => void;
}

async function fetchPlacePhoto(spotName: string, lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.photos',
      },
      body: JSON.stringify({
        textQuery: spotName,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 500,
          },
        },
        languageCode: 'ja',
        maxResultCount: 1,
      }),
    });

    const data = await response.json();
    if (data.places?.[0]?.photos?.[0]?.name) {
      const photoName = data.places[0].photos[0].name;
      return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&maxWidthPx=600&key=${GOOGLE_API_KEY}`;
    }
    return null;
  } catch {
    return null;
  }
}

export default function SpotCard({ spot, onAudioPress, onDismiss }: Props) {
  const category = CATEGORIES.find((c) => c.id === spot.category);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(true);

  useEffect(() => {
    setPhotoLoading(true);
    setPhotoUrl(null);
    fetchPlacePhoto(spot.name, spot.latitude, spot.longitude).then((url) => {
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

      <Text style={styles.name}>{spot.name}</Text>
      <ScrollView style={styles.descriptionScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>{spot.audio_text || spot.description}</Text>
      </ScrollView>

      {spot.address && (
        <Text style={styles.address}>{spot.address}</Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.audioButton, isSpeaking && styles.stopButton]}
          onPress={handleAudioToggle}
        >
          <Text style={styles.audioButtonText}>
            {isSpeaking ? '音声を停止' : '音声ガイドを聞く'}
          </Text>
        </TouchableOpacity>
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
    maxHeight: 550,
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
  categoryIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  categoryLabel: {
    fontSize: 13,
    color: '#4361ee',
    fontWeight: '600',
    flex: 1,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 16,
    color: '#999',
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
  },
  photoPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  descriptionScroll: {
    maxHeight: 150,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  address: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
  },
  audioButton: {
    flex: 1,
    backgroundColor: '#4361ee',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#e63946',
  },
  audioButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
