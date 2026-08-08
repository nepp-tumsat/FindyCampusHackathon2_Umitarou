import { useMemo, useState } from 'react'
import { generateRestaurants } from './data'
import { StationForm } from './StationForm'
import { BudgetGroupSection } from './BudgetGroupSection'

function RestaurantApp() {
  const [station, setStation] = useState<string | null>(null)
  const groups = useMemo(() => (station ? generateRestaurants(station) : null), [station])

  return (
    <div className="eat-app">
      <nav className="app-nav">
        <a href="/restaurants" className="is-active">
          🍜 飲食店さがし
        </a>
        <a href="/">🤖 MAGI</a>
      </nav>

      <header className="eat-header">
        <h1>駅から飲食店さがし</h1>
        <p>駅名を入力すると、おすすめの飲食店を予算1,000円ごとに紹介します（デモ用のダミーデータです）</p>
      </header>

      <main className="eat-main">
        <StationForm onSearch={setStation} />

        {groups && (
          <div className="eat-results">
            <h2 className="eat-results-title">{station}駅 周辺のおすすめ</h2>
            {groups.map((group) => (
              <BudgetGroupSection key={group.label} group={group} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default RestaurantApp
