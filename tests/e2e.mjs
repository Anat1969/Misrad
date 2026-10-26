// End-to-end test against `vite preview`. No server: all data lives in localStorage.
// AI_MENU_JS (default: tests/ai-menu.local.js) serves the shared A&I menu locally when the network is out.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'

const PORT = process.env.PORT || '4174'
const BASE = `http://localhost:${PORT}`
const MENU = process.env.AI_MENU_JS || 'tests/ai-menu.local.js'
mkdirSync('tests/shots', { recursive: true })

let failures = 0
const ok = (cond, msg) => { if (cond) console.log(`  ok  ${msg}`); else { failures++; console.log(`  FAIL ${msg}`) } }

async function newPage(browser, { viewport = { width: 1360, height: 900 }, reducedMotion } = {}) {
  const context = await browser.newContext({ viewport, locale: 'he-IL', reducedMotion, permissions: ['clipboard-read', 'clipboard-write'] })
  if (existsSync(MENU)) await context.route('https://appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ path: MENU, contentType: 'application/javascript' }))
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()) })
  return { context, page, errors }
}

const noHScroll = async (page, label) => {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  ok(sw <= cw, `${label}: no horizontal scroll (${sw} <= ${cw})`)
}
const openMenu = async (page) => { if (!(await page.locator('ai-menu .panel').isVisible())) await page.locator('ai-menu .logo').click(); await page.locator('ai-menu .panel').waitFor() }
const menuItem = (page, name) => page.locator('ai-menu').getByRole('menuitem', { name })
const stage = (page, name) => page.locator('li.stage', { has: page.locator('.stage-title strong', { hasText: name }) })
const seen = (loc) => loc.first().waitFor({ timeout: 4000 }).then(() => true, () => false)
const notice = async (page, text) => { const n = page.getByTestId('notice').filter({ hasText: text }); await n.first().waitFor({ timeout: 4000 }); return true }

