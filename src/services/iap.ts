import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection,
  endConnection,
  getProducts,
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

// IAP初期化
export async function initIAP(): Promise<boolean> {
  try {
    await initConnection();
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
    await requestPurchase({
      request: {
        apple: { sku: GOURMET_PACK_ID },
        google: { skus: [GOURMET_PACK_ID] },
      },
    });
    return { success: true };
  } catch (e: any) {
    if (e.code === 'E_USER_CANCELLED') {
      return { success: false, error: 'cancelled' };
    }
    return { success: false, error: e.message };
  }
}

// AIチャット月額購入
export async function purchaseAiChat(): Promise<{ success: boolean; error?: string }> {
  try {
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
    if (error.code !== 'E_USER_CANCELLED') {
      onError(error.message);
    }
  });

  return () => {
    successSub.remove();
    errorSub.remove();
  };
}
