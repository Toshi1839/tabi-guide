import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Localization from 'expo-localization';

// 端末の言語設定を取得（'ja' or 'en'）
// expo-localizationを使用（New Architecture対応・確実）
function getDeviceLanguage(): 'ja' | 'en' {
  try {
    const locales = Localization.getLocales();
    const langCode = locales[0]?.languageCode || 'ja';
    return langCode === 'ja' ? 'ja' : 'en';
  } catch {
    return 'ja';
  }
}
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotCategory } from './src/types';
import CategorySelectScreen from './src/screens/CategorySelectScreen';
import GuideScreen from './src/screens/GuideScreen';
// 音楽セクションは 1.0.5 から非表示化（コードは保持、1.0.6/1.0.7 の B3 アーキで復活予定）
// import MusicVenuesScreen from './src/screens/MusicVenuesScreen';
import OnboardingScreen, { ONBOARDING_KEY } from './src/screens/OnboardingScreen';
import { Analytics } from './src/services/analytics';
// import { AppMode, loadAppMode, saveAppMode } from './src/services/app-mode';
import { onAppLaunch, onAppBackground } from './src/services/review-prompter';
import InAppSurvey from './src/components/InAppSurvey';
import { AppState } from 'react-native';
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
  const [language, setLanguage] = useState<'ja' | 'en'>(getDeviceLanguage());
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  // 1.0.5: 音楽セクションを非表示化のため appMode/handleModeChange は使用しない
  // 1.0.6+ で B3 アーキで復活させる時に再有効化する
  // const [appMode, setAppMode] = useState<AppMode>('sightseeing');
  // const handleModeChange = (mode: AppMode) => {
  //   setAppMode(mode);
  //   saveAppMode(mode);
  //   Analytics.trackModeSwitch(mode);
  // };

  useEffect(() => {
    // アプリ起動トラッキング
    Analytics.trackAppLaunch();

    // 1.0.5: レビュー誘導用の起動カウンタを加算
    onAppLaunch();

    // AppState 監視（バックグラウンド遷移時にセッション時間を累積）
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        onAppBackground();
      } else if (state === 'active') {
        // フォアグラウンド復帰時に新セッション開始扱い
        onAppLaunch();
      }
    });

    // 音楽セクション非表示化に伴いモード復元はスキップ（1.0.5）
    // loadAppMode().then(setAppMode);

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

    initIAP().then(async (ok) => {
      if (!ok) return;
      // 起動時に購入復元（別デバイスでの購入を反映）
      try {
        const restored = await restorePurchases();
        if (restored.gourmet) setIsGourmetPremium(true);
        if (restored.aiChat) setIsAiChatPremium(true);
      } catch {}
      const cleanup = setupPurchaseListeners(
        // グルメパック購入成功（既に購入済みならアラートを出さない）
        () => {
          setIsGourmetPremium(prev => {
            if (!prev) {
              Analytics.trackGourmetPurchase();
              Alert.alert('購入完了!', 'グルメパックが解放されました。');
            }
            return true;
          });
        },
        // AIチャットサブスク購入成功（既に購入済みならアラートを出さない）
        () => {
          setIsAiChatPremium(prev => {
            if (!prev) {
              Analytics.trackAiChatPurchase();
              Alert.alert('購入完了!', 'AIチャットが無制限になりました。');
            }
            return true;
          });
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
      sub.remove();
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
    }
    // エラーアラートは表示しない（Apple審査対策）
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

  // オンボーディング系は既存のまま（モード非依存）
  if (screen === 'onboarding') {
    return (
      <>
        <StatusBar style="auto" />
        <OnboardingScreen language={language} onComplete={() => setScreen('category')} />
      </>
    );
  }
  if (screen === 'onboarding_replay') {
    return (
      <>
        <StatusBar style="auto" />
        <OnboardingScreen language={language} onComplete={() => setScreen('category')} isReplay />
      </>
    );
  }

  // 1.0.5: 音楽モードのレンダリングは非表示化（コード保持、1.0.6+ で復活予定）
  // if (appMode === 'music') {
  //   return (
  //     <>
  //       <StatusBar style="auto" />
  //       <MusicVenuesScreen
  //         language={language}
  //         appMode={appMode}
  //         onModeChange={handleModeChange}
  //       />
  //     </>
  //   );
  // }

  // 観光モード（既存フロー: category → guide）
  return (
    <>
      <StatusBar style="auto" />
      {screen === 'category' ? (
        <CategorySelectScreen
          onStart={handleStart}
          isPremium={isGourmetPremium}
          isAiChatPremium={isAiChatPremium}
          onPurchase={handleGourmetPurchase}
          onAiChatPurchase={handleAiChatPurchase}
          onRestorePurchases={handleRestorePurchases}
          language={language}
          onLanguageChange={setLanguage}
          onShowGuide={() => setScreen('onboarding_replay')}
          // 1.0.5: 音楽モード非表示化のため appMode/onModeChange は渡さない
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
      {/* 1.0.5: 起動 10 回目に表示する継続アンケート（カテゴリ画面表示中のみ） */}
      {screen === 'category' && <InAppSurvey language={language} />}
    </>
  );
}