const server = spawn('npx', ['vite', 'preview', '--port', PORT, '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch()

try {
  console.log('home and navigation')
  {
    const { page, errors, context } = await newPage(browser)
    await page.goto(BASE + '/')
    await page.locator('h1').waitFor()
    ok(await page.locator('.topbar-inner ai-menu .logo').isVisible(), 'A&I logo button in the top bar')
    ok((await page.locator('.kpi').count()) === 4, 'four live KPIs on the home page')
    ok(await page.locator('.risk').count() > 0, 'risks computed from data')
    ok(await page.locator('svg.bridge').isVisible(), 'bridge visual renders')
    for (const [name, path] of [['משרד', '/office'], ['תזרים', '/cashflow'], ['הגדרות', '/settings']]) {
      await page.locator('.navlink', { hasText: name }).click()
      await page.waitForURL(BASE + path)
      ok(true, `nav ${name} -> ${path}`)
    }
    await page.locator('.brand').click(); await page.waitForURL(BASE + '/')
    ok(true, 'app name links home')
    await openMenu(page)
    ok(await menuItem(page, 'פרויקט חדש').isVisible(), 'menu holds "פרויקט חדש"')
    ok(await menuItem(page, 'מצב עריכה').isVisible(), 'menu holds "מצב עריכה"')
    await page.keyboard.press('Escape')
    await page.screenshot({ path: 'tests/shots/home.png', fullPage: true })
    ok(errors.length === 0, `no console errors on home (${errors.join(' | ')})`)
    await context.close()
  }

  console.log('office filters')
  {
    const { page, context } = await newPage(browser)
    await page.goto(BASE + '/office')
    const all = await page.locator('.prow').count()
    ok(all === 4, `four active projects listed (${all})`)
    await page.locator('.chip', { hasText: 'באיחור תשלום' }).click()
    await page.waitForURL(/f=late/)
    ok((await page.locator('.prow').count()) === 1, 'late filter shows one project')
    await page.locator('.chip', { hasText: 'בארכיון' }).click()
    ok((await page.locator('.prow').count()) === 1 && (await page.locator('.prow-name').first().textContent()) === 'שימור בית העם', 'archive filter')
    await page.locator('.chip', { hasText: 'פעילים' }).click()
    await page.getByLabel('חיפוש פרויקט').fill('הרצליה')
    ok((await page.locator('.prow').count()) === 1, 'search filters by name')
    await page.getByLabel('חיפוש פרויקט').fill('')
    await page.locator('.pipe-col', { hasText: 'ממתין לאישור' }).click()
    await page.waitForURL(/state=submitted/)
    ok((await page.locator('.prow').count()) === 1, 'pipeline column filters projects by stage state')
    await context.close()
  }

  console.log('the bridge: client approval -> payment request -> payment')
  {
    const { page, errors, context } = await newPage(browser)
    await page.goto(BASE + '/')
    const clientHref = await page.locator('a.btn', { hasText: 'הפורטל כפי שהלקוח רואה' }).getAttribute('href')
    ok(clientHref?.startsWith('/c#'), 'client portal link built from data')
    await page.goto(BASE + clientHref)
    await page.getByRole('heading', { name: 'שלום משפחת לוי' }).waitFor()
    ok(await page.locator('ai-menu').count() === 0, 'client portal shows the logo without a menu')
    await page.getByRole('button', { name: 'מאשר/ת את השלב' }).click()
    const code = (await page.getByTestId('approval-code').textContent()).trim()
    ok(/^A-2026-011-4-\d{8}-[0-9A-Z]{4}$/.test(code), `approval code issued (${code})`)
    await page.screenshot({ path: 'tests/shots/client.png', fullPage: true })

    await page.goto(BASE + '/office')
    await page.locator('.prow', { hasText: 'וילה כרמל' }).click()
    await page.locator('.ptitle', { hasText: 'וילה כרמל' }).waitFor()
    const permit = stage(page, 'היתר בנייה')
    await permit.getByRole('button', { name: 'רישום אישור הלקוח' }).click()
    await page.getByLabel('קוד אישור').fill(code.replace(/.{4}$/, 'ZZZZ'))
    await page.getByRole('button', { name: 'אימות ורישום האישור' }).click()
    ok(await page.getByRole('alert').filter({ hasText: 'ספרות הביקורת' }).isVisible(), 'a mistyped code is rejected with a reason')
    await page.getByLabel('קוד אישור').fill(code)
    await page.getByRole('button', { name: 'אימות ורישום האישור' }).click()
    ok(await notice(page, 'האישור נרשם'), 'approval registered')
    ok(await permit.locator('.tag', { hasText: 'נשלחה דרישה' }).isVisible(), 'approval issued a payment request at once')
    ok(await stage(page, 'תכניות עבודה ופרטים').locator('.tag', { hasText: 'בעבודה' }).isVisible(), 'approval opened the next stage')
    const invLink = permit.getByRole('link', { name: /דרישת תשלום \d+/ })
    const invNo = (await invLink.textContent()).match(/\d+/)[0]

    await invLink.click()
    await page.locator('.invoice').waitFor()
    const invText = await page.locator('.invoice').textContent()
    ok(invText.includes(invNo) && invText.includes('מע"מ 18%') && invText.includes('66,080'), 'payment request shows number, VAT 18% and total 66,080')
    ok(invText.includes('אינו חשבונית מס'), 'payment request states it is not a tax invoice')
    await page.screenshot({ path: 'tests/shots/invoice.png', fullPage: true })
    await page.getByRole('link', { name: 'חזרה לפרויקט' }).click()

    await stage(page, 'היתר בנייה').getByRole('button', { name: 'רישום תשלום' }).click()
    await page.getByLabel('סכום (₪, כולל מע"מ)').fill('30000')
    await page.getByRole('button', { name: 'רישום התשלום' }).click()
    ok(await stage(page, 'היתר בנייה').locator('.tag', { hasText: 'נשלחה דרישה' }).isVisible(), 'partial payment keeps the stage open')
    await stage(page, 'היתר בנייה').getByRole('button', { name: 'רישום תשלום' }).click()
    ok((await page.getByLabel('סכום (₪, כולל מע"מ)').inputValue()) === '36080', 'balance prefilled after partial payment')
    await page.getByRole('button', { name: 'רישום התשלום' }).click()
    await notice(page, 'התשלום נרשם')
    await page.reload()
    await page.locator('.ptitle').waitFor()
    const closed = await stage(page, 'היתר בנייה').locator('.tag', { hasText: 'שולם' }).isVisible()
    ok(closed, 'stage paid in full, closed, and kept after reload')
    if (!closed) console.log('     stage:', await stage(page, 'היתר בנייה').textContent())
    await page.getByRole('tab', { name: 'יומן' }).click()
    ok(await seen(page.locator('.log li', { hasText: 'השלב נסגר' })), 'log records the closing payment')

    await page.goto(BASE + '/cashflow')
    await page.locator('.chip', { hasText: 'שולמו' }).click()
    ok(await seen(page.locator('tbody tr', { hasText: invNo }).filter({ hasText: 'שולם' })), 'cashflow lists the paid request')
    await page.screenshot({ path: 'tests/shots/cashflow.png', fullPage: true })
    ok(errors.length === 0, `no console errors in the flow (${errors.join(' | ')})`)
    await context.close()
  }

  console.log('return with comments, edit mode, menu actions')
  {
    const { page, context } = await newPage(browser)
    await page.goto(BASE + '/office')
    await page.locator('.prow', { hasText: 'משרדים רמת גן' }).click()
    const s1 = stage(page, 'סקר ופרוגרמה')
    await s1.getByRole('button', { name: 'הגשה לאישור הלקוח' }).click()
    await page.getByRole('dialog', { name: 'קישור אישי ללקוח' }).waitFor()
    await page.waitForFunction(() => document.querySelector('.share-text')?.value.includes('/c#'))
    ok((await page.locator('.share-text').inputValue()).includes('סקר ופרוגרמה'), 'submission opens a ready message with the client link')
    await page.getByRole('button', { name: 'סגירה' }).click()
    await s1.getByRole('button', { name: 'רישום אישור הלקוח' }).click()
    await page.getByRole('tab', { name: 'הוחזר עם הערות' }).click()
    await page.getByLabel('הערות הלקוח').fill('להוסיף חדר ישיבות')
    await page.getByRole('button', { name: 'החזרה לעבודה' }).click()
    ok(await s1.locator('.returned', { hasText: 'להוסיף חדר ישיבות' }).isVisible(), 'returned stage shows the client comments')
    await page.locator('.sheet-wrap').waitFor({ state: 'detached' })

    await openMenu(page)
    await menuItem(page, 'הוספת משימה').click()
    await page.getByLabel('משימה', { exact: true }).fill('סימון מחיצות באתר')
    await page.getByLabel('אחראי').selectOption('contractor')
    await page.getByRole('button', { name: 'הוספה' }).click()
    await notice(page, 'המשימה נוספה')
    ok(await seen(page.locator('.task', { hasText: 'סימון מחיצות באתר' })), 'task added from the logo menu')

    await openMenu(page)
    await menuItem(page, 'מצב עריכה').click()
    ok(await seen(page.locator('.editband')), 'edit mode on from the menu')
    await page.getByRole('tab', { name: 'פרטים' }).click()
    await page.getByLabel('טלפון קבלן').fill('052-1231234')
    await page.getByLabel('קבלן ראשי').fill('אבי בונה')
    await page.getByLabel('טלפון קבלן').click()
    await page.reload()
    await page.getByRole('tab', { name: 'פרטים' }).click()
    ok((await page.getByLabel('קבלן ראשי').inputValue()) === 'אבי בונה', 'edited field saved after reload')
    await openMenu(page)
    await menuItem(page, 'מצב עריכה').click()
    ok(!(await page.locator('.editband').isVisible()), 'edit mode off')
    await context.close()
  }

  console.log('new project and settings')
  {
    const { page, context } = await newPage(browser)
    await page.goto(BASE + '/settings')
    await page.getByLabel('מע"מ (%)').fill('17')
    await page.getByLabel('מע"מ (%)').press('Enter')
    await page.goto(BASE + '/new')
    ok(await page.getByRole('button', { name: 'פתיחת הפרויקט' }).isDisabled(), 'create disabled until the essentials are filled')
    await page.getByLabel('שם הפרויקט').fill('בית משפחת אברהם')
    await page.getByLabel('לקוח').fill('משפחת אברהם')
    await page.getByLabel('שכר טרחה לפני מע"מ (₪)').fill('100000')
    ok(await page.locator('.tpl li', { hasText: 'היתר בנייה' }).filter({ hasText: '23,400' }).isVisible(), 'live preview of stage amounts with VAT 17%')
    await page.getByRole('button', { name: 'פתיחת הפרויקט' }).click()
    await page.locator('.ptitle', { hasText: 'בית משפחת אברהם' }).waitFor()
    ok(await stage(page, 'סקר ופרוגרמה').locator('.tag', { hasText: 'בעבודה' }).isVisible(), 'new project opens with stage 1 active')
    await page.goto(BASE + '/office')
    ok(await page.locator('.prow', { hasText: 'בית משפחת אברהם' }).isVisible(), 'new project appears in the office')
    await context.close()
  }

  console.log('contractor portal and broken links')
  {
    const { page, context } = await newPage(browser)
    await page.goto(BASE + '/')
    const href = await page.locator('a.btn', { hasText: 'הפורטל כפי שהקבלן רואה' }).getAttribute('href')
    await page.goto(BASE + href)
    await page.getByRole('heading', { name: 'וילה כרמל' }).waitFor()
    ok(await page.locator('.task', { hasText: 'סימון גבולות מגרש באתר' }).isVisible(), 'contractor sees only contractor tasks')
    ok(!(await page.locator('.task', { hasText: 'אישור יועץ נגישות' }).isVisible()), 'studio tasks hidden from the contractor')
    ok(await page.locator('.drawings li.stale').count() === 1, 'superseded drawing marked')
    await page.screenshot({ path: 'tests/shots/contractor.png', fullPage: true })
    await page.goto(BASE + '/c#zbroken')
    await page.getByText('הקישור לא תקין').waitFor()
    ok(true, 'broken portal link explained')
    await context.close()
  }

  console.log('mobile, installability, reduced motion')
  {
    const { page, context, errors } = await newPage(browser, { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    for (const path of ['/', '/office', '/cashflow', '/settings', '/new']) {
      await page.goto(BASE + path)
      await page.waitForTimeout(400)
      await noHScroll(page, `mobile ${path}`)
    }
    await page.goto(BASE + '/office')
    await page.locator('.prow').first().click()
    await page.locator('.ptitle').waitFor()
    await noHScroll(page, 'mobile project')
    ok(await page.locator('ai-menu .logo').isVisible(), 'A&I logo visible on mobile')
    await page.screenshot({ path: 'tests/shots/m-project.png', fullPage: true })
    const cdp = await context.newCDPSession(page)
    await page.goto(BASE + '/')
    await page.waitForTimeout(800)
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
    ok(installabilityErrors.length === 0, `installable from Chrome (${JSON.stringify(installabilityErrors)})`)
    ok(errors.length === 0, `no console errors on mobile (${errors.join(' | ')})`)
    await context.close()
  }
} catch (e) {
  failures++
  console.log('  FAIL', e.message.split('\n')[0])
  for (const ctx of browser.contexts()) for (const pg of ctx.pages()) await pg.screenshot({ path: 'tests/shots/failure.png', fullPage: true }).catch(() => {})
} finally {
  await browser.close()
  server.kill()
}

console.log(failures ? `\n${failures} failed` : '\nall passed')
process.exit(failures ? 1 : 0)
