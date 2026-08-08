import { Hono, type Context } from 'hono'
import { agentsMiddleware } from 'hono-agents'
import { renderToReadableStream } from 'react-dom/server'
import { Script, Link, ViteClient, ReactRefresh } from 'vite-ssr-components/react'
export { CounterAgent } from './agents/counter'
export { MagiAgent } from './agents/magi'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('*', agentsMiddleware())

const renderShell = async (c: Context<{ Bindings: CloudflareBindings }>) => {
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
}

app.get('/', renderShell)
app.get('/restaurants', renderShell)

export default app
