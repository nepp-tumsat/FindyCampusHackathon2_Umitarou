import type { AttendanceRecord, Member } from '../agents/sakurun-types'

export const MEMBERS: Member[] = [
  {
    id: 'm1',
    name: '佐藤 遥',
    grade: '3年',
    role: '部長',
    unavailableDays: [],
    memo: '全体を見るのが得意。抱え込みがちなので、仕事は分担するよう声をかける'
  },
  {
    id: 'm2',
    name: '田中 陸',
    grade: '3年',
    role: '会計',
    unavailableDays: ['水'],
    memo: '数字に強く事務作業が正確。締切がある仕事だと動きやすいタイプ'
  },
  {
    id: 'm3',
    name: '鈴木 澪',
    grade: '2年',
    role: 'デザイン担当',
    unavailableDays: ['月', '火'],
    memo: 'デザインが得意で、頼られると張り切るタイプ。月火は授業で忙しい'
  },
  {
    id: 'm4',
    name: '高橋 蒼',
    grade: '2年',
    role: '一般部員',
    unavailableDays: ['木', '金'],
    memo: '最近参加率低め。ゲーム開発に興味あり。具体的な役割があると来やすいタイプ'
  },
  {
    id: 'm5',
    name: '伊藤 陽菜',
    grade: '1年',
    role: '一般部員',
    unavailableDays: ['火'],
    memo: '1年生。イベント企画に興味あり。細かい作業も丁寧にやってくれる'
  }
]

// 直近の通常活動の出欠（サンプル）。参加率はここから自動計算される
export const SEED_ATTENDANCE: AttendanceRecord[] = [
  { id: 'a1', date: '2026-07-04', presentMemberIds: ['m1', 'm2', 'm3', 'm4', 'm5'], createdAt: 0 },
  { id: 'a2', date: '2026-07-11', presentMemberIds: ['m1', 'm2', 'm3', 'm5'], createdAt: 0 },
  { id: 'a3', date: '2026-07-18', presentMemberIds: ['m1', 'm2', 'm5'], createdAt: 0 },
  { id: 'a4', date: '2026-07-25', presentMemberIds: ['m1', 'm2', 'm3', 'm4'], createdAt: 0 },
  { id: 'a5', date: '2026-08-01', presentMemberIds: ['m1', 'm3'], createdAt: 0 },
  { id: 'a6', date: '2026-08-08', presentMemberIds: ['m1', 'm2', 'm3', 'm5'], createdAt: 0 }
]
