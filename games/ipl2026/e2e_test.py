#!/usr/bin/env python3
"""Full end-to-end walkthrough of the IPL 2026 Playing XI app."""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
SHOT = '/home/user/ipl2026/e2e'
import os
os.makedirs(SHOT, exist_ok=True)

errors = []

async def build_xi(page, label):
    # ensure a wicketkeeper is on board first
    await page.click('#rolePills .pill[data-role="WK"]')
    await page.wait_for_timeout(150)
    add_btn = page.locator('#squadList button[data-add]').first
    await add_btn.click()
    await page.wait_for_timeout(150)
    # back to all roles, fill remaining slots
    await page.click('#rolePills .pill[data-role="ALL"]')
    await page.wait_for_timeout(150)
    for _ in range(40):
        count = await page.locator('#squadList .player-row.in-xi').count()
        if count >= 11:
            break
        btn = page.locator('#squadList button[data-add]').first
        if await btn.count() == 0:
            print(f'[{label}] no more addable players, count={count}')
            break
        try:
            await btn.click(timeout=1500)
        except Exception as e:
            print(f'[{label}] click failed: {e}')
            break
        await page.wait_for_timeout(120)
    count = await page.locator('#squadList .player-row.in-xi').count()
    print(f'[{label}] XI count = {count}')

    # captain: first XI item's C button
    await page.locator('#xiList .xi-item [data-cap]').first.click()
    await page.wait_for_timeout(120)
    # keeper: first enabled K button
    k_btn = page.locator('#xiList .xi-item [data-wk]:not([disabled])').first
    await k_btn.click()
    await page.wait_for_timeout(120)
    # bowling options: enable up to 5 (or however many enabled exist)
    bowl_btns = page.locator('#xiList .xi-item [data-bowl]:not([disabled])')
    nb = await bowl_btns.count()
    print(f'[{label}] enabled bowling-option buttons in XI: {nb}')
    clicked = 0
    for i in range(nb):
        if clicked >= 5:
            break
        await bowl_btns.nth(i).click()
        clicked += 1
        await page.wait_for_timeout(80)
    await page.wait_for_timeout(200)

    validation_text = await page.locator('#xiValidation').inner_text()
    print(f'[{label}] validation:\n{validation_text}')
    disabled = await page.locator('#confirmXiBtn').is_disabled()
    print(f'[{label}] confirm XI disabled? {disabled}')
    return disabled

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
        await page.screenshot(path=f'{SHOT}/01-team1.png')

        # pick team 1 (CSK) and team 2 (RCB)
        await page.click('#team1Grid .team-card:has-text("CSK")')
        await page.wait_for_timeout(200)
        await page.click('#selectBarConfirmBtn')
        await page.wait_for_timeout(400)
        await page.screenshot(path=f'{SHOT}/02-team2.png')
        print('team1 confirmed -> now on team2 screen, grid cards:', await page.locator('#team2Grid .team-card').count())

        # team1 should be disabled in team2 grid
        dis = await page.locator('#team2Grid .team-card.disabled').count()
        print('disabled cards in team2 grid (should be 1):', dis)

        await page.click('#team2Grid .team-card:has-text("RCB")')
        await page.wait_for_timeout(200)
        await page.click('#selectBarConfirmBtn')
        await page.wait_for_timeout(500)
        await page.screenshot(path=f'{SHOT}/03-xi1.png')

        # XI 1
        disabled = await build_xi(page, 'XI-1')
        await page.screenshot(path=f'{SHOT}/04-xi1-filled.png')
        if not disabled:
            await page.click('#confirmXiBtn')
            await page.wait_for_timeout(500)
        else:
            print('XI-1 NOT confirmable — stopping'); 
            await page.screenshot(path=f'{SHOT}/04b-xi1-blocked.png')
            await browser.close(); return

        await page.screenshot(path=f'{SHOT}/05-xi2.png')
        disabled = await build_xi(page, 'XI-2')
        await page.screenshot(path=f'{SHOT}/06-xi2-filled.png')
        if not disabled:
            await page.click('#confirmXiBtn')
            await page.wait_for_timeout(500)
        else:
            print('XI-2 NOT confirmable — stopping')
            await page.screenshot(path=f'{SHOT}/06b-xi2-blocked.png')
            await browser.close(); return

        await page.screenshot(path=f'{SHOT}/07-confirm.png')
        await page.click('#confirmMatchBtn')
        await page.wait_for_timeout(450)
        await page.screenshot(path=f'{SHOT}/08-toss.png')
        await page.click('#coinBtn')
        await page.wait_for_timeout(2300)
        await page.screenshot(path=f'{SHOT}/09-toss-result.png')
        toss_txt = await page.locator('#tossResult').inner_text()
        print('toss:', toss_txt)
        await page.click('#decisionZone .choice-card[data-choice="bat"]')
        await page.wait_for_timeout(200)
        await page.click('#startMatchBtn')
        await page.wait_for_timeout(2500)
        await page.screenshot(path=f'{SHOT}/10-match-live.png')

        # let the match auto-play; poll for result
        done = False
        for _ in range(90):
            vis = await page.locator('#resultBanner.show').count()
            if vis:
                done = True
                break
            await page.wait_for_timeout(1000)
        print('match finished:', done)
        await page.screenshot(path=f'{SHOT}/11-result.png')
        rb = await page.locator('#resultBanner').inner_text()
        print('result banner:\n', rb)

        # scorecard visible
        sc = await page.locator('#scorecardBody').inner_text()
        print('scorecard sample:\n', sc[:600])

        await browser.close()

asyncio.run(main())

if errors:
    print('\n=== PAGE ERRORS ===')
    for e in errors:
        print(e)
    sys.exit(2)
else:
    print('\nNO PAGE ERRORS')
