import { useEffect, useRef, useState } from 'react'
import { useAgent } from 'agents/react'
import type { SakurunAgent } from '../agents/sakurun'
import type { SakurunState } from '../agents/sakurun'
import {
  CHANNEL_LABELS,
  SAKURUN_INSTANCE_NAME,
  type Channel,
  type Contact,
  type DraftSuggestion,
  type RoutineSchedule
} from '../agents/sakurun-types'

const CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[]

const EMPTY_STATE: SakurunState = {
  contacts: [],
  projects: [],
  members: [],
  attendance: [],
  drafts: [],
  boardPosts: [],
  routines: [],
  chat: []
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// タブ順はユーザー（幹部）の行動起点で決める：
// さくるんの本体は「困りごとの相談窓口」なので相談が先頭＆初期表示。連絡・定例は
// 相談から繋がる（または直接使う）作る系の導線。記憶は不足に気づいたら整備しに行く
// 設定に近い場所。掲示板（公開）は右端に置き、内と外の境界を位置で表す。
type Tab = 'consult' | 'draft' | 'routine' | 'memory' | 'members' | 'board'

const TAB_LABELS: Record<Tab, string> = {
  consult: '相談する',
  draft: '連絡をつくる',
  routine: '定例',
  memory: 'サークルの記憶',
  members: 'メンバー',
  board: '掲示板'
}

type Selection = { enabled: boolean; channel: Channel }

export function SakurunWidget() {
  const [state, setState] = useState<SakurunState>(EMPTY_STATE)
  const [tab, setTab] = useState<Tab>('consult')

  const agent = useAgent<SakurunAgent, SakurunState>({
    agent: 'SakurunAgent',
    name: SAKURUN_INSTANCE_NAME,
    onStateUpdate: (s) => setState(s)
  })

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>さくるん</h1>
        <p className="tagline">アプリ一つでサークルの稼働率アップ！幹部負担を軽減するAIエージェント</p>
      </header>

      <nav className="tab-nav">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} type="button" className={`tab-nav-item${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
            {t === 'board' && <span className="badge badge-public">公開</span>}
            {t === 'draft' && state.drafts.filter((d) => d.status === 'draft').length > 0 && (
              <span className="tab-count">{state.drafts.filter((d) => d.status === 'draft').length}</span>
            )}
          </button>
        ))}
      </nav>
      <p className="visibility-note">掲示板以外は幹部（運営）だけが見る内側のページです</p>

      {tab === 'consult' && <ConsultTab agent={agent} state={state} goToDrafts={() => setTab('draft')} />}
      {tab === 'draft' && <DraftTab agent={agent} state={state} />}
      {tab === 'routine' && <RoutineTab agent={agent} state={state} />}
      {tab === 'memory' && <MemoryTab agent={agent} state={state} />}
      {tab === 'members' && <MembersTab agent={agent} state={state} />}
      {tab === 'board' && <BoardTab state={state} />}
    </div>
  )
}

type TabProps = {
  agent: ReturnType<typeof useAgent<SakurunAgent, SakurunState>>
  state: SakurunState
}

function ConsultTab({ agent, state, goToDrafts }: TabProps & { goToDrafts: () => void }) {
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [suggestionLoading, setSuggestionLoading] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const chat = state.chat ?? []

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.length, thinking])

  const handleSend = async () => {
    if (!input.trim() || thinking) return
    const text = input
    setInput('')
    setThinking(true)
    try {
      await agent.stub.consult(text)
    } finally {
      setThinking(false)
    }
  }

  const handleSuggestion = async (key: string, s: DraftSuggestion) => {
    if (suggestionLoading !== null) return
    setSuggestionLoading(key)
    try {
      await agent.stub.draftAuto(s.projectId, s.situation)
      goToDrafts()
    } finally {
      setSuggestionLoading(null)
    }
  }

  return (
    <section className="card">
      <h2>さくるんに相談する</h2>
      <p className="section-hint">
        困りごとを何でも話しかけてください。さくるんはサークルのこと（活動・メンバー・過去の反省）を覚えているので、それを踏まえて一緒に考えます。連絡が必要なら下書きの提案もします。
      </p>

      <div className="chat-list">
        {chat.length === 0 && (
          <p className="empty-state">
            例：「高橋くん最近来てないんだよね」「合宿の買い出し、誰に頼めばいいかな」「協賛のお礼っていつ送るべき？」
          </p>
        )}
        {chat.map((m) => (
          <div key={m.id} className={`chat-row ${m.role}`}>
            <div className={`chat-bubble ${m.role}`}>
              <p className="chat-text">{m.text}</p>
              {m.suggestions.length > 0 && (
                <div className="chat-suggestions">
                  {m.suggestions.map((s, i) => {
                    const key = `${m.id}:${i}`
                    return (
                      <button
                        key={key}
                        type="button"
                        className="btn btn-ghost suggestion-btn"
                        onClick={() => handleSuggestion(key, s)}
                        disabled={suggestionLoading !== null}
                      >
                        {suggestionLoading === key ? '下書きを作成中...' : `✎ ${s.description}`}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="chat-row sakurun">
            <div className="chat-bubble sakurun">
              <p className="chat-text">考え中...</p>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
          }}
          placeholder="困りごとを話しかける（Cmd/Ctrl+Enterで送信）"
          rows={2}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={thinking || !input.trim()}>
          送る
        </button>
      </div>
    </section>
  )
}

function DraftTab({ agent, state }: TabProps) {
  const [projectId, setProjectId] = useState<string>('p0')
  const [manualMode, setManualMode] = useState(false)
  const [selections, setSelections] = useState<Record<string, Selection>>({})
  const [situation, setSituation] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoNotice, setAutoNotice] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  const selectionFor = (c: Contact): Selection => selections[c.id] ?? { enabled: false, channel: c.defaultChannel }

  const toggleEnabled = (c: Contact) => {
    const cur = selectionFor(c)
    setSelections((prev) => ({ ...prev, [c.id]: { ...cur, enabled: !cur.enabled } }))
  }

  const setChannelFor = (c: Contact, channel: Channel) => {
    const cur = selectionFor(c)
    setSelections((prev) => ({ ...prev, [c.id]: { ...cur, channel } }))
  }

  const targets = (state.contacts ?? []).filter((c) => selectionFor(c).enabled)

  const handleGenerateAuto = async () => {
    if (!situation.trim()) return
    setLoading(true)
    setAutoNotice(null)
    try {
      const result = await agent.stub.draftAuto(projectId, situation)
      if (result.targets.length === 0) {
        setAutoNotice('宛先を判定できませんでした。状況をもう少し具体的に書くか、下の手動選択を使ってください。')
      } else {
        setSituation('')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateManual = async () => {
    if (!situation.trim() || targets.length === 0) return
    setLoading(true)
    try {
      await Promise.all(targets.map((c) => agent.stub.draftMessage(projectId, c.id, selectionFor(c).channel, situation)))
      setSituation('')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleReply = async (draftId: string) => {
    if (!replyText.trim()) return
    setReplying(true)
    try {
      await agent.stub.replyDraft(draftId, replyText)
      setReplyText('')
      setReplyOpenId(null)
    } finally {
      setReplying(false)
    }
  }

  return (
    <>
      <section className="card">
        <h2>さくるんに話しかける</h2>
        <p className="section-hint">
          状況を話しかけると、さくるんが「誰に・どの手段で」伝えるべきかまで考えて、相手ごとに書き分けた下書きを作ります。宛先が違ったら破棄すればOKです。
        </p>

        <div className="field-label">どの活動の連絡？</div>
        <select className="project-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {(state.projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="field" style={{ marginTop: 12 }}>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="状況を入力（例：デザイン担当の子にポスター作成をお願いしたい）"
            rows={3}
          />
        </div>
        {autoNotice && <p className="error-text">{autoNotice}</p>}
        <div className="actions-row">
          <button className="btn btn-primary" onClick={handleGenerateAuto} disabled={loading || !situation.trim()}>
            {loading ? '生成中...' : '下書き生成（宛先はさくるんが選ぶ）'}
          </button>
        </div>

        <details className="manual-select" open={manualMode} onToggle={(e) => setManualMode(e.currentTarget.open)}>
          <summary>宛先を自分で選ぶ</summary>
          <div className="target-checklist" style={{ marginTop: 8 }}>
            {(state.contacts ?? []).map((c) => {
              const sel = selectionFor(c)
              return (
                <div key={c.id} className={`target-row${sel.enabled ? ' enabled' : ''}`}>
                  <label className="target-row-label">
                    <input type="checkbox" checked={sel.enabled} onChange={() => toggleEnabled(c)} />
                    <span>
                      {c.name}
                      <span className={`badge ${c.internal ? 'badge-internal' : 'badge-external'}`}>{c.label}</span>
                    </span>
                  </label>
                  <div className="channel-toggle channel-toggle-inline">
                    {CHANNELS.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        className={`channel-tab${sel.channel === ch ? ' active' : ''}`}
                        onClick={() => setChannelFor(c, ch)}
                      >
                        {CHANNEL_LABELS[ch]}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="actions-row">
            <button
              className="btn btn-ghost"
              onClick={handleGenerateManual}
              disabled={loading || !situation.trim() || targets.length === 0}
            >
              {loading ? '生成中...' : `選んだ${targets.length}件に下書き生成`}
            </button>
          </div>
        </details>
      </section>

      <section className="card">
        <h2>下書き一覧</h2>
        {state.drafts.length === 0 && <p className="empty-state">まだ下書きはありません</p>}
        <div className="draft-list">
          {state.drafts
            .slice()
            .reverse()
            .map((d) => (
              <div key={d.id} className="draft-card">
                <div className="draft-card-header">
                  <span>
                    <strong>{d.contactName}</strong>{' '}
                    <span className={`badge ${d.internal ? 'badge-internal' : 'badge-external'}`}>{d.contactLabel}</span>{' '}
                    <span className="badge badge-channel">{CHANNEL_LABELS[d.channel]}</span>
                    {d.projectName && <span className="badge badge-project">{d.projectName}</span>}
                    {d.source === 'routine' && <span className="badge badge-routine">定例: {d.routineName}</span>}
                    {d.source === 'reply' && <span className="badge badge-routine">返信への返事</span>}
                  </span>
                  <span className={`status-badge${d.status === 'confirmed' ? ' confirmed' : ''}`}>
                    {d.status === 'confirmed' ? '確定済み' : '下書き（編集できます）'}
                  </span>
                </div>
                {d.receivedReply && <p className="reply-quote">相手からの返信: {d.receivedReply}</p>}
                <div className="field">
                  <textarea
                    defaultValue={d.editedText}
                    onBlur={(e) => agent.stub.updateDraft(d.id, e.target.value)}
                    rows={4}
                    disabled={d.status === 'confirmed'}
                  />
                </div>
                {d.selectionReason && <p className="selection-reason">さくるんがこの宛先を選んだ理由: {d.selectionReason}</p>}
                {(d.usedRetroProjects ?? []).length > 0 && (
                  <p className="retro-refs">
                    過去の教訓を反映: {(d.usedRetroProjects ?? []).map((n) => `「${n}」の振り返り`).join('、')}
                  </p>
                )}
                {(d.missingInfo ?? []).length > 0 && d.status === 'draft' && (
                  <div className="missing-info">
                    <p className="missing-info-title">送る前に確認：不足していそうな情報</p>
                    <ul>
                      {(d.missingInfo ?? []).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="actions-row">
                  <button className="btn btn-ghost" onClick={() => handleCopy(d.id, d.editedText)}>
                    {copiedId === d.id ? 'コピーしました ✓' : 'コピー'}
                  </button>
                  {d.status === 'draft' && (
                    <button className="btn btn-primary" onClick={() => agent.stub.confirmDraft(d.id)}>
                      確定して送る
                    </button>
                  )}
                  {d.status === 'confirmed' && replyOpenId !== d.id && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setReplyOpenId(d.id)
                        setReplyText('')
                      }}
                    >
                      返信が来た
                    </button>
                  )}
                </div>
                {d.status === 'confirmed' && replyOpenId === d.id && (
                  <div className="reply-form">
                    <div className="field">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="相手からの返信を貼り付けると、やり取りを踏まえた返事の下書きを作ります"
                        rows={3}
                      />
                    </div>
                    <div className="actions-row">
                      <button className="btn btn-ghost" onClick={() => setReplyOpenId(null)}>
                        閉じる
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleReply(d.id)}
                        disabled={replying || !replyText.trim()}
                      >
                        {replying ? '生成中...' : '返事の下書きを作る'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      </section>
    </>
  )
}

function MemoryTab({ agent, state }: TabProps) {
  const projects = state.projects ?? []
  const [selectedProjectId, setSelectedProjectId] = useState<string>('p0')
  const [newProjectName, setNewProjectName] = useState('')
  const [newNote, setNewNote] = useState('')
  const [retroDraft, setRetroDraft] = useState<string | null>(null)
  const [retroLoading, setRetroLoading] = useState(false)

  const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return
    const p = await agent.stub.addProject(newProjectName)
    setNewProjectName('')
    setSelectedProjectId(p.id)
  }

  const handleAddNote = async () => {
    if (!project || !newNote.trim()) return
    await agent.stub.addNote(project.id, newNote)
    setNewNote('')
  }

  const handleGenerateRetro = async () => {
    if (!project) return
    setRetroLoading(true)
    try {
      const r = await agent.stub.generateRetrospective(project.id)
      setRetroDraft(r.text)
    } finally {
      setRetroLoading(false)
    }
  }

  const handleSaveRetro = async () => {
    if (!project || retroDraft === null) return
    await agent.stub.saveRetrospective(project.id, retroDraft)
    setRetroDraft(null)
  }

  return (
    <>
      <section className="card">
        <h2>活動の記憶（プロジェクトとノート）</h2>
        <p className="section-hint">
          ここに書いておくと、さくるんが連絡文に日付・会場・金額などを推測ではなく事実として正しく反映できるようになります。
        </p>
        <div className="project-tabs">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`project-tab${project?.id === p.id ? ' active' : ''}`}
              onClick={() => {
                setSelectedProjectId(p.id)
                setRetroDraft(null)
              }}
            >
              {p.name}
              {p.retrospective && <span className="retro-mark" title="振り返り済み">✓</span>}
            </button>
          ))}
          <div className="project-add">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="新しいプロジェクト名"
            />
            <button type="button" className="btn btn-ghost" onClick={handleAddProject} disabled={!newProjectName.trim()}>
              追加
            </button>
          </div>
        </div>

        {project && (
          <>
            <h3 className="subsection-title">ノート（クリックで編集できます）</h3>
            <ul className="note-list">
              {project.notes.length === 0 && <p className="empty-state">まだノートはありません</p>}
              {project.notes.map((n) => (
                <li key={n.id} className="note-item">
                  <textarea
                    defaultValue={n.text}
                    rows={2}
                    onBlur={(e) => {
                      if (e.target.value !== n.text) agent.stub.updateNote(project.id, n.id, e.target.value)
                    }}
                  />
                  <button
                    type="button"
                    className="note-delete"
                    onClick={() => agent.stub.deleteNote(project.id, n.id)}
                    aria-label="削除"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="note-form">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="ノートを追加（決定事項、日付、会場、金額、気づき… 自由に）"
                rows={2}
              />
              <div className="actions-row">
                <button className="btn btn-ghost" onClick={handleAddNote} disabled={!newNote.trim()}>
                  + ノートを追加
                </button>
              </div>
            </div>

            <h3 className="subsection-title">振り返り</h3>
            {project.retrospective && retroDraft === null && (
              <div className="retro-saved">
                <p className="retro-text">{project.retrospective}</p>
                <p className="section-hint">保存済み。さくるんが今後の連絡づくりに教訓として活かします。</p>
              </div>
            )}
            {retroDraft === null ? (
              <div className="actions-row actions-row-start">
                <button className="btn btn-ghost" onClick={handleGenerateRetro} disabled={retroLoading}>
                  {retroLoading ? '生成中...' : project.retrospective ? '振り返りを作り直す' : '振り返りを生成'}
                </button>
              </div>
            ) : (
              <div className="retro-edit">
                <p className="section-hint">さくるんが作った下書きです。編集して保存してください。</p>
                <textarea value={retroDraft} onChange={(e) => setRetroDraft(e.target.value)} rows={6} />
                <div className="actions-row">
                  <button className="btn btn-ghost" onClick={() => setRetroDraft(null)}>
                    破棄
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveRetro}>
                    保存
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <ContactsSection agent={agent} state={state} />
    </>
  )
}

function ContactsSection({ agent, state }: TabProps) {
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [internal, setInternal] = useState(true)
  const [channel, setChannel] = useState<Channel>('line')
  const [notes, setNotes] = useState('')

  const handleAdd = async () => {
    if (!name.trim()) return
    await agent.stub.addContact(name, label.trim() || 'その他', internal, channel, notes)
    setName('')
    setLabel('')
    setNotes('')
  }

  return (
    <section className="card">
      <h2>人の記憶（宛先と書き方メモ）</h2>
      <p className="section-hint">相手ごとのトーン・言葉遣い・窓口担当などを自由に書いておくと、さくるんはそれに従って書き分けます。</p>
      <div className="contact-list">
        {(state.contacts ?? []).map((c) => (
          <div key={c.id} className="contact-item">
            <div className="contact-item-header">
              <strong>{c.name}</strong>
              <span className={`badge ${c.internal ? 'badge-internal' : 'badge-external'}`}>{c.label}</span>
              <span className="badge badge-channel">既定: {CHANNEL_LABELS[c.defaultChannel]}</span>
              <button
                type="button"
                className="note-delete item-delete"
                onClick={() => agent.stub.deleteContact(c.id)}
                aria-label="削除"
              >
                ×
              </button>
            </div>
            <textarea
              defaultValue={c.styleNotes}
              rows={2}
              onBlur={(e) => {
                if (e.target.value !== c.styleNotes) agent.stub.updateContactStyleNotes(c.id, e.target.value)
              }}
            />
          </div>
        ))}
      </div>

      <div className="add-form">
        <div className="add-form-row">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="宛先の名前（例：OB会）" />
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="分類（例：OB）" />
          <select value={internal ? 'internal' : 'external'} onChange={(e) => setInternal(e.target.value === 'internal')}>
            <option value="internal">内部（確定で掲示板へ）</option>
            <option value="external">外部（コピーして送信）</option>
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                既定: {CHANNEL_LABELS[ch]}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="書き方メモ（トーン・言葉遣い・窓口担当など）"
          rows={2}
        />
        <div className="actions-row">
          <button className="btn btn-ghost" onClick={handleAdd} disabled={!name.trim()}>
            + 宛先を追加
          </button>
        </div>
      </div>
    </section>
  )
}

function MembersTab({ agent, state }: TabProps) {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [role, setRole] = useState('')
  const [memo, setMemo] = useState('')

  const records = state.attendance ?? []
  const rateOf = (memberId: string) => {
    if (records.length === 0) return null
    const attended = records.filter((r) => r.presentMemberIds.includes(memberId)).length
    return { percent: Math.round((attended / records.length) * 100), attended, total: records.length }
  }

  const handleAdd = async () => {
    if (!name.trim()) return
    await agent.stub.addMember(name, grade.trim() || '学年不明', role.trim() || '一般部員', memo)
    setName('')
    setGrade('')
    setRole('')
    setMemo('')
  }

  const toggleDay = (memberId: string, days: string[], day: string) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    agent.stub.updateMember(memberId, { unavailableDays: next })
  }

  return (
    <>
    <section className="card">
      <h2>メンバー一覧</h2>
      <p className="section-hint">
        メンバーの情報はさくるんの記憶になります。得意なこと・興味・声かけのコツを書いておくと、依頼や声かけが「その人に合った頼み方」になります。参加率は下の出欠記録から自動計算されます。
      </p>

      <div className="contact-list">
        {(state.members ?? []).map((m) => {
          const rate = rateOf(m.id)
          return (
          <div key={m.id} className="contact-item member-row">
            <div className="member-edit-row">
              <input
                type="text"
                className="member-name"
                defaultValue={m.name}
                onBlur={(e) => {
                  if (e.target.value !== m.name && e.target.value.trim()) agent.stub.updateMember(m.id, { name: e.target.value })
                }}
              />
              <input
                type="text"
                className="member-grade"
                defaultValue={m.grade}
                onBlur={(e) => {
                  if (e.target.value !== m.grade) agent.stub.updateMember(m.id, { grade: e.target.value })
                }}
              />
              <input
                type="text"
                className="member-role"
                defaultValue={m.role}
                onBlur={(e) => {
                  if (e.target.value !== m.role) agent.stub.updateMember(m.id, { role: e.target.value })
                }}
              />
              <span className="badge badge-channel">
                {rate === null ? '参加率 未記録' : `参加率 ${rate.percent}%（${rate.total}回中${rate.attended}回）`}
              </span>
              <button
                type="button"
                className="note-delete item-delete"
                onClick={() => agent.stub.deleteMember(m.id)}
                aria-label="削除"
              >
                ×
              </button>
            </div>
            <div className="member-days">
              <span className="member-days-label">参加できない曜日:</span>
              {DAY_LABELS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`day-chip${m.unavailableDays.includes(d) ? ' selected' : ''}`}
                  onClick={() => toggleDay(m.id, m.unavailableDays, d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <textarea
              defaultValue={m.memo}
              rows={2}
              placeholder="得意なこと・興味・声かけのコツなど"
              onBlur={(e) => {
                if (e.target.value !== m.memo) agent.stub.updateMemberMemo(m.id, e.target.value)
              }}
            />
          </div>
          )
        })}
      </div>

      <div className="add-form">
        <div className="add-form-row">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="名前（例：山田 花）" />
          <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="学年（例：1年）" />
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="役職（例：一般部員）" />
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="メモ（得意なこと・興味・声かけのコツなど）"
          rows={2}
        />
        <div className="actions-row">
          <button className="btn btn-ghost" onClick={handleAdd} disabled={!name.trim()}>
            + メンバーを追加
          </button>
        </div>
      </div>
    </section>

    <AttendanceSection agent={agent} state={state} />
    </>
  )
}

function AttendanceSection({ agent, state }: TabProps) {
  const members = state.members ?? []
  const records = state.attendance ?? []
  const [date, setDate] = useState('')
  const [presentIds, setPresentIds] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)

  // 初期状態は全員出席にしておき、欠席者のチェックを外す運用にする
  const present = presentIds ?? members.map((m) => m.id)

  const togglePresent = (id: string) => {
    setPresentIds(present.includes(id) ? present.filter((p) => p !== id) : [...present, id])
  }

  const handleSave = async () => {
    if (!date) return
    setSaving(true)
    try {
      await agent.stub.recordAttendance(date, present)
      setDate('')
      setPresentIds(null)
    } finally {
      setSaving(false)
    }
  }

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '（退部済み）'

  return (
    <section className="card">
      <h2>出欠を記録する</h2>
      <p className="section-hint">
        活動日ごとに出席した人へチェックを入れて保存すると、参加率が自動で更新されます。
      </p>

      <div className="add-form-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="routine-contacts" style={{ marginBottom: 10 }}>
        {members.map((m) => (
          <label key={m.id} className={`routine-contact-chip${present.includes(m.id) ? ' selected' : ''}`}>
            <input type="checkbox" checked={present.includes(m.id)} onChange={() => togglePresent(m.id)} />
            {m.name}
          </label>
        ))}
      </div>
      <div className="actions-row actions-row-start">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !date}>
          {saving ? '保存中...' : 'この内容で記録する'}
        </button>
      </div>

      <h3 className="subsection-title">記録済み（{records.length}回）</h3>
      <ul className="routine-list">
        {records
          .slice()
          .reverse()
          .map((r) => (
            <li key={r.id} className="routine-item">
              <div>
                <strong>{r.date}</strong>
                <p className="routine-meta">
                  出席 {r.presentMemberIds.length}名: {r.presentMemberIds.map(memberName).join('、')}
                </p>
              </div>
              <button
                type="button"
                className="note-delete"
                onClick={() => agent.stub.deleteAttendance(r.id)}
                aria-label="削除"
              >
                ×
              </button>
            </li>
          ))}
      </ul>
    </section>
  )
}

function RoutineTab({ agent, state }: TabProps) {
  const [name, setName] = useState('')
  const [situation, setSituation] = useState('')
  const [projectId, setProjectId] = useState<string>('p0')
  const [contactIds, setContactIds] = useState<string[]>([])
  const [scheduleKind, setScheduleKind] = useState<'demoMinutely' | 'daily' | 'weekly'>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState(5)
  const [time, setTime] = useState('18:00')
  const [saving, setSaving] = useState(false)

  // 宛先マスタ＋メンバー個人の両方を定例の宛先に選べる
  const recipients = [
    ...(state.contacts ?? []).map((c) => ({ id: c.id, name: c.name, channel: c.defaultChannel })),
    ...(state.members ?? []).map((m) => ({ id: `member:${m.id}`, name: m.name, channel: 'line' as Channel }))
  ]
  const recipientName = (id: string) => recipients.find((r) => r.id === id)?.name ?? '?'

  const toggleContact = (id: string) => {
    setContactIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const handleAdd = async () => {
    if (!name.trim() || !situation.trim() || contactIds.length === 0) return
    const [hour, minute] = time.split(':').map(Number)
    let schedule: RoutineSchedule
    let scheduleLabel: string
    if (scheduleKind === 'demoMinutely') {
      schedule = { kind: 'demoMinutely' }
      scheduleLabel = '毎分（デモ用）'
    } else if (scheduleKind === 'daily') {
      schedule = { kind: 'daily', hour, minute }
      scheduleLabel = `毎日 ${time}`
    } else {
      schedule = { kind: 'weekly', dayOfWeek, hour, minute }
      scheduleLabel = `毎週${DAY_LABELS[dayOfWeek]}曜 ${time}`
    }
    setSaving(true)
    try {
      await agent.stub.addRoutine(name, schedule, scheduleLabel, contactIds, projectId, situation)
      setName('')
      setSituation('')
      setContactIds([])
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="card">
        <h2>定例ワークを登録する</h2>
        <p className="section-hint">
          登録したタイミングで、さくるんが下書きを自動で作って「連絡をつくる」タブに積みます。確定して送るのは人間です（勝手に送られることはありません）。
        </p>

        <div className="field-label">名前</div>
        <div className="field">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：週次活動リマインド"
          />
        </div>

        <div className="field-label">頻度</div>
        <div className="routine-schedule-row">
          <select value={scheduleKind} onChange={(e) => setScheduleKind(e.target.value as typeof scheduleKind)}>
            <option value="weekly">毎週</option>
            <option value="daily">毎日</option>
            <option value="demoMinutely">毎分（デモ用）</option>
          </select>
          {scheduleKind === 'weekly' && (
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAY_LABELS.map((d, i) => (
                <option key={i} value={i}>
                  {d}曜
                </option>
              ))}
            </select>
          )}
          {scheduleKind !== 'demoMinutely' && <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
        </div>

        <div className="field-label">宛先（宛先マスタとメンバー個人から選べます）</div>
        <div className="routine-contacts">
          {recipients.map((r) => (
            <label key={r.id} className={`routine-contact-chip${contactIds.includes(r.id) ? ' selected' : ''}`}>
              <input type="checkbox" checked={contactIds.includes(r.id)} onChange={() => toggleContact(r.id)} />
              {r.name}（{CHANNEL_LABELS[r.channel]}）
            </label>
          ))}
        </div>

        <div className="field-label">プロジェクト（文脈）</div>
        <select className="project-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {(state.projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="field-label">状況（毎回この内容で下書きされます）</div>
        <div className="field">
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="例：明日の通常活動のリマインド。出欠の返事を促す"
            rows={2}
          />
        </div>

        <div className="actions-row">
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={saving || !name.trim() || !situation.trim() || contactIds.length === 0}
          >
            {saving ? '登録中...' : '定例を登録'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>登録済みの定例</h2>
        {(state.routines ?? []).length === 0 && <p className="empty-state">まだ定例はありません</p>}
        <ul className="routine-list">
          {(state.routines ?? []).map((r) => (
            <li key={r.id} className="routine-item">
              <div>
                <strong>{r.name}</strong> <span className="badge badge-routine">{r.scheduleLabel}</span>
                <p className="routine-meta">
                  宛先: {r.contactIds.map(recipientName).join('、')}
                  {r.lastRunAt ? ` ／ 最終実行: ${new Date(r.lastRunAt).toLocaleString('ja-JP')}` : ' ／ まだ実行されていません'}
                </p>
              </div>
              <button type="button" className="note-delete" onClick={() => agent.stub.deleteRoutine(r.id)} aria-label="削除">
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function BoardTab({ state }: { state: SakurunState }) {
  return (
    <section className="card">
      <h2>掲示板</h2>
      <p className="section-hint">
        部員全員に公開される面はここだけです。内部宛（幹部・メンバー・タスク依頼）の確定した連絡が流れます。下書きや記憶が公開されることはありません。
      </p>
      {state.boardPosts.length === 0 && <p className="empty-state">まだ投稿はありません</p>}
      <ul className="board-list">
        {state.boardPosts
          .slice()
          .reverse()
          .map((p) => (
            <li key={p.id} className="board-item">
              <span className="badge badge-internal">{p.contactLabel}</span>{' '}
              <span className="badge badge-channel">{CHANNEL_LABELS[p.channel]}</span> {p.text}
            </li>
          ))}
      </ul>
    </section>
  )
}
