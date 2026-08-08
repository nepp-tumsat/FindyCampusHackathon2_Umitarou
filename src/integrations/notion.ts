const NOTION_API_URL = 'https://api.notion.com/v1/pages'
const NOTION_VERSION = '2022-06-28'

export type NotionPageResult = {
  id: string
  url: string
}

export async function createNotionHandoverPage(
  env: CloudflareBindings,
  title: string,
  content: string
): Promise<NotionPageResult> {
  if (!env.NOTION_TOKEN || !env.NOTION_PARENT_PAGE_ID) {
    throw new Error('Notion連携が未設定です（NOTION_TOKEN / NOTION_PARENT_PAGE_IDを設定してください）')
  }

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
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content } }] }
        }
      ]
    })
  })

  if (!res.ok) throw new Error(`Notionページ作成に失敗しました: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { id: string; url: string }
  return { id: data.id, url: data.url }
}
