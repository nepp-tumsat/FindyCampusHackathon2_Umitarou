export type Channel = 'email' | 'line'

export type Member = {
  id: string
  name: string
  grade: string
  role: string
  participationRate: number
  unavailableDays: string[]
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
  notionUrl?: string
}

export type Draft = {
  id: string
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
  status: 'draft' | 'confirmed'
  postedToBoard: boolean
}

export type BoardPost = {
  id: string
  contactName: string
  contactLabel: string
  channel: Channel
  text: string
  createdAt: number
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: 'メール',
  line: 'LINE'
}

export const SAKURUN_INSTANCE_NAME = 'default'

export type GoogleTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}
