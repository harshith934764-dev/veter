# IPL 2026 — Playing XI Selector & AI vs AI Match Simulator

A static web app (no build step, no dependencies). Open it in any modern browser.

## The three modes

The app opens on a **Select Match Format** screen:

| Mode | What it is |
|---|---|
| **Full XI Classic** | One-off match — build both XIs, watch the one-over AI vs AI broadcast |
| **One-Over Showdown** | One-off match — 4 batters + 3 bowlers, 2 wickets end the innings |
| **IPL 2026 Championship** | **Full tournament** — lock one franchise, build its XI, and carry it through a double round-robin season → top 5 → custom playoffs |

## IPL 2026 Championship (tournament mode)

Pick **IPL 2026 Championship** on the format screen, then:

1. **Lock your franchise** — one of the 10 verified 2026 teams, permanently for the season.
   All nine rivals are AI-managed (XIs auto-built from ratings).
2. **Build the tournament XI** — the same squad builder as Full XI (captain, keeper,
   batting order, 5+ bowling options, max 4 overseas), with live confirmation checks.
3. **Season hub** — always shows your record, position, points table (W = 2 pts · Tie = 1 ·
   NR = 1 · NRR decides), upcoming fixture, fixtures & results for all 18 rounds, Orange &
   Purple Cap mini-boards and full stats.
4. **90 league fixtures** — generated home/away double round-robin (18 matches per team,
   every team hosts every other team home and away). Play yours with one tap; the other
   four games of each round are simulated instantly so the table never stalls.
   **Sim remaining season** is available (with a confirmation) if you don't want to play the rest.
