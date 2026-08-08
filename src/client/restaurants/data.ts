export type Restaurant = {
  id: string
  name: string
  genre: string
  budget: number
  rating: number
  reviewCount: number
  walkMin: number
  description: string
}

export type BudgetGroup = {
  label: string
  min: number
  max: number
  restaurants: Restaurant[]
}

export const STATION_SUGGESTIONS = [
  '渋谷',
  '新宿',
  '池袋',
  '東京',
  '品川',
  '秋葉原',
  '上野',
  '中野',
  '吉祥寺',
  '横浜',
  '大阪',
  '梅田',
  'なんば',
  '京都',
  '名古屋',
  '札幌',
  '天神',
  '仙台',
  '広島'
]

const BUDGET_BUCKETS: { min: number; max: number; label: string }[] = [
  { min: 0, max: 999, label: '〜1,000円' },
  { min: 1000, max: 1999, label: '1,000円〜2,000円' },
  { min: 2000, max: 2999, label: '2,000円〜3,000円' },
  { min: 3000, max: 3999, label: '3,000円〜4,000円' },
  { min: 4000, max: 4999, label: '4,000円〜5,000円' },
  { min: 5000, max: 8000, label: '5,000円〜' }
]

const GENRES = [
  'ラーメン',
  '焼肉',
  '寿司',
  'イタリアン',
  '中華',
  'カフェ',
  '居酒屋',
  'フレンチ',
  'カレー',
  '焼き鳥',
  'そば・うどん',
  'バーガー',
  '韓国料理',
  'タイ料理',
  'バル',
  'ステーキ',
  '定食',
  '和食',
  '鉄板焼き'
]

const SUFFIXES = ['食堂', '酒場', '亭', '屋', 'キッチン', 'ダイニング', '商店', '屋台', 'Bar', 'Bistro']
const ADJECTIVES = ['本格', '創作', '老舗の', 'こだわりの', '隠れ家的', '行列必至の', '地元で人気の', '駅近の']
const NAME_WORDS = ['はなび', 'たまや', 'こなから', '風花', '月見', 'ひまわり', 'あさひ', '蔵', 'おかん', '極', '匠', '悠', '和心', '山海', '三代目']

// mulberry32: 文字列シードから決定的な擬似乱数を生成する
function createRng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

function generateName(station: string, genre: string, rng: () => number) {
  const style = Math.floor(rng() * 4)
  switch (style) {
    case 0:
      return `${station}駅前 ${genre}${pick(SUFFIXES, rng)}`
    case 1:
      return `${pick(ADJECTIVES, rng)}${genre}${pick(SUFFIXES, rng)}`
    case 2:
      return `${genre}処 ${pick(NAME_WORDS, rng)}`
    default:
      return `${pick(NAME_WORDS, rng)}${pick(SUFFIXES, rng)}`
  }
}

function generateRestaurant(station: string, bucketIndex: number, rng: () => number): Restaurant {
  const bucket = BUDGET_BUCKETS[bucketIndex]
  const genre = pick(GENRES, rng)
  const budget = Math.round((bucket.min + rng() * (bucket.max - bucket.min)) / 100) * 100
  const rating = Math.round((3.2 + rng() * 1.7) * 10) / 10
  const reviewCount = 10 + Math.floor(rng() * 780)
  const walkMin = 1 + Math.floor(rng() * 12)
  const name = generateName(station, genre, rng)
  const description = `${genre}が自慢の一軒。${station}駅から徒歩${walkMin}分、評価${rating}（${reviewCount}件）の${
    rng() < 0.5 ? '人気店' : '穴場スポット'
  }。`

  return {
    id: `${bucketIndex}-${name}-${budget}`,
    name,
    genre,
    budget,
    rating,
    reviewCount,
    walkMin,
    description
  }
}

export function generateRestaurants(station: string): BudgetGroup[] {
  const rng = createRng(station.trim())

  return BUDGET_BUCKETS.map((bucket, bucketIndex) => {
    const count = 2 + Math.floor(rng() * 3)
    const restaurants = Array.from({ length: count }, () => generateRestaurant(station, bucketIndex, rng)).sort(
      (a, b) => a.budget - b.budget
    )
    return { label: bucket.label, min: bucket.min, max: bucket.max, restaurants }
  })
}
