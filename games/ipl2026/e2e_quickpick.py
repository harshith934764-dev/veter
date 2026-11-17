#!/usr/bin/env python3
"""AI Quick Pick e2e — fills EMPTY slots only, user picks survive, both formats."""
import asyncio, sys, os
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
SHOT = '/home/user/ipl2026/e2e'
os.makedirs(SHOT, exist_ok=True)
errors = []

async def fresh(browser, mode_card, team1='CSK', team2='RCB'):
    ctx = await browser.new_context(viewport={'width': 1560, 'height': 1000})
    page = await ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'PAGEERROR[{mode_card}]: {e}'))
    page.on('console', lambda m: errors.append(f'CONSOLE[{mode_card}]: {m.text}') if m.type == 'error' else None)
    await page.goto(BASE + '/index.html', wait_until='networkidle')
    await page.click(f'#{mode_card}')
    await page.wait_for_timeout(300)
    await page.click(f'#team1Grid .team-card:has-text("{team1}")')
    await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(350)
    await page.click(f'#team2Grid .team-card:has-text("{team2}")')
    await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(450)
    return ctx, page

async def xi_ids(page):
    return await page.locator('#xiList .xi-item').count()

async def named_in_xi(page):
    return await page.locator('#xiList .xi-item').all_inner_texts()

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--no-sandbox'])

        # ── Full mode: quick pick from EMPTY squad → 11/11, confirm enabled
        ctx, page = await fresh(browser, 'modeFullCard')
        await page.click('#quickPickBtn'); await page.wait_for_timeout(500)
        n = await xi_ids(page)
        dis = await page.locator('#confirmXiBtn').is_disabled()
        print(f'FULL  quick-pick-from-empty: xi={n}/11, confirmDisabled={dis}')
        await page.screenshot(path=f'{SHOT}/40-quickpick-full.png')
        assert n == 11, 'full quick pick should fill 11'
        assert not dis, 'confirm should be enabled after a full quick pick'
        await ctx.close()

        # ── Full mode: user picks 2 players FIRST, quick pick must keep them
        ctx, page = await fresh(browser, 'modeFullCard')
        await page.click('#rolePills .pill[data-role="WK"]'); await page.wait_for_timeout(150)
        wk = page.locator('#squadList button[data-add]').first
        wk_name = (await wk.locator('xpath=ancestor::div[contains(@class,"player-row")]//div[@class="pr-name"]').first.inner_text()) if await wk.count() else '?'
        await wk.click(); await page.wait_for_timeout(200)
        await page.click('#rolePills .pill[data-role="ALL"]'); await page.wait_for_timeout(150)
        b = page.locator('#squadList button[data-add]').first
        bname = (await b.locator('xpath=ancestor::div[contains(@class,"player-row")]//div[@class="pr-name"]').first.inner_text()) if await b.count() else '?'
        await b.click(); await page.wait_for_timeout(200)
        pre = await page.locator('#xiList .xi-item').all_inner_texts()
        await page.click('#quickPickBtn'); await page.wait_for_timeout(500)
        post = await page.locator('#xiList .xi-item').all_inner_texts()
        kept = all(any(name in p for p in post) for name in pre)
        print(f'FULL  user picks kept after quick-pick: {kept} (kept {len(pre)}/2)')
        n = await xi_ids(page)
        print(f'FULL  after quick-pick xi={n}/11')
        assert kept and n == 11
        await ctx.close()

        # ── Showdown mode: quick pick from empty → 7/7
        ctx, page = await fresh(browser, 'modeShowdownCard', 'MI', 'CSK')
        await page.click('#quickPickBtn'); await page.wait_for_timeout(500)
        n = await xi_ids(page)
        val = await page.locator('#xiValidation').inner_text()
        print(f'SHOW  quick-pick-from-empty: xi={n}/7')
        print(val)
        await page.screenshot(path=f'{SHOT}/41-quickpick-showdown.png')
        assert n == 7, 'showdown quick pick should fill 7'
        assert '4/4' in val and '3/3' in val
        dis = await page.locator('#confirmXiBtn').is_disabled()
        print(f'SHOW  confirmDisabled after quick pick = {dis}')
        assert not dis, 'showdown confirm should be enabled after a full quick pick'
        await ctx.close()

        # ── Showdown mode: user picks 4 batters manually, quick pick fills only bowlers
        ctx, page = await fresh(browser, 'modeShowdownCard', 'MI', 'CSK')
        await page.click('#rolePills .pill[data-role="BAT"]'); await page.wait_for_timeout(150)
        for _ in range(4):
            btn = page.locator('#squadList button[data-add]').first
            if await btn.count() == 0: break
            await btn.click(); await page.wait_for_timeout(150)
        pre = await page.locator('#xiList .xi-item').all_inner_texts()
        print(f'SHOW  user added {len(pre)} batters')
        await page.click('#quickPickBtn'); await page.wait_for_timeout(500)
        post = await page.locator('#xiList .xi-item').all_inner_texts()
        kept = all(any(name in p for p in post) for name in pre)
        n = await xi_ids(page)
        print(f'SHOW  after quick-pick: xi={n}/7, user batters kept: {kept}')
        await page.screenshot(path=f'{SHOT}/42-quickpick-showdown-fill.png')
        assert kept and n == 7
        await ctx.close()

        await browser.close()

asyncio.run(main())
if errors:
    print('\n=== ERRORS ==='); [print(e) for e in errors]; sys.exit(2)
print('\nQUICK-PICK E2E PASSED')
