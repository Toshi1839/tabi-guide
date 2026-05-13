/**
 * SampleTourScreen — 1.0.5 のリテンション改善主軸
 *
 * 設計目標:
 *   - DL 後の初回起動で **30秒以内に「これは何のアプリか」を理解**
 *   - 位置情報なし・オフラインで音声ガイドが再生できる
 *   - 5スポットで日本旅行の主要体験を網羅
 *
 * 参考: docs/monetization.md §9
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SAMPLE_TOUR_SPOTS, SampleTourSpot } from '../data/sample-tour-spots';
import { SpeechService } from '../services/speech';
import { Analytics } from '../services/analytics';

interface Props {
  language: 'ja' | 'en';
  onClose: () => void;
}

export default function SampleTourScreen({ language, onClose }: Props) {
  const [selectedSpot, setSelectedSpot] = useState<SampleTourSpot | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    Analytics.trackEvent('sample_tour_opened', { language });
  }, [language]);

  const handleSelect = (spot: SampleTourSpot) => {
    Analytics.trackEvent('sample_tour_spot_tapped', {
      spot_id: spot.id,
      spot_name: spot.name_en,
    });
    setSelectedSpot(spot);
  };

  const handlePlay = async (spot: SampleTourSpot) => {
    setIsPlaying(true);
    Analytics.trackEvent('sample_tour_play_start', {
      spot_id: spot.id,
      language,
    });
    try {
      const text = language === 'en' ? spot.audio_text_en : spot.audio_text_ja;
      await SpeechService.speak(text, language);
      // 再生完了時に Analytics 記録
      Analytics.trackEvent('sample_tour_completed', {
        spot_id: spot.id,
        language,
      });
    } catch (e) {
      // 失敗時もイベント記録
      Analytics.trackEvent('sample_tour_play_failed', { spot_id: spot.id });
    } finally {
      setIsPlaying(false);
    }
  };

  const handleStop = async () => {
    await SpeechService.stop();
    setIsPlaying(false);
  };

  const handleCloseModal = async () => {
    await SpeechService.stop();
    setIsPlaying(false);
    setSelectedSpot(null);
  };

  const t = language === 'en'
    ? {
        screenTitle: 'Sample Tours',
        screenSubtitle: 'Hear what tabi-guide sounds like — no location needed',
        listenButton: 'Listen to Audio Guide',
        stopButton: 'Stop',
        closeButton: 'Close',
        back: '← Back',
      }
    : {
        screenTitle: 'サンプル音声ガイド',
        screenSubtitle: 'tabi-guideの音声ガイドを試聴。位置情報なしで再生可能',
        listenButton: '音声ガイドを聞く',
        stopButton: '停止',
        closeButton: '閉じる',
        back: '← 戻る',
      };

  const renderItem = ({ item }: { item: SampleTourSpot }) => {
    const name = language === 'en' ? item.name_en : item.name;
    const tagline = language === 'en' ? item.tagline_en : item.tagline_ja;
    return (
      <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)}>
        <View style={styles.cardIcon}>
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardCity}>{item.city}</Text>
          <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
          <Text style={styles.cardTagline} numberOfLines={2}>{tagline}</Text>
        </View>
        <Text style={styles.cardChevron}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🎧 {t.screenTitle}</Text>
        <Text style={styles.subtitle}>{t.screenSubtitle}</Text>
      </View>

      <FlatList
        data={SAMPLE_TOUR_SPOTS}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

      <SampleTourDetailModal
        spot={selectedSpot}
        language={language}
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onStop={handleStop}
        onClose={handleCloseModal}
        t={t}
      />
    </SafeAreaView>
  );
}

// ============================================================
// 詳細モーダル
// ============================================================
interface ModalProps {
  spot: SampleTourSpot | null;
  language: 'ja' | 'en';
  isPlaying: boolean;
  onPlay: (spot: SampleTourSpot) => void;
  onStop: () => void;
  onClose: () => void;
  t: { listenButton: string; stopButton: string; closeButton: string };
}

function SampleTourDetailModal({ spot, language, isPlaying, onPlay, onStop, onClose, t }: ModalProps) {
  if (!spot) return null;
  const name = language === 'en' ? spot.name_en : spot.name;
  const tagline = language === 'en' ? spot.tagline_en : spot.tagline_ja;
  const description = language === 'en' ? spot.description_en : spot.description_ja;
  const audioText = language === 'en' ? spot.audio_text_en : spot.audio_text_ja;

  return (
    <Modal visible={!!spot} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Text style={{ fontSize: 22 }}>✕</Text>
            </TouchableOpacity>

            <View style={styles.modalHeader}>
              <Text style={styles.modalEmoji}>{spot.emoji}</Text>
              <Text style={styles.modalCity}>{spot.city}</Text>
              <Text style={styles.modalName}>{name}</Text>
              <Text style={styles.modalTagline}>{tagline}</Text>
            </View>

            <Text style={styles.modalDescription}>{description}</Text>

            {/* 大きな再生ボタン */}
            <TouchableOpacity
              style={[styles.playButton, isPlaying && styles.playButtonActive]}
              onPress={() => (isPlaying ? onStop() : onPlay(spot))}
            >
              <Text style={styles.playButtonIcon}>{isPlaying ? '⏹' : '▶'}</Text>
              <Text style={styles.playButtonText}>
                {isPlaying ? t.stopButton : t.listenButton}
              </Text>
            </TouchableOpacity>

            {/* 朗読テキストもスクロール可能に表示（学習用） */}
            <Text style={styles.transcript}>{audioText}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E4EA',
    backgroundColor: '#FFFFFF',
  },
  backButton: { paddingVertical: 6 },
  backText: { fontSize: 14, color: '#4361ee', fontWeight: '500' },
  title: { fontSize: 22, fontWeight: '700', color: '#1A2230', marginTop: 4 },
  subtitle: { fontSize: 13, color: '#7A8492', marginTop: 4 },
  listContent: { paddingHorizontal: 12, paddingVertical: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#EEF1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: { fontSize: 32 },
  cardBody: { flex: 1, marginLeft: 14 },
  cardCity: { fontSize: 11, color: '#7A8492', fontWeight: '500', letterSpacing: 0.5 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1A2230', marginTop: 2 },
  cardTagline: { fontSize: 12, color: '#52606D', marginTop: 4 },
  cardChevron: { fontSize: 28, color: '#C9CFD8', marginLeft: 8 },

  // モーダル
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '88%',
  },
  modalClose: { alignSelf: 'flex-end', padding: 4 },
  modalHeader: { alignItems: 'center', marginVertical: 12 },
  modalEmoji: { fontSize: 56 },
  modalCity: { fontSize: 12, color: '#7A8492', fontWeight: '500', marginTop: 8, letterSpacing: 0.8 },
  modalName: { fontSize: 22, fontWeight: '700', color: '#1A2230', marginTop: 4, textAlign: 'center' },
  modalTagline: { fontSize: 14, color: '#52606D', marginTop: 6, textAlign: 'center' },
  modalDescription: { fontSize: 14, color: '#1A2230', lineHeight: 21, marginTop: 12 },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
  },
  playButtonActive: { backgroundColor: '#E53E3E' },
  playButtonIcon: { fontSize: 18, color: '#FFFFFF', marginRight: 8 },
  playButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  transcript: {
    fontSize: 13,
    color: '#52606D',
    lineHeight: 20,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E4EA',
  },
});
