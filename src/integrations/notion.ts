const NOTION_API_URL = 'https://api.notion.com/v1/pages'
const NOTION_VERSION = '2022-06-28'

export type NotionPageResult = {
  id: string
  url: string
}

type Section = {
  heading?: string
  paragraphs: string[]
}

// Notionのrich_textは1ブロック2000文字制限があるため分割する
function chunkText(text: string, size = 1800): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks.length > 0 ? chunks : ['']
}

export async function createNotionPage(
  env: CloudflareBindings,
  title: string,
  sections: Section[]
): Promise<NotionPageResult> {
  if (!env.NOTION_TOKEN || !env.NOTION_PARENT_PAGE_ID) {
    throw new Error('Notion連携が未設定です（NOTION_TOKEN / NOTION_PARENT_PAGE_IDを設定してください）')
  }

  const children = sections.flatMap((section) => [
    ...(section.heading
      ? [
          {
            object: 'block',
            type: 'heading_2',
            heading_2: { rich_text: [{ text: { content: section.heading } }] }
          }
        ]
      : []),
    ...section.paragraphs.flatMap((p) =>
      chunkText(p).map((chunk) => ({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: chunk } }] }
      }))
    )
  ])

  const res = await fetch(NOTION_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION
    },
    body: JSON.stringify({
      parent: { page_id: env.NOTION_PARENT_PAGE_ID },
      properties: {
        title: { title: [{ text: { content: title } }] }
      },
      children
    })
  })

  if (!res.ok) throw new Error(`Notionページ作成に失敗しました: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { id: string; url: string }
  return { id: data.id, url: data.url }
}
