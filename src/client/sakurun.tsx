import { useEffect, useState } from 'react'
import { useAgent } from 'agents/react'
import type { SakurunAgent } from '../agents/sakurun'
import type { SakurunState } from '../agents/sakurun'
import { CHANNEL_LABELS, SAKURUN_INSTANCE_NAME, type Channel, type Contact } from '../agents/sakurun-types'
import { MEMBERS } from '../data/members'

const CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[]

const EMPTY_STATE: SakurunState = {
  contacts: [],
  projects: [],
  drafts: [],
  boardPosts: [],
  googleAuth: null
}

type Selection = { enabled: boolean; channel: Channel }

export function SakurunWidget() {
  const [state, setState] = useState<SakurunState>(EMPTY_STATE)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, Selection>>({})
  const [situation, setSituation] = useState('')
  const [loading, setLoading] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newNote, setNewNote] = useState('')
  const [retroDraft, setRetroDraft] = useState<string | null>(null)
  const [retroLoading, setRetroLoading] = useState(false)
  const [notionError, setNotionError] = useState<string | null>(null)
  const [notionExporting, setNotionExporting] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)

  const agent = useAgent<SakurunAgent, SakurunState>({
    agent: 'SakurunAgent',
    name: SAKURUN_INSTANCE_NAME,
    onStateUpdate: (s) => setState(s)
  })

  useEffect(() => {
    agent.stub.getGoogleAuthStatus().then((s) => setGoogleConnected(s.connected))
  }, [agent])

  const projects = state.projects ?? []
  const project = projects.find((p) => p.id === selectedProjectId) ?? null

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

  const handleGenerate = async () => {
    if (!situation.trim() || targets.length === 0) return
    setLoading(true)
    try {
      await Promise.all(
        targets.map((c) => agent.stub.draftMessage(selectedProjectId, c.id, selectionFor(c).channel, situation))
      )
    } finally {
      setLoading(false)
    }
  }

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

  const handleExportNotion = async () => {
    if (!project) return
    setNotionExporting(true)
    setNotionError(null)
    try {
      await agent.stub.exportProjectToNotion(project.id)
    } catch (e) {
      setNotionError(e instanceof Error ? e.message : String(e))
    } finally {
      setNotionExporting(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>さくるん</h1>
        <p className="tagline">サークルの運営に伴走してくれるAIエージェントツール</p>
      </header>

      <section className="card">
        <h2>プロジェクト</h2>
        <p className="section-hint">
          プロジェクトを選ぶと、そこに蓄積したノートと過去の振り返りを、さくるんが文脈として読み取って文面に反映します。
        </p>
        <div className="project-tabs">
          <button
            type="button"
            className={`project-tab${selectedProjectId === null ? ' active' : ''}`}
            onClick={() => {
              setSelectedProjectId(null)
              setRetroDraft(null)
            }}
          >
            指定なし（全般）
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`project-tab${selectedProjectId === p.id ? ' active' : ''}`}
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

            <h3 className="subsection-title">振り返り（PDCA）</h3>
            {project.retrospective && retroDraft === null && (
              <div className="retro-saved">
                <p className="retro-text">{project.retrospective}</p>
                <p className="section-hint">保存済み。次のプロジェクトの下書き生成時に、教訓として自動で参照されます。</p>
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
                <p className="section-hint">AIが作った下書きです。編集して保存してください。</p>
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

            <div className="notion-export">
              <button className="btn btn-ghost" onClick={handleExportNotion} disabled={notionExporting}>
                {notionExporting ? '書き出し中...' : 'ノートと振り返りをNotionに書き出す'}
              </button>
              {project.notionUrl && (
                <a href={project.notionUrl} target="_blank" rel="noreferrer">
                  Notionで開く
                </a>
              )}
              {notionError && <p className="error-text">{notionError}</p>}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>連絡文の下書きを作る</h2>
        <p className="section-hint">
          送る相手にチェックを入れ、それぞれメール/LINEを選んでから、状況を1回書くだけでまとめて下書きできます。相手ごとの「書き方メモ」は▼から編集でき、さくるんはそれに従います。
        </p>

        <div className="target-checklist">
          {(state.contacts ?? []).map((c) => {
            const sel = selectionFor(c)
            return (
              <div key={c.id} className={`target-row${sel.enabled ? ' enabled' : ''}`}>
                <div className="target-row-main">
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
                <details className="style-notes">
                  <summary>書き方メモ</summary>
                  <textarea
                    defaultValue={c.styleNotes}
                    rows={2}
                    onBlur={(e) => {
                      if (e.target.value !== c.styleNotes) agent.stub.updateContactStyleNotes(c.id, e.target.value)
                    }}
                  />
                </details>
              </div>
            )
          })}
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="状況を入力（例：合同ハッカソンの日程が1週間ずれ込みそう）"
            rows={3}
          />
        </div>
        <div className="actions-row">
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading || !situation.trim() || targets.length === 0}
          >
            {loading ? '生成中...' : `${targets.length}件の宛先にまとめて下書き生成`}
          </button>
        </div>
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
                  </span>
                  <span className={`status-badge${d.status === 'confirmed' ? ' confirmed' : ''}`}>
                    {d.status === 'confirmed' ? '確定済み' : '下書き（編集できます）'}
                  </span>
                </div>
                <div className="field">
                  <textarea
                    defaultValue={d.editedText}
                    onBlur={(e) => agent.stub.updateDraft(d.id, e.target.value)}
                    rows={4}
                    disabled={d.status === 'confirmed'}
                  />
                </div>
                {(d.missingInfo ?? []).length > 0 && (
                  <div className="missing-info">
                    <p className="missing-info-title">送る前に確認：不足していそうな情報</p>
                    <ul>
                      {(d.missingInfo ?? []).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {d.status === 'draft' && (
                  <div className="actions-row">
                    <button className="btn btn-primary" onClick={() => agent.stub.confirmDraft(d.id)}>
                      確定して送る
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </section>

      <section className="card">
        <h2>掲示板</h2>
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

      <section className="card">
        <h2>
          メンバー <span className="muted-suffix">（モックデータ）</span>
        </h2>
        <ul className="member-list">
          {MEMBERS.map((m) => (
            <li key={m.id} className="member-chip">
              {m.name} ／ {m.grade}・{m.role} ／ 参加率<span className="rate">{m.participationRate}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>
          外部連携 <span className="muted-suffix">（ストレッチ）</span>
        </h2>
        <div className="stretch-card">
          <h3>Googleカレンダー</h3>
          <div className="connection-status">
            <span className={`dot${googleConnected ? ' connected' : ''}`} />
            {googleConnected ? '接続済み' : '未接続'}
          </div>
          {!googleConnected && (
            <div>
              <a className="btn btn-ghost" href="/auth/google">
                連携する
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
