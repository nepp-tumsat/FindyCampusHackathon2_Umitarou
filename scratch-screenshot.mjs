import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForSelector('text=さくるん')
await page.screenshot({ path: 'scratch-sakurun.png', fullPage: true })
await browser.close()
console.log('done')
