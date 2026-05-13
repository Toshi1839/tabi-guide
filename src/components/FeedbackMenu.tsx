/**
 * FeedbackMenu (1.0.5)
 *
 * ユーザーフィードバック収集の3導線:
 *   - 評価する（App Store ページへ遷移）
 *   - 問い合わせ・要望（mailto:）
 *   - バグ報告（mailto: + アプリバージョン等のログ自動添付）
 *
 * 参考: docs/monetization.md §9 「ユーザーフィードバック収集の設計」
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { Analytics } from '../services/analytics';

// App Store の tabi-guide URL
const APP_STORE_URL = 'https://apps.apple.com/app/id6761404193';
// フィードバック送信先メール
const FEEDBACK_EMAIL = 'toshiiwasaki@gmail.com';

interface Props {
  visible: boolean;
  onClose: () => void;
  language: 'ja' | 'en';
}

export default function FeedbackMenu({ visible, onClose, language }: Props) {
  const t = language === 'en'
    ? {
        title: 'Feedback',
        subtitle: 'We\'d love to hear from you',
        rate: '⭐ Rate this app',
        rateDesc: 'Leave a review on the App Store',
        contact: '✉️ Send feedback or request',
        contactDesc: 'Email us your thoughts',
        bug: '🐛 Report a bug',
        bugDesc: 'Help us fix issues',
        close: 'Close',
        emailError: 'No email app configured',
      }
    : {
        title: 'フィードバック',
        subtitle: 'ご意見をお聞かせください',
        rate: '⭐ アプリを評価する',
        rateDesc: 'App Store でレビューを書く',
        contact: '✉️ 問い合わせ・要望',
        contactDesc: 'メールで送信',
        bug: '🐛 バグを報告',
        bugDesc: '不具合を報告する',
        close: '閉じる',
        emailError: 'メールアプリが設定されていません',
      };

  const handleRate = async () => {
    Analytics.trackEvent('feedback_menu_rate_tapped');
    try {
      await Linking.openURL(APP_STORE_URL + '?action=write-review');
    } catch {
      await Linking.openURL(APP_STORE_URL);
    }
    onClose();
  };

  const handleContact = async () => {
    Analytics.trackEvent('feedback_menu_contact_tapped');
    const subject = encodeURIComponent(
      language === 'en' ? 'tabi-guide feedback' : 'tabi-guide フィードバック'
    );
    const body = encodeURIComponent(
      language === 'en'
        ? '\n\n---\nPlease keep app information below to help us respond faster:\n' +
          `App version: ${Constants.expoConfig?.version ?? 'unknown'}\n` +
          `Platform: ${Platform.OS} ${Platform.Version}\n`
        : '\n\n---\n（下記情報は迅速な対応のため残してください）\n' +
          `アプリバージョン: ${Constants.expoConfig?.version ?? 'unknown'}\n` +
          `端末: ${Platform.OS} ${Platform.Version}\n`
    );
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(url);
      onClose();
    } catch {
      Alert.alert(t.emailError);
    }
  };

  const handleBug = async () => {
    Analytics.trackEvent('feedback_menu_bug_tapped');
    const subject = encodeURIComponent(
      language === 'en' ? 'tabi-guide bug report' : 'tabi-guide バグ報告'
    );
    const body = encodeURIComponent(
      language === 'en'
        ? '\n\n[Steps to reproduce]\n1. \n2. \n3. \n\n[Expected behavior]\n\n[Actual behavior]\n\n---\nApp version: ' +
          (Constants.expoConfig?.version ?? 'unknown') + '\n' +
          `Platform: ${Platform.OS} ${Platform.Version}\n`
        : '\n\n【再現手順】\n1. \n2. \n3. \n\n【期待する動作】\n\n【実際の動作】\n\n---\nアプリバージョン: ' +
          (Constants.expoConfig?.version ?? 'unknown') + '\n' +
          `端末: ${Platform.OS} ${Platform.Version}\n`
    );
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(url);
      onClose();
    } catch {
      Alert.alert(t.emailError);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={{ fontSize: 22 }}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{t.subtitle}</Text>

          <TouchableOpacity style={styles.item} onPress={handleRate}>
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>{t.rate}</Text>
              <Text style={styles.itemDesc}>{t.rateDesc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={handleContact}>
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>{t.contact}</Text>
              <Text style={styles.itemDesc}>{t.contactDesc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={handleBug}>
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>{t.bug}</Text>
              <Text style={styles.itemDesc}>{t.bugDesc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  closeButton: { alignSelf: 'flex-end', padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A2230' },
  subtitle: { fontSize: 13, color: '#7A8492', marginTop: 4, marginBottom: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E4EA',
  },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '500', color: '#1A2230' },
  itemDesc: { fontSize: 12, color: '#7A8492', marginTop: 2 },
  chevron: { fontSize: 24, color: '#C9CFD8' },
});
