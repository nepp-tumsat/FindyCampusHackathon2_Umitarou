import { useEffect, useState } from 'react'
import { useAgent } from 'agents/react'
import type { SakurunAgent } from '../agents/sakurun'
import type { SakurunState } from '../agents/sakurun'
import { RECIPIENT_LABELS, SAKURUN_INSTANCE_NAME, type RecipientType } from '../agents/sakurun-types'
import { MEMBERS } from '../data/members'

const RECIPIENT_TYPES = Object.keys(RECIPIENT_LABELS) as RecipientType[]

const EMPTY_STATE: SakurunState = { drafts: [], boardPosts: [], googleAuth: null, handoverDocs: [] }

export function SakurunWidget() {
  const [state, setState] = useState<SakurunState>(EMPTY_STATE)
  const [recipientType, setRecipientType] = useState<RecipientType>('member')
  const [situation, setSituation] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [handoverTitle, setHandoverTitle] = useState('')
  const [handoverContent, setHandoverContent] = useState('')
  const [handoverError, setHandoverError] = useState<string | null>(null)
  const [savingHandover, setSavingHandover] = useState(false)

  const agent = useAgent<SakurunAgent, SakurunState>({
    agent: 'SakurunAgent',
    name: SAKURUN_INSTANCE_NAME,
    onStateUpdate: (s) => setState(s)
  })

  useEffect(() => {
    agent.stub.getGoogleAuthStatus().then((s) => setGoogleConnected(s.connected))
  }, [agent])

  const handleGenerate = async () => {
    if (!situation.trim()) return
    setLoading(true)
    try {
      await agent.stub.draftMessage(recipientType, situation)
      setSituation('')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveHandoverDoc = async () => {
    if (!handoverTitle.trim() || !handoverContent.trim()) return
    setSavingHandover(true)
    setHandoverError(null)
    try {
      await agent.stub.saveHandoverDoc(handoverTitle, handoverContent)
      setHandoverTitle('')
      setHandoverContent('')
    } catch (e) {
      setHandoverError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingHandover(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>さくるん</h1>
        <p className="tagline">サークルの運営に伴走してくれるAIエージェントツール</p>
      </header>

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
        <h2>連絡文の下書きを作る</h2>
        <div className="recipient-tabs">
          {RECIPIENT_TYPES.map((rt) => (
            <button
              key={rt}
              type="button"
              className={`recipient-tab${rt === recipientType ? ' active' : ''}`}
              onClick={() => setRecipientType(rt)}
            >
              {RECIPIENT_LABELS[rt]}
            </button>
          ))}
        </div>
        <div className="field">
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="状況を入力（例：デザイン担当の子にポスター作成をお願いしたい）"
            rows={3}
          />
        </div>
        <div className="actions-row">
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || !situation.trim()}>
            {loading ? '生成中...' : '下書き生成'}
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
                  <span className={`badge badge-${d.recipientType}`}>{RECIPIENT_LABELS[d.recipientType]}</span>
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
                <span className={`badge badge-${p.recipientType}`}>{RECIPIENT_LABELS[p.recipientType]}</span>{' '}
                {p.text}
              </li>
            ))}
        </ul>
      </section>

      <section className="card">
        <h2>
          外部連携 <span className="muted-suffix">（ストレッチ）</span>
        </h2>
        <div className="stretch-grid">
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

          <div className="stretch-card">
            <h3>Notion（引き継ぎ文書）</h3>
            <div className="field">
              <input
                type="text"
                value={handoverTitle}
                onChange={(e) => setHandoverTitle(e.target.value)}
                placeholder="タイトル（例：2026年度 引き継ぎ）"
              />
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <textarea
                value={handoverContent}
                onChange={(e) => setHandoverContent(e.target.value)}
                placeholder="引き継ぎ内容"
                rows={3}
              />
            </div>
            <div className="actions-row">
              <button
                className="btn btn-primary"
                onClick={handleSaveHandoverDoc}
                disabled={savingHandover || !handoverTitle.trim() || !handoverContent.trim()}
              >
                {savingHandover ? '保存中...' : 'Notionに保存'}
              </button>
            </div>
            {handoverError && <p className="error-text">{handoverError}</p>}
            <ul className="handover-list">
              {(state.handoverDocs ?? []).map((d) => (
                <li key={d.id}>
                  {d.title}
                  {d.notionUrl && (
                    <>
                      {' '}
                      —{' '}
                      <a href={d.notionUrl} target="_blank" rel="noreferrer">
                        Notionで開く
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
