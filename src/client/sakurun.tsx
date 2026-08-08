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
    <div>
      <h2>さくるん（動作確認用の簡易モック — 本UIは別途実装予定）</h2>

      <section>
        <h3>メンバー（モックデータ）</h3>
        <ul>
          {MEMBERS.map((m) => (
            <li key={m.id}>
              {m.name}（{m.grade}・{m.role}、参加率{m.participationRate}%、参加不可:{' '}
              {m.unavailableDays.join('・') || 'なし'}）
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>下書き作成</h3>
        <select value={recipientType} onChange={(e) => setRecipientType(e.target.value as RecipientType)}>
          {RECIPIENT_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {RECIPIENT_LABELS[rt]}
            </option>
          ))}
        </select>
        <br />
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="状況を入力（例：デザイン担当の子にポスター作成をお願いしたい）"
          rows={3}
          cols={60}
        />
        <br />
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? '生成中...' : '下書き生成'}
        </button>
      </section>

      <section>
        <h3>下書き一覧</h3>
        {state.drafts.length === 0 && <p>まだ下書きはありません</p>}
        {state.drafts.map((d) => (
          <div key={d.id} style={{ border: '1px solid #ccc', margin: '8px 0', padding: '8px' }}>
            <p>
              宛先: {RECIPIENT_LABELS[d.recipientType]} / 状態: {d.status === 'confirmed' ? '確定済み' : '下書き'}
            </p>
            <textarea
              defaultValue={d.editedText}
              onBlur={(e) => agent.stub.updateDraft(d.id, e.target.value)}
              rows={4}
              cols={60}
              disabled={d.status === 'confirmed'}
            />
            <br />
            {d.status === 'draft' && <button onClick={() => agent.stub.confirmDraft(d.id)}>確定</button>}
          </div>
        ))}
      </section>

      <section>
        <h3>掲示板（内部宛の確定分が反映される）</h3>
        {state.boardPosts.length === 0 && <p>まだ投稿はありません</p>}
        <ul>
          {state.boardPosts.map((p) => (
            <li key={p.id}>
              [{RECIPIENT_LABELS[p.recipientType]}] {p.text}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Googleカレンダー連携（ストレッチ・土台のみ）</h3>
        <p>接続状態: {googleConnected ? '接続済み' : '未接続'}</p>
        {!googleConnected && <a href="/auth/google">Googleカレンダーと連携する</a>}
      </section>

      <section>
        <h3>引き継ぎ文書 → Notion保存（ストレッチ・土台のみ）</h3>
        <input
          value={handoverTitle}
          onChange={(e) => setHandoverTitle(e.target.value)}
          placeholder="タイトル（例：2026年度 引き継ぎ）"
          style={{ width: '100%' }}
        />
        <br />
        <textarea
          value={handoverContent}
          onChange={(e) => setHandoverContent(e.target.value)}
          placeholder="引き継ぎ内容"
          rows={3}
          cols={60}
        />
        <br />
        <button onClick={handleSaveHandoverDoc} disabled={savingHandover}>
          {savingHandover ? '保存中...' : 'Notionに保存'}
        </button>
        {handoverError && <p style={{ color: 'red' }}>{handoverError}</p>}
        <ul>
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
      </section>
    </div>
  )
}
