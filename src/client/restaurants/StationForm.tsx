import { useState } from 'react'
import type { FormEvent } from 'react'
import { STATION_SUGGESTIONS } from './data'

type Props = {
  onSearch: (station: string) => void
}

export function StationForm({ onSearch }: Props) {
  const [station, setStation] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!station.trim()) return
    onSearch(station.trim())
  }

  return (
    <form className="eat-form" onSubmit={handleSubmit}>
      <label>
        駅名
        <input
          type="text"
          list="eat-station-suggestions"
          value={station}
          onChange={(e) => setStation(e.target.value)}
          placeholder="例: 渋谷"
        />
        <datalist id="eat-station-suggestions">
          {STATION_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <div className="eat-examples">
        {STATION_SUGGESTIONS.slice(0, 8).map((s) => (
          <button type="button" key={s} onClick={() => setStation(s)}>
            {s}
          </button>
        ))}
      </div>
      <button type="submit" className="primary" disabled={!station.trim()}>
        お店をさがす
      </button>
    </form>
  )
}
