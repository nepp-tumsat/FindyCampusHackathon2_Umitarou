export type PersonaId = 'a' | 'b' | 'c'

export type Persona = {
  id: PersonaId
  name: string
  description: string
}

export const DEFAULT_PERSONAS: Persona[] = [
  { id: 'a', name: '論理AI', description: '論理・効率重視。コスト対効果と実現可能性を最優先に考える。' },
  { id: 'b', name: '共感AI', description: '感情・倫理重視。関係者の納得感やフェアネスを最優先に考える。' },
  { id: 'c', name: '革新AI', description: '革新・リスク重視。新しい可能性や長期的インパクト、機会損失を最優先に考える。' }
]

export type OptionKey = 'A' | 'B'

export type PersonaOpinion = {
  personaId: PersonaId
  status: 'thinking' | 'done'
  thoughtLines: string[]
  choice: OptionKey | null
  conclusion: string
  reasoning: string
}

export type Verdict = {
  winner: OptionKey
  winningLabel: string
  summary: string
  tally: Record<OptionKey, number>
  tradeoffs: string[]
}

export type SessionStatus = 'thinking' | 'aggregating' | 'done'

export type EvaluationRating = 'good' | 'bad'

export type Evaluation = {
  good: string[]
  bad: string[]
}

export type Comment = {
  id: string
  authorName: string
  text: string
  createdAt: number
}

export type DecisionSession = {
  id: string
  topic: string
  optionA: string
  optionB: string
  personas: Persona[]
  opinions: Record<PersonaId, PersonaOpinion>
  verdict: Verdict | null
  status: SessionStatus
  votes: Record<PersonaId, string[]>
  finalDecision: string | null
  evaluation: Evaluation
  comments: Comment[]
  createdAt: number
}

export function evaluationStats(evaluation: Evaluation) {
  const good = evaluation.good.length
  const bad = evaluation.bad.length
  const total = good + bad
  const goodPercent = total === 0 ? null : Math.round((good / total) * 100)
  return { good, bad, total, goodPercent }
}

export type MagiState = {
  personas: Persona[]
  current: DecisionSession | null
  history: DecisionSession[]
}

export function voteCounts(session: DecisionSession): Record<PersonaId, number> {
  return {
    a: session.votes.a.length,
    b: session.votes.b.length,
    c: session.votes.c.length
  }
}
