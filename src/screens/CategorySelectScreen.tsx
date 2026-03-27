import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { CATEGORIES } from '../data/categories';
import { SpotCategory } from '../types';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARD_WIDTH = (width - 40 - CARD_MARGIN * 4) / 2;

interface Props {
  onStart: (categories: SpotCategory[]) => void;
}

export default function CategorySelectScreen({ onStart }: Props) {
  const [selected, setSelected] = useState<Set<SpotCategory>>(new Set());

  const toggle = (id: SpotCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === CATEGORIES.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(CATEGORIES.map(c => c.id)));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>旅ガイド</Text>
        <Text style={styles.title}>どんな場所に興味がありますか？</Text>
        <Text style={styles.subtitle}>
          選んだカテゴリのスポットに近づくと{'\n'}自動で音声ガイドが始まります
        </Text>
      </View>

      <View style={styles.selectAllRow}>
        <TouchableOpacity onPress={selectAll} style={styles.selectAllButton}>
          <Text style={styles.selectAllText}>
            {selected.size === CATEGORIES.length ? 'すべて解除' : 'すべて選択'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.countText}>
          {selected.size} / {CATEGORIES.length} 選択中
        </Text>
      </View>

      <FlatList
        data={CATEGORIES}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {item.label}
              </Text>
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.startButton, selected.size === 0 && styles.startButtonDisabled]}
          onPress={() => onStart(Array.from(selected))}
          disabled={selected.size === 0}
        >
          <Text style={styles.startButtonText}>
            {selected.size === 0 ? 'カテゴリを選択してください' : 'ガイドを開始する'}
          </Text>
          {selected.size > 0 && (
            <Text style={styles.startButtonSubtext}>
              {selected.size}カテゴリ選択中
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  appName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  selectAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  selectAllText: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '600',
  },
  countText: {
    fontSize: 13,
    color: '#64748b',
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  card: {
    width: CARD_WIDTH,
    margin: CARD_MARGIN,
    paddingVertical: 24,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#60a5fa',
    backgroundColor: '#1e3a5f',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(96, 165, 250, 0.25)',
  },
  icon: {
    fontSize: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  labelSelected: {
    color: '#93c5fd',
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#60a5fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  startButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  startButtonDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  startButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
  },
});
