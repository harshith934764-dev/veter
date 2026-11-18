"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight, ArrowUpRight, Code2, Cpu, Gamepad2, Globe2,
  Layers3, Terminal, Trophy,
} from "lucide-react";
import Link from "next/link";

const tracks = [
  {
    id: "language",
    number: "01",
    label: "Language",
    title: "A language with its own point of view.",
    description: "Explore VETER's independent programming language, compiler work and learning resources.",
    href: "/veter-programming-language.html",
    action: "Explore the language",
    icon: Code2,
    meta: "DEVELOPER TOOLS",
  },
  {
    id: "ai",
    number: "02",
    label: "Artificial intelligence",
    title: "Useful intelligence, built in the open.",
    description: "Discover VETER AI experiments, assistant capabilities and the systems behind them.",
    href: "/veter-ai.html",
    action: "Meet VETER AI",
    icon: Cpu,
    meta: "AI EXPERIMENTS",
  },
  {
    id: "arcade",
    number: "03",
    label: "Arcade",
    title: "Small games. Big room to play.",
    description: "Find browser games and sports challenges in the growing VETER arcade.",
    href: "/games.html",
    action: "Enter the arcade",
    icon: Gamepad2,
    meta: "GAMES & PLAY",
  },
];

const previewScores = [
  { rank: "01", player: "Demo player", game: "Arcade challenge", score: "—" },
  { rank: "02", player: "Demo player", game: "Sports challenge", score: "—" },
  { rank: "03", player: "Demo player", game: "Arcade challenge", score: "—" },
];

