import { Agent, callable } from 'agents'
import { MEMBERS } from '../data/members'
import { SEED_CONTACTS, SEED_PROJECTS } from '../data/seed'
import {
  CHANNEL_LABELS,
  type BoardPost,
  type Channel,
  type Contact,
  type Draft,
  type GoogleTokens,
  type Note,
  type Project
} from './sakurun-types'
import { createCalendarEvent, refreshGoogleToken, type CalendarEventInput } from '../integrations/google-calendar'
import { createNotionPage } from '../integrations/notion'

export type SakurunState = {
  contacts: Contact[]
  projects: Project[]
  drafts: Draft[]
  boardPosts: BoardPost[]
  googleAuth: GoogleTokens | null
}

// チャンネルの物理的なフォーマット指針のみコードに残す。
// 宛先ごとのトーンはContact.styleNotes（ユーザーが編集して育てる）に委ねる。
const CHANNEL_STYLE_GUIDE: Record<Channel, string> = {
  email: '件名を意識した書き出し・宛名・本文・結びの挨拶までを含む、きちんとした構成のメール文面として書く。改行や段落を適切に使う。',
  line: 'LINEのトークで送るような、短く話しかける文面として書く。宛名や結びの挨拶は省略し、1〜3文程度の簡潔さにする。'
}

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
    projects: SEED_PROJECTS,
    drafts: [],
    boardPosts: [],
    googleAuth: null
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
  addContact(name: string, label: string, internal: boolean, defaultChannel: Channel, styleNotes: string) {
    const contact: Contact = { id: crypto.randomUUID(), name, label, internal, defaultChannel, styleNotes }
    this.setState({ ...this.state, contacts: [...(this.state.contacts ?? []), contact] })
    return contact
  }

  @callable()
  updateContactStyleNotes(contactId: string, styleNotes: string) {
    const contacts = (this.state.contacts ?? []).map((c) => (c.id === contactId ? { ...c, styleNotes } : c))
    this.setState({ ...this.state, contacts })
    return contacts.find((c) => c.id === contactId)
  }

  // --- プロジェクトとノート（文脈ストア） ---
  @callable()
  listProjects() {
    return this.state.projects ?? []
  }

  @callable()
  addProject(name: string) {
    const project: Project = { id: crypto.randomUUID(), name, notes: [], retrospective: '' }
    this.setState({ ...this.state, projects: [...(this.state.projects ?? []), project] })
    return project
  }

  @callable()
  addNote(projectId: string, text: string) {
    const now = Date.now()
    const note: Note = { id: crypto.randomUUID(), text, createdAt: now, updatedAt: now }
    const projects = (this.state.projects ?? []).map((p) =>
      p.id === projectId ? { ...p, notes: [...p.notes, note] } : p
    )
    this.setState({ ...this.state, projects })
    return note
  }

  @callable()
  updateNote(projectId: string, noteId: string, text: string) {
    const projects = (this.state.projects ?? []).map((p) =>
      p.id === projectId
        ? { ...p, notes: p.notes.map((n) => (n.id === noteId ? { ...n, text, updatedAt: Date.now() } : n)) }
        : p
    )
    this.setState({ ...this.state, projects })
  }

  @callable()
  deleteNote(projectId: string, noteId: string) {
    const projects = (this.state.projects ?? []).map((p) =>
      p.id === projectId ? { ...p, notes: p.notes.filter((n) => n.id !== noteId) } : p
    )
    this.setState({ ...this.state, projects })
  }

  // --- 下書き生成 ---
  @callable()
  async draftMessage(projectId: string | null, contactId: string, channel: Channel, situation: string) {
    const contact = (this.state.contacts ?? []).find((c) => c.id === contactId)
    if (!contact) throw new Error(`contact not found: ${contactId}`)

    const project = projectId ? (this.state.projects ?? []).find((p) => p.id === projectId) : undefined

    const memberSummary = MEMBERS.map(
      (m) =>
        `- ${m.name}（${m.grade}・${m.role}、参加率${m.participationRate}%、参加不可: ${
          m.unavailableDays.join('・') || 'なし'
        }）`
    ).join('\n')

    // データ量が少ない前提でノート・振り返りは全件注入し、LLMに関連箇所を拾わせる。
    // 蓄積が増えたらここをVectorize等の検索に差し替える。
    const projectContext = project
      ? `対象プロジェクト「${project.name}」のノート:\n${
          project.notes.map((n) => `- ${n.text}`).join('\n') || '（まだなし）'
        }`
      : '対象プロジェクト: 指定なし（サークル全般の連絡）'

    const pastRetrospectives = (this.state.projects ?? [])
      .filter((p) => p.retrospective && p.id !== projectId)
      .map((p) => `- ${p.name}: ${p.retrospective}`)
      .join('\n')

    const prompt = `あなたはサークル運営を支援するAIアシスタント「さくるん」です。
以下の状況について、宛先「${contact.name}」向け、送信手段「${CHANNEL_LABELS[channel]}」の連絡文を日本語で作成してください。

宛先の情報:
- 分類: ${contact.label}
- 書き方メモ（この宛先へのトーン・言葉遣いの指針。最優先で従うこと）: ${contact.styleNotes || 'なし'}

フォーマット（送信手段による構成）の指針: ${CHANNEL_STYLE_GUIDE[channel]}

${projectContext}

過去プロジェクトの振り返り（活かせる教訓があれば文面や提案に反映すること）:
${pastRetrospectives || '（まだなし）'}

参考情報（メンバーデータ）:
${memberSummary}

状況: ${situation}

bodyには本文のみ（前置きや説明は不要）を書いてください。ノートに日付や会場などの事実があれば、推測せずそれを使ってください。
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
      projectId: project?.id ?? null,
      projectName: project?.name ?? '',
      contactId: contact.id,
      contactName: contact.name,
      contactLabel: contact.label,
      internal: contact.internal,
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
    const raw =
      typeof result === 'object' && result !== null && 'response' in result
        ? (result as { response: unknown }).response
        : result

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

    const confirmed: Draft = { ...target, status: 'confirmed', postedToBoard: target.internal }

    const boardPosts: BoardPost[] = target.internal
      ? [
          ...this.state.boardPosts,
          {
            id: crypto.randomUUID(),
            contactName: target.contactName,
            contactLabel: target.contactLabel,
            channel: target.channel,
            text: target.editedText,
            createdAt: Date.now()
          }
        ]
      : this.state.boardPosts

    const drafts = this.state.drafts.map((d) => (d.id === draftId ? confirmed : d))

    this.setState({ ...this.state, drafts, boardPosts })
    return { draft: confirmed, postedToBoard: target.internal }
  }

  @callable()
  listBoardPosts() {
    return this.state.boardPosts
  }

  // --- 振り返り（PDCA） ---
  @callable()
  async generateRetrospective(projectId: string) {
    const project = (this.state.projects ?? []).find((p) => p.id === projectId)
    if (!project) throw new Error(`project not found: ${projectId}`)

    const confirmedDrafts = this.state.drafts
      .filter((d) => d.projectId === projectId && d.status === 'confirmed')
      .map((d) => `- ${d.contactName}宛（${CHANNEL_LABELS[d.channel]}）: ${d.editedText}`)
      .join('\n')

    const prompt = `あなたはサークル運営を支援するAIアシスタント「さくるん」です。
プロジェクト「${project.name}」の振り返りドラフトをKPT形式（Keep/Problem/Try）で作成してください。

プロジェクトのノート:
${project.notes.map((n) => `- ${n.text}`).join('\n') || '（なし）'}

このプロジェクトで実際に送った連絡:
${confirmedDrafts || '（なし）'}

事実に基づいて書き、推測で断定しないでください。情報が足りない観点は「要確認」として挙げてください。
【Keep】【Problem】【Try】の3見出しで、それぞれ簡潔な箇条書きにしてください。
これは幹部が編集して確定する下書きです。本文のみを出力してください。`

    const result = await this.env.AI.run(MODEL, {
      messages: [{ role: 'user', content: prompt }]
    })

    const text = typeof result === 'string' ? result : (result.response ?? '')
    return { projectId, text }
  }

  @callable()
  saveRetrospective(projectId: string, text: string) {
    const projects = (this.state.projects ?? []).map((p) => (p.id === projectId ? { ...p, retrospective: text } : p))
    this.setState({ ...this.state, projects })
    return projects.find((p) => p.id === projectId)
  }

  // --- Notion書き出し（プロジェクトの文脈・振り返りを長期保管） ---
  @callable()
  async exportProjectToNotion(projectId: string) {
    const project = (this.state.projects ?? []).find((p) => p.id === projectId)
    if (!project) throw new Error(`project not found: ${projectId}`)

    const result = await createNotionPage(this.env, `さくるん: ${project.name}`, [
      { heading: 'ノート', paragraphs: project.notes.length > 0 ? project.notes.map((n) => n.text) : ['（なし）'] },
      { heading: '振り返り', paragraphs: [project.retrospective || '（未実施）'] }
    ])

    const projects = (this.state.projects ?? []).map((p) => (p.id === projectId ? { ...p, notionUrl: result.url } : p))
    this.setState({ ...this.state, projects })
    return result
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
}
