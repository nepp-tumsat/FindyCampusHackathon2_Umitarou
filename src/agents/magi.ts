import { Agent, callable } from 'agents'
import { DEFAULT_PERSONAS } from './magi-types'
import type {
  Comment,
  DecisionSession,
  EvaluationRating,
  MagiState,
  OptionKey,
  Persona,
  PersonaId,
  PersonaOpinion,
  Verdict
} from './magi-types'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function emptyOpinion(personaId: PersonaId): PersonaOpinion {
  return { personaId, status: 'thinking', thoughtLines: [], choice: null, conclusion: '', reasoning: '' }
}

// 以下、モックの理由生成・集約ロジック。AI連携が決まるまでのプレースホルダーで、
// 本来はここでLLM（Workers AI / Claude API）にペルソナのdescriptionと2つの選択肢を渡して生成する。
// プロンプトの手続き文（「検討します」等）ではなく、結論に至った理由そのものを出力する。
type TopicContext = { topic: string; optionA: string; optionB: string }

function pickChoice(seed: string): OptionKey {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return hash % 2 === 0 ? 'A' : 'B'
}

function optionLabel(ctx: TopicContext, choice: OptionKey) {
  return choice === 'A' ? ctx.optionA : ctx.optionB
}

// 選んだ選択肢に至った理由を7行で丁寧に構成する
// （基準の確認 → 採用案の利点2点 → 採用案の留意点 → 却下案の弱点2点 → 比較の総括 → 結論）
function buildReasonLines(persona: Persona, ctx: TopicContext, choice: OptionKey): string[] {
  const chosen = optionLabel(ctx, choice)
  const rejected = optionLabel(ctx, choice === 'A' ? 'B' : 'A')
  return [
    `${persona.name}は「${persona.description}」という基準で「${ctx.topic}」を検討する。`,
    `「${chosen}」を選んだ場合、この基準において重視すべき条件を満たしている点が最大の利点である。`,
    `加えて「${chosen}」は、短期的な実行のしやすさと、この基準における長期的な妥当性の両方を兼ね備えている。`,
    `もっとも「${chosen}」にも留意すべき点はあるが、この基準に照らせば致命的な欠点とまでは言えない。`,
    `一方「${rejected}」は一見魅力的に映る場面もあるが、この基準で重視すべき部分を十分に満たせていない。`,
    `「${rejected}」を選んだ場合に生じうる懸念やリスクは、${persona.name}の立場では看過できない大きさである。`,
    `両案を比較した結果、「${chosen}」の優位性が「${rejected}」の懸念を上回ると判断できる。`,
    `以上の理由から、${persona.name}は「${chosen}」を支持するという結論に至った。`
  ]
}

function conclusionText(persona: Persona, ctx: TopicContext, choice: OptionKey) {
  return `${persona.name}は「${optionLabel(ctx, choice)}」を支持します。`
}

function buildVerdict(session: DecisionSession): Verdict {
  const tally: Record<OptionKey, number> = { A: 0, B: 0 }
  for (const p of session.personas) {
    const choice = session.opinions[p.id].choice
    if (choice) tally[choice]++
  }
  // ペルソナは常に3人・選択肢は常に2つなので、多数決で必ずどちらかに決まる（同数にはならない）
  const winner: OptionKey = tally.A > tally.B ? 'A' : 'B'
  const winningLabel = optionLabel(session, winner)
  const winnerCount = tally[winner]
  const summary = `3人中${winnerCount}人が「${winningLabel}」を支持しました。多数決の結果、議長AIは「${winningLabel}」に決定します。`
  const tradeoffs = session.personas.map((p) => `${p.name}: ${session.opinions[p.id].conclusion}`)

  return { winner, winningLabel, summary, tally, tradeoffs }
}

export class MagiAgent extends Agent<CloudflareBindings, MagiState> {
  initialState: MagiState = { personas: DEFAULT_PERSONAS, current: null, history: [] }

  @callable()
  updatePersonas(personas: Persona[]) {
    this.setState({ ...this.state, personas })
  }

  @callable()
  startSession({ topic, optionA, optionB }: { topic: string; optionA: string; optionB: string }) {
    this.runSession(topic, optionA, optionB)
  }

