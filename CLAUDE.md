# AI街歩きガイド (tabi-guide)

## 現在のビルド
- バージョン: 1.0.3 (38) — TestFlight 配信中

## 主要ドキュメント
- [収益化戦略](docs/monetization.md) — 課金モデル、エリアパック構想、ASO、5/1データ分析

## マルチセッション運用（2026-05-05〜）
複数セッション並走時は以下のルールで同期:
1. **canonical state** は `docs/*.md` を直接更新（例: `docs/monetization.md`）
2. **作業ログ** は `.claude/session-log-YYYY-MM-DD.md` に追記式（消さない）
3. 各セッションは**作業開始時にログを読み、終了時に追記**
4. エントリ書式: `### HH:MM [セッション名]` + 要点・決定事項・次アクション
5. **役割分担はログ冒頭で都度確認**（流動的なため、固定化しない）

### 現在の役割分担（2026-05-05）
- **CLI / メインリポセッション** — 戦略立案・分析（ASC、マーケット、差別化）→ 結論を `docs/monetization.md` に反映
- **「0505 街歩きアプリ開発」** — 実装・コンテンツ制作。`monetization.md` を読んで作業（別途の実装指示書は作らない）

## 概要
日本国内向けの位置連動型旅ガイドアプリ。Expo (React Native) + TypeScript。
GPS連動で近くのスポットに近づくと自動で音声ガイドを再生。
個人プロジェクト（Terveys事業とは別）。

## 技術スタック
- Expo SDK 54 / React Native + TypeScript
- Google Maps API (iOS/Android両対応)
- AsyncStorage (ローカルストレージ)
- Supabase (バックエンド・PostGIS・スポットデータ管理 + Edge Function で Claude API 経由化 2026-05-05〜)
- Claude API (AIチャット・Haiku 4.5、Edge Function 経由)
- react-native-iap (アプリ内課金)
- Bundle ID: com.tabishiroguide.app
- EAS Project ID: 1fbf1e35-aada-4b2d-9d0b-b2c15aeefed7（プロジェクト登録のみ、EAS Build は未使用）

## ビルド方式（重要）
- **iOS ビルドは Xcode 直接で行う**（EAS Build は使わない）
- 手順: `open ios/AI.xcworkspace` → Xcode で Archive → Distribute App → App Store Connect
- 直近ビルド: Build 38（2026-05-03 archive、2026-04-28 upload.log）
- 理由: EAS Build 月次枠温存、ローカル M2 Mac の方が速い、証明書設定済み

## 画面構成 (App.tsx)
- onboarding: 初回オンボーディング
- onboarding_replay: オンボーディング再生
- category: カテゴリ選択画面（デフォルト）
- guide: ガイド画面（メイン）

## src構成
- components/ - UIコンポーネント
- data/ - カテゴリ定義、サンプルデータ
- hooks/ - カスタムフック
- screens/
  - CategorySelectScreen.tsx - カテゴリ/ジャンル選択
  - GuideScreen.tsx - メインガイド画面
  - OnboardingScreen.tsx - オンボーディング（6スライド）
- services/
  - claude-chat.ts - Claude API連携（Wikipedia情報+Claude知識）
  - iap.ts - アプリ内課金
  - location.ts - 位置情報
  - speech-dict.ts - 音声発音辞書
  - speech.ts - 音声合成(TTS) Otoya（拡張）優先
  - spots-api.ts - スポット情報API
  - supabase.ts - Supabase接続

## カテゴリ
- 史跡・寺社 (shrine_history) = historical + temple
- 観光名所 (attraction) = nature + museum + viewpoint
- グルメ (restaurant) — 食べログ3.5以上、ラーメンは無料
- 文化遺産 (heritage)

## スポットデータ（2026-04-04時点）
- 合計: 18,676件
- 史跡・寺社: 7,643件
- 観光名所: 3,695件（2回のGoogle Places収集で拡大済み）
- グルメ: 7,670件（食べログベース、評価99.97%網羅）
- 文化遺産: 876件
- 全スポットradius: 50m
- データソース: Google Places API + 食べログスクレイピング（OSMデータは品質問題で全削除済み）

