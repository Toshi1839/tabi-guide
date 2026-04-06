import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotCategory } from './src/types';
import CategorySelectScreen from './src/screens/CategorySelectScreen';
import GuideScreen from './src/screens/GuideScreen';
import OnboardingScreen, { ONBOARDING_KEY } from './src/screens/OnboardingScreen';
import { Analytics } from './src/services/analytics';
import {
  initIAP,
  closeIAP,
  purchaseGourmetPack,
  purchaseAiChat,
  restorePurchases,
  loadGourmetStatus,
  loadAiChatStatus,
  loadPremiumStatus,
  saveGourmetStatus,
  setupPurchaseListeners,
} from './src/services/iap';

type Screen = 'onboarding' | 'onboarding_replay' | 'category' | 'guide';

export default function App() {
  const [screen, setScreen] = useState<Screen>('category');
  const [selectedCategories, setSelectedCategories] = useState<SpotCategory[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isGourmetPremium, setIsGourmetPremium] = useState(false);
  const [isAiChatPremium, setIsAiChatPremium] = useState(false);
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    // アプリ起動トラッキング
    Analytics.trackAppLaunch();

    // オンボーディング完了チェック
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      if (!val) {
        setScreen('onboarding');
      }
      setOnboardingChecked(true);
    });

    // アプリ起動時: ローカル購入状態を読み込み
    loadGourmetStatus().then(val => {
      if (val) setIsGourmetPremium(true);
    });
    loadAiChatStatus().then(val => {
      if (val) setIsAiChatPremium(true);
    });
    // 旧isPremiumからの移行
    loadPremiumStatus().then(val => {
      if (val) {
        setIsGourmetPremium(true);
        saveGourmetStatus(true);
      }
    });

    initIAP().then(ok => {
      if (!ok) return;
      const cleanup = setupPurchaseListeners(
        // グルメパック購入成功
        () => {
          setIsGourmetPremium(true);
          Analytics.trackGourmetPurchase();
          Alert.alert('購入完了!', 'グルメパックが解放されました。');
        },
        // AIチャットサブスク購入成功
        () => {
          setIsAiChatPremium(true);
          Analytics.trackAiChatPurchase();
          Alert.alert('購入完了!', 'AIチャットが無制限になりました。');
        },
        // エラー
        (msg) => {
          Alert.alert('購入エラー', msg);
        }
      );
      return cleanup;
    });

    return () => {
      closeIAP();
    };
  }, []);

  const handleStart = (categories: SpotCategory[], genres: string[]) => {
    setSelectedCategories(categories);
    setSelectedGenres(genres);
    setScreen('guide');
    Analytics.trackGuideStart(categories, genres);
  };

  const handleStop = () => {
    setScreen('category');
  };

  const handleGourmetPurchase = async () => {
    const { success, error } = await purchaseGourmetPack();
    if (error === 'cancelled') return;
    if (success) {
      setIsGourmetPremium(true);
    } else if (error) {
      Alert.alert('エラー', error);
    }
  };

  const handleAiChatPurchase = async () => {
    const { success, error } = await purchaseAiChat();
    if (error === 'cancelled') return;
    if (success) {
      setIsAiChatPremium(true);
    } else if (error) {
      Alert.alert('エラー', error);
    }
  };

  const handleRestorePurchases = async () => {
    const restored = await restorePurchases();
    if (restored.gourmet || restored.aiChat) {
      if (restored.gourmet) setIsGourmetPremium(true);
      if (restored.aiChat) setIsAiChatPremium(true);
      const items = [];
      if (restored.gourmet) items.push('グルメパック');
      if (restored.aiChat) items.push('AIチャット');
      Alert.alert('復元完了', `${items.join('と')}が復元されました。`);
    } else {
      Alert.alert('購入履歴なし', 'このApple IDには購入履歴が見つかりませんでした。');
    }
  };

  if (!onboardingChecked) return null;

  return (
    <>
      <StatusBar style="auto" />
      {screen === 'onboarding' ? (
        <OnboardingScreen
          language={language}
          onComplete={() => setScreen('category')}
        />
      ) : screen === 'onboarding_replay' ? (
        <OnboardingScreen
          language={language}
          onComplete={() => setScreen('category')}
          isReplay
        />
      ) : screen === 'category' ? (
        <CategorySelectScreen
          onStart={handleStart}
          isPremium={isGourmetPremium}
          onPurchase={handleGourmetPurchase}
          onRestorePurchases={handleRestorePurchases}
          language={language}
          onLanguageChange={setLanguage}
          onShowGuide={() => setScreen('onboarding_replay')}
        />
      ) : (
        <GuideScreen
          selectedCategories={selectedCategories}
          selectedGenres={selectedGenres}
          isPremium={isGourmetPremium}
          isAiChatPremium={isAiChatPremium}
          onAiChatPurchase={handleAiChatPurchase}
          onStop={handleStop}
          language={language}
        />
      )}
    </>
  );
}
