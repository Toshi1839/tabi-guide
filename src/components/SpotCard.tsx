import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Spot } from '../types';
import { CATEGORIES } from '../data/categories';

interface Props {
  spot: Spot;
  onAudioPress: (spot: Spot) => void;
  onDismiss: () => void;
}

export default function SpotCard({ spot, onAudioPress, onDismiss }: Props) {
  const category = CATEGORIES.find((c) => c.id === spot.category);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.categoryIcon}>{category?.icon}</Text>
        <Text style={styles.categoryLabel}>{category?.label}</Text>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>x</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.name}>{spot.name}</Text>
      <Text style={styles.description}>{spot.description}</Text>

      {spot.address && (
        <Text style={styles.address}>{spot.address}</Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.audioButton}
          onPress={() => onAudioPress(spot)}
        >
          <Text style={styles.audioButtonText}>音声ガイドを聞く</Text>
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
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 8,
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
  audioButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
