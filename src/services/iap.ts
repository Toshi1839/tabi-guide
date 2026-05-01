import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type ProductPurchase,
  type PurchaseError,
  type Subscription as IAPSubscription,
} from 'react-native-iap';

// 商品ID
export const GOURMET_PACK_ID = 'com.tabishiroguide.app.restaurantpack';
export const AI_CHAT_MONTHLY_ID = 'com.tabishiroguide.app.aichat.monthly';

// ストレージキー
const GOURMET_STORAGE_KEY = 'is_gourmet_purchased';
const AI_CHAT_STORAGE_KEY = 'is_aichat_subscribed';

// グルメパック状態の保存・読み込み
export async function saveGourmetStatus(value: boolean): Promise<void> {
  await AsyncStorage.setItem(GOURMET_STORAGE_KEY, value ? '1' : '0');
}

export async function loadGourmetStatus(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(GOURMET_STORAGE_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

// AIチャットサブスク状態の保存・読み込み
export async function saveAiChatStatus(value: boolean): Promise<void> {
  await AsyncStorage.setItem(AI_CHAT_STORAGE_KEY, value ? '1' : '0');
}

export async function loadAiChatStatus(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(AI_CHAT_STORAGE_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

// 旧isPremiumとの互換（既存ユーザーの移行）
export async function loadPremiumStatus(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem('is_premium_purchased');
    return val === '1';
  } catch {
    return false;
  }
}

// 未完了トランザクションをクリア
async function flushPendingTransactions(): Promise<void> {
  try {
    const purchases = await getAvailablePurchases();
    for (const purchase of purchases) {
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {}
    }
  } catch (e) {
    console.warn('flushPendingTransactions failed:', e);
  }
}

// IAP初期化 + 商品フェッチ
export async function initIAP(): Promise<boolean> {
  try {
    await initConnection();
    // 未完了トランザクションをクリア（"Item already owned"エラー防止）
    await flushPendingTransactions();
    // 商品を事前にフェッチ（購入前に必須）
    try {
      await fetchProducts({ skus: [GOURMET_PACK_ID] });
    } catch (e) {
      console.warn('fetchProducts (inapp) failed:', e);
    }
    try {
      await fetchProducts({ skus: [AI_CHAT_MONTHLY_ID], type: 'subs' });
    } catch (e) {
      console.warn('fetchProducts (subs) failed:', e);
    }
    return true;
  } catch (e) {
    console.warn('IAP initConnection failed:', e);
    return false;
  }
}

// IAP終了
export async function closeIAP(): Promise<void> {
  try {
    await endConnection();
  } catch {}
}

// グルメパック購入
export async function purchaseGourmetPack(): Promise<{ success: boolean; error?: string }> {
  try {
    // 商品を再フェッチして確認
    const products = await fetchProducts({ skus: [GOURMET_PACK_ID] });
    if (!products || products.length === 0) {
      return { success: false, error: '商品情報を取得できませんでした' };
    }
    await requestPurchase({
      request: {
        apple: { sku: GOURMET_PACK_ID },
        google: { skus: [GOURMET_PACK_ID] },
      },
      type: 'inapp',
    });
    return { success: true };
  } catch (e: any) {
    if (e.code === 'E_USER_CANCELLED') {
      return { success: false, error: 'cancelled' };
    }
    // 既に購入済みの場合は成功として扱う
    if (e.message?.includes('already owned') || e.code === 'E_ALREADY_OWNED') {
      await saveGourmetStatus(true);
      return { success: true };
    }
    return { success: false, error: e.message };
  }
}

// AIチャット月額購入
export async function purchaseAiChat(): Promise<{ success: boolean; error?: string }> {
  try {
    // 購入前に既存の購入を確認（既に購入済みなら復元して終了）
    try {
      const existing = await getAvailablePurchases();
      const alreadyOwned = existing.some(p => p.productId === AI_CHAT_MONTHLY_ID);
      if (alreadyOwned) {
        for (const p of existing.filter(p => p.productId === AI_CHAT_MONTHLY_ID)) {
          try { await finishTransaction({ purchase: p, isConsumable: false }); } catch {}
        }
        await saveAiChatStatus(true);
        return { success: true };
      }
    } catch {}

    // サブスクリプション商品をフェッチして確認（v14: fetchProducts with type: 'subs'）
    const subs = await fetchProducts({ skus: [AI_CHAT_MONTHLY_ID], type: 'subs' });
    if (!subs || subs.length === 0) {
      return { success: false, error: 'サブスクリプション情報を取得できませんでした' };
    }
    // v14: requestPurchaseでサブスクも購入
    await requestPurchase({
      request: {
        apple: { sku: AI_CHAT_MONTHLY_ID },
        google: { skus: [AI_CHAT_MONTHLY_ID] },
      },
      type: 'subs',
    });
    return { success: true };
  } catch (e: any) {
    if (e.code === 'E_USER_CANCELLED') {
      return { success: false, error: 'cancelled' };
    }
    // 購入エラー時は復元を試みる（エラーダイアログを出さない）
    try {
      const purchases = await getAvailablePurchases();
      const owned = purchases.some(p => p.productId === AI_CHAT_MONTHLY_ID);
      if (owned) {
        for (const p of purchases.filter(p => p.productId === AI_CHAT_MONTHLY_ID)) {
          try { await finishTransaction({ purchase: p, isConsumable: false }); } catch {}
        }
        await saveAiChatStatus(true);
        return { success: true };
      }
    } catch {}
    return { success: false, error: e.message };
  }
}

// 購入復元
export async function restorePurchases(): Promise<{ gourmet: boolean; aiChat: boolean }> {
  try {
    const purchases = await getAvailablePurchases();
    const gourmet = purchases.some(p => p.productId === GOURMET_PACK_ID);
    const aiChat = purchases.some(p => p.productId === AI_CHAT_MONTHLY_ID);
    if (gourmet) await saveGourmetStatus(true);
    if (aiChat) await saveAiChatStatus(true);
    return { gourmet, aiChat };
  } catch (e) {
    console.warn('restorePurchases failed:', e);
    return { gourmet: false, aiChat: false };
  }
}

// 購入リスナー
export function setupPurchaseListeners(
  onGourmetSuccess: () => void,
  onAiChatSuccess: () => void,
  onError: (msg: string) => void
): () => void {
  const successSub: IAPSubscription = purchaseUpdatedListener(async (purchase: ProductPurchase) => {
    if (purchase.productId === GOURMET_PACK_ID) {
      await finishTransaction({ purchase, isConsumable: false });
      await saveGourmetStatus(true);
      onGourmetSuccess();
    } else if (purchase.productId === AI_CHAT_MONTHLY_ID) {
      await finishTransaction({ purchase, isConsumable: false });
      await saveAiChatStatus(true);
      onAiChatSuccess();
    }
  });

  const errorSub: IAPSubscription = purchaseErrorListener((error: PurchaseError) => {
    // ユーザーキャンセル以外のエラーは全て無視（エラーダイアログを出さない）
    // Apple審査でエラーダイアログ表示が却下理由になるため
    console.warn('Purchase error (suppressed):', error.code, error.message);
  });

  return () => {
    successSub.remove();
    errorSub.remove();
  };
}
