#!/usr/bin/env python3
"""See the XI screen at 1366x768 with full squads selected — where is the confirm button?"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
errors = []

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--no-sandbox'])
        ctx = await browser.new_context(viewport={'width': 1366, 'height': 768})
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))
        page.on('console', lambda m: errors.append(f'CONSOLE: {m.text}') if m.type == 'error' else None)
        await page.goto(BASE + '/index.html', wait_until='networkidle')
        await page.click('#modeFullCard'); await page.wait_for_timeout(300)
        await page.click('#team1Grid .team-card:has-text("MI")'); await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(300)
        await page.click('#team2Grid .team-card:has-text("CSK")'); await page.click('#selectBarConfirmBtn'); await page.wait_for_timeout(400)
        # fill team 1 XI via AI quick pick — user-equivalent of picking 11 valid players
        await page.click('#quickPickBtn'); await page.wait_for_timeout(400)
        btn = page.locator('#confirmXiBtn')
        print('confirm visible:', await btn.is_visible())
        print('confirm box:', await btn.bounding_box())
        print('confirm disabled:', await btn.is_disabled())
        await page.screenshot(path='/home/user/ipl2026/e2e/54-xi-1366x768-filled.png')
        # scroll the sidebar to the bottom to check button position
        box = await btn.bounding_box()
        page_height = await page.evaluate('document.documentElement.scrollHeight')
        print('page scrollHeight:', page_height)
        # try clicking it if enabled
        if not await btn.is_disabled():
            await btn.click(); await page.wait_for_timeout(400)
            print('screen after confirm team1:', await page.locator('.screen.active').get_attribute('id'))
        await ctx.close()
        await browser.close()

asyncio.run(main())
print('\nERRORS:' if errors else '\nNO ERRORS', *errors, sep='\n')