  private async runSession(topic: string, optionA: string, optionB: string) {
    const personas = this.state.personas
    const ctx: TopicContext = { topic, optionA, optionB }
    const opinions = {} as Record<PersonaId, PersonaOpinion>
    const plans = {} as Record<PersonaId, { choice: OptionKey; lines: string[] }>
    for (const p of personas) {
      opinions[p.id] = emptyOpinion(p.id)
      const choice = pickChoice(topic + optionA + optionB + p.id)
      plans[p.id] = { choice, lines: buildReasonLines(p, ctx, choice) }
    }

    const session: DecisionSession = {
      id: crypto.randomUUID(),
      topic,
      optionA,
      optionB,
      personas,
      opinions,
      verdict: null,
      status: 'thinking',
      votes: { a: [], b: [], c: [] },
      finalDecision: null,
      evaluation: { good: [], bad: [] },
      comments: [],
      createdAt: Date.now()
    }

    this.setState({ ...this.state, current: session })

    // 3人のターミナルが同時にカタカタ動いているように見せるため、ラウンドロビンで理由を1行ずつ追加していく
    const maxLines = Math.max(...personas.map((p) => plans[p.id].lines.length))
    for (let i = 0; i < maxLines; i++) {
      for (const persona of personas) {
        const line = plans[persona.id].lines[i]
        if (!line) continue
        await sleep(350 + Math.floor(Math.random() * 250))
        const current = this.state.current
        if (!current || current.id !== session.id) return // 別の議題が開始されていたら中断
        const opinion = current.opinions[persona.id]
        const updated: PersonaOpinion = { ...opinion, thoughtLines: [...opinion.thoughtLines, line] }
        this.setState({
          ...this.state,
          current: { ...current, opinions: { ...current.opinions, [persona.id]: updated } }
        })
      }
    }

    // 全ての理由が出揃ったら、各ペルソナの結論を確定する
    for (const persona of personas) {
      await sleep(200)
      const current = this.state.current
      if (!current || current.id !== session.id) return
      const { choice, lines } = plans[persona.id]
      const opinion = current.opinions[persona.id]
      const updated: PersonaOpinion = {
        ...opinion,
        status: 'done',
        choice,
        conclusion: conclusionText(persona, ctx, choice),
        reasoning: lines[lines.length - 1]
      }
      this.setState({
        ...this.state,
        current: { ...current, opinions: { ...current.opinions, [persona.id]: updated } }
      })
    }

    // 議長AIが多数決で集約
    await sleep(500)
    const aggregating = this.state.current
    if (!aggregating || aggregating.id !== session.id) return
    this.setState({ ...this.state, current: { ...aggregating, status: 'aggregating' } })

    await sleep(600)
    const finalCurrent = this.state.current
    if (!finalCurrent || finalCurrent.id !== session.id) return
    const verdict = buildVerdict(finalCurrent)
    this.setState({ ...this.state, current: { ...finalCurrent, verdict, status: 'done' } })
  }

  @callable()
  vote({ personaId, voterId }: { personaId: PersonaId; voterId: string }) {
    const current = this.state.current
    if (!current) return
    const votes: Record<PersonaId, string[]> = {
      a: current.votes.a.filter((v) => v !== voterId),
      b: current.votes.b.filter((v) => v !== voterId),
      c: current.votes.c.filter((v) => v !== voterId)
    }
    votes[personaId] = [...votes[personaId], voterId]
    this.setState({ ...this.state, current: { ...current, votes } })
  }

  @callable()
  setFinalDecision({ finalDecision }: { finalDecision: string }) {
    const current = this.state.current
    if (!current) return
    // 既に履歴入りしている場合は上書き更新する（重複追加や評価・コメントのリセットを防ぐ）
    const existingIndex = this.state.history.findIndex((s) => s.id === current.id)
    const updatedCurrent = { ...current, finalDecision }
    const history =
      existingIndex >= 0
        ? this.state.history.map((s, i) => (i === existingIndex ? { ...s, finalDecision } : s))
        : [updatedCurrent, ...this.state.history].slice(0, 20)
    this.setState({ ...this.state, current: updatedCurrent, history })
  }

  @callable()
  clearSession() {
    this.setState({ ...this.state, current: null })
  }

  private updateSession(sessionId: string, updater: (s: DecisionSession) => DecisionSession) {
    const current =
      this.state.current && this.state.current.id === sessionId ? updater(this.state.current) : this.state.current
    const history = this.state.history.map((s) => (s.id === sessionId ? updater(s) : s))
    this.setState({ ...this.state, current, history })
  }

  @callable()
  evaluateDecision({
    sessionId,
    evaluatorId,
    rating
  }: {
    sessionId: string
    evaluatorId: string
    rating: EvaluationRating
  }) {
    this.updateSession(sessionId, (s) => {
      const good = s.evaluation.good.filter((v) => v !== evaluatorId)
      const bad = s.evaluation.bad.filter((v) => v !== evaluatorId)
      if (rating === 'good') good.push(evaluatorId)
      else bad.push(evaluatorId)
      return { ...s, evaluation: { good, bad } }
    })
  }

  @callable()
  addComment({ sessionId, authorName, text }: { sessionId: string; authorName: string; text: string }) {
    this.updateSession(sessionId, (s) => {
      const comment: Comment = {
        id: crypto.randomUUID(),
        authorName: authorName.trim() || '匿名',
        text,
        createdAt: Date.now()
      }
      return { ...s, comments: [...s.comments, comment] }
    })
  }
}
