import type { DecisionSession } from '../../agents/magi-types'
import { HistoryItem } from './HistoryItem'

type Props = {
  history: DecisionSession[]
  evaluatorId: string
  displayName: string
  onEvaluate: (sessionId: string, rating: 'good' | 'bad') => void
  onComment: (sessionId: string, text: string) => void
}

export function HistoryList({ history, evaluatorId, displayName, onEvaluate, onComment }: Props) {
  if (history.length === 0) return null

  return (
    <div className="magi-history">
      <h2>過去の意思決定</h2>
      <ul className="magi-history-list">
        {history.map((s) => (
          <HistoryItem
            key={s.id}
            session={s}
            evaluatorId={evaluatorId}
            displayName={displayName}
            onEvaluate={(rating) => onEvaluate(s.id, rating)}
            onComment={(text) => onComment(s.id, text)}
          />
        ))}
      </ul>
    </div>
  )
}
