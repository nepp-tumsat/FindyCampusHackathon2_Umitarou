import type { Member } from '../agents/sakurun-types'

export const MEMBERS: Member[] = [
  {
    id: 'm1',
    name: '佐藤 遥',
    grade: '3年',
    role: '部長',
    participationRate: 95,
    unavailableDays: []
  },
  {
    id: 'm2',
    name: '田中 陸',
    grade: '3年',
    role: '会計',
    participationRate: 88,
    unavailableDays: ['水']
  },
  {
    id: 'm3',
    name: '鈴木 澪',
    grade: '2年',
    role: 'デザイン担当',
    participationRate: 72,
    unavailableDays: ['月', '火']
  },
  {
    id: 'm4',
    name: '高橋 蒼',
    grade: '2年',
    role: '一般部員',
    participationRate: 45,
    unavailableDays: ['木', '金']
  },
  {
    id: 'm5',
    name: '伊藤 陽菜',
    grade: '1年',
    role: '一般部員',
    participationRate: 60,
    unavailableDays: ['火']
  }
]