export default function HomeExperience() {
  const [activeTrack, setActiveTrack] = useState("language");
  const reduceMotion = useReducedMotion();
  const selected = tracks.find((track) => track.id === activeTrack) ?? tracks[0];
  const SelectedIcon = selected.icon;

  return (
    <div className="site-shell">
      <section className="hero-section">
        <div className="hero-grid">
          <motion.div
            className="hero-copy"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            <p className="eyebrow"><span className="eyebrow-dot" /> INDEPENDENT TECHNOLOGY, IN PROGRESS</p>
            <h1>Make room<br />for <span className="hero-accent">what&apos;s next.</span></h1>
            <p className="hero-description">
              VETER is an independent technology ecosystem exploring programming,
              AI, operating systems and play. Follow the work. Try what&apos;s ready.
            </p>
            <div className="hero-actions">
              <Link className="button-primary" href="/veter-programming-language.html">
                Explore VETER <ArrowUpRight size={17} />
              </Link>
              <Link className="button-quiet" href="/docs.html">
                Read the documentation <ArrowDownRight size={16} />
              </Link>
            </div>
            <div className="hero-footnote">
              <span>BUILT WITH CURIOSITY</span><span className="footnote-line" /><span>OPEN TO EXPLORATION</span>
            </div>
          </motion.div>

          <motion.aside
            className="hero-aside"
            initial={reduceMotion ? false : { opacity: 0, y: 24, rotate: 1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 22, delay: 0.12 }}
            aria-label="VETER project index"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="index-card">
              <div className="index-card-top"><span>V / INDEX</span><span>PROJECT MAP · 2026</span></div>
              <div className="index-mark"><span>V</span><i /></div>
              <div className="index-card-bottom">
                <div><p className="micro-label">ONE ECOSYSTEM</p><p className="index-title">Many directions.</p></div>
                <span className="index-count">04<br /><small>TRACKS</small></span>
              </div>
              <div className="index-lines"><span /><span /><span /><span /></div>
            </div>
            <div className="floating-note">
              <span className="note-icon"><Layers3 size={17} /></span>
              <span><strong>Built in layers</strong><small>Tools · Systems · Experiences</small></span>
            </div>
            <p className="aside-caption">A WORK IN PROGRESS, BY DESIGN.</p>
          </motion.aside>
        </div>
      </section>

      <section className="ecosystem-section" id="explore">
        <div className="section-heading">
          <div><p className="eyebrow">01 / THE ECOSYSTEM</p><h2>Different disciplines.<br /><span>One curious mindset.</span></h2></div>
          <p className="section-intro">Pick a direction and go deeper. Each project has its own purpose, pace and place to begin.</p>
        </div>

        <div className="track-layout">
          <div className="track-list" role="tablist" aria-label="Explore VETER projects" aria-orientation="vertical">
            {tracks.map((track) => {
              const Icon = track.icon;
              const active = activeTrack === track.id;
              return (
                <button
                  className={`track-tab ${active ? "is-active" : ""}`}
                  key={track.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="track-panel"
                  onClick={() => setActiveTrack(track.id)}
                >
                  <span className="track-number">{track.number}</span>
                  <Icon size={19} strokeWidth={1.7} />
                  <span className="track-tab-label">{track.label}</span>
                  <ArrowUpRight className="track-arrow" size={17} />
                </button>
              );
            })}
            <Link className="track-tab track-tab-muted" href="/veteros.html">
              <span className="track-number">04</span><Terminal size={19} strokeWidth={1.7} />
              <span className="track-tab-label">VETER OS</span><ArrowUpRight className="track-arrow" size={17} />
            </Link>
          </div>

          <div className="track-panel" id="track-panel" role="tabpanel" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={selected.id}
                className="track-panel-content"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                <div className="panel-topline"><span>{selected.meta}</span><span>{selected.number} / 03</span></div>
                <div className="panel-icon"><SelectedIcon size={25} strokeWidth={1.5} /></div>
                <h3>{selected.title}</h3>
                <p>{selected.description}</p>
                <Link className="text-link" href={selected.href}>{selected.action}<ArrowUpRight size={17} /></Link>
              </motion.div>
            </AnimatePresence>
            <div className="panel-index">VETER<span>®</span></div>
          </div>
        </div>
      </section>

      <section
        id="ipl-2026"
        aria-labelledby="ipl-2026-title"
        style={{ padding: "clamp(56px, 8vw, 96px) 6vw", background: "linear-gradient(135deg, #071b2d 0%, #123b4b 55%, #071b2d 100%)", color: "#f8fafc" }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(260px, .7fr)", gap: 36, alignItems: "center" }}>
          <div>
            <p className="eyebrow" style={{ color: "#f5c518" }}>THE VETER ARCADE · FEATURED GAME</p>
            <h2 id="ipl-2026-title" style={{ fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1.04, margin: "12px 0 18px" }}>
              IPL 2026. <span style={{ color: "#f5c518" }}>Your team. Your trophy.</span>
            </h2>
            <p style={{ maxWidth: 650, color: "#d3e3ec", fontSize: 17, lineHeight: 1.7 }}>
              Pick your franchise, build your Playing XI and take on the AI. Play a quick showdown or lead your team through a full IPL championship season.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 26 }}>
              <Link href="/games/ipl2026/index.html" className="button-primary" style={{ background: "#f5c518", color: "#171717", borderColor: "#f5c518" }}>
                Play IPL 2026 <ArrowUpRight size={17} />
              </Link>
              <Link href="/games.html" className="button-quiet" style={{ color: "#f8fafc" }}>
                Explore all games <Gamepad2 size={17} />
              </Link>
            </div>
          </div>
          <div aria-hidden="true" style={{ minHeight: 230, border: "1px solid #ffffff2b", borderRadius: 24, background: "radial-gradient(circle at 50% 35%, #f5c51838, transparent 55%), linear-gradient(145deg, #ffffff12, #ffffff04)", display: "grid", placeItems: "center", boxShadow: "0 24px 70px #0005" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 88, lineHeight: 1 }}>🏏</div>
              <p style={{ margin: "14px 0 0", letterSpacing: ".18em", fontSize: 12, fontWeight: 800, color: "#f5c518" }}>READY FOR THE BIG MATCH?</p>
            </div>
          </div>
        </div>
        <style>{`@media(max-width:700px){#ipl-2026>div{grid-template-columns:1fr!important}}`}</style>
      </section>

      <section className="score-section">
        <div className="score-copy">
          <p className="eyebrow">02 / THE ARCADE</p>
          <h2>Play for the<br /><span>personal best.</span></h2>
          <p>VETER Arcade brings browser games and sports challenges together. A connected score service can power verified rankings here.</p>
          <Link href="/games.html" className="button-primary">Browse the games <ArrowUpRight size={17} /></Link>
        </div>
        <div className="leaderboard">
          <div className="leaderboard-head">
            <div><p className="micro-label">ARCADE / SCOREBOARD</p><h3><Trophy size={18} /> High scores</h3></div>
            <span className="preview-pill">SCORE FEED OFFLINE</span>
          </div>
          <div className="leaderboard-columns"><span>RANK / PLAYER</span><span>GAME</span><span>SCORE</span></div>
          {previewScores.map((entry) => (
            <div className="leaderboard-row" key={entry.rank}>
              <div className="player-cell"><span className="rank">{entry.rank}</span><span>{entry.player}</span></div>
              <span className="game-cell">{entry.game}</span>
              <span className="score-value">{entry.score}</span>
            </div>
          ))}
          <div className="score-skeleton" aria-hidden="true"><span /><span /><span /></div>
          <div className="leaderboard-foot"><span>Awaiting verified game scores</span><span>— / —</span></div>
          <p className="leaderboard-note">Preview only. Live rankings require a connected score database.</p>
        </div>
      </section>

      <section className="closing-section">
        <div className="closing-rule" />
        <div className="closing-content">
          <div><p className="eyebrow">03 / KEEP EXPLORING</p><h2>Curiosity is a<br /><span>good place to start.</span></h2></div>
          <div className="closing-action"><p>Get to know the projects, read the docs, or follow the next release.</p><Link className="button-primary" href="/docs.html">Start with the docs <ArrowUpRight size={17} /></Link></div>
        </div>
        <div className="closing-bottom"><span>VETER / INDEPENDENT TECHNOLOGY ECOSYSTEM</span><Globe2 size={16} /><span>THEVETER.IN</span></div>
      </section>
    </div>
  );
}
