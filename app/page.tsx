import Link from "next/link";

const cards = [
  { title: "VETER Language", tag: "DEVELOPER TOOLS", desc: "Explore the independent .vtr programming language, compiler and learning resources.", href: "/veter-programming-language.html" },
  { title: "VETER AI", tag: "AI & EXPERIMENTS", desc: "Discover AI experiments and the VETER assistant ecosystem.", href: "/veter-ai.html" },
  { title: "VETER Arcade", tag: "PLAY & EXPLORE", desc: "Play browser games, sports challenges and the growing game collection.", href: "/games.html" },
  { title: "VETER OS", tag: "OPERATING SYSTEM", desc: "See the Linux-based operating system project and its development.", href: "/veteros.html" }
];

const styles = {
  page: { minHeight: "100vh", background: "#070b14", color: "#f4f7fb", fontFamily: "Arial, Helvetica, sans-serif" },
  wrap: { width: "min(1120px, 100% - 40px)", margin: "0 auto" },
  hero: { padding: "100px 0 90px" },
  eyebrow: { display: "inline-block", padding: "10px 15px", border: "1px solid #28584f", borderRadius: "30px", color: "#a7f3d0", fontSize: "12px", fontWeight: 800, letterSpacing: "2px" },
  heading: { fontSize: "clamp(48px, 8vw, 88px)", lineHeight: 1.02, letterSpacing: "-4px", fontWeight: 900, margin: "28px 0 0" },
  accent: { color: "#6ee7b7" },
  intro: { maxWidth: "680px", color: "#cbd5e1", fontSize: "18px", lineHeight: 1.8, marginTop: "28px" },
  actions: { display: "flex", flexWrap: "wrap" as const, gap: "12px", marginTop: "30px" },
  primary: { display: "inline-block", background: "#6ee7b7", color: "#06111a", padding: "15px 22px", borderRadius: "30px", fontWeight: 800, textDecoration: "none" },
  secondary: { display: "inline-block", border: "1px solid #475569", color: "#fff", padding: "14px 22px", borderRadius: "30px", fontWeight: 700, textDecoration: "none" },
  section: { borderTop: "1px solid #263244", background: "#0b1220", padding: "75px 0" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginTop: "32px" },
  card: { display: "block", padding: "26px", border: "1px solid #263244", borderRadius: "18px", background: "#111b2b", color: "#f8fafc", textDecoration: "none", minHeight: "190px" },
  tag: { color: "#6ee7b7", fontSize: "11px", fontWeight: 800, letterSpacing: "1.5px" },
  desc: { color: "#aebccc", lineHeight: 1.7 },
  lower: { padding: "75px 0" }
};

export default function Home() {
  return <div style={styles.page}>
    <section style={{ ...styles.wrap, ...styles.hero }}>
      <span style={styles.eyebrow}>INDEPENDENT TECHNOLOGY ECOSYSTEM</span>
      <h1 style={styles.heading}>Build what<br /><span style={styles.accent}>comes next.</span></h1>
      <p style={styles.intro}>Welcome to VETER — a growing technology ecosystem for programming, developer tools, AI experiments, games and learning. Explore projects, try tools and follow what is being built.</p>
      <div style={styles.actions}><Link href="/veter-programming-language.html" style={styles.primary}>Explore VETER ↗</Link><Link href="/games.html" style={styles.secondary}>Play games</Link></div>
      <p style={{ color: "#64748b", fontSize: "12px", fontWeight: 800, letterSpacing: "2px", marginTop: "50px" }}>PROGRAMMING　 AI EXPERIMENTS　 GAMES　 OPEN DEVELOPMENT</p>
    </section>
    <section style={styles.section}><div style={styles.wrap}>
      <p style={styles.tag}>THE ECOSYSTEM</p><h2 style={{ fontSize: "clamp(30px, 5vw, 48px)", margin: "12px 0" }}>Explore what VETER is building.</h2>
      <p style={{ color: "#94a3b8" }}>Choose a project to get started. Your existing VETER tools and pages remain available.</p>
      <div style={styles.grid}>{cards.map(card => <Link key={card.title} href={card.href} style={styles.card}><span style={styles.tag}>{card.tag}</span><h3 style={{ fontSize: "24px", margin: "24px 0 10px" }}>{card.title}</h3><p style={styles.desc}>{card.desc}</p><strong style={{ color: "#a7f3d0" }}>Explore project ↗</strong></Link>)}</div>
    </div></section>
    <section style={{ ...styles.wrap, ...styles.lower }}><div style={{ padding: "35px", border: "1px solid #28584f", borderRadius: "22px", background: "#0e1b25" }}><p style={styles.tag}>START BUILDING</p><h2 style={{ fontSize: "34px", margin: "12px 0" }}>One ecosystem. Many possibilities.</h2><p style={styles.desc}>Read the documentation, discover the projects and follow the next VETER releases.</p><Link href="/docs.html" style={{ ...styles.primary, marginTop: "12px" }}>Read documentation ↗</Link></div></section>
  </div>;
}