5. **Playoffs (top 5, custom bracket)** — Qualifier 1 (#2 v #3), Eliminator (#4 v #5),
   Qualifier 2 (#1 v Q1 winners), IPL Final (Q2 winners v Eliminator winners). Knockout ties
   are settled by a **Super Over**.
6. **Live caps & records** — Orange Cap (runs, inns, HS, avg, SR, 4s/6s, 50s/100s) and
   Purple Cap (wkts, overs, econ, avg, best figures, 3/4/5-wicket hauls) update after every
   match, as do MVP impact race and tournament records (most sixes/fours, highest score,
   best SR/economy, best figures, catches/run-outs/keeper dismissals, most team wins,
   highest/lowest totals, biggest wins by runs/wickets).
7. **Champions screen** — champion crest, winning captain, Orange & Purple Cap winners,
   Player of the Tournament, and a persistent IPL champions history saved on this device.
8. **Season stats screen** — full boards, franchise numbers (RF/RA/NRR/high/low totals).
9. **Broadcast HUD** — every Championship 2D match draws team logos (SVG crests) and stylized
   broadcast player portraits on canvas: bugs with crests, on-strike batter and bowler cards,
   target/need pill with live required run rate (e.g. `NEED 18 OFF 12 · RRR 9.0`), plus an
   oversized REQ RR readout and enlarged score/crest treatment on the TV strip. Nothing
   real-headshot-like ships; all artwork is generated locally (SVG/canvas), no external assets.
10. **Audio** — a complete sound system:
    - **Background music** (single-track, crossfaded, never stacked) adapts to the scene — epic
      menu theme in flows, peaceful piano on the hub / XI builder / toss, high-energy rock in the
      match and a breakbeat pursuit track when a chase gets tight (last 3 balls or RRR ≥ 9),
      calm at innings breaks, a brass victory march when you win. Tracks ship locally
      (`assets/audio/music-*.mp3`, Mixkit License — free, no attribution).
    - **Sound effects** — synthesized bat cracks, wicket appeals with a stumps rattle, four/six
      stings, real crowd shouts on boundaries (SoundDino, royalty-free), footsteps while running
      between the creases, dot-ball thuds, wide/no-ball whistles, innings-break chime, reward
      sparkles on wins and trophy lifts, UI clicks and navigation blips for every button, whoosh
      on modal open/close, and a breathing stadium ambience bed (real loop) that fades out at
      full time.
    - **Voice commentary** — a calm analyst-style English voice calls the match ball-by-ball
      (35 pre-recorded local clips in `assets/audio/commentary/` — intro, boundaries, wickets,
      dot balls, run call-outs, wides, no-balls, innings break, win and tie). One call at a
      time like a real broadcast, with big moments (innings break, result) cutting in.
      Routed through its own mixer bus with its own **Commentary Volume** slider.
    - **Audio Settings** (header **Audio** button) — Master / Music / SFX / Commentary volume
      sliders with perceptual taper, **Mute All**, and an **Audio ON/OFF** master switch. Everything applies
      live, persists to `ipl2026-audio-settings` and is restored on restart (legacy
      `ipl2026-sound` is migrated automatically). One shared AudioContext feeds a three-bus
      mixer (SFX / music / master); sounds are rate-limited so they never overlap themselves.

**Match-day XI** — before every Championship match you can reshuffle your playing XI from the
locked franchise's 25-man squad: batting order ▲▼, captain, wicketkeeper, five bowling options,
overseas quota and ratings are all yours to edit (classic squad rules apply — 11 players, max 4
overseas, a keeper, at least five bowling options). The confirmed squad plays that match and rolls
forward as the baseline for the next one — league and knockouts alike. Backing out to the hub
keeps the match unplayed.

Every Championship match is played in the **one-over format** — six balls a side, straight in
the 2D broadcast engine (the same canvas match used by the classic modes): the toss, the bat/bowl
call, the floodlit ground, ball flight, confetti and the full-time banner. Tapping **Play Match**
on the season hub opens the match-day XI screen, then launches the match; when the final ball is bowled, the result flows back into
the season — table, NRR, Orange & Purple Caps, records, bracket and stats — exactly as if the
simulator had run it. Any fixture (league or playoff) can be played that way, including play-offs
you don't participate in (they play as a broadcast you simply watch). Tied knockouts are settled
by a **Super Over**, simulated and recorded the same way.

All franchise squads, player stats, the table, caps and every fixture are persisted in
localStorage — reload mid-season and you return exactly where you left off. **Reset season**
(top bar) wipes the tournament; the classic formats remain untouched.

| Format | Squad per side | End of innings |
|---|---|---|
| **Full XI Classic** | 11 players (max 4 overseas), 10 wickets, min 5 bowling options | 10 wickets or 6 balls |
| **One-Over Showdown** | **4 batters + 3 bowlers** (WK roles count as batters), 2 wickets end the innings | **2 wickets** or 6 balls |

Flow: **Format → Team 1 → Team 2 → Team 1 squad → Team 2 squad → Confirm → Toss → Bat/Bowl → AI vs AI one-over match.**

In every format the human owns both squads completely — captain, wicketkeeper, batting order,
bowling options. The AI never adds, swaps or replaces a picked player; it only runs the match
after both sides are locked.

### AI Quick Pick (optional)
Empty squad slots can be auto-filled with one explicit tap per side via **AI Quick Pick**:
- **Full XI Classic** — picks the best available players (rating-wise, respecting eligibility &
  the overseas cap), guarantees a wicketkeeper and ≥5 bowling options are in the XI, and only
  fills *unset* captain / keeper / bowling-option markers.
- **One-Over Showdown** — fills the 4 batter slots (BAT + WK roles) and the 3 bowler slots
  (BOWL + AR roles), then sets unset captain/keeper markers.

Everything Quick Pick does remains fully editable, and it never drops or replaces a player you
picked yourself. If constraints can't be met without touching your picks, it says so and leaves
the squad for you to fix.

### The 2D match
One-over matches are rendered on an animated broadcast-camera canvas: night stadium, floodlights,
crowd speckle, ad boards, run-up, quadratic-bezier ball flight with bounce, six/four hit
into the outfield, stumpings/bowled demolishing the stumps, score pop-ups (FOUR! / SIX! /
BOWLED! / OUT), particle bursts and confetti, plus a TV-style scoreboard strip. Both teams'
XIs decide the players shown on screen.

## Run it

**Option A — Live preview (already running)**
The app is served on port **4173** in this workspace. Open the preview URL shown in the UI.

**Option B — Locally**
```bash
cd ipl2026
python3 -m http.server 4173 --bind 0.0.0.0
# then open http://localhost:4173/index.html
```
(Any static file server works — `npx serve`, nginx, VS Code Live Server, etc.)

**Option C — Double-click**
`index.html` works straight from disk (`file://`) too — the soundtrack and commentary switch to
plain `<audio>` element playback (browsers block `fetch()` there) while sound effects stay
synthesized. Everything — music, commentary, crowd, SFX — plays after your first click (Chrome's
autoplay rules).

## Project layout
```
index.html        — all screens (mode → team select → squads → confirm → toss → match)
css/styles.css    — broadcast-style dark/gold theme, responsive
js/data.js        — verified IPL 2026 squads (250 players, all 10 teams) + ratings
js/app.js         — state machine, squad builders (both formats), validation,
                    AI Quick Pick, persistence (localStorage)
js/league-core.js — Championship engine (pure logic): fixtures, AI XIs, ball-by-ball sim,
                    NRR/points table, playoffs + Super Over, stats aggregation
js/league.js      — Championship UI: franchise picker, season hub, playoff bracket,
                    champions screen, stats & records, season persistence
js/match.js       — AI vs AI one-over ball-by-ball engine (mode-aware: 2 or 10 wickets)
js/match2d.js     — canvas 2D broadcast renderer for the live match
js/audio.js       — shared AudioContext + 3-bus mixer (master/music/sfx) + persisted settings
js/music.js       — scene-aware soundtrack manager (lazy decode, single-track crossfades)
js/audio-ui.js    — header Audio button, settings modal, global UI click/nav sounds, boot music
js/sound.js       — synthesized SFX engine + recorded crowd samples (bat/wicket/boundaries)
assets/audio/     — music + crowd recordings shipped with the game (~19 MB, all royalty-free)
assets/stadium.jpg— stadium backdrop (AI-generated)
build_data.py     — regenerates js/data.js (squad source-of-truth script)
e2e_test.py       — full Full-XI flow Playwright walkthrough (requires: pip install playwright)
e2e_test2.py      — edge cases: overseas cap, XI switcher, reload persistence, mobile
e2e_modes.py      — both formats end-to-end (Full XI + Showdown) incl. 2D match
e2e_quickpick.py  — AI Quick Pick: fills only empty slots, user picks survive, both formats
e2e_tournament.py — Championship mode end-to-end: franchise lock → XI → play a match →
                    sim season → playoffs → champion → stats → reload persistence
```

## Data provenance
Squads & 2026 captains: post-auction IPL 2026 rosters (Dec 2025) — news24online,
firstpost, olympics.com captains list. Ratings are editorial game ratings (0–99).
Player photos are stylized initials avatars (official headshots not redistributable).

## Reset / replay
- **Reset** button (top-right) wipes localStorage (including the Championship season) and returns to the format screen.
- Progress auto-saves in the browser; reload mid-selection resumes where you left off.
- After a match: **Rematch · Same Teams** (re-toss) or **Pick New Teams & XIs**.
- Switching formats wipes XIs and locks (it starts a fresh slate); the mode choice is yours.
