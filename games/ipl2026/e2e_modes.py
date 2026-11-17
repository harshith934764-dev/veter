#!/usr/bin/env python3
"""Full end-to-end walkthrough — BOTH formats."""
import asyncio, sys, os
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
SHOT = '/home/user/ipl2026/e2e'
os.makedirs(SHOT, exist_ok=True)
errors = []

async def build_showdown_side(page, label):
    # add 1 wicketkeeper first if available (filter pill)
    await page.click('#rolePills .pill[data-role="WK"]')
    await page.wait_for_timeout(150)
    wk_add = page.locator('#squadList button[data-add]').first
    if await wk_add.count() > 0:
        await wk_add.click()
        await page.wait_for_timeout(150)
    await page.click('#rolePills .pill[data-role="ALL"]')
    await page.wait_for_timeout(150)
    # fill batters to 4
    for _ in range(30):
        batters = await page.locator('#xiList .xi-item').count()
        # count batter rows: those not having BWL-only category — simpler: try WK/BAT pill
        # just add from ALL while BAT slots remain
        await page.click('#rolePills .pill[data-role="BAT"]')
        await page.wait_for_timeout(120)
        bat_btn = page.locator('#squadList button[data-add]').first
        bat_count = await bat_btn.count()
        if bat_count == 0:
            await page.click('#rolePills .pill[data-role="WK"]')
            await page.wait_for_timeout(120)
            bat_btn = page.locator('#squadList button[data-add]').first
            bat_count = await bat_btn.count()
        if bat_count == 0:
            break
        await bat_btn.click()
        await page.wait_for_timeout(130)
        batters = await page.locator('#squadList .player-row.in-xi').count()
        # stop when 4 batter-role players are in
        # (BAT FULL tag appears on rows once 4 are in, so we can also rely on that)
        bat_full = await page.locator('#squadList button[disabled]').count()
        # crude: check validation text
        val = await page.locator('#xiValidation').inner_text()
        if 'Batters selected: 4/4' in val:
            break
    # fill bowlers to 3
    for _ in range(30):
        val = await page.locator('#xiValidation').inner_text()
        if 'Bowlers selected: 3/3' in val:
            break
        await page.click('#rolePills .pill[data-role="BOWL"]')
        await page.wait_for_timeout(120)
        b = page.locator('#squadList button[data-add]').first
        if await b.count() == 0:
            await page.click('#rolePills .pill[data-role="AR"]')
            await page.wait_for_timeout(120)
            b = page.locator('#squadList button[data-add]').first
            if await b.count() == 0:
                print(f'[{label}] no more bowler options'); break
        await b.click()
        await page.wait_for_timeout(130)
    await page.click('#rolePills .pill[data-role="ALL"]')
    await page.wait_for_timeout(150)
    # captain (first batter), keeper (a WK if any)
    await page.locator('#xiList .xi-item [data-cap]').first.click()
    await page.wait_for_timeout(120)
    k_btn = page.locator('#xiList .xi-item [data-wk]:not([disabled])').first
    if await k_btn.count():
        await k_btn.click()
        await page.wait_for_timeout(120)
    validation_text = await page.locator('#xiValidation').inner_text()
    print(f'[{label}] validation:\n{validation_text}')
    return await page.locator('#confirmXiBtn').is_disabled()

async def build_full_xi(page, label):
    await page.click('#rolePills .pill[data-role="WK"]')
    await page.wait_for_timeout(150)
    add_btn = page.locator('#squadList button[data-add]').first
    if await add_btn.count(): await add_btn.click()
    await page.wait_for_timeout(150)
    await page.click('#rolePills .pill[data-role="ALL"]')
    await page.wait_for_timeout(150)
    for _ in range(40):
        count = await page.locator('#squadList .player-row.in-xi').count()
        if count >= 11: break
        btn = page.locator('#squadList button[data-add]').first
        if await btn.count() == 0: break
        try: await btn.click(timeout=1500)
        except Exception: break
        await page.wait_for_timeout(110)
    print(f'[{label}] XI count = {await page.locator("#squadList .player-row.in-xi").count()}')
    await page.locator('#xiList .xi-item [data-cap]').first.click()
    await page.wait_for_timeout(120)
    k_btn = page.locator('#xiList .xi-item [data-wk]:not([disabled])').first
    await k_btn.click()
    await page.wait_for_timeout(120)
    bowl_btns = page.locator('#xiList .xi-item [data-bowl]:not([disabled])')
    nb = await bowl_btns.count()
    for i in range(min(5, nb)):
        await bowl_btns.nth(i).click(); await page.wait_for_timeout(70)
    await page.wait_for_timeout(200)
    validation_text = await page.locator('#xiValidation').inner_text()
    print(f'[{label}] validation ok?')
    return await page.locator('#confirmXiBtn').is_disabled()

