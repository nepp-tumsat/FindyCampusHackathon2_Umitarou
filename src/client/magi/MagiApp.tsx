import { useState } from 'react'
import { useAgent } from 'agents/react'
import type { MagiAgent } from '../../agents/magi'
import type { MagiState } from '../../agents/magi-types'
import { voteCounts } from '../../agents/magi-types'
import { TopicForm } from './TopicForm'
import { PersonaSettings } from './PersonaSettings'
import { Terminal } from './Terminal'
import { VerdictPanel } from './VerdictPanel'
import { HistoryList } from './HistoryList'

function getVoterId() {
  const key = 'magi-voter-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

type SakurunSnapshot = {
  projects: { name: string; notes: string[]; retrospective: string }[]
  members: { name: string; grade: string; role: string; memo: string }[]
}

export function MagiApp() {
  // デモモードは専用インスタンスに接続（さくるん側のデモ開始時に一緒にリセットされる）
  const agent = useAgent<MagiAgent, MagiState>({ agent: 'MagiAgent', name: DEMO ? 'demo' : 'default' })
  const [voterId] = useState(getVoterId)
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('magi-display-name') ?? '')
  const [snapshot, setSnapshot] = useState<SakurunSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  const loadSnapshot = async () => {
    setSnapshotLoading(true)
    try {
      setSnapshot(await agent.stub.getSakurunSnapshot(DEMO ? 'demo' : undefined))
    } finally {
      setSnapshotLoading(false)
    }
  }
  const personas = agent.state?.personas ?? []
  const session = agent.state?.current ?? null
  const history = agent.state?.history ?? []
  const busy = session ? session.status !== 'done' : false
  const counts = session ? voteCounts(session) : null

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value)
    localStorage.setItem('magi-display-name', value)
  }

  return (
    <div className="magi-app">
      <a className="magi-back" href="#">
        ← さくるんに戻る
      </a>
      <header className="magi-header">
        <h1>MAGI</h1>
        <p>DECISION SUPPORT SYSTEM — 2択の意思決定を3つの視点のAIが検討し、議長AIが多数決で決定する</p>
      </header>
      <div className="magi-hazard" />

      <main className="magi-main">
        <section>
          <PersonaSettings personas={personas} onSave={(p) => agent.stub.updatePersonas(p)} />

          <div className="magi-context">
            <div className="magi-context-header">
              <span>SAKURUN LINK — さくるんの記憶（議題の背景情報）</span>
              <button type="button" onClick={loadSnapshot} disabled={snapshotLoading}>
                {snapshotLoading ? 'ACCESSING...' : snapshot ? '再読み込み' : '読み込む'}
              </button>
            </div>
            {snapshot && (
              <div className="magi-context-body">
                {snapshot.projects.map((p) => (
                  <div key={p.name} className="magi-context-block">
                    <strong>{p.name}</strong>
                    <ul>
                      {p.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                      {p.retrospective && <li>振り返り: {p.retrospective}</li>}
                    </ul>
                  </div>
                ))}
                <div className="magi-context-block">
                  <strong>メンバー</strong>
                  <ul>
                    {snapshot.members.map((m) => (
                      <li key={m.name}>
                        {m.name}（{m.grade}・{m.role}）{m.memo && ` — ${m.memo}`}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <TopicForm onStart={(input) => agent.stub.startSession(input)} busy={busy} demo={DEMO} />
        </section>

        {session && (
          <section className="magi-terminals">
            {session.personas.map((p) => (
              <Terminal
                key={p.id}
                persona={p}
                opinion={session.opinions[p.id]}
                voteCount={counts ? counts[p.id] : 0}
                hasVoted={session.votes[p.id].includes(voterId)}
                onVote={() => agent.stub.vote({ personaId: p.id, voterId })}
              />
            ))}
          </section>
        )}

        {session && session.status !== 'thinking' && (
          <section>
            <VerdictPanel
              session={session}
              onDecide={(finalDecision) => agent.stub.setFinalDecision({ finalDecision })}
            />
          </section>
        )}

        {history.length > 0 && (
          <section>
            <label className="magi-display-name">
              あなたの表示名（コメント用・任意）
              <input
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder="例: たなか"
              />
            </label>
            <HistoryList
              history={history}
              evaluatorId={voterId}
              displayName={displayName}
              onEvaluate={(sessionId, rating) => agent.stub.evaluateDecision({ sessionId, evaluatorId: voterId, rating })}
              onComment={(sessionId, text) => agent.stub.addComment({ sessionId, authorName: displayName, text })}
            />
          </section>
        )}
      </main>
    </div>
  )
}
