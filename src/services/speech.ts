import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { convertToSpeechText } from './speech-dict';
import { onAudioPlay, maybeRequestReview } from './review-prompter';

let currentSound: Audio.Sound | null = null;

export const SpeechService = {
  // ガイドテキストを音声で読み上げ
  async speak(text: string, language: 'ja' | 'en' = 'ja', audioUrl?: string): Promise<void> {
    // 既存の音声を停止
    await this.stop();

    // 1.0.5: 音声再生回数をカウント（レビュー誘導の閾値判定用）
    onAudioPlay();

    // audio_urlがある場合はWaveNet MP3を再生
    if (audioUrl && language === 'ja') {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true }
        );
        currentSound = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
            currentSound = null;
            // 1.0.5: 完了時にレビュー誘導判定（成功体験直後）
            maybeRequestReview();
          }
        });
        return;
      } catch (e) {
        console.warn('WaveNet audio playback failed, falling back to expo-speech:', e);
        currentSound = null;
      }
    }

    // expo-speech フォールバック（audioUrlなし、または英語、またはMP3再生失敗時）
    const speechText = language === 'ja' ? convertToSpeechText(text) : text;

    let voiceId: string | undefined;
    if (Platform.OS === 'ios' && language === 'ja') {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const jaVoices = voices.filter((v) => v.language === 'ja-JP');
        const preferred =
          jaVoices.find((v) => /otoya/i.test(v.identifier || '') && /enhanced|premium/i.test(v.identifier || '')) ||
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
      rate: 1.0,
      pitch: 0.9,
      ...(voiceId ? { voice: voiceId } : {}),
      // 1.0.5: 完了時にレビュー誘導判定（成功体験直後）
      onDone: () => { maybeRequestReview(); },
    });
  },

  // 読み上げ停止
  async stop(): Promise<void> {
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch {}
      currentSound = null;
    }
    Speech.stop();
  },

  // 読み上げ中かどうか
  async isSpeaking(): Promise<boolean> {
    if (currentSound) {
      try {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) return true;
      } catch {}
    }
    return Speech.isSpeakingAsync();
  },
};
