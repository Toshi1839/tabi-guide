import * as Speech from 'expo-speech';

export const SpeechService = {
  // ガイドテキストを音声で読み上げ
  speak(text: string, language: 'ja' | 'en' = 'ja'): void {
    Speech.speak(text, {
      language: language === 'ja' ? 'ja-JP' : 'en-US',
      rate: 0.9,
      pitch: 1.0,
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
