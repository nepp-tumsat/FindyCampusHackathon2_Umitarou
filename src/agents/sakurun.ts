import { Agent, callable } from 'agents'
import { MEMBERS } from '../data/members'
import {
  CHANNEL_LABELS,
  RECIPIENT_LABELS,
  type BoardPost,
  type Channel,
  type Draft,
  type GoogleTokens,
  type HandoverDoc,
  type RecipientType
} from './sakurun-types'
import { createCalendarEvent, refreshGoogleToken, type CalendarEventInput } from '../integrations/google-calendar'
import { createNotionHandoverPage } from '../integrations/notion'

export type SakurunState = {
  drafts: Draft[]
  boardPosts: BoardPost[]
  googleAuth: GoogleTokens | null
  handoverDocs: HandoverDoc[]
}

const RECIPIENT_TONE_GUIDE: Record<RecipientType, string> = {
  executive: '率直かつ簡潔に。意思決定を仰ぐトーンで書く。',
  member: '分かりやすく前向きに。参加を促すトーンで書く。',
  taskAssignee: '依頼内容と期限を明確にし、丁寧にお願いするトーンで書く。',
  partnerOrg: 'フォーマルな敬語を使い、社外の団体宛の調整・依頼文として書く。',
  company: 'ビジネスメール形式。丁寧語・謙譲語を用いた、社外の企業宛の文書として書く。'
}

const CHANNEL_STYLE_GUIDE: Record<Channel, string> = {
  email: '件名を意識した書き出し・宛名・本文・結びの挨拶までを含む、きちんとした構成のメール文面として書く。改行や段落を適切に使う。',
  line: 'LINEのトークで送るような、短く話しかける文面として書く。宛名や結びの挨拶は省略し、1〜3文程度の簡潔さにする。'
}

const INTERNAL_RECIPIENTS: RecipientType[] = ['executive', 'member', 'taskAssignee']

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

export class SakurunAgent extends Agent<CloudflareBindings, SakurunState> {
  initialState: SakurunState = { drafts: [], boardPosts: [], googleAuth: null, handoverDocs: [] }

  @callable()
  listMembers() {
    return MEMBERS
  }

  @callable()
  async draftMessage(recipientType: RecipientType, channel: Channel, situation: string) {
    const memberSummary = MEMBERS.map(
      (m) =>
        `- ${m.name}（${m.grade}・${m.role}、参加率${m.participationRate}%、参加不可: ${
          m.unavailableDays.join('・') || 'なし'
        }）`
    ).join('\n')

    const prompt = `あなたはサークル運営を支援するAIアシスタント「さくるん」です。
以下の状況について、宛先「${RECIPIENT_LABELS[recipientType]}」向け、送信手段「${CHANNEL_LABELS[channel]}」の連絡文を日本語で作成してください。

トーン（宛先による丁寧さ）の指針: ${RECIPIENT_TONE_GUIDE[recipientType]}
フォーマット（送信手段による構成）の指針: ${CHANNEL_STYLE_GUIDE[channel]}

参考情報（メンバーデータ）:
${memberSummary}

状況: ${situation}

本文のみを出力してください。前置きや説明は不要です。`

    const result = await this.env.AI.run(MODEL, {
      messages: [{ role: 'user', content: prompt }]
    })

    const generatedText = typeof result === 'string' ? result : (result.response ?? '')

    const draft: Draft = {
      id: crypto.randomUUID(),
      recipientType,
      channel,
      situation,
      generatedText,
      editedText: generatedText,
      status: 'draft',
      postedToBoard: false
    }

    this.setState({ ...this.state, drafts: [...this.state.drafts, draft] })
    return draft
  }

  @callable()
  updateDraft(draftId: string, editedText: string) {
    const drafts = this.state.drafts.map((d) => (d.id === draftId ? { ...d, editedText } : d))
    this.setState({ ...this.state, drafts })
    return drafts.find((d) => d.id === draftId)
  }

  @callable()
  confirmDraft(draftId: string) {
    const target = this.state.drafts.find((d) => d.id === draftId)
    if (!target) throw new Error(`draft not found: ${draftId}`)

    const isInternal = INTERNAL_RECIPIENTS.includes(target.recipientType)
    const confirmed: Draft = { ...target, status: 'confirmed', postedToBoard: isInternal }

    const boardPosts: BoardPost[] = isInternal
      ? [
          ...this.state.boardPosts,
          {
            id: crypto.randomUUID(),
            recipientType: target.recipientType,
            channel: target.channel,
            text: target.editedText,
            createdAt: Date.now()
          }
        ]
      : this.state.boardPosts

    const drafts = this.state.drafts.map((d) => (d.id === draftId ? confirmed : d))

    this.setState({ drafts, boardPosts })
    return { draft: confirmed, postedToBoard: isInternal }
  }

  @callable()
  listBoardPosts() {
    return this.state.boardPosts
  }

  // --- Google Calendar連携（ストレッチ） ---
  // saveGoogleTokensはOAuthコールバック用のルート（src/index.tsx）からサーバー側で呼ぶ想定。
  // クライアントから直接呼べないよう@callableは付けない。
  saveGoogleTokens(tokens: GoogleTokens) {
    this.setState({ ...this.state, googleAuth: tokens })
  }

  @callable()
  getGoogleAuthStatus() {
    return { connected: !!this.state.googleAuth }
  }

  @callable()
  async createCalendarEvent(input: CalendarEventInput) {
    let tokens = this.state.googleAuth
    if (!tokens) {
      throw new Error('Googleカレンダーが未接続です。/auth/google から連携してください。')
    }
    if (tokens.expiresAt < Date.now() + 60_000) {
      tokens = await refreshGoogleToken(this.env, tokens.refreshToken)
      this.setState({ ...this.state, googleAuth: tokens })
    }
    return createCalendarEvent(tokens.accessToken, input)
  }

  // --- Notion連携（ストレッチ） ---
  @callable()
  async saveHandoverDoc(title: string, content: string) {
    const result = await createNotionHandoverPage(this.env, title, content)
    const doc: HandoverDoc = {
      id: crypto.randomUUID(),
      title,
      content,
      notionUrl: result.url,
      createdAt: Date.now()
    }
    this.setState({ ...this.state, handoverDocs: [...(this.state.handoverDocs ?? []), doc] })
    return doc
  }

  @callable()
  listHandoverDocs() {
    return this.state.handoverDocs ?? []
  }
}
