import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import { CATEGORIES, RESTAURANT_GENRES } from '../data/categories';
import { SpotCategory } from '../types';
import ModeToggle from '../components/ModeToggle';
import SampleTourScreen from './SampleTourScreen';
import BrowseScreen from './BrowseScreen';
import FeedbackMenu from '../components/FeedbackMenu';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARD_WIDTH = (width - 40 - CARD_MARGIN * 4) / 2;

interface Props {
  onStart: (categories: SpotCategory[], genres: string[]) => void;
  isPremium: boolean;
  isAiChatPremium: boolean;
  onPurchase: () => void;
  onAiChatPurchase: () => void;
  onRestorePurchases: () => void;
  language: 'ja' | 'en';
  onLanguageChange: (lang: 'ja' | 'en') => void;
  onShowGuide?: () => void;
  // 1.0.5: モードトグル（音楽モードへ切替）
  appMode?: 'sightseeing' | 'music';
  onModeChange?: (mode: 'sightseeing' | 'music') => void;
}

const T = {
  ja: {
    appName: 'AI街歩きガイド',
    title: '好きなカテゴリーの選択',
    subtitle: '選んだカテゴリのスポットに近づくと\n自動で音声ガイドが始まります',
    selectAll: 'すべて選択',
    deselectAll: 'すべて解除',
    selected: '選択中',
    packTitle: '🍽️ グルメパック',
    packDescription: 'ラーメンは無料で表示。パック購入で全ジャンル解放 + グルメリンク',
    purchaseButtonText: '¥500',
    purchasedBadge: '購入済み',
    restoreButton: '購入を復元',
    selectAllGenres: '全ジャンル選択',
    deselectAllGenres: '全解除',
    purchaseTitle: 'グルメパック',
    purchaseMessage: 'ラーメン以外の全ジャンルが解放され、グルメサイトのリンクも表示されます。\n\n¥500（買い切り）',
    cancel: 'キャンセル',
    purchase: '購入する',
    startButton: 'ガイドを開始する',
    startDisabled: 'カテゴリを選択してください',
    categoriesSelected: 'カテゴリ',
    genresSelected: 'ジャンル',
    aiChatTitle: '🤖 AIチャット',
    aiChatDescription: 'スポットについて何でもAIに質問。歴史・見どころ・グルメ情報など、深い知識を瞬時に。',
    aiChatFree: '無料：1日3回まで',
    aiChatPremium: '無制限：¥100/月（自動更新サブスクリプション）',
    aiChatPurchaseButton: '¥100/月で登録',
    aiChatSubscribed: '登録済み',
    aiChatManage: '管理',
    aiChatPurchaseTitle: 'AIチャット無制限プラン',
    aiChatPurchaseMessage: 'AIチャットが無制限に利用できるようになります。\n\n¥100/月（自動更新サブスクリプション）\n\n・期間：1ヶ月（自動更新）\n・価格：¥100/月（税込）\n・解約：いつでもApp Storeの設定から可能',
  },
  en: {
    appName: 'AI Street Guide',
    title: 'Select Your Favorite Categories',
    subtitle: 'Audio guides will start automatically\nwhen you approach selected spots',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    selected: 'selected',
    packTitle: '🍽️ Restaurant Pack',
    packDescription: 'Ramen is free. Purchase to unlock all genres + restaurant links',
    purchaseButtonText: '¥500',
    purchasedBadge: 'Purchased',
    restoreButton: 'Restore Purchase',
    selectAllGenres: 'Select All Genres',
    deselectAllGenres: 'Deselect All',
    purchaseTitle: 'Restaurant Pack',
    purchaseMessage: 'Unlock all genres except ramen, with restaurant links.\n\n¥500 (one-time)',
    cancel: 'Cancel',
    purchase: 'Purchase',
    startButton: 'Start Guide',
    startDisabled: 'Please select a category',
    categoriesSelected: 'categories',
    genresSelected: 'genres',
    aiChatTitle: '🤖 AI Chat',
    aiChatDescription: 'Ask AI anything about spots. Get history, highlights, and food info instantly.',
    aiChatFree: 'Free: 3 questions/day',
    aiChatPremium: 'Unlimited: ¥100/month (auto-renewing subscription)',
    aiChatPurchaseButton: 'Subscribe ¥100/mo',
    aiChatSubscribed: 'Subscribed',
    aiChatManage: 'Manage',
    aiChatPurchaseTitle: 'AI Chat Unlimited',
    aiChatPurchaseMessage: 'Get unlimited AI chat access.\n\n¥100/month (auto-renewing subscription)\n\n• Duration: 1 month (auto-renewing)\n• Price: ¥100/month (tax included)\n• Cancel: anytime in App Store settings',
  },
};

