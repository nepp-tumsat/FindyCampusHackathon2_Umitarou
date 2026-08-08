import { useState } from 'react'
import { useAgent } from 'agents/react'
import type { MagiAgent } from '../agents/magi'
import type { MagiState } from '../agents/magi-types'
import { voteCounts } from '../agents/magi-types'
import { TopicForm } from './magi/TopicForm'
import { PersonaSettings } from './magi/PersonaSettings'
import { Terminal } from './magi/Terminal'
import { VerdictPanel } from './magi/VerdictPanel'
import { HistoryList } from './magi/HistoryList'

function getVoterId() {
  const key = 'magi-voter-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

function App() {
  const agent = useAgent<MagiAgent, MagiState>({ agent: 'MagiAgent', name: 'default' })
  const [voterId] = useState(getVoterId)
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('magi-display-name') ?? '')
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
      <header className="magi-header">
        <h1>MAGI</h1>
        <p>DECISION SUPPORT SYSTEM — 2択の意思決定を3つの視点のAIが検討し、議長AIが多数決で決定する</p>
      </header>
      <div className="magi-hazard" />

      <main className="magi-main">
        <section>
          <PersonaSettings personas={personas} onSave={(p) => agent.stub.updatePersonas(p)} />
          <TopicForm onStart={(input) => agent.stub.startSession(input)} busy={busy} />
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

export default App
