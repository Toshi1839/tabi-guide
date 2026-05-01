import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { Spot } from '../types';
import { ChatMessage, sendChatMessage, getRemainingQuestions } from '../services/claude-chat';

interface Props {
  visible: boolean;
  spot: Spot;
  isAiChatPremium: boolean;
  onAiChatPurchase: () => void;
  language: 'ja' | 'en';
  onClose: () => void;
}

export default function ChatModal({ visible, spot, isAiChatPremium, onAiChatPurchase, language, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number>(3);
  const flatListRef = useRef<FlatList>(null);

  const T = {
    title:       language === 'en' ? 'Ask AI Guide'           : 'AIガイドに質問',
    placeholder: language === 'en' ? 'Ask about this spot...' : 'このスポットについて質問...',
    send:        language === 'en' ? 'Send'                   : '送信',
    close:       language === 'en' ? 'Close'                  : '閉じる',
    thinking:    language === 'en' ? 'Thinking...'            : '考え中...',
    freeLimit:   language === 'en'
      ? `${remaining} question${remaining !== 1 ? 's' : ''} remaining today (free)`
      : `本日の残り質問回数: ${remaining}回（無料）`,
    welcome:     language === 'en'
      ? `Hi! I'm your AI guide for ${spot.name_en || spot.name}. What would you like to know?`
      : `こんにちは！${spot.name}のAIガイドです。何でも聞いてください。`,
  };

  useEffect(() => {
    if (visible) {
      setMessages([{ role: 'assistant', content: T.welcome }]);
      setInput('');
      if (!isAiChatPremium) {
        getRemainingQuestions().then(setRemaining);
      }
    }
  }, [visible, spot.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    // ウェルカムメッセージを除いた履歴を渡す
    const chatHistory = newHistory.filter(m => m !== messages[0]);

    const { reply, error } = await sendChatMessage(
      text,
      spot,
      chatHistory.slice(0, -1), // userMsgの直前まで
      language,
      isAiChatPremium
    );

    if (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: error }]);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      if (!isAiChatPremium) {
        getRemainingQuestions().then(setRemaining);
      }
    }

    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>AI</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ヘッダー */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.aiIcon}>🤖</Text>
              <View>
                <Text style={styles.title}>{T.title}</Text>
                <Text style={styles.spotName} numberOfLines={1}>
                  {language === 'en' ? (spot.name_en || spot.name) : spot.name}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 残り回数表示＋サブスク案内（無料ユーザーのみ） */}
          {!isAiChatPremium && (
            <View>
              <View style={styles.limitBar}>
                <Text style={styles.limitText}>{T.freeLimit}</Text>
                <TouchableOpacity onPress={onAiChatPurchase} style={styles.subscribeButton}>
                  <Text style={styles.subscribeText}>{language === 'en' ? 'Unlimited ¥100/mo' : '無制限 ¥100/月'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.legalLinks}>
                <Text style={styles.legalText}>
                  {language === 'en' ? 'Auto-renewable subscription. ' : '自動更新サブスクリプション '}
                </Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://toshi1839.github.io/tabi-guide-privacy/')}>
                  <Text style={styles.legalLink}>{language === 'en' ? 'Privacy Policy' : 'プライバシーポリシー'}</Text>
                </TouchableOpacity>
                <Text style={styles.legalText}> | </Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
                  <Text style={styles.legalLink}>{language === 'en' ? 'Terms of Use' : '利用規約'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* サブスク管理リンク（有料ユーザーのみ） */}
          {isAiChatPremium && (
            <View style={styles.limitBar}>
              <Text style={styles.limitText}>{language === 'en' ? 'AI Chat: Unlimited' : 'AIチャット: 無制限'}</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')} style={styles.manageButton}>
                <Text style={styles.manageText}>{language === 'en' ? 'Manage' : '管理'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* メッセージ一覧 */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* 送信中インジケーター */}
          {loading && (
            <View style={styles.thinkingRow}>
              <ActivityIndicator size="small" color="#4361ee" />
              <Text style={styles.thinkingText}>{T.thinking}</Text>
            </View>
          )}

          {/* 入力エリア */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={T.placeholder}
              placeholderTextColor="#999"
              multiline
              maxLength={200}
              editable={!loading}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || loading) && styles.sendDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || loading}
            >
              <Text style={styles.sendText}>{T.send}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aiIcon: { fontSize: 28 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  spotName: { fontSize: 12, color: '#4361ee', maxWidth: 220 },
  closeButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: '#666' },
  limitBar: {
    backgroundColor: '#fff8e1',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ffe082',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  limitText: { fontSize: 12, color: '#f57f17' },
  subscribeButton: {
    backgroundColor: '#4361ee',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subscribeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    backgroundColor: '#fff8e1',
    borderBottomWidth: 1,
    borderBottomColor: '#ffe082',
    flexWrap: 'wrap',
  },
  legalText: { fontSize: 9, color: '#999' },
  legalLink: { fontSize: 9, color: '#4361ee', textDecorationLine: 'underline' },
  manageButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  manageText: { fontSize: 11, color: '#666', fontWeight: '600' },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  userRow: { justifyContent: 'flex-end' },
  aiRow:  { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#4361ee', alignItems: 'center', justifyContent: 'center',
    marginRight: 8, marginTop: 2,
  },
  aiAvatarText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: '#4361ee',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#f4f4f8',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  aiText:  { color: '#1a1a2e' },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  thinkingText: { fontSize: 13, color: '#999' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#1a1a2e',
  },
  sendButton: {
    backgroundColor: '#4361ee',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
  },
  sendDisabled: { backgroundColor: '#bbb' },
  sendText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
