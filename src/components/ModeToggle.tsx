/**
 * ModeToggle
 *
 * 観光モード / 音楽モード のセグメンテッドコントロール。
 * GuideScreen の上部に配置。
 *
 * 参考: /Volumes/Toshi SSD/開発/収益拡大戦略/UI提案/music-section-ui-1.0.5.pptx Slide 2
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { AppMode } from '../services/app-mode';

interface Props {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
  language: 'ja' | 'en';
}

export default function ModeToggle({ mode, onChange, language }: Props) {
  const labels = language === 'en'
    ? { sightseeing: 'Sightseeing', music: 'Music' }
    : { sightseeing: '観光', music: '音楽' };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.tab, mode === 'sightseeing' && styles.tabActive]}
        onPress={() => mode !== 'sightseeing' && onChange('sightseeing')}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'sightseeing' }}
      >
        <Text style={[styles.tabText, mode === 'sightseeing' && styles.tabTextActive]}>
          🗾 {labels.sightseeing}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, mode === 'music' && styles.tabActive]}
        onPress={() => mode !== 'music' && onChange('music')}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'music' }}
      >
        <Text style={[styles.tabText, mode === 'music' && styles.tabTextActive]}>
          🎵 {labels.music}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#EEF1F5',
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 12,
    marginTop: Platform.OS === 'ios' ? 8 : 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7A8492',
  },
  tabTextActive: {
    color: '#1A2230',
    fontWeight: '600',
  },
});
