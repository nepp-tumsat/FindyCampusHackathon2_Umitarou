import { Agent, callable } from 'agents'
import { MEMBERS } from '../data/members'
import { SEED_CONTACTS, SEED_EVENTS } from '../data/seed'
import {
  CHANNEL_LABELS,
  RECIPIENT_LABELS,
  type BoardPost,
  type Channel,
  type CircleEvent,
  type Contact,
  type Draft,
  type GoogleTokens,
  type HandoverDoc,
  type RecipientType
} from './sakurun-types'
import { createCalendarEvent, refreshGoogleToken, type CalendarEventInput } from '../integrations/google-calendar'
import { createNotionHandoverPage } from '../integrations/notion'

export type SakurunState = {
  contacts: Contact[]
  events: CircleEvent[]
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

const DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    body: { type: 'string', description: '生成した連絡文の本文' },
    missingInfo: {
      type: 'array',
      description:
        '状況説明・蓄積情報に対して5W1H（誰が/何を/いつ/どこで/なぜ/どのように）の観点で不足・曖昧な点があれば日本語の短い箇条書きで列挙する。十分な場合は空配列。',
      items: { type: 'string' }
    }
  },
  required: ['body', 'missingInfo']
}

type DraftGenerationResult = { body: string; missingInfo: string[] }

export class SakurunAgent extends Agent<CloudflareBindings, SakurunState> {
  initialState: SakurunState = {
    contacts: SEED_CONTACTS,
    events: SEED_EVENTS,
    drafts: [],
    boardPosts: [],
    googleAuth: null,
    handoverDocs: []
  }

  @callable()
  listMembers() {
    return MEMBERS
  }

  // --- 宛先マスタ ---
  @callable()
  listContacts() {
    return this.state.contacts ?? []
  }

  @callable()
  addContact(name: string, recipientType: RecipientType, defaultChannel: Channel, notes: string) {
    const contact: Contact = { id: crypto.randomUUID(), name, recipientType, defaultChannel, notes }
    this.setState({ ...this.state, contacts: [...(this.state.contacts ?? []), contact] })
    return contact
  }

  // --- イベント情報の蓄積（ドメイン知識ストア） ---
  @callable()
  listEvents() {
    return this.state.events ?? []
  }

  @callable()
  addEvent(title: string, date: string, details: string) {
    const event: CircleEvent = { id: crypto.randomUUID(), title, date, details, createdAt: Date.now() }
    this.setState({ ...this.state, events: [...(this.state.events ?? []), event] })
    return event
  }

  // --- 下書き生成 ---
  @callable()
  async draftMessage(contactId: string, channel: Channel, situation: string) {
    const contact = (this.state.contacts ?? []).find((c) => c.id === contactId)
    if (!contact) throw new Error(`contact not found: ${contactId}`)

    const memberSummary = MEMBERS.map(
      (m) =>
        `- ${m.name}（${m.grade}・${m.role}、参加率${m.participationRate}%、参加不可: ${
          m.unavailableDays.join('・') || 'なし'
        }）`
    ).join('\n')

    // データ量が少ない前提でイベント情報は全件注入し、LLMに関連箇所を拾わせる。
    // 蓄積が増えたらここをVectorize等の検索に差し替える。
    const eventSummary = (this.state.events ?? [])
      .map((e) => `- ${e.title}（${e.date}）: ${e.details}`)
      .join('\n')

    const prompt = `あなたはサークル運営を支援するAIアシスタント「さくるん」です。
以下の状況について、宛先「${contact.name}」向け、送信手段「${CHANNEL_LABELS[channel]}」の連絡文を日本語で作成してください。

宛先の情報:
- 分類: ${RECIPIENT_LABELS[contact.recipientType]}
- 関係性メモ: ${contact.notes || 'なし'}

トーン（宛先による丁寧さ）の指針: ${RECIPIENT_TONE_GUIDE[contact.recipientType]}
フォーマット（送信手段による構成）の指針: ${CHANNEL_STYLE_GUIDE[channel]}

サークルの蓄積情報（イベント）— 状況に関係するものだけを文脈として使うこと:
${eventSummary || '（まだ登録なし）'}

参考情報（メンバーデータ）:
${memberSummary}

状況: ${situation}

bodyには本文のみ（前置きや説明は不要）を書いてください。蓄積情報に日付や会場などの事実があれば、推測せずそれを使ってください。
missingInfoには、状況説明と蓄積情報を5W1H（誰が/何を/いつ/どこで/なぜ/どのように）の観点で見たときに、
不足・曖昧なため本文中で断定・具体化できなかった点を、日本語の短い箇条書きで列挙してください。
十分な場合は空配列にしてください。`

    const result = await this.env.AI.run(MODEL, {
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: DRAFT_RESPONSE_SCHEMA }
    })

    const parsed = this.parseDraftResult(result)

    const draft: Draft = {
      id: crypto.randomUUID(),
      contactId: contact.id,
      contactName: contact.name,
      recipientType: contact.recipientType,
      channel,
      situation,
      generatedText: parsed.body,
      editedText: parsed.body,
      missingInfo: parsed.missingInfo,
      status: 'draft',
      postedToBoard: false
    }

    this.setState({ ...this.state, drafts: [...this.state.drafts, draft] })
    return draft
  }

  private parseDraftResult(result: unknown): DraftGenerationResult {
    const raw = typeof result === 'object' && result !== null && 'response' in result ? (result as { response: unknown }).response : result

    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw

    if (obj && typeof obj === 'object' && 'body' in obj) {
      const body = String((obj as { body: unknown }).body ?? '')
      const missingInfoRaw = (obj as { missingInfo?: unknown }).missingInfo
      const missingInfo = Array.isArray(missingInfoRaw) ? missingInfoRaw.map((m) => String(m)) : []
      return { body, missingInfo }
    }

    return { body: typeof raw === 'string' ? raw : '', missingInfo: [] }
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
            contactName: target.contactName,
            recipientType: target.recipientType,
            channel: target.channel,
            text: target.editedText,
            createdAt: Date.now()
          }
        ]
      : this.state.boardPosts

    const drafts = this.state.drafts.map((d) => (d.id === draftId ? confirmed : d))

    this.setState({ ...this.state, drafts, boardPosts })
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
