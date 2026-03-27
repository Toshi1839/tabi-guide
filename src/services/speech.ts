import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { convertToSpeechText } from './speech-dict';

export const SpeechService = {
  // ガイドテキストを音声で読み上げ
  async speak(text: string, language: 'ja' | 'en' = 'ja'): Promise<void> {
    // 難読漢字をひらがなに変換
    const speechText = language === 'ja' ? convertToSpeechText(text) : text;

    // iOSの男性日本語音声を探す
    let voiceId: string | undefined;
    if (Platform.OS === 'ios' && language === 'ja') {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const jaVoices = voices.filter((v) => v.language === 'ja-JP');

        // デバッグ: 利用可能な日本語音声を表示
        console.log('Available ja-JP voices:', jaVoices.map((v) => `${v.identifier} (${v.quality})`));

        // O-Ren（拡張）を優先
        const preferred =
          jaVoices.find((v) => /o-ren/i.test(v.identifier || '') && /enhanced|premium/i.test(v.identifier || '')) ||
          jaVoices.find((v) => /o-ren/i.test(v.identifier || '') && /enhanced|premium/i.test(String(v.quality || ''))) ||
          jaVoices.find((v) => /o.?ren/i.test(v.identifier || '')) ||
          jaVoices.find((v) => /otoya/i.test(v.identifier || ''));

        if (preferred) {
          voiceId = preferred.identifier;
        }
      } catch (e) {
        // fallback to default
      }
    }

    Speech.speak(speechText, {
      language: language === 'ja' ? 'ja-JP' : 'en-US',
      rate: 0.65,
      pitch: 0.9,
      ...(voiceId ? { voice: voiceId } : {}),
    });
  },

  // 読み上げ停止
  stop(): void {
    Speech.stop();
  },

  // 読み上げ中かどうか
  async isSpeaking(): Promise<boolean> {
    return Speech.isSpeakingAsync();
  },
};
