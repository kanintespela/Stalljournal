import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message))
await page.goto('http://localhost:4173/')

// -- Förberedelse: två djur --
for (const [tag, name, sex] of [['21501','Selma','tacka'],['21502','Bosse','bagge']]) {
  await page.click('text=+ Nytt djur')
  await page.fill('input[placeholder="t.ex. 21501"]', tag)
  await page.fill('form label:has-text("Namn") input', name)
  await page.selectOption('form label:has-text("Kön") select', sex)
  await page.click('button:has-text("Lägg till djur")')
  await page.waitForSelector(`h1:has-text("${tag}")`)
  await page.click('text=‹ Djur')
}
console.log('✓ två djur skapade')

// -- Platser --
await page.click('.tab:has-text("Platser")')
await page.click('text=+ Ny plats')
await page.fill('input[placeholder="t.ex. Södra betet"]', 'Södra betet')
await page.fill('form label:has-text("Typ") input', 'Bete')
await page.click('button:has-text("Skapa plats")')
await page.waitForSelector('.card-title:has-text("Södra betet")')
await page.click('text=+ Ny plats')
await page.fill('input[placeholder="t.ex. Södra betet"]', 'Stallet')
await page.fill('form label:has-text("Typ") input', 'Stall')
await page.click('button:has-text("Skapa plats")')
await page.waitForSelector('.card-title:has-text("Stallet")')
console.log('✓ två platser skapade')

// -- Grupp + medlemmar --
await page.click('.tab:has-text("Grupper")')
await page.click('text=+ Ny grupp')
await page.fill('input[placeholder="t.ex. Tackor med lamm"]', 'Betesgrupp A')
await page.click('button:has-text("Skapa grupp")')
await page.waitForSelector('h1:has-text("Betesgrupp A")')
await page.click('text=+ Lägg till djur')
await page.waitForSelector('h1:has-text("Lägg till djur")')
await page.click('button:has-text("Alla")')
await page.click('button:has-text("Lägg till 2 djur")')
await page.waitForSelector('text=Djur i gruppen (2)')
console.log('✓ grupp skapad med 2 medlemmar')

// -- Flytt 1: till Södra betet --
await page.click('text=Flytta grupp')
await page.selectOption('form select', { label: 'Södra betet' })
await page.click('button:has-text("Flytta grupp")')
await page.waitForSelector('.badge:has-text("Södra betet")')
console.log('✓ flytt 1 registrerad, aktuell plats visas')

// -- Flytt 2: till Stallet (föregående ska stängas) --
await page.click('text=Flytta grupp')
await page.selectOption('form select', { label: 'Stallet' })
await page.click('button:has-text("Flytta grupp")')
await page.waitForSelector('.badge:has-text("Stallet")')
const hist = await page.textContent('.section:has(h2:has-text("Flytthistorik"))')
if (!hist.includes('pågår')) throw new Error('ingen pågående flytt i historiken')
if ((hist.match(/pågår/g) || []).length !== 1) throw new Error('fler än en pågående flytt!')
console.log('✓ flytt 2: föregående placering stängdes automatiskt')

// -- Vägning med Spara & nästa --
await page.click('.tab:has-text("Journal")')
await page.click('text=⚖️ Vägning')
await page.selectOption('form select', { label: '21501 (Selma)' })
await page.fill('input[placeholder="0.0"]', '48.5')
await page.click('button:has-text("Spara & nästa")')
await page.waitForSelector('.badge:has-text("1 sparade")')
await page.selectOption('form select', { label: '21502 (Bosse)' })
await page.fill('input[placeholder="0.0"]', '75')
await page.click('button:has-text("Spara & nästa")')
await page.waitForSelector('.badge:has-text("2 sparade")')
await page.click('text=‹ Klar')
console.log('✓ bulkvägning: 2 vägningar sparade')

// -- Behandling med karens --
await page.click('text=💊 Behandling')
await page.selectOption('form select', { label: '21501 (Selma)' })
await page.fill('form label:has-text("Läkemedel") input', 'Penovet')
await page.fill('form label:has-text("Karens") input', '14')
await page.click('button:has-text("Spara behandling")')
await page.waitForSelector('h1:has-text("Journal")')
console.log('✓ behandling med 14 dagars karens sparad')

// -- Karensvakt i djurlistan --
await page.click('.tab:has-text("Djur")')
await page.waitForSelector('.card:has-text("21501") .badge-warn:has-text("Karens")')
console.log('✓ karensvakt: 21501 flaggad i djurlistan')

// -- Djurdetalj: karensvarning + grupp --
await page.click('.card-title:has-text("21501")')
await page.waitForSelector('.alert:has-text("Karens t.o.m.")')
await page.waitForSelector('.section:has(h2:has-text("Grupper")) a:has-text("Betesgrupp A")')
console.log('✓ djurdetalj: karensvarning + grupptillhörighet visas')

// -- Gruppbehandling --
await page.click('.tab:has-text("Grupper")')
await page.click('.card-title:has-text("Betesgrupp A")')
await page.click('text=Behandla grupp')
await page.waitForSelector('h1:has-text("Behandla Betesgrupp A")')
page.once('dialog', (d) => { console.log('  dialog:', d.message()); d.accept() })
await page.fill('form label:has-text("Läkemedel") input', 'Ivomec')
await page.fill('form label:has-text("Orsak") input', 'Avmaskning')
await page.click('button:has-text("Registrera för 2 djur")')
await page.waitForSelector('h1:has-text("Betesgrupp A")')
console.log('✓ gruppbehandling registrerad för 2 djur')

// -- Journalfeed --
await page.click('.tab:has-text("Journal")')
const feed = await page.textContent('.section:has(h2:has-text("Senaste händelser"))')
for (const expected of ['Ivomec', '48.5 kg', 'Stallet']) {
  if (!feed.includes(expected)) throw new Error(`"${expected}" saknas i händelsefeeden`)
}
console.log('✓ händelsefeed visar vägning, behandling och flytt')

// -- Viktkurva (två vägningar på Selma behövs — lägg till en till) --
await page.click('text=⚖️ Vägning')
await page.selectOption('form select', { label: '21501 (Selma)' })
await page.fill('input[placeholder="0.0"]', '50.2')
await page.click('form button:has-text("Spara")')
await page.waitForSelector('h1:has-text("Journal")')
await page.click('.tab:has-text("Djur")')
await page.click('.card-title:has-text("21501")')
await page.waitForSelector('.chart .recharts-line', { timeout: 10000 })
console.log('✓ viktkurva ritas (recharts, lazy-laddad)')
await page.screenshot({ path: '/tmp/claude-0/-home-user-Stalljournal/2464c60a-1a58-5b1c-8cf1-b759020f2a77/scratchpad/app-djurdetalj.png', fullPage: true })

// -- Platser: gruppen syns på sin plats --
await page.click('.tab:has-text("Platser")')
await page.waitForSelector('.card:has-text("Stallet"):has-text("Betesgrupp A")')
console.log('✓ platslistan visar vilken grupp som står var')

await browser.close()
console.log('ALLA FAS 2-TESTER OK')
