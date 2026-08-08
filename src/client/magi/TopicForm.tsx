import { useState } from 'react'
import type { FormEvent } from 'react'

const EXAMPLES = [
  { topic: 'リリース直前での仕様変更', optionA: '受け入れる', optionB: '見送る' },
  { topic: '次のスプリントで優先すること', optionA: '新機能開発', optionB: 'バグ修正' },
  { topic: '今日のお昼', optionA: 'ラーメン', optionB: 'カレー' }
]

type Props = {
  onStart: (input: { topic: string; optionA: string; optionB: string }) => void
  busy: boolean
}

export function TopicForm({ onStart, busy }: Props) {
  const [topic, setTopic] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')

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
