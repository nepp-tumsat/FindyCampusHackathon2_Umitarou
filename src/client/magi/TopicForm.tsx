import { useState } from 'react'
import type { FormEvent } from 'react'

// サークル運営の意思決定を想定した議題例（デモモードでは先頭が事前入力される）
const EXAMPLES = [
  { topic: '夏合宿の宿はどちらにする？', optionA: '湖畔荘（安いが古い）', optionB: 'レイクビューホテル（高いが綺麗）' },
  { topic: '合同ハッカソンの懇親会', optionA: '会場でケータリング', optionB: '近くの店に移動' },
  { topic: '新歓の予算配分', optionA: 'BBQに厚く', optionB: 'ビラ・ポスターに厚く' }
]

type Props = {
  onStart: (input: { topic: string; optionA: string; optionB: string }) => void
  busy: boolean
  demo?: boolean
}

export function TopicForm({ onStart, busy, demo }: Props) {
  const [topic, setTopic] = useState(demo ? EXAMPLES[0].topic : '')
  const [optionA, setOptionA] = useState(demo ? EXAMPLES[0].optionA : '')
  const [optionB, setOptionB] = useState(demo ? EXAMPLES[0].optionB : '')

  const ready = topic.trim() && optionA.trim() && optionB.trim()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready || busy) return
    onStart({ topic: topic.trim(), optionA: optionA.trim(), optionB: optionB.trim() })
  }

  const applyExample = (ex: (typeof EXAMPLES)[number]) => {
    setTopic(ex.topic)
    setOptionA(ex.optionA)
    setOptionB(ex.optionB)
  }

  return (
    <form className="magi-form" onSubmit={handleSubmit}>
      <label>
        議題
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例: リリース直前での仕様変更"
        />
      </label>
      <div className="magi-form-row">
        <label>
          選択肢A
          <input type="text" value={optionA} onChange={(e) => setOptionA(e.target.value)} placeholder="例: 受け入れる" />
        </label>
        <label>
          選択肢B
          <input type="text" value={optionB} onChange={(e) => setOptionB(e.target.value)} placeholder="例: 見送る" />
        </label>
      </div>
      <div className="magi-examples">
        {EXAMPLES.map((ex) => (
          <button type="button" key={ex.topic} onClick={() => applyExample(ex)} disabled={busy}>
            {ex.topic}（{ex.optionA} vs {ex.optionB}）
          </button>
        ))}
      </div>
      <button type="submit" className="primary" disabled={!ready || busy}>
        {busy ? '審議中…' : '3人のAIに諮問する'}
      </button>
    </form>
  )
}
