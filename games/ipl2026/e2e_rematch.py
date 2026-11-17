#!/usr/bin/env python3
"""Result-screen actions: REMATCH keeps teams, PICK NEW TEAMS returns to selection."""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
errors = []

async def to_result(page):
    await page.click('#quickPickBtn'); await page.wait_for_timeout(300)
    await page.click('#confirmXiBtn'); await page.wait_for_timeout(300)
    await page.click('#quickPickBtn'); await page.wait_for_timeout(300)
    await page.click('#confirmXiBtn'); await page.wait_for_timeout(300)
    await page.click('#confirmMatchBtn'); await page.wait_for_timeout(400)
    await page.click('#coinBtn'); await page.wait_for_timeout(2300)
    await page.click('#decisionZone .choice-card[data-choice="bat"]'); await page.wait_for_timeout(150)
    await page.click('#startMatchBtn')
    for _ in range(190):
        if await page.locator('#resultBanner.show').count(): return True
        await page.wait_for_timeout(1000)
    return False

async def run(browser, mode_card, label):
    ctx = await browser.new_context(viewport={'width': 1560, 'height': 1000})
    page = await ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{label} PAGEERROR: {e}'))
    page.on('console', lambda m: errors.append(f'{label} CONSOLE: {m.text}') if m.type == 'error' else None)
    await page.goto(BASE + '/index.html', wait_until='networkidle')
    await page.click(f'#{mode_card}'); await page.wait_for_timeout(300)
    await page.click('#team1Grid .team-card:has-text("CSK")')
    await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(300)
    await page.click('#team2Grid .team-card:has-text("MI")')
    await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(400)
    ok = await to_result(page)
    print(f'[{label}] reached result: {ok}')
    # REMATCH
    await page.click('#rematchBtn'); await page.wait_for_timeout(600)
    active = await page.locator('.screen.active').get_attribute('id')
    print(f'[{label}] after REMATCH active screen: {active}')
    assert active == 'screen-toss', 'rematch should land on toss'
    # go through toss again quickly to result, then use PICK NEW TEAMS
    await page.click('#coinBtn'); await page.wait_for_timeout(2300)
    await page.click('#decisionZone .choice-card[data-choice="bat"]'); await page.wait_for_timeout(150)
    await page.click('#startMatchBtn')
    for _ in range(190):
        if await page.locator('#resultBanner.show').count(): break
        await page.wait_for_timeout(1000)
    await page.click('#newSelectionBtn'); await page.wait_for_timeout(600)
    active = await page.locator('.screen.active').get_attribute('id')
    print(f'[{label}] after PICK NEW active screen: {active}')
    assert active in ('screen-mode', 'screen-team1'), 'pick new should return to selection'
    await ctx.close()

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--no-sandbox'])
        await run(browser, 'modeShowdownCard', 'SHOWDOWN')
        await run(browser, 'modeFullCard', 'FULL')
        await browser.close()

asyncio.run(main())
if errors:
    print('\n=== ERRORS ==='); [print(e) for e in errors]; sys.exit(2)
print('\nREMATCH E2E PASSED')
