import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { CATEGORIES } from '../data/categories';
import { SpotCategory } from '../types';

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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>興味のあるカテゴリを選択</Text>
      <Text style={styles.subtitle}>
        選んだカテゴリのスポットに近づくと自動でガイドが始まります
      </Text>

      <FlatList
        data={CATEGORIES}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={[styles.startButton, selected.size === 0 && styles.startButtonDisabled]}
        onPress={() => onStart(Array.from(selected))}
        disabled={selected.size === 0}
      >
        <Text style={styles.startButtonText}>
          ガイドを開始 ({selected.size}カテゴリ)
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  grid: {
    paddingBottom: 20,
  },
  card: {
    flex: 1,
    margin: 6,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardSelected: {
    borderColor: '#4361ee',
    backgroundColor: '#eef0ff',
  },
  icon: {
    fontSize: 36,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  labelSelected: {
    color: '#4361ee',
  },
  startButton: {
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  startButtonDisabled: {
    backgroundColor: '#ccc',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
