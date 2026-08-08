import type { BudgetGroup } from './data'
import { RestaurantCard } from './RestaurantCard'

type Props = {
  group: BudgetGroup
}

export function BudgetGroupSection({ group }: Props) {
  return (
    <section className="eat-group">
      <h2 className="eat-group-label">{group.label}</h2>
      <div className="eat-group-cards">
        {group.restaurants.map((r) => (
          <RestaurantCard key={r.id} restaurant={r} />
        ))}
      </div>
    </section>
  )
}
