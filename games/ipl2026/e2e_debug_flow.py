#!/usr/bin/env python3
"""Reproduce: after selecting two teams, is the confirm/next affordance working?"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
errors = []

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--no-sandbox'])
        # mimic a real user viewport (laptop), not a giant QA canvas
        ctx = await browser.new_context(viewport={'width': 1366, 'height': 768})
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))
        page.on('console', lambda m: errors.append(f'CONSOLE-{m.type}: {m.text}') if m.type in ('error',) else None)
        await page.goto(BASE + '/index.html', wait_until='networkidle')

        await page.click('#modeFullCard'); await page.wait_for_timeout(300)
        print('screen after format pick:', await page.locator('.screen.active').get_attribute('id'))

        await page.click('#team1Grid .team-card:has-text("MI")')
        await page.wait_for_timeout(300)
        # inspect the select bar on team1 screen
        bar = page.locator('#screen-team1 .select-bar')
        print('team1 bar count:', await bar.count())
        if await bar.count():
            print('team1 bar visible:', await bar.first.is_visible())
            btn = bar.first.locator('button').last
            print('team1 bar button text:', (await btn.inner_text()).strip())
            print('team1 bar button disabled:', await btn.is_disabled())
        await page.screenshot(path='/home/user/ipl2026/e2e/50-after-team1-pick.png')
        await page.click('#selectBarConfirmBtn')
        await page.wait_for_timeout(400)
        print('screen after team1 confirm:', await page.locator('.screen.active').get_attribute('id'))

        await page.click('#team2Grid .team-card:has-text("CSK")')
        await page.wait_for_timeout(300)
        bar2 = page.locator('#screen-team2 .select-bar')
        print('team2 bar count:', await bar2.count())
        if await bar2.count():
            print('team2 bar visible:', await bar2.first.is_visible())
            btn = bar2.first.locator('button').last
            print('team2 bar button text:', (await btn.inner_text()).strip())
            print('team2 bar button disabled:', await btn.is_disabled())
        box = await page.locator('#selectBarConfirmBtn').bounding_box()
        print('confirm button box:', box)
        await page.screenshot(path='/home/user/ipl2026/e2e/51-after-team2-pick.png', full_page=False)
        await page.click('#selectBarConfirmBtn')
        await page.wait_for_timeout(500)
        print('screen after team2 confirm:', await page.locator('.screen.active').get_attribute('id'))
        await page.screenshot(path='/home/user/ipl2026/e2e/52-after-both-pick.png')
        await ctx.close()

        # and showdown too
        ctx = await browser.new_context(viewport={'width': 1366, 'height': 768})
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'SHOWDOWN PAGEERROR: {e}'))
        await page.goto(BASE + '/index.html', wait_until='networkidle')
        await page.click('#modeShowdownCard'); await page.wait_for_timeout(300)
        await page.click('#team1Grid .team-card:has-text("MI")')
        await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(400)
        await page.click('#team2Grid .team-card:has-text("CSK")')
        await page.wait_for_timeout(300)
        box = await page.locator('#selectBarConfirmBtn').bounding_box()
        print('showdown confirm button box:', box)
        await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(400)
        print('showdown screen after both:', await page.locator('.screen.active').get_attribute('id'))
        await ctx.close()
        await browser.close()

asyncio.run(main())
if errors:
    print('\n=== ERRORS ==='); [print(e) for e in errors]
else:
    print('\nNO ERRORS')
