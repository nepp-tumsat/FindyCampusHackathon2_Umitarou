import type { Persona, PersonaId, PersonaOpinion } from '../../agents/magi-types'

const MAGI_UNIT_LABEL: Record<PersonaId, string> = {
  a: 'MELCHIOR・1',
  b: 'BALTHASAR・2',
  c: 'CASPER・3'
}

type Props = {
  persona: Persona
  opinion: PersonaOpinion | undefined
  voteCount: number
  hasVoted: boolean
  onVote: () => void
}

export function Terminal({ persona, opinion, voteCount, hasVoted, onVote }: Props) {
  const thinking = !opinion || opinion.status === 'thinking'

  return (
    <div className="magi-terminal">
      <div className="magi-terminal-header">
        <div className="magi-terminal-names">
          <span className="magi-terminal-unit">{MAGI_UNIT_LABEL[persona.id]}</span>
          <span className="magi-terminal-name">{persona.name}</span>
        </div>
        <span className={`magi-terminal-status ${thinking ? 'is-thinking' : 'is-done'}`}>
          {thinking ? 'THINKING' : 'CONCLUDED'}
        </span>
      </div>
      <p className="magi-terminal-desc">{persona.description}</p>
      <div className="magi-terminal-body">
        {(opinion?.thoughtLines ?? []).map((line, i) => (
          <p key={i} className="magi-terminal-line">
            {line}
          </p>
        ))}
        {thinking && <span className="magi-cursor">_</span>}
        {opinion?.status === 'done' && (
          <div className="magi-terminal-conclusion">
            <p className={`magi-choice is-${opinion.choice}`}>{opinion.conclusion}</p>
          </div>
        )}
      </div>
      {opinion?.status === 'done' && (
        <button type="button" className={`magi-vote-button${hasVoted ? ' is-active' : ''}`} onClick={onVote}>
          {hasVoted ? '✓ 賛成中' : 'この意見を支持する'}（{voteCount}）
        </button>
      )}
    </div>
  )
}
