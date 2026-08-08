import type { DecisionSession } from '../../agents/magi-types'

type Props = {
  session: DecisionSession
  onDecide: (finalDecision: string) => void
}

export function VerdictPanel({ session, onDecide }: Props) {
  if (session.status === 'aggregating' || !session.verdict) {
    return <div className="magi-verdict is-pending">議長AIが3人の意見を多数決で集約しています…</div>
  }

  const { verdict } = session

  return (
    <div className="magi-verdict">
      <h2>議長AIの決定</h2>
      <p className="magi-verdict-result">
        「{verdict.winningLabel}」に決定（{verdict.tally.A}対{verdict.tally.B}）
      </p>
      <p className="magi-verdict-summary">{verdict.summary}</p>
      <ul className="magi-tradeoffs">
        {verdict.tradeoffs.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <div className="magi-decision">
        <p className="magi-decision-label">あなたの最終判断</p>
        <div className="magi-decision-buttons">
          <button
            type="button"
            className={`magi-decision-button is-A${session.finalDecision === session.optionA ? ' is-selected' : ''}`}
            onClick={() => onDecide(session.optionA)}
          >
            {session.optionA}
          </button>
          <button
            type="button"
            className={`magi-decision-button is-B${session.finalDecision === session.optionB ? ' is-selected' : ''}`}
            onClick={() => onDecide(session.optionB)}
          >
            {session.optionB}
          </button>
        </div>
        {session.finalDecision && <p className="magi-decision-saved">記録済み: {session.finalDecision}</p>}
      </div>
    </div>
  )
}
