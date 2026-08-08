# 初回実装タスク

## やること
さくるんのコア体験（自然文の依頼→宛先タイプ別トーンでAI下書き→Human-in-the-loopで編集・確定→内部宛は掲示板へ反映）をバックエンド中心に実装する。UIは別メンバーが本実装するため、動作確認用の簡易モックでよい。

## 決定事項
- AI呼び出しはWorkers AI binding（`env.AI`）を使う。Cloudflareアカウントの無料枠で完結し、APIキー取得などのセットアップが不要なため、ハッカソン当日に一番早く動かせる選択肢として採用（docs/architecture.mdに追記）

## タスクリスト
- [x] `wrangler.jsonc`にWorkers AI binding（`AI`）を追加し、型を再生成する
- [x] メンバーのモックデータを定義する（名前、学年、役職、参加率、参加不可曜日）
- [x] `SakurunAgent`（Durable Object）を実装する
  - [x] メンバーデータ参照
  - [x] 宛先タイプ（幹部／メンバー／タスク依頼相手／外部協力団体／企業）に応じたトーンで下書き生成
  - [x] 下書きの編集・確定（Human-in-the-loop）
  - [x] 確定後、内部宛は掲示板データへ反映
- [x] 動作確認用の簡易フロントエンド（宛先選択・状況入力・下書き表示・編集・確定ボタン）
- [x] `npm run build`が通ることを確認
- [x] `npx wrangler login`後、`npm run dev`で実機のAI応答まで動作確認する（RPCクライアントで直接検証。企業宛は掲示板に載らず、メンバー宛は掲示板に反映されることを確認済み）

## 完了条件
- 宛先タイプを変えて下書きを生成すると、トーンが明確に変わることを画面上で確認できる
- 下書きを編集して確定すると、内部宛の場合は掲示板データに反映される
- `npm run build`がエラーなく通る

## ストレッチ機能の土台（Google Calendar / Notion）
認証情報（Google OAuthクライアントID/シークレット、Notionトークン）が届く前に、コード側の受け口だけ用意した。

- [x] `src/integrations/google-calendar.ts` — OAuth URL生成・トークン交換・リフレッシュ・イベント作成
- [x] `src/integrations/notion.ts` — 引き継ぎページ作成（Notion API）
- [x] `SakurunAgent`にツール追加：`getGoogleAuthStatus` / `createCalendarEvent` / `saveHandoverDoc` / `listHandoverDocs`
- [x] `src/index.tsx`に`/auth/google`, `/auth/google/callback`のOAuthルートを追加
- [x] `src/env.d.ts`でGOOGLE_*/NOTION_*の型を定義（wrangler.jsoncには秘密情報を書かないため手動追加）
- [x] `.dev.vars.example`を用意（値を埋めて`.dev.vars`にコピーすれば動く）
- [x] モックUIに接続状態表示・Notion保存フォームを追加
- [ ] 実際の認証情報が届いたら、`.dev.vars`に設定して動作確認する（未設定の間は「未接続」「Notion連携が未設定です」等のエラーで安全に失敗する設計）
