#!/usr/bin/env python3
"""IPL 2026 Championship — full tournament flow e2e."""
import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
SHOT = '/home/user/ipl2026/e2e/tournament'
os.makedirs(SHOT, exist_ok=True)
errors = []

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={'width': 1680, 'height': 950})
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console: {m.text}') if m.type == 'error' else None)

        # compress long pre-2D waits in the one-over match (only >1s setTimeout delays)
        await page.add_init_script("""(() => { const _st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => _st(fn, (typeof ms === 'number' && ms > 1000) ? Math.max(40, ms * 0.12) : ms, ...a); })()""")
        print('1. load page')
        await page.goto(BASE + '/index.html', wait_until='domcontentloaded')
        await page.evaluate("localStorage.clear()")
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_timeout(400)

        print('2. enter tournament mode')
        await page.click('#modeTournamentCard')
        await page.wait_for_selector('#screen-season-team.active', timeout=5000)
        cards = await page.locator('.league-team-card').count()
        print('   team cards:', cards)
        assert cards == 10, cards
        await page.screenshot(path=SHOT + '/01-pick-franchise.png')

        print('3. pick Mumbai Indians')
        await page.click('.league-team-card[data-team="MI"]')
        await page.wait_for_timeout(350)
        rows = await page.locator('#leagueTeamDetail .ltd-row').count()
        print('   squad rows:', rows)
        assert rows >= 20
        assert await page.locator('#leagueConfirmBtn').is_enabled()

        print('4. lock modal')
        await page.click('#leagueConfirmBtn')
        await page.wait_for_selector('#lockTeamModal.show', timeout=3000)
        await page.screenshot(path=SHOT + '/02-lock-modal.png')
        await page.click('#lockConfirmBtn')
        await page.wait_for_selector('#screen-xi.active', timeout=5000)

        print('5. quick pick XI')
        await page.click('#quickPickBtn')
        await page.wait_for_timeout(600)
        enabled = await page.locator('#confirmXiBtn:not([disabled])').count()
        print('   confirm enabled:', bool(enabled))
        if not enabled:
            txt = await page.inner_text('#xiValidation')
            print('   validation:', txt)
            raise AssertionError('XI validation failed after quick pick')

        print('6. lock in championship XI')
        await page.click('#confirmXiBtn')
        await page.wait_for_selector('#screen-season.active', timeout=5000)
        await page.wait_for_timeout(400)

        rows_tbl = await page.locator('#pointsTableBody tr').count()
        pills = await page.locator('#roundPills .round-pill').count()
        fx = await page.locator('#roundFixtures .fx-row').count()
        print(f'   table rows={rows_tbl} round pills={pills} fixtures shown={fx}')
        assert rows_tbl == 10 and pills == 18 and fx == 5
        await page.screenshot(path=SHOT + '/03-season-hub.png', full_page=False)

        print('7. play your round-1 match — match-day XI first')
        await page.click('#playNextBtn')
        await page.wait_for_selector('#screen-matchxi.active', timeout=5000)
        ctx_txt = await page.inner_text('#mdContext')
        count_before = (await page.inner_text('#mdXiCount')).strip()
        print(f'   match-day XI screen: context={ctx_txt!r} count={count_before}')
        assert count_before == '11'
        # prove the squad is editable — drop the last picked player, quick-pick refills
        await page.click('#mdXiList .xi-item:last-child [data-remove]')
        assert (await page.inner_text('#mdXiCount')).strip() == '10'
        await page.click('#mdQuickPickBtn')
        assert (await page.inner_text('#mdXiCount')).strip() == '11'
        await page.wait_for_selector('#mdConfirmBtn:not([disabled])', timeout=3000)
        # back out to the hub once, then re-enter and confirm — the unplayed match must survive
        await page.click('#mdBackBtn')
        await page.wait_for_selector('#screen-season.active', timeout=5000)
        unplayed = await page.evaluate("() => JSON.parse(localStorage.getItem('ipl2026-season-v1')).fixtures.filter(f => !f.played && f.userMatch).length")
        print('   user fixtures still pending after backing out:', unplayed)
        assert unplayed >= 1
        await page.click('#playNextBtn')
        await page.wait_for_selector('#screen-matchxi.active', timeout=5000)
        await page.click('#mdConfirmBtn')
        await page.wait_for_selector('#screen-toss.active', timeout=5000)
        print('   match-day XI confirmed -> toss')
        await page.click('#coinBtn')
        await page.wait_for_selector('#decisionZone', state='visible', timeout=3000)
        await page.click('#decisionZone .choice-card[data-choice="bat"]')
        await page.wait_for_selector('#startMatchZone', state='visible', timeout=3000)
        await page.screenshot(path=SHOT + '/04-toss.png')
        await page.click('#startMatchBtn')
        await page.wait_for_selector('#screen-match.active', timeout=5000)
        # 1 over a side through the 2D canvas engine — wait for the full-time banner
        await page.wait_for_selector('#resultBanner.show', timeout=150000)
        rb_title = await page.inner_text('#rbTitle')
        rb_kicker = await page.inner_text('#rbKicker')
        banner_visible_champ = await page.locator('#champResultBtn').is_visible()
        banner_hidden_rematch = not await page.locator('#rematchBtn').is_visible()
        print(f'   2D result: kicker={rb_kicker!r} title={rb_title!r} champBtn={banner_visible_champ} rematchHidden={banner_hidden_rematch}')
        assert banner_visible_champ and banner_hidden_rematch
        await page.screenshot(path=SHOT + '/05-2d-result.png')
        await page.click('#champResultBtn')
        await page.wait_for_selector('#screen-season.active', timeout=8000)
        played = await page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('ipl2026-season-v1')); return { total: s.fixtures.filter(f => f.played).length, user: s.fixtures.filter(f => f.userMatch && f.played).length }; }""")
        print('   fixtures played after 2D match:', played)
        assert played['user'] == 1 and played['total'] >= 1

        print('8. sim remaining season (AI fixtures)')
        await page.click('#simRemainingBtn')
        await page.wait_for_selector('#simAllModal.show', timeout=3000)
        await page.click('#simAllConfirmBtn')
        await page.wait_for_timeout(2500)
        phase_po = await page.locator('#playoffsPhase.active').count()
        print('   playoffs phase active:', bool(phase_po))
        await page.screenshot(path=SHOT + '/05-playoffs.png')
        bracket = await page.locator('#playoffBracket .bracket-card').count()
        print('   bracket cards:', bracket)
        assert bracket == 4

        print('9. sim remaining playoff matches')
        await page.click('#simPlayoffsBtn')
        await page.wait_for_timeout(1500)
        done = await page.locator('#donePhase.active').count()
        champ = await page.inner_text('#champTeamName')
        print('   champion phase active:', bool(done), '| champion:', champ)
        assert done and champ.strip()
        await page.screenshot(path=SHOT + '/06-champion.png')

        print('10. stats page')
        await page.click('#leagueNav [data-hubnav="stats"]')
        await page.wait_for_selector('#screen-stats.active', timeout=4000)
        oc = await page.locator('#orangeCapBody tr').count()
        pc = await page.locator('#purpleCapBody tr').count()
        recs = await page.locator('#recordsGrid .rec-tile').count()
        team_stats = await page.locator('#teamStatsBody tr').count()
        mvp = await page.locator('#mvpRaceBody .mvp-row').count()
        print(f'   orange rows={oc} purple rows={pc} records={recs} team-stats={team_stats} mvp={mvp}')
        assert oc == 10 and pc == 10 and recs >= 8 and team_stats == 10
        await page.screenshot(path=SHOT + '/07-stats.png', full_page=True)

        print('11. persistence across reload')
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_timeout(500)
        active = await page.evaluate("document.querySelector('.screen.active')?.id")
        print('   after reload, active screen:', active)
        assert active in ('screen-season', 'screen-stats'), active

        print('12. table final check')
        pts = await page.locator('#pointsTableBody tr').count()
        played = await page.evaluate("""() => {
          const s = JSON.parse(localStorage.getItem('ipl2026-season-v1'));
          return s.fixtures.filter(f => f.played).length;
        }""")
        print(f'   table rows after reload={pts} fixtures played={played}')
        assert played == 90

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
    print()
    if errors:
        print('PAGE ERRORS / CONSOLE ERRORS:')
        for e in errors[:20]:
            print(' -', e)
        sys.exit(1)
    print('TOURNAMENT E2E: ALL STEPS PASSED')
