import type { Contact, Project } from '../agents/sakurun-types'

export const SEED_CONTACTS: Contact[] = [
  {
    id: 'c1',
    name: '佐藤 遥（部長）',
    label: '幹部',
    internal: true,
    defaultChannel: 'line',
    styleNotes: '意思決定者。結論から先に、率直かつ簡潔に。意思決定を仰ぐトーンで'
  },
  {
    id: 'c2',
    name: '部員全体',
    label: 'メンバー',
    internal: true,
    defaultChannel: 'line',
    styleNotes: '全員向けの告知はサークルLINEグループに流す。分かりやすく前向きに、参加を促すトーンで'
  },
  {
    id: 'c3',
    name: '鈴木 澪（デザイン担当）',
    label: 'タスク依頼',
    internal: true,
    defaultChannel: 'line',
    styleNotes: 'ポスター・スライドなどデザイン系の依頼はこの人。月火は授業で忙しい。依頼内容と期限を明確に、丁寧にお願いする'
  },
  {
    id: 'c4',
    name: 'A大学ハッカソン実行委員会',
    label: '外部協力団体',
    internal: false,
    defaultChannel: 'email',
    styleNotes: '合同ハッカソンの共催相手。窓口は委員長の山本さん。返信は2〜3日かかることが多い。フォーマルな敬語で調整・依頼文として書く'
  },
  {
    id: 'c5',
    name: '株式会社テックパートナーズ',
    label: '協賛企業',
    internal: false,
    defaultChannel: 'email',
    styleNotes: '合同ハッカソンの協賛企業。会場と懇親会費を支援いただいている。担当は人事部の中村様。ビジネスメール形式、丁寧語・謙譲語で'
  }
]

export const SEED_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: '大学間合同ハッカソン',
    notes: [
      {
        id: 'n1',
        text: 'A大学実行委員会と共催。開催日は2026-09-12。会場はA大学のホールを借りる予定。テーマは「学生生活を便利にするアプリ」。参加予定は両校あわせて約40名。',
        createdAt: 0,
        updatedAt: 0
      },
      {
        id: 'n2',
        text: '株式会社テックパートナーズ協賛。会場費と懇親会費を支援いただく。ロゴをポスターと配布資料に掲載する約束。',
        createdAt: 0,
        updatedAt: 0
      },
      {
        id: 'n3',
        text: '事前説明会を2026-08-22にオンラインで開催予定。チーム分けと持ち物・スケジュールの説明を行う。',
        createdAt: 0,
        updatedAt: 0
      }
    ],
    retrospective: ''
  },
  {
    id: 'p2',
    name: '夏合宿',
    notes: [
      {
        id: 'n4',
        text: '2026-08-30から2泊3日、山中湖の合宿所。ハッカソンに向けた開発合宿を兼ねる。会費は1人8,000円、部費から一部補助あり。',
        createdAt: 0,
        updatedAt: 0
      }
    ],
    retrospective: ''
  },
  {
    id: 'p3',
    name: '新歓イベント（4月・完了）',
    notes: [
      {
        id: 'n5',
        text: '4月に新歓BBQを開催。参加は新入生12名、部員15名。会費は1人1,500円。',
        createdAt: 0,
        updatedAt: 0
      }
    ],
    retrospective:
      '【Keep】新入生への個別声かけは入部率が高かった（12名中8名入部）。【Problem】開催告知が前日になり、部員の参加率が低かった。買い出し担当が当日まで決まらず バタバタした。【Try】次回から告知は最低1週間前に出す。役割分担はイベントの3日前までに確定させる。'
  }
]
