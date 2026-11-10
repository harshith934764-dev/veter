import { useState } from "react";
import {
  ArrowRight, ArrowUpRight, BookOpen, Braces, CheckCircle2, Code2,
  Cpu, Gamepad2, Globe2, Menu, Monitor, Rocket, Sparkles, Users, X,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { LegacyHomeSections } from "./LegacyHomeSections";

const links = [
  { label: "Language", href: "/veter-programming-language.html" },
  { label: "Learn", href: "/learn.html" },
  { label: "Documentation", href: "/docs.html" },
  { label: "Games", href: "/games.html" },
  { label: "VETER World", href: "/veter-world.html" },
  { label: "Social", href: "/social.html" },
  { label: "VETER AI", href: "/veter-ai.html" },
  { label: "Downloads", href: "/downloads.html" },
  { label: "Studio", href: "/studio.html" },
  { label: "Community", href: "/community.html" },
  { label: "Developers", href: "/developers.html" },
];

const projects = [
  { icon: Braces, name: "VETER Language", tag: "CORE PROJECT", description: "An original programming-language project with its own .vtr source format and compiler prototype.", href: "/veter-programming-language.html", action: "Explore language" },
  { icon: Cpu, name: "VETER AI", tag: "AI EXPERIMENTS", description: "Explore the VETER AI assistant and the growing set of AI-powered developer experiments.", href: "/veter-ai.html", action: "Open VETER AI" },
  { icon: Gamepad2, name: "VETER World", tag: "3D SIMULATION", description: "A developing city-life simulation project with an expanding interactive world.", href: "/veter-world.html", action: "Explore the world" },
  { icon: Users, name: "VETER Social", tag: "COMMUNITY", description: "A place to share projects, connect with creators and follow the VETER ecosystem.", href: "/social.html", action: "Visit community" },
  { icon: Monitor, name: "VETEROS", tag: "OS PROJECT", description: "An independent operating-system project exploring a desktop environment and system tools.", href: "/veteros.html", action: "Discover VETEROS" },
  { icon: Gamepad2, name: "Games & Arcade", tag: "PLAY", description: "Browse browser-based games and experiments built for the VETER platform.", href: "/games.html", action: "Play games" },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-[#080b14] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(36,99,170,.2),transparent_38%),radial-gradient(ellipse_at_90%_20%,rgba(20,155,150,.12),transparent_32%)]" />
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#080b14]/85 backdrop-blur-2xl">
        <nav className="relative mx-auto flex min-h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8" aria-label="Main navigation">
          <a href="/" className="flex items-center gap-3 text-xl font-black tracking-tight" aria-label="VETER home">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/40"><Code2 size={22} /></span>
            <span>VETER<span className="text-cyan-300">.</span></span>
          </a>
          <div className="hidden items-center gap-7 md:flex">
            {links.slice(0, 5).map((link) => <a key={link.href} className="text-sm text-slate-400 transition hover:text-cyan-200" href={link.href}>{link.label}</a>)}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <a href="https://github.com/harshith934764-dev/veter" target="_blank" rel="noreferrer"><Button variant="secondary" size="sm">GitHub <ArrowUpRight size={14} /></Button></a>
            <a href="/learn.html"><Button size="sm">Get started <ArrowRight size={14} /></Button></a>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</Button>
          {menuOpen && <div className="absolute left-0 right-0 top-full border-b border-white/10 bg-[#0c1220] p-5 shadow-2xl md:hidden">{links.map((link) => <a key={link.href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-cyan-200" href={link.href}>{link.label}</a>)}</div>}
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-20 sm:pt-28 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pb-28">
          <div>
            <Badge><span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" /> INDEPENDENT TECHNOLOGY ECOSYSTEM</Badge>
            <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-.055em] sm:text-6xl lg:text-[76px]">Build beyond<br />the <span className="bg-gradient-to-r from-blue-300 via-cyan-200 to-teal-200 bg-clip-text text-transparent">ordinary.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">A growing ecosystem for programming, developer tools, AI experiments, games and creative projects. Explore what works today and follow what comes next.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="/learn.html"><Button size="lg">Start building <ArrowRight size={17} /></Button></a>
              <a href="https://github.com/harshith934764-dev/veter" target="_blank" rel="noreferrer"><Button variant="secondary" size="lg">Explore source <ArrowUpRight size={17} /></Button></a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-300" /> Public source repository</span>
              <span className="inline-flex items-center gap-2"><Globe2 size={14} className="text-cyan-300" /> Open web experiences</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-8 rounded-[40px] bg-cyan-400/[0.08] blur-3xl" />
            <Card className="relative overflow-hidden border-cyan-200/15 bg-[#0b1220]/90">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
                <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-rose-400" /><span className="size-2.5 rounded-full bg-amber-300" /><span className="size-2.5 rounded-full bg-emerald-300" /><span className="ml-3 text-xs text-slate-500">hello.vtr</span></div>
                <span className="text-[10px] font-bold tracking-[.16em] text-cyan-200">VETER CORE</span>
              </div>
              <div className="grid grid-cols-[36px_1fr] gap-4 p-6 font-mono text-sm leading-8 sm:p-8">
                <div className="text-right text-slate-700">01<br />02<br />03<br />04<br />05</div>
                <pre className="overflow-x-auto text-slate-200"><span className="text-blue-300">remember</span> score <span className="text-blue-300">as</span> <span className="text-amber-200">95</span>{"\n"}<span className="text-blue-300">remember</span> bonus <span className="text-blue-300">as</span> <span className="text-amber-200">5</span>{"\n\n"}<span className="text-blue-300">revise</span> score <span className="text-blue-300">as</span> score + bonus{"\n"}<span className="text-blue-300">display</span> score</pre>
              </div>
              <div className="mx-6 mb-6 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.045] p-5 sm:mx-8 sm:mb-8">
                <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-emerald-200"><span className="size-1.5 rounded-full bg-emerald-300" /> OUTPUT PREVIEW</div>
                <div className="mt-2 font-mono text-4xl font-semibold tracking-tight text-emerald-200">100</div>
                <p className="mt-1 text-xs text-slate-500">Illustrative language example</p>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.07] bg-white/[0.02] px-6 py-3 text-[10px] text-slate-500"><span>VETER · .vtr</span><span>Code preview</span></div>
            </Card>
            <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-xl border border-white/10 bg-[#111b2b] px-4 py-3 shadow-2xl sm:flex"><span className="grid size-9 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><Sparkles size={18} /></span><span><strong className="block text-xs">Made to explore</strong><small className="text-[10px] text-slate-500">Ideas into experiments</small></span></div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-12 lg:px-8">
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] sm:grid-cols-4">
            {[[".vtr","Source format"],["C++20","Compiler implementation"],["Web","Accessible experiences"],["Open","Explore the project"]].map(([value,label],i) => <div key={label} className={`px-5 py-5 sm:px-7 ${i%2===0?"border-r":""} ${i<2?"border-b sm:border-b-0":""} ${i===1?"sm:border-r":""} ${i===2?"sm:border-r":""} border-white/[0.07]`}><div className="text-xl font-semibold tracking-tight text-slate-100">{value}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div></div>)}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div><Badge>THE ECOSYSTEM</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">One place. Many ways to build.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">Explore the projects and experiences growing under the VETER name.</p></div>
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100" href="/ecosystem.html">View ecosystem <ArrowUpRight size={16} /></a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(({icon:Icon,name,tag,description,href,action}) => <Card key={name} className="group transition duration-300 hover:-translate-y-1 hover:border-cyan-200/25 hover:bg-white/[0.055]">
              <CardHeader><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-xl border border-cyan-200/10 bg-cyan-200/[0.07] text-cyan-200"><Icon size={20} /></span><span className="text-[10px] font-bold tracking-[.15em] text-slate-600">{tag}</span></div><h3 className="pt-3 text-lg font-semibold">{name}</h3></CardHeader>
              <CardContent><p className="min-h-[72px] text-sm leading-6 text-slate-400">{description}</p><a href={href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition group-hover:gap-3">{action}<ArrowRight size={15} /></a></CardContent>
            </Card>)}
          </div>
        </section>

        <LegacyHomeSections />

        <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
          <Card className="relative overflow-hidden border-blue-300/15 bg-gradient-to-br from-blue-500/[0.12] via-cyan-400/[0.06] to-transparent">
            <div className="absolute -right-16 -top-24 size-80 rounded-full bg-cyan-300/[0.08] blur-3xl" />
            <div className="relative flex flex-col items-start justify-between gap-8 p-7 sm:p-10 lg:flex-row lg:items-center">
              <div className="max-w-2xl"><Badge><Rocket size={12} /> YOUR NEXT STEP</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Start with one small build.</h2><p className="mt-3 text-sm leading-7 text-slate-400">Learn the language, try the browser playground or inspect the source code. Pick a path and make something.</p></div>
              <div className="flex shrink-0 flex-wrap gap-3"><a href="/learn.html"><Button size="lg">Learn VETER <BookOpen size={16} /></Button></a><a href="/developers.html"><Button variant="secondary" size="lg">Developer hub <ArrowUpRight size={16} /></Button></a></div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div><div className="mb-1 text-base font-black tracking-tight text-slate-200">VETER<span className="text-cyan-300">.</span></div><p>Independent technology projects. Built to explore.</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-3">{[["About","/about.html"],["Docs","/docs.html"],["Community","/community.html"],["Support","/support.html"],["Privacy","/privacy.html"],["GitHub","https://github.com/harshith934764-dev/veter"]].map(([label,href])=><a key={label} href={href} className="transition hover:text-cyan-200">{label}</a>)}</div>
          <span>© 2026 VETER Project</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