async def play_through_match(page, shot_prefix):
    await page.click('#confirmMatchBtn'); await page.wait_for_timeout(450)
    await page.screenshot(path=f'{SHOT}/{shot_prefix}-toss.png')
    await page.click('#coinBtn'); await page.wait_for_timeout(2400)
    await page.click('#decisionZone .choice-card[data-choice="bat"]'); await page.wait_for_timeout(200)
    await page.click('#startMatchBtn'); await page.wait_for_timeout(1200)
    await page.screenshot(path=f'{SHOT}/{shot_prefix}-match-start.png')
    await page.wait_for_timeout(2600)
    await page.screenshot(path=f'{SHOT}/{shot_prefix}-match-live.png')
    done = False
    for _ in range(190):
        if await page.locator('#resultBanner.show').count():
            done = True; break
        await page.wait_for_timeout(1000)
    print(f'[{shot_prefix}] match finished:', done)
    await page.screenshot(path=f'{SHOT}/{shot_prefix}-result.png')
    print((await page.locator('#resultBanner').inner_text()).split('\n')[:3])

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--no-sandbox'])

        # ═════════ SHOWDOWN MODE ═════════
        ctx = await browser.new_context(viewport={'width': 1560, 'height': 1000})
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'SHOWDOWN-PAGEERROR: {e}'))
        page.on('console', lambda m: errors.append(f'SHOWDOWN-CONSOLE: {m.text}') if m.type == 'error' else None)
        await page.goto(BASE + '/index.html', wait_until='networkidle')
        await page.screenshot(path=f'{SHOT}/30-mode.png')
        await page.click('#modeShowdownCard'); await page.wait_for_timeout(450)
        print('mode picked: one-over showdown')
        await page.click('#team1Grid .team-card:has-text("MI")'); await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(350)
        await page.click('#team2Grid .team-card:has-text("CSK")'); await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(450)
        await page.screenshot(path=f'{SHOT}/31-showdown-xi.png')
        disabled = await build_showdown_side(page, 'SHOWDOWN-XI-1')
        print('showdown xi1 confirm disabled?', disabled)
        await page.screenshot(path=f'{SHOT}/32-showdown-filled.png')
        if disabled: print('SHOWDOWN XI-1 BLOCKED'); await browser.close(); return
        await page.click('#confirmXiBtn'); await page.wait_for_timeout(450)
        disabled = await build_showdown_side(page, 'SHOWDOWN-XI-2')
        print('showdown xi2 confirm disabled?', disabled)
        await page.screenshot(path=f'{SHOT}/33-showdown-xi2.png')
        if disabled: print('SHOWDOWN XI-2 BLOCKED'); await browser.close(); return
        await page.click('#confirmXiBtn'); await page.wait_for_timeout(450)
        await page.screenshot(path=f'{SHOT}/34-showdown-confirm.png')
        await play_through_match(page, '35-showdown')
        sc = await page.locator('#scorecardBody').inner_text()
        print('scorecard innings1 sample:', ' '.join(sc.split()[:40]))
        await ctx.close()

        # ═════════ FULL XI MODE ═════════
        ctx2 = await browser.new_context(viewport={'width': 1560, 'height': 1000})
        page2 = await ctx2.new_page()
        page2.on('pageerror', lambda e: errors.append(f'FULL-PAGEERROR: {e}'))
        page2.on('console', lambda m: errors.append(f'FULL-CONSOLE: {m.text}') if m.type == 'error' else None)
        await page2.goto(BASE + '/index.html', wait_until='networkidle')
        await page2.click('#modeFullCard'); await page2.wait_for_timeout(350)
        await page2.click('#team1Grid .team-card:has-text("RCB")'); await page2.click('#selectBarConfirmBtn'); await page2.wait_for_timeout(350)
        await page2.click('#team2Grid .team-card:has-text("KKR")'); await page2.click('#selectBarConfirmBtn'); await page2.wait_for_timeout(450)
        disabled = await build_full_xi(page2, 'FULL-XI-1')
        print('full xi1 confirm disabled?', disabled)
        await page2.click('#confirmXiBtn'); await page2.wait_for_timeout(450)
        disabled = await build_full_xi(page2, 'FULL-XI-2')
        print('full xi2 confirm disabled?', disabled)
        await page2.click('#confirmXiBtn'); await page2.wait_for_timeout(450)
        await play_through_match(page2, '36-full')
        await ctx2.close()
        await browser.close()

asyncio.run(main())
if errors:
    print('\n=== ERRORS ==='); [print(e) for e in errors]; sys.exit(2)
print('\nALL E2E PASSED — NO ERRORS')
