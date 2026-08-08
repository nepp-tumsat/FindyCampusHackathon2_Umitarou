import { useEffect, useState } from 'react'
import type { Persona } from '../../agents/magi-types'
import { DEFAULT_PERSONAS } from '../../agents/magi-types'

type Props = {
  personas: Persona[]
  onSave: (personas: Persona[]) => void
}

export function PersonaSettings({ personas, onSave }: Props) {
  const [draft, setDraft] = useState(personas)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setDraft(personas)
  }, [personas])

  const update = (index: number, field: 'name' | 'description', value: string) => {
    setDraft((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const handleSave = () => {
    onSave(draft)
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="magi-persona-toggle" onClick={() => setOpen(true)}>
        ペルソナ設定（{personas.map((p) => p.name).join(' / ')}）
      </button>
    )
  }

  return (
    <div className="magi-persona-settings">
      {draft.map((p, i) => (
        <div key={p.id} className="magi-persona-edit">
          <input
            type="text"
            value={p.name}
            onChange={(e) => update(i, 'name', e.target.value)}
            placeholder="ペルソナ名（例: エンジニア）"
          />
          <textarea
            value={p.description}
            onChange={(e) => update(i, 'description', e.target.value)}
            placeholder="重視する観点（例: 技術的な実現可能性と保守性を最優先に考える）"
            rows={2}
          />
        </div>
      ))}
      <div className="magi-persona-actions">
        <button type="button" onClick={() => setDraft(DEFAULT_PERSONAS)}>
          デフォルトに戻す
        </button>
        <button type="button" className="primary" onClick={handleSave}>
          保存
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          閉じる
        </button>
      </div>
    </div>
  )
}
