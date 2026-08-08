import { useState } from 'react'
import type { FormEvent } from 'react'
import type { DecisionSession } from '../../agents/magi-types'
import { evaluationStats } from '../../agents/magi-types'

type Props = {
  session: DecisionSession
  evaluatorId: string
  displayName: string
  onEvaluate: (rating: 'good' | 'bad') => void
  onComment: (text: string) => void
}

export function HistoryItem({ session, evaluatorId, displayName, onEvaluate, onComment }: Props) {
  const [text, setText] = useState('')
  const stats = evaluationStats(session.evaluation)
  const myRating = session.evaluation.good.includes(evaluatorId)
    ? 'good'
    : session.evaluation.bad.includes(evaluatorId)
      ? 'bad'
      : null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onComment(text.trim())
    setText('')
  }

  return (
    <li className="magi-history-item">
      <div className="magi-history-item-head">
        <strong>{session.topic}</strong>
        {session.verdict && <span className="magi-history-winner">議長AI: {session.verdict.winningLabel}</span>}
      </div>
      {session.finalDecision && <p className="magi-history-decision">最終判断: {session.finalDecision}</p>}

      <div className="magi-eval">
        <div className="magi-eval-buttons">
          <button
            type="button"
            className={`magi-eval-button is-good${myRating === 'good' ? ' is-active' : ''}`}
            onClick={() => onEvaluate('good')}
          >
            👍 Good（{stats.good}）
          </button>
          <button
            type="button"
            className={`magi-eval-button is-bad${myRating === 'bad' ? ' is-active' : ''}`}
            onClick={() => onEvaluate('bad')}
          >
            👎 Bad（{stats.bad}）
          </button>
        </div>
        {stats.total > 0 && (
          <div className="magi-eval-bar">
            <div className="magi-eval-bar-fill" style={{ width: `${stats.goodPercent}%` }} />
            <span className="magi-eval-percent">Good {stats.goodPercent}%</span>
          </div>
        )}
      </div>

      {session.comments.length > 0 && (
        <ul className="magi-comments">
          {session.comments.map((c) => (
            <li key={c.id}>
              <span className="magi-comment-author">{c.authorName}</span>
              <span className="magi-comment-text">{c.text}</span>
            </li>
          ))}
        </ul>
      )}

      <form className="magi-comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`${displayName || '匿名'}としてコメントする`}
        />
        <button type="submit" disabled={!text.trim()}>
          送信
        </button>
      </form>
    </li>
  )
}
