import type { CircleEvent, Contact } from '../agents/sakurun-types'

export const SEED_CONTACTS: Contact[] = [
  {
    id: 'c1',
    name: '佐藤 遥（部長）',
    recipientType: 'executive',
    defaultChannel: 'line',
    notes: '意思決定者。結論から先に伝えると喜ぶ'
  },
  {
    id: 'c2',
    name: '部員全体',
    recipientType: 'member',
    defaultChannel: 'line',
    notes: '全員向けの告知はサークルLINEグループに流す'
  },
  {
    id: 'c3',
    name: '鈴木 澪（デザイン担当）',
    recipientType: 'taskAssignee',
    defaultChannel: 'line',
    notes: 'ポスター・スライドなどデザイン系の依頼はこの人。月火は授業で忙しい'
  },
  {
    id: 'c4',
    name: 'A大学ハッカソン実行委員会',
    recipientType: 'partnerOrg',
    defaultChannel: 'email',
    notes: '合同ハッカソンの共催相手。窓口は委員長の山本さん。返信は2〜3日かかることが多い'
  },
  {
    id: 'c5',
    name: '株式会社テックパートナーズ',
    recipientType: 'company',
    defaultChannel: 'email',
    notes: '合同ハッカソンの協賛企業。会場と懇親会費を支援いただいている。担当は人事部の中村様'
  }
]

export const SEED_EVENTS: CircleEvent[] = [
  {
    id: 'e1',
    title: '大学間合同ハッカソン',
    date: '2026-09-12',
    details:
      'A大学実行委員会と共催。株式会社テックパートナーズ協賛。会場はA大学のホールを借りる予定。テーマは「学生生活を便利にするアプリ」。参加予定は両校あわせて約40名。',
    createdAt: 0
  },
  {
    id: 'e2',
    title: '合同ハッカソン事前説明会',
    date: '2026-08-22',
    details: '参加希望の部員向けにオンラインで開催。チーム分けと持ち物・スケジュールの説明を行う。',
    createdAt: 0
  },
  {
    id: 'e3',
    title: '夏合宿',
    date: '2026-08-30',
    details: '2泊3日、山中湖の合宿所。ハッカソンに向けた開発合宿を兼ねる。会費は1人8,000円、部費から一部補助あり。',
    createdAt: 0
  }
]
