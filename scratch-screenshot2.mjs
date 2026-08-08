import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForSelector('text=さくるん')

await page.getByRole('button', { name: 'メンバー', exact: true }).click()
await page.locator('textarea').first().fill('今週土曜に会場設営あるので集まってほしい')
await page.getByRole('button', { name: '下書き生成' }).click()
await page.waitForSelector('.draft-card', { timeout: 30000 })
await page.waitForTimeout(500)

await page.getByRole('button', { name: '確定して送る' }).click()
await page.waitForSelector('.board-item', { timeout: 10000 })
await page.waitForTimeout(300)

await page.screenshot({ path: 'scratch-sakurun-with-draft.png', fullPage: true })
await browser.close()
console.log('done')
