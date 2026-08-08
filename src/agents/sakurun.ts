import { Agent, callable } from 'agents'
import { MEMBERS, SEED_ATTENDANCE } from '../data/members'
import { SEED_CONTACTS, SEED_PROJECTS } from '../data/seed'
import {
  CHANNEL_LABELS,
  type AttendanceRecord,
  type BoardPost,
  type Channel,
  type ChatMessage,
  type Contact,
  type Draft,
  type DraftSuggestion,
  type Member,
  type Note,
  type Project,
  type Routine,
  type RoutineSchedule
} from './sakurun-types'

export type SakurunState = {
  contacts: Contact[]
  projects: Project[]
  members: Member[]
  attendance: AttendanceRecord[]
  drafts: Draft[]
  boardPosts: BoardPost[]
  routines: Routine[]
  chat: ChatMessage[]
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

const TARGET_SELECTION_SCHEMA = {
  type: 'object',
  properties: {
    targets: {
      type: 'array',
      description: 'この状況を伝えるべき宛先。伝える必要がない相手は含めない。',
      items: {
        type: 'object',
        properties: {
          contactId: { type: 'string', description: '宛先一覧に示されたid' },
          channel: { type: 'string', enum: ['email', 'line'], description: 'この宛先に適した送信手段' },
          reason: { type: 'string', description: 'この宛先を選んだ理由（日本語で簡潔に）' }
        },
        required: ['contactId', 'channel', 'reason']
      }
    }
  },
  required: ['targets']
}

type TargetSelection = { contactId: string; channel: Channel; reason: string }

const CONSULT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: '相談への返答（日本語。共感し、記憶の事実に基づいて具体的に助言する）' },
    draftSuggestions: {
      type: 'array',
      description:
        '相談の解決に連絡が有効な場合の提案。不要なら空配列。situationはそのまま下書き生成に使える状況説明文にする。',
      items: {
        type: 'object',
        properties: {
          situation: { type: 'string', description: '下書き生成に渡す状況説明文' },
          projectId: { type: 'string', description: '関連するプロジェクトのid。なければ空文字' },
          description: { type: 'string', description: 'ボタンに表示する短い説明（例：高橋くんへの声かけ文を作る）' }
        },
        required: ['situation', 'projectId', 'description']
      }
    }
  },
  required: ['reply', 'draftSuggestions']
}

export class SakurunAgent extends Agent<CloudflareBindings, SakurunState> {
  initialState: SakurunState = {
    contacts: SEED_CONTACTS,
    projects: SEED_PROJECTS,
    members: MEMBERS,
    attendance: SEED_ATTENDANCE,
    drafts: [],
    boardPosts: [],
    routines: [],
    chat: []
  }

  // --- メンバー（編集して育てる記憶の一部） ---
  @callable()
  listMembers() {
    return this.state.members ?? MEMBERS
  }

  @callable()
  updateMemberMemo(memberId: string, memo: string) {
    const members = (this.state.members ?? MEMBERS).map((m) => (m.id === memberId ? { ...m, memo } : m))
    this.setState({ ...this.state, members })
    return members.find((m) => m.id === memberId)
  }

  @callable()
  updateMember(memberId: string, patch: Partial<Pick<Member, 'name' | 'grade' | 'role' | 'unavailableDays' | 'memo'>>) {
    const members = (this.state.members ?? MEMBERS).map((m) => (m.id === memberId ? { ...m, ...patch } : m))
    this.setState({ ...this.state, members })
    return members.find((m) => m.id === memberId)
  }

  @callable()
  addMember(name: string, grade: string, role: string, memo: string) {
    const member: Member = {
      id: crypto.randomUUID(),
      name,
      grade,
      role,
      unavailableDays: [],
      memo
    }
    this.setState({ ...this.state, members: [...(this.state.members ?? MEMBERS), member] })
    return member
  }

  @callable()
  deleteMember(memberId: string) {
    this.setState({ ...this.state, members: (this.state.members ?? MEMBERS).filter((m) => m.id !== memberId) })
  }

