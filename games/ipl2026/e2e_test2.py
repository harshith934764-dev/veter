#!/usr/bin/env python3
"""Edge-case & robustness tests: switcher, persistence, overseas cap, mobile."""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
SHOT = '/home/user/ipl2026/e2e'
errors = []

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--no-sandbox'])
        ctx = await browser.new_context(viewport={'width': 1560, 'height': 980})
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))
        page.on('console', lambda m: errors.append(f'CONSOLE-{m.type}: {m.text}') if m.type == 'error' else None)

        await page.goto(BASE + '/index.html', wait_until='networkidle')
        await page.click('#modeFullCard')
        await page.wait_for_timeout(300)
        # pick Mumbai (MI) then Gujarat (GT)
        await page.click('#team1Grid .team-card:has-text("MI")')
        await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(350)
        await page.click('#team2Grid .team-card:has-text("GT")')
        await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(450)

        # --- overseas cap test: switch to Overseas pill and add 5 overseas MI players
        await page.click('#overseasToggle'); await page.wait_for_timeout(200)
        os_add = page.locator('#squadList button[data-add]')
        for i in range(5):
            n = await page.locator('#squadList button[data-add]').count()
            if n == 0:
                break
            await page.locator('#squadList button[data-add]').first.click()
            await page.wait_for_timeout(150)
        os_count = await page.locator('#squadList .player-row.in-xi').count()
        print('overseas added (expect cap 4):', os_count)
        toast_txt = await page.locator('#toast').inner_text()
        print('toast:', toast_txt)
        await page.screenshot(path=f'{SHOT}/20-overseas-cap.png')

        # --- switch button jumps to Team 2 XI and back
        print('switch btn label:', await page.locator('#switchXiBtn').inner_text())
        await page.click('#switchXiBtn'); await page.wait_for_timeout(300)
        h2 = await page.locator('#xiTeamName').inner_text()
        print('after switch, editing team:', h2)
        await page.click('#switchXiBtn'); await page.wait_for_timeout(300)
        h2 = await page.locator('#xiTeamName').inner_text()
        print('after switching back:', h2)

        # --- persistence: reload and see if MI players persist
        await page.evaluate("window.scrollTo(0,0)")
        await page.reload(wait_until='networkidle')
        await page.wait_for_timeout(400)
        count = await page.locator('#xiList .xi-item').count() if await page.locator('#screen-xi').evaluate('e=>e.classList.contains("active")') else -1
        print('XI items after reload (expect 4):', count)
        await page.screenshot(path=f'{SHOT}/21-reload.png')

        await browser.close()

        # --- mobile pass
        mob = await pw.chromium.launch(args=['--no-sandbox'])
        mctx = await mob.new_context(viewport={'width': 390, 'height': 844})
        mpage = await mctx.new_page()
        mpage.on('pageerror', lambda e: errors.append(f'MOBILE-PAGEERROR: {e}'))
        await mpage.goto(BASE + '/index.html', wait_until='networkidle')
        await mpage.click('#modeFullCard')
        await mpage.wait_for_timeout(300)
        await mpage.screenshot(path=f'{SHOT}/22-mobile-team.png')
        await mpage.click('#team1Grid .team-card:has-text("KKR")')
        await mpage.click('#selectBarConfirmBtn'); await mpage.wait_for_timeout(400)
        await mpage.screenshot(path=f'{SHOT}/23-mobile-team2.png')
        await mpage.click('#team2Grid .team-card:has-text("SRH")')
        await mpage.click('#selectBarConfirmBtn'); await mpage.wait_for_timeout(450)
        await mpage.screenshot(path=f'{SHOT}/24-mobile-xi.png')
        await mob.close()

asyncio.run(main())
if errors:
    print('\n=== ERRORS ==='); [print(e) for e in errors]; sys.exit(2)
print('\nNO ERRORS')
