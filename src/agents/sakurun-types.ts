export type RecipientType = 'executive' | 'member' | 'taskAssignee' | 'partnerOrg' | 'company'

export type Channel = 'email' | 'line'

export type Member = {
  id: string
  name: string
  grade: string
  role: string
  participationRate: number
  unavailableDays: string[]
}

export type Contact = {
  id: string
  name: string
  recipientType: RecipientType
  defaultChannel: Channel
  notes: string
}

export type CircleEvent = {
  id: string
  title: string
  date: string
  details: string
  createdAt: number
}

export type Draft = {
  id: string
  contactId: string
  contactName: string
  recipientType: RecipientType
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
  recipientType: RecipientType
  channel: Channel
  text: string
  createdAt: number
}

export const RECIPIENT_LABELS: Record<RecipientType, string> = {
  executive: '幹部',
  member: 'メンバー',
  taskAssignee: 'タスクを依頼する相手',
  partnerOrg: '外部協力団体（他大学の実行委員会など）',
  company: '協賛企業'
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

export type HandoverDoc = {
  id: string
  title: string
  content: string
  notionUrl?: string
  createdAt: number
}