  // --- 出欠記録（参加率は手入力ではなくここから自動計算する） ---
  @callable()
  recordAttendance(date: string, presentMemberIds: string[]) {
    const record: AttendanceRecord = { id: crypto.randomUUID(), date, presentMemberIds, createdAt: Date.now() }
    this.setState({ ...this.state, attendance: [...(this.state.attendance ?? []), record] })
    return record
  }

  @callable()
  deleteAttendance(recordId: string) {
    this.setState({ ...this.state, attendance: (this.state.attendance ?? []).filter((r) => r.id !== recordId) })
  }

  // 参加率（%）。記録が1件もなければnull
  private participationRate(memberId: string): number | null {
    const records = this.state.attendance ?? []
    if (records.length === 0) return null
    const attended = records.filter((r) => r.presentMemberIds.includes(memberId)).length
    return Math.round((attended / records.length) * 100)
  }

  private memberSummary() {
    return (this.state.members ?? MEMBERS)
      .map((m) => {
        const rate = this.participationRate(m.id)
        return `- ${m.name}（${m.grade}・${m.role}、${
          rate === null ? '参加率不明' : `参加率${rate}%`
        }、参加不可: ${m.unavailableDays.join('・') || 'なし'}）メモ: ${m.memo || 'なし'}`
      })
      .join('\n')
  }

  // 宛先の解決。宛先マスタに加え、メンバー個人（id: "member:mX"）にも送れるようにする。
  // メンバー宛の場合は本人のメモを書き方の手がかりとして使う。
  private resolveRecipient(recipientId: string): {
    id: string
    name: string
    label: string
    internal: boolean
    defaultChannel: Channel
    styleNotes: string
  } {
    if (recipientId.startsWith('member:')) {
      const m = (this.state.members ?? MEMBERS).find((x) => `member:${x.id}` === recipientId)
      if (!m) throw new Error(`member not found: ${recipientId}`)
      return {
        id: recipientId,
        name: m.name,
        label: 'メンバー個人',
        internal: true,
        defaultChannel: 'line',
        styleNotes: `${m.grade}・${m.role}。${m.memo}`
      }
    }
    const c = (this.state.contacts ?? []).find((x) => x.id === recipientId)
    if (!c) throw new Error(`contact not found: ${recipientId}`)
    return c
  }

  // 記憶の全体像。相談と下書き生成の両方で使う。
  // データ量が少ない前提で全件注入し、増えたらVectorize等の検索に差し替える。
  private memoryContext(projectId: string | null) {
    const project = projectId ? (this.state.projects ?? []).find((p) => p.id === projectId) : undefined

    const projectContext = project
      ? `対象プロジェクト「${project.name}」のノート:\n${
          project.notes.map((n) => `- ${n.text}`).join('\n') || '（まだなし）'
        }`
      : ''

    const allProjects = (this.state.projects ?? [])
      .map((p) => `- id: ${p.id} / ${p.name}: ${p.notes.map((n) => n.text).join(' / ') || '（ノートなし）'}`)
      .join('\n')

    const retroProjects = (this.state.projects ?? []).filter((p) => p.retrospective && p.id !== projectId)
    const pastRetrospectives = retroProjects.map((p) => `- ${p.name}: ${p.retrospective}`).join('\n')

    return { project, projectContext, allProjects, retroProjects, pastRetrospectives }
  }

  // --- 相談（さくるんのコア。困りごとを何でも聞き、必要なら連絡文作成を提案する） ---
  @callable()
  listChat() {
    return this.state.chat ?? []
  }

  @callable()
  async consult(text: string) {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      suggestions: [],
      createdAt: Date.now()
    }
    this.setState({ ...this.state, chat: [...(this.state.chat ?? []), userMessage] })

    const { allProjects, pastRetrospectives } = this.memoryContext(null)
    const contactCatalog = (this.state.contacts ?? [])
      .map((c) => `- ${c.name}（${c.label}）: ${c.styleNotes}`)
      .join('\n')