export default function CategorySelectScreen({ onStart, isPremium, isAiChatPremium, onPurchase, onAiChatPurchase, onRestorePurchases, language, onLanguageChange, onShowGuide, appMode, onModeChange }: Props) {
  const t = T[language];
  const [selected, setSelected] = useState<Set<SpotCategory>>(new Set());
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  // 1.0.5: Sample Tour Screen の表示状態（位置情報なしで音声試聴できる体験）
  const [showSampleTour, setShowSampleTour] = useState(false);
  // 1.0.5: Browse Screen の表示状態（位置情報なしでスポット一覧閲覧可能）
  const [showBrowse, setShowBrowse] = useState(false);
  // 1.0.5: フィードバックメニュー（★アプリ評価／問い合わせ／バグ報告）
  const [showFeedback, setShowFeedback] = useState(false);

  const toggle = (id: SpotCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllGenres = () => {
    if (selectedGenres.size === RESTAURANT_GENRES.length) {
      setSelectedGenres(new Set());
    } else {
      setSelectedGenres(new Set(RESTAURANT_GENRES.map(g => g.id)));
    }
  };

  const selectAll = () => {
    if (selected.size === CATEGORIES.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(CATEGORIES.map(c => c.id)));
    }
  };

  const handlePurchase = () => {
    Alert.alert(
      t.purchaseTitle,
      t.purchaseMessage,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.purchase, onPress: onPurchase },
      ]
    );
  };

  const handleAiChatSubscribe = () => {
    Alert.alert(
      t.aiChatPurchaseTitle,
      t.aiChatPurchaseMessage,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.purchase, onPress: onAiChatPurchase },
      ]
    );
  };

  const handleManageAiChat = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

  const totalSelected = selected.size + (isPremium && selectedGenres.size > 0 ? 1 : 0);
  const canStart = selected.size > 0 || (isPremium && selectedGenres.size > 0);

  const handleStart = () => {
    const categories = Array.from(selected);
    // グルメパックのジャンルが選ばれていればrestaurantカテゴリも含める
    if (isPremium && selectedGenres.size > 0 && !categories.includes('restaurant')) {
      categories.push('restaurant');
    }
    onStart(categories, Array.from(selectedGenres));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1.0.5: 観光モード/音楽モード トグル（プロップ渡された場合のみ表示）*/}
      {appMode && onModeChange && (
        <ModeToggle mode={appMode} onChange={onModeChange} language={language} />
      )}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.appName}>{t.appName}</Text>
          <View style={styles.headerRight}>
            {onShowGuide && (
              <TouchableOpacity style={styles.guideButton} onPress={onShowGuide}>
                <Text style={styles.guideButtonText}>?</Text>
              </TouchableOpacity>
            )}
            {/* 1.0.5: フィードバックメニュー */}
            <TouchableOpacity style={styles.feedbackButton} onPress={() => setShowFeedback(true)}>
              <Text style={styles.feedbackButtonText}>✉️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 1.0.5: Sample Tour 訴求バナー（リテンション改善の主軸）*/}
        <TouchableOpacity
          style={styles.sampleTourBanner}
          onPress={() => setShowSampleTour(true)}
          activeOpacity={0.85}
        >
          <View style={styles.sampleTourIcon}>
            <Text style={styles.sampleTourEmoji}>🎧</Text>
          </View>
          <View style={styles.sampleTourBody}>
            <Text style={styles.sampleTourTitle}>
              {language === 'en' ? 'Try a Sample Tour' : 'サンプル音声ガイドを試聴'}
            </Text>
            <Text style={styles.sampleTourSubtitle} numberOfLines={2}>
              {language === 'en'
                ? "Hear what tabi-guide sounds like — Japan's top 5 sites, no location needed"
                : '日本の代表5スポットを試聴。位置情報なしで再生可能'}
            </Text>
          </View>
          <Text style={styles.sampleTourChevron}>›</Text>
        </TouchableOpacity>

        {/* 1.0.5: Browse 訴求バナー（位置情報なしでスポット閲覧）*/}
        <TouchableOpacity
          style={styles.browseBanner}
          onPress={() => setShowBrowse(true)}
          activeOpacity={0.85}
        >
          <View style={styles.browseIcon}>
            <Text style={styles.browseEmoji}>📚</Text>
          </View>
          <View style={styles.browseBody}>
            <Text style={styles.browseTitle}>
              {language === 'en' ? 'Browse All Sites' : '一覧から探す'}
            </Text>
            <Text style={styles.browseSubtitle} numberOfLines={2}>
              {language === 'en'
                ? 'Explore Japan by city or category — perfect for trip planning'
                : '都市・カテゴリ別にスポットを閲覧。旅行前の下調べに'}
            </Text>
          </View>
          <Text style={styles.browseChevron}>›</Text>
        </TouchableOpacity>

        {/* 通常カテゴリ */}
        <View style={styles.selectAllRow}>
          <TouchableOpacity onPress={selectAll} style={styles.selectAllButton}>
            <Text style={styles.selectAllText}>
              {selected.size === CATEGORIES.length ? t.deselectAll : t.selectAll}
            </Text>
          </TouchableOpacity>
          <Text style={styles.countText}>
            {selected.size} / {CATEGORIES.length} {t.selected}
          </Text>
        </View>

        <View style={styles.grid}>
          {CATEGORIES.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                  <Text style={styles.icon}>{item.icon}</Text>
                </View>
                <Text style={[styles.label, isSelected && styles.labelSelected]}>
                  {language === 'en' ? item.label_en : item.label}
                </Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* グルメパック */}
        <View style={styles.packSection}>
          <View style={styles.packHeader}>
            <Text style={styles.packTitle}>{t.packTitle}</Text>
            {!isPremium && (
              <View style={styles.purchaseActions}>
                <TouchableOpacity style={styles.purchaseButton} onPress={handlePurchase}>
                  <Text style={styles.purchaseButtonText}>{t.purchaseButtonText}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.restoreButton} onPress={onRestorePurchases}>
                  <Text style={styles.restoreButtonText}>{t.restoreButton}</Text>
                </TouchableOpacity>
              </View>
            )}
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>{t.purchasedBadge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.packDescription}>{t.packDescription}</Text>

          {isPremium && (
            <TouchableOpacity onPress={selectAllGenres} style={styles.selectAllGenreButton}>
              <Text style={styles.selectAllGenreText}>
                {selectedGenres.size === RESTAURANT_GENRES.length ? t.deselectAllGenres : t.selectAllGenres}
              </Text>
            </TouchableOpacity>
          )}

          {!isPremium ? (
            // 未購入：ラーメンは無料、それ以外はロック表示
            <View style={styles.lockedGrid}>
              {RESTAURANT_GENRES.map((g) => {
                const isFree = g.id === 'ramen';
                return (
                  <View key={g.id} style={[styles.genreCardLocked, isFree && styles.genreCardFree]}>
                    <Text style={styles.genreIcon}>{g.icon}</Text>
                    <Text style={[styles.genreLabelLocked, isFree && styles.genreLabelFree]}>
                      {language === 'en' ? g.label_en : g.label}
                    </Text>
                    {isFree
                      ? <Text style={styles.freeTag}>FREE</Text>
                      : <Text style={styles.lockIcon}>🔒</Text>
                    }
                  </View>
                );
              })}
            </View>
          ) : (
            // 購入済み：選択可能
            <View style={styles.lockedGrid}>
              {RESTAURANT_GENRES.map((g) => {
                const isSelected = selectedGenres.has(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genreCard, isSelected && styles.genreCardSelected]}
                    onPress={() => toggleGenre(g.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.genreIcon}>{g.icon}</Text>
                    <Text style={[styles.genreLabel, isSelected && styles.genreLabelSelected]}>
                      {language === 'en' ? g.label_en : g.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.genreCheck}>
                        <Text style={styles.checkMark}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* AIチャットセクション */}
        <View style={styles.packSection}>
          <View style={styles.packHeader}>
            <Text style={styles.packTitle}>{t.aiChatTitle}</Text>
            {!isAiChatPremium ? (
              <TouchableOpacity style={styles.aiChatPurchaseButton} onPress={handleAiChatSubscribe}>
                <Text style={styles.purchaseButtonText}>{t.aiChatPurchaseButton}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.aiChatManageButton} onPress={handleManageAiChat}>
                <Text style={styles.purchaseButtonText}>{t.aiChatManage}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.packDescription}>{t.aiChatDescription}</Text>
          <View style={styles.aiChatPlanRow}>
            <View style={styles.aiChatPlanBadge}><Text style={styles.aiChatPlanBadgeText}>{t.aiChatFree}</Text></View>
          </View>
          <View style={styles.aiChatPlanRow}>
            <View style={[styles.aiChatPlanBadge, styles.aiChatPlanBadgePremium]}>
              <Text style={styles.aiChatPlanBadgeText}>{t.aiChatPremium}</Text>
            </View>
          </View>
          {isAiChatPremium && (
            <View style={styles.premiumBadgeInline}>
              <Text style={styles.premiumBadgeText}>{t.aiChatSubscribed}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.startButton, !canStart && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!canStart}
        >
          <Text style={styles.startButtonText}>
            {!canStart ? t.startDisabled : t.startButton}
          </Text>
          {canStart && (
            <Text style={styles.startButtonSubtext}>
              {selected.size} {t.categoriesSelected}
              {isPremium && selectedGenres.size > 0 ? ` + ${selectedGenres.size} ${t.genresSelected}` : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 1.0.5: Sample Tour 全画面モーダル */}
      <Modal
        visible={showSampleTour}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSampleTour(false)}
      >
        <SampleTourScreen
          language={language}
          onClose={() => setShowSampleTour(false)}
        />
      </Modal>

      {/* 1.0.5: Browse All Sites 全画面モーダル */}
      <Modal
        visible={showBrowse}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBrowse(false)}
      >
        <BrowseScreen
          language={language}
          onClose={() => setShowBrowse(false)}
        />
      </Modal>

      {/* 1.0.5: フィードバックメニュー */}
      <FeedbackMenu
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
        language={language}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  // 1.0.5: Sample Tour 訴求バナー
  sampleTourBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#3b4760',
  },
  sampleTourIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#4361ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleTourEmoji: { fontSize: 28 },
  sampleTourBody: { flex: 1, marginLeft: 12 },
  sampleTourTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  sampleTourSubtitle: { fontSize: 12, color: '#A6B0C2', marginTop: 4, lineHeight: 16 },
  sampleTourChevron: { fontSize: 28, color: '#A6B0C2', marginLeft: 6 },
  // 1.0.5: Browse バナー
  browseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#3b4760',
  },
  browseIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseEmoji: { fontSize: 28 },
  browseBody: { flex: 1, marginLeft: 12 },
  browseTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  browseSubtitle: { fontSize: 12, color: '#A6B0C2', marginTop: 4, lineHeight: 16 },
  browseChevron: { fontSize: 28, color: '#A6B0C2', marginLeft: 6 },
  // 1.0.5: フィードバックボタン (ヘッダー右上、? ボタンの隣)
  feedbackButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  feedbackButtonText: { fontSize: 14 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guideButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  guideButtonText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: 'bold',
  },
  langToggle: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  langBtnActive: {
    backgroundColor: '#3b82f6',
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  langBtnTextActive: {
    color: '#fff',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
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
  // グルメパック
  packSection: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f59e0b33',
  },
  packHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  packTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  purchaseActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  purchaseButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  purchaseButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  restoreButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  restoreButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  premiumBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  premiumBadgeText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
  },
  packDescription: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  lockedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreCardLocked: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.5,
  },
  genreCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  genreCardSelected: {
    borderColor: '#f59e0b',
    backgroundColor: '#1c1700',
  },
  genreIcon: {
    fontSize: 16,
  },
  genreLabelLocked: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  genreLabel: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  genreLabelSelected: {
    color: '#fbbf24',
  },
  lockIcon: {
    fontSize: 10,
    marginLeft: 2,
  },
  genreCardFree: {
    opacity: 1,
    borderWidth: 1,
    borderColor: '#22c55e33',
    backgroundColor: '#052e16',
  },
  genreLabelFree: {
    color: '#4ade80',
    fontWeight: '600',
  },
  freeTag: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4ade80',
    marginLeft: 2,
  },
  selectAllGenreButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    marginBottom: 10,
  },
  selectAllGenreText: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
  },
  genreCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
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
  aiChatPurchaseButton: {
    backgroundColor: '#4361ee',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  aiChatManageButton: {
    backgroundColor: '#64748b',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  aiChatPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  aiChatPlanBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiChatPlanBadgePremium: {
    backgroundColor: 'rgba(67, 97, 238, 0.2)',
  },
  aiChatPlanBadgeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  premiumBadgeInline: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
});
