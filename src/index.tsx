import { Hono } from 'hono'
import { agentsMiddleware } from 'hono-agents'
import { getAgentByName } from 'agents'
import { renderToReadableStream } from 'react-dom/server'
import { Script, Link, ViteClient, ReactRefresh } from 'vite-ssr-components/react'
import { buildGoogleAuthUrl, exchangeGoogleCode } from './integrations/google-calendar'
import { SAKURUN_INSTANCE_NAME } from './agents/sakurun-types'
export { CounterAgent } from './agents/counter'
export { SakurunAgent } from './agents/sakurun'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('*', agentsMiddleware())

// Googleカレンダー連携（ストレッチ機能）のOAuthフロー。
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRETが未設定の間はGoogle側で認可エラーになるだけで、
// 他の機能には影響しない。
app.get('/auth/google', (c) => {
  const redirectUri = new URL('/auth/google/callback', c.req.url).toString()
  return c.redirect(buildGoogleAuthUrl(c.env, redirectUri))
})

app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) return c.text('missing code', 400)

  const redirectUri = new URL('/auth/google/callback', c.req.url).toString()
  const tokens = await exchangeGoogleCode(c.env, code, redirectUri)

  const stub = await getAgentByName(c.env.SakurunAgent, SAKURUN_INSTANCE_NAME)
  await stub.saveGoogleTokens(tokens)

  return c.redirect('/')
})

app.get('/', async (c) => {
  c.header('Content-Type', 'text/html')
  return c.body(
    await renderToReadableStream(
      <html>
        <head>
          <ViteClient />
          <ReactRefresh />
          <Script src="/src/client/index.tsx" />
          <Link href="/src/style.css" rel="stylesheet" />
        </head>
        <body>
          <div id="root" />
        </body>
      </html>
    )
  )
})

export default app