    const history = (this.state.chat ?? [])
      .slice(-8)
      .map((m) => `${m.role === 'user' ? '幹部' : 'さくるん'}: ${m.text}`)
      .join('\n')

    const prompt = `あなたはサークル運営に伴走するAIアシスタント「さくるん」です。
幹部の困りごとの相談相手として、下のサークルの記憶（事実）に基づいて具体的に答えてください。
推測で断定せず、記憶にないことは正直に「わからない」と言ってください。

サークルの記憶:
【プロジェクトとノート】
${allProjects || '（なし）'}

【過去の振り返り（教訓）】
${pastRetrospectives || '（なし）'}

【メンバー】
${this.memberSummary()}

【連絡できる宛先】
${contactCatalog}

これまでの会話:
${history}

replyには相談への返答を書いてください。メンバーへの依頼・声かけを助言するときは、そのメンバーのメモ
（得意・興味・声かけのコツ）を踏まえた頼み方を提案してください。
連絡を送ることが解決に有効なら、draftSuggestionsに提案を入れてください（勝手に送ることはできません。
幹部がボタンを押すと下書きが作られます）。`

    const result = await this.env.AI.run(MODEL, {
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: CONSULT_RESPONSE_SCHEMA }
    })

    const raw =
      typeof result === 'object' && result !== null && 'response' in result
        ? (result as { response: unknown }).response
        : result
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
      reply?: string
      draftSuggestions?: { situation: string; projectId: string; description: string }[]
    }

    const validProjectIds = new Set((this.state.projects ?? []).map((p) => p.id))
    const seenDescriptions = new Set<string>()
    const suggestions: DraftSuggestion[] = (parsed.draftSuggestions ?? [])
      .filter((s) => {
        if (seenDescriptions.has(s.description)) return false
        seenDescriptions.add(s.description)
        return true
      })
      .map((s) => ({
        situation: s.situation,
        projectId: validProjectIds.has(s.projectId) ? s.projectId : null,
        description: s.description
      }))

    const reply: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'sakurun',
      text: parsed.reply ?? 'ごめんなさい、うまく答えられませんでした。もう一度聞いてもらえますか？',
      suggestions,
      createdAt: Date.now()
    }
    this.setState({ ...this.state, chat: [...(this.state.chat ?? []), reply] })
    return reply
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

  @callable()
  deleteContact(contactId: string) {
    this.setState({ ...this.state, contacts: (this.state.contacts ?? []).filter((c) => c.id !== contactId) })
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
    return this.generateDraft(projectId, contactId, channel, situation, 'manual')
  }

  // 状況文から宛先をさくるんが判定して一括生成する（デフォルトの入り口）。
  // 判定理由は各下書きに残し、人間が破棄・編集・確定で最終判断する。
  @callable()
  async draftAuto(projectId: string | null, situation: string) {
    const contacts = this.state.contacts ?? []
    const members = this.state.members ?? MEMBERS
    const project = projectId ? (this.state.projects ?? []).find((p) => p.id === projectId) : undefined

    const contactCatalog = [
      ...contacts.map(
        (c) =>
          `- id: ${c.id} / ${c.name}（${c.label}、${c.internal ? '内部' : '外部'}、既定: ${
            CHANNEL_LABELS[c.defaultChannel]
          }）: ${c.styleNotes}`
      ),
      ...members.map(
        (m) => `- id: member:${m.id} / ${m.name}（メンバー個人、内部、既定: LINE）: ${m.grade}・${m.role}。${m.memo}`
      )
    ].join('\n')

    const selectionPrompt = `あなたはサークル運営を支援するAIアシスタント「さくるん」です。
以下の状況を、どの宛先に伝えるべきか判定してください。

宛先一覧:
${contactCatalog}

${project ? `関連プロジェクト「${project.name}」のノート:\n${project.notes.map((n) => `- ${n.text}`).join('\n')}` : ''}

状況: ${situation}

この状況を伝える必要がある宛先だけをtargetsに含めてください。関係のない宛先を含めてはいけません。
状況に特定の個人の名前があれば、その人（メンバー個人）を選んでください。
送信手段は各宛先の既定を基本とし、フォーマルさが必要な内容ならemailを選んでください。`

    const result = await this.env.AI.run(MODEL, {
      messages: [{ role: 'user', content: selectionPrompt }],
      response_format: { type: 'json_schema', json_schema: TARGET_SELECTION_SCHEMA }
    })

    const raw =
      typeof result === 'object' && result !== null && 'response' in result
        ? (result as { response: unknown }).response
        : result
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { targets?: TargetSelection[] }
    const validIds = new Set([...contacts.map((c) => c.id), ...members.map((m) => `member:${m.id}`)])
    const targets = (parsed.targets ?? []).filter((t) => validIds.has(t.contactId))

    const drafts: Draft[] = []
    for (const t of targets) {
      const draft = await this.generateDraft(projectId, t.contactId, t.channel, situation, 'auto')
      const withReason = { ...draft, selectionReason: t.reason }
      this.setState({
        ...this.state,
        drafts: this.state.drafts.map((d) => (d.id === draft.id ? withReason : d))
      })
      drafts.push(withReason)
    }

    return { targets, drafts }
  }

  private async generateDraft(
    projectId: string | null,
    contactId: string,
    channel: Channel,
    situation: string,
    source: 'manual' | 'routine' | 'auto',
    routineName?: string
  ) {
    const contact = this.resolveRecipient(contactId)

    const { project, projectContext, retroProjects, pastRetrospectives } = this.memoryContext(projectId)

    const prompt = `あなたはサークル運営を支援するAIアシスタント「さくるん」です。
以下の状況について、宛先「${contact.name}」向け、送信手段「${CHANNEL_LABELS[channel]}」の連絡文を日本語で作成してください。

宛先の情報:
- 分類: ${contact.label}
- 書き方メモ（この宛先へのトーン・言葉遣いの指針。最優先で従うこと）: ${contact.styleNotes || 'なし'}

フォーマット（送信手段による構成）の指針: ${CHANNEL_STYLE_GUIDE[channel]}

${projectContext || '対象プロジェクト: 指定なし（サークル全般の連絡）'}

過去プロジェクトの振り返り（活かせる教訓があれば文面や提案に反映すること）:
${pastRetrospectives || '（まだなし）'}

参考情報（メンバー。依頼や声かけの文面では、そのメンバーのメモに合った頼み方をすること）:
${this.memberSummary()}

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
      usedRetroProjects: retroProjects.map((p) => p.name),
      source,
      routineName,
      status: 'draft',
      postedToBoard: false
    }

    this.setState({ ...this.state, drafts: [...this.state.drafts, draft] })
    return draft
  }

  // 確定して送った後、相手からの返信を貼り付けると、やり取りを文脈に返事の下書きを作る
  @callable()
  async replyDraft(draftId: string, receivedReply: string) {
    const original = this.state.drafts.find((d) => d.id === draftId)
    if (!original) throw new Error(`draft not found: ${draftId}`)
    const contact = this.resolveRecipient(original.contactId)

    const { projectContext, pastRetrospectives } = this.memoryContext(original.projectId)

    const prompt = `あなたはサークル運営を支援するAIアシスタント「さくるん」です。
「${contact.name}」とのやり取りの続きとして、返事の文面を日本語で作成してください。

宛先の情報:
- 分類: ${contact.label}
- 書き方メモ（この宛先へのトーン・言葉遣いの指針。最優先で従うこと）: ${contact.styleNotes || 'なし'}

フォーマット（送信手段による構成）の指針: ${CHANNEL_STYLE_GUIDE[original.channel]}

${projectContext || ''}

過去プロジェクトの振り返り（活かせる教訓があれば反映すること）:
${pastRetrospectives || '（まだなし）'}

参考情報（メンバー）:
${this.memberSummary()}

これまでのやり取り:
【こちらが送った内容（当初の目的: ${original.situation}）】
${original.editedText}

【相手からの返信】
${receivedReply}

bodyには相手の返信を踏まえた返事の本文のみを書いてください。相手の質問には記憶にある事実で答え、
わからないことは確認して折り返す旨を書いてください。
missingInfoには、返事を書くうえで不足していて確認が必要な点を日本語の短い箇条書きで列挙してください。
十分な場合は空配列にしてください。`

    const result = await this.env.AI.run(MODEL, {
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: DRAFT_RESPONSE_SCHEMA }
    })

    const parsed = this.parseDraftResult(result)

    const draft: Draft = {
      id: crypto.randomUUID(),
      projectId: original.projectId,
      projectName: original.projectName,
      contactId: contact.id,
      contactName: contact.name,
      contactLabel: contact.label,
      internal: contact.internal,
      channel: original.channel,
      situation: `${contact.name}からの返信への返事`,
      generatedText: parsed.body,
      editedText: parsed.body,
      missingInfo: parsed.missingInfo,
      usedRetroProjects: [],
      source: 'reply',
      replyToDraftId: original.id,
      receivedReply,
      status: 'draft',
      postedToBoard: false
    }

    this.setState({ ...this.state, drafts: [...this.state.drafts, draft] })
    return draft
  }

  // --- 定例ワーク（routine） ---
  @callable()
  listRoutines() {
    return this.state.routines ?? []
  }

  @callable()
  async addRoutine(
    name: string,
    schedule: RoutineSchedule,
    scheduleLabel: string,
    contactIds: string[],
    projectId: string | null,
    situation: string
  ) {
    const routineId = crypto.randomUUID()

    let scheduleId: string
    if (schedule.kind === 'demoMinutely') {
      const s = await this.scheduleEvery(60, 'runRoutine', routineId)
      scheduleId = s.id
    } else {
      // Cloudflareのcron評価はUTCのため、JST（UTC+9）から変換する
      const jstMinutes = schedule.hour * 60 + schedule.minute
      const utcTotal = (jstMinutes - 9 * 60 + 24 * 60) % (24 * 60)
      const utcHour = Math.floor(utcTotal / 60)
      const utcMinute = utcTotal % 60
      const dayShift = jstMinutes < 9 * 60 ? -1 : 0
      const cron =
        schedule.kind === 'daily'
          ? `${utcMinute} ${utcHour} * * *`
          : `${utcMinute} ${utcHour} * * ${(schedule.dayOfWeek + dayShift + 7) % 7}`
      const s = await this.schedule(cron, 'runRoutine', routineId)
      scheduleId = s.id
    }

    const routine: Routine = {
      id: routineId,
      name,
      schedule,
      scheduleLabel,
      contactIds,
      projectId,
      situation,
      scheduleId,
      lastRunAt: null
    }
    this.setState({ ...this.state, routines: [...(this.state.routines ?? []), routine] })
    return routine
  }

  @callable()
  async deleteRoutine(routineId: string) {
    const routine = (this.state.routines ?? []).find((r) => r.id === routineId)
    if (!routine) return
    await this.cancelSchedule(routine.scheduleId)
    this.setState({ ...this.state, routines: (this.state.routines ?? []).filter((r) => r.id !== routineId) })
  }

  // スケジューラから呼ばれる。下書きの自動生成まで行い、確定は人間に委ねる
  async runRoutine(routineId: string) {
    const routine = (this.state.routines ?? []).find((r) => r.id === routineId)
    if (!routine) return

    for (const contactId of routine.contactIds) {
      try {
        const recipient = this.resolveRecipient(contactId)
        await this.generateDraft(
          routine.projectId,
          contactId,
          recipient.defaultChannel,
          routine.situation,
          'routine',
          routine.name
        )
      } catch (e) {
        console.error(`routine ${routine.name}: draft generation failed for ${contactId}`, e)
      }
    }

    const routines = (this.state.routines ?? []).map((r) => (r.id === routineId ? { ...r, lastRunAt: Date.now() } : r))
    this.setState({ ...this.state, routines })
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

}