## 対象地域
関東（東京・神奈川・埼玉・千葉・茨城・栃木・群馬）、関西（大阪・京都・奈良）、
東海（名古屋）、北陸（金沢）、東北（仙台・松島）、九州・中国（福岡・広島）、北海道（札幌）、箱根、日光
※神戸はデータ少のため対象地域表記から除外（DBにデータは残存、近づけば表示）
※四国はv1対象外

## ★ 今回のセッションで完了した作業
- App.tsx: 「レストランパック」→「グルメパック」統一
- アイコンに白背景追加（icon.png, adaptive-icon.png）
- オンボーディング地域分け修正（東北追加、神戸削除、関東は県→都市の順）
- オンボーディングスポット数: 18,000+
- 表示範囲カテゴリ順修正（史跡・寺社・観光名所・文化遺産）
- 音声: Otoya（拡張）を最優先に変更
- 英語切り替えUI（JA/ENボタン）削除
- アンケートページのnestedScrollEnabled追加
- 観光名所データ追加収集（ラウンド1: 877件、ラウンド2: 1,014件）
- 仙台の全カテゴリ追加収集（史跡・寺社・グルメ・文化遺産: 219件）
- 食べログ評価なしレストラン再収集（443+244件削除→食べログベースで再収集）
- OSM由来データ全削除（5,432件）— 低品質・座標不正確のため
- OSM残存低品質データ追加削除（庚申塔・道祖神・碑・句碑・駐車場等: 約980件）
- 全スポットradius: 50mに統一
- App Store Connect: プロモテキスト・概要を18,000スポット・18地域に更新
- EASビルド作成・App Store Connectにアップロード済み（ビルド6）

## ★ 審査再提出済み（2026-04-06 ビルド14）
- 2.3.8対応: アイコン白背景
- 2.1(b)対応: requestPurchase API修正（react-native-iap v14対応）、Paid Apps Agreement有効、納税フォーム完了
- 2.5.4対応: UIBackgroundModes削除、フォアグラウンドのみで位置情報使用
- 写真表示修正: Google Places API skipHttpRedirect対応 + APIキーフォールバック追加 + 住所付き検索で精度向上（半径200m）
- AIチャットサブスクリプション分離: グルメパック（¥500買い切り）とAIチャット（¥100/月）を独立
- アナリティクス実装: Supabase analytics_eventsテーブルで利用状況収集
- 食べログ評価スコア非表示（リンクのみ提供）、audio_textからも食べログ言及削除
- 食べログ再収集v2（data-detail-urlベース、インデックスずれ修正）、地域不一致246件+URLなし44件削除
- カテゴリ表示: 横スクロール+短縮表記
- サブスクリプション管理リンク追加（ChatModal内）
- プライバシーポリシー更新（アナリティクス開示+免責事項追加）
- スクショ9枚差し替え済み（1284x2778px）
- メタデータ更新済み（18,000スポット、18地域）
- 音声: Otoya（拡張）、rate 1.0
- TestFlightで動作確認済み
- 審査結果待ち

## ★ 審査通過後のタスク
- アプリ内課金「グルメパック」の画像説明文を修正：「評価とリンク」→「リンク」に変更（評価非表示にしたため）
- 食べログへの利用許可の問い合わせ結果を確認

## ★ 将来のカテゴリ追加（v2以降）
1. 近くの公衆トイレ
2. 無料休憩施設
3. アニメの聖地

## ★ 既知の課題
- 英語対応は後日
- 神戸のデータが少ない（12件）→ 将来的に追加収集検討

## 関連パス
- プロジェクト: ~/Projects/tabi-guide/
- プライバシー: ~/Projects/tabi-guide-privacy/
- SS元画像: ~/IPhoneアプリ/Onboarding shots/Submission/
- リサイズ済みSS: ~/IPhoneアプリ/Onboarding shots/Submission/resized/

## 注意事項
- Claude Codeに画像を送る際はfor-claude/のリサイズ版(1200px幅)を使用
- 一度に送る画像は2-3枚まで（2000px制限）
- 提出用は元サイズを使用
- OSMデータは使用しない（品質問題のため）
- グルメデータは食べログベースのみ（Google Places単体での収集は不可）
- 有料API使用前に必ず費用確認（無料枠の確認含む）
