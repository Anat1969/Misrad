import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const [file, out, seconds, fps] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await p.goto('file://' + file); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
const n = Math.round(+seconds * +fps)
for (let i = 0; i < n; i++) {
  await p.evaluate((t) => window.render(t), i / +fps)
  await p.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 })
}
await b.close()
console.log('frames', n)
