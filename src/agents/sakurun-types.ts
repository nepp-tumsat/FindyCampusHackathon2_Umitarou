export type Channel = 'email' | 'line'

// メンバーも編集して育てる記憶の一部。memoには得意なこと・興味・声かけのコツなどを
// 自由に書き、さくるんが依頼や声かけで一人ひとりに合った頼み方をするのに使う。
// 役割をうまく頼れることが、メンバーの当事者意識を育てる起点になる。
export type Member = {
  id: string
  name: string
  grade: string
  role: string
  unavailableDays: string[]
  memo: string
}

// 活動ごとの出欠記録。参加率は手入力ではなく、この記録から自動計算する
export type AttendanceRecord = {
  id: string
  date: string
  presentMemberIds: string[]
  createdAt: number
}

// 宛先。分類は固定enumではなく自由記述のラベルと「書き方メモ」で表現する。
// トーンの指針はコードに埋め込まず、styleNotesとしてユーザーが編集して育てる。
export type Contact = {
  id: string
  name: string
  label: string
  internal: boolean
  defaultChannel: Channel
  styleNotes: string
}

// プロジェクト配下に自由記述のノートを蓄積する。スキーマで縛らない。
export type Note = {
  id: string
  text: string
  createdAt: number
  updatedAt: number
}

export type Project = {
  id: string
  name: string
  notes: Note[]
  retrospective: string
}

export type Draft = {
  id: string
  // 同時に生成された下書きのまとまり（1回の生成・定例の1回の実行・1つの返信）。
  // UIはこの単位でアコーディオン表示する
  batchId: string
  createdAt: number
  projectId: string | null
  projectName: string
  contactId: string
  contactName: string
  contactLabel: string
  internal: boolean
  channel: Channel
  situation: string
  generatedText: string
  editedText: string
  missingInfo: string[]
  usedRetroProjects: string[]
  source: 'manual' | 'routine' | 'auto' | 'reply'
  routineName?: string
  selectionReason?: string
  // 返信スレッド：確定後に相手からの返信を貼り付けると、やり取りを文脈に
  // 返事の下書きが作られる。replyToDraftIdで元の下書きに紐づく
  replyToDraftId?: string
  receivedReply?: string
  status: 'draft' | 'confirmed'
  postedToBoard: boolean
}

// 定例ワーク。scheduleSpecの内容でAgents SDKのスケジュールを張り、
// 発火時に下書きを自動生成する（確定は人間が行う）
export type RoutineSchedule =
  | { kind: 'demoMinutely' }
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'weekly'; dayOfWeek: number; hour: number; minute: number }

export type Routine = {
  id: string
  name: string
  schedule: RoutineSchedule
  scheduleLabel: string
  contactIds: string[]
  projectId: string | null
  situation: string
  scheduleId: string
  lastRunAt: number | null
}

// 掲示板の投稿。sent=確定した連絡が流れたもの、free=部員の自由な書き込み
export type BoardPost = {
  id: string
  kind: 'sent' | 'free'
  contactName?: string
  contactLabel?: string
  channel?: Channel
  authorName?: string
  text: string
  createdAt: number
}

// 相談（さくるんとの会話）。返答には「この内容で連絡文を作ろうか？」という
// 提案が付くことがあり、人間がボタンで承認すると下書き生成に繋がる。
export type DraftSuggestion = {
  situation: string
  projectId: string | null
  description: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'sakurun'
  text: string
  suggestions: DraftSuggestion[]
  createdAt: number
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: 'メール',
  line: 'LINE'
}

export const SAKURUN_INSTANCE_NAME = 'default'
