import type { Restaurant } from './data'

type Props = {
  restaurant: Restaurant
}

export function RestaurantCard({ restaurant }: Props) {
  return (
    <article className="eat-card">
      <div className="eat-card-head">
        <span className="eat-card-genre">{restaurant.genre}</span>
        <span className="eat-card-budget">¥{restaurant.budget.toLocaleString()}</span>
      </div>
      <h3 className="eat-card-name">{restaurant.name}</h3>
      <p className="eat-card-desc">{restaurant.description}</p>
      <div className="eat-card-meta">
        <span className="eat-card-rating">★ {restaurant.rating.toFixed(1)}</span>
        <span className="eat-card-reviews">{restaurant.reviewCount}件</span>
        <span className="eat-card-walk">駅から徒歩{restaurant.walkMin}分</span>
      </div>
    </article>
  )
}
