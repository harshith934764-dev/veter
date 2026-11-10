import { BookOpen, Braces, Code2, ExternalLink, Gamepad2, GraduationCap, LayoutDashboard, LifeBuoy } from "lucide-react";

const nav = [
  ["Home", "/"], ["Dashboard", "/dashboard.html"], ["Language", "/veter-programming-language.html"],
  ["Learn", "/learn.html"], ["Docs", "/docs.html"], ["Games", "/games.html"],
  ["VETER AI", "/veter-ai.html"], ["Social", "/social.html"], ["Developers", "/developers.html"]
] as const;

function Shell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#080b14] text-slate-100">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080b14]">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4" aria-label="VETER navigation">
        <a href="/" className="text-2xl font-black tracking-tight">VETER<span className="text-cyan-300">.</span></a>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">{nav.map(([label, href]) => <a key={href} href={href} className="hover:text-cyan-200">{label}</a>)}</div>
      </nav>
    </header>
    <main className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <div className="mt-8">{children}</div>
    </main>
    <footer className="border-t border-white/10 px-5 py-7 text-center text-xs text-slate-500">© 2026 VETER Project · <a className="text-cyan-200" href="/">theveter.in</a></footer>
  </div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5 sm:p-7"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-slate-300">{children}</div></section>;
}
function Example({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-xl border border-cyan-200/10 bg-[#050914] p-5 font-mono text-sm leading-7 text-cyan-100"><code>{children}</code></pre>;
}

function Dashboard() {
  const products = [
    ["VETER AI", "Ask questions and work with code.", "/veter-ai.html", "AI WORKSPACE"],
    ["VETER Social", "Connect with creators and explore community features.", "/social.html", "COMMUNITY"],
    ["VETER Studio", "Open the browser-based programming workspace.", "/studio.html", "CODE EDITOR"],
    ["Games", "Browse the current browser game collection.", "/games.html", "PLAY"],
    ["VETER World", "Explore the interactive world prototypes.", "/veter-world.html", "3D PROJECT"],
    ["Learn Veter", "Follow the language learning path.", "/learn.html", "LEARNING"],
    ["Developer portal", "Find source code and developer resources.", "/developers.html", "TOOLS"],
    ["Roadmap", "Review current and planned project work.", "/roadmap.html", "PROJECT STATUS"],
    ["Support", "Find help and report a problem.", "/support.html", "HELP"]
  ];
  return <Shell title="Your VETER workspace." eyebrow="One place to start">
    <p className="max-w-2xl text-slate-400">Open your VETER tools, learning space and games from one simple workspace.</p>
    <Panel title="Account access"><p>Public tools can be explored without signing in. For account features, use the existing sign-in flow on VETER Social or VETER AI.</p><a className="inline-flex items-center gap-2 font-semibold text-cyan-200" href="/social.html">Open VETER Social <ExternalLink size={15}/></a></Panel>
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map(([name,desc,href,tag])=><article key={name} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><span className="text-[10px] font-bold tracking-widest text-cyan-300">{tag}</span><h2 className="mt-3 text-lg font-semibold">{name}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{desc}</p><a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200" href={href}>Open {name} <ExternalLink size={14}/></a></article>)}</section>
    <p className="mt-6 rounded-xl border border-amber-200/20 bg-amber-200/5 p-4 text-sm text-amber-100/80">Some products are prototypes. Billing, shared profile data and saved game progress are not represented as available unless their backend services are implemented.</p>
  </Shell>;
}

function Learn() {
  const lessons = [
    ["01 · Your first Veter file", "Create hello.vtr and try the output command.", 'display "Hello from Veter!"'],
    ["02 · Store information", "Use remember to store values and revise to update them.", 'remember learner as "Harshith"\nremember score as 80\ndisplay learner\ndisplay score'],
    ["03 · Work with values", "Combine arithmetic expressions and use parentheses for grouping.", "remember first as 10\nremember second as 5\nremember total as first + second * 2\ndisplay total"],
    ["04 · Make decisions", "Use a condition to choose which block runs.", 'remember marks as 72\nchoose when marks >= 50\n    display "You passed"\nelse choose\n    display "Try again"\nclose choice'],
    ["05 · Repeat work", "A counted loop repeats a block a fixed number of rounds.", "remember step as 1\nrepeat 3 rounds\n    display step\n    revise step as step + 1\nclose cycle"]
  ];
  return <Shell title="Learn to think in Veter." eyebrow="Official learning path">
    <p className="max-w-3xl text-slate-400">A practical introduction to .vtr source files and command forms documented in the Core 1.0 prototype. Use a compiler build that matches these examples.</p>
    <div className="mt-8 space-y-5">{lessons.map(([title,desc,code])=><Panel key={title} title={title}><p>{desc}</p><Example>{code}</Example></Panel>)}</div>
    <Panel title="Practice plan"><ul className="list-disc space-y-2 pl-5"><li>Beginner: print messages and store values.</li><li>Problem solving: use comparisons and conditions.</li><li>Repetition: write counted and condition-controlled loops.</li><li>Build confidence: run small tests and read compiler errors.</li></ul></Panel>
    <Panel title="Continue learning"><p><a className="text-cyan-200" href="/docs.html">Documentation</a> · <a className="text-cyan-200" href="/reference.html">Language reference</a> · <a className="text-cyan-200" href="/#code-maker">Browser playground</a></p><p className="text-amber-200/80">The native Core 1.0 prototype and browser playground support different command subsets. Check the matching runtime documentation.</p></Panel>
  </Shell>;
}

function Docs() {
  return <Shell title="Understand the Veter language." eyebrow="Official documentation">
    <p className="max-w-3xl text-slate-400">Technical guidance for language design, source files, compiler, runtime and tools. Working prototypes are distinguished from proposed features.</p>
    <div className="mt-8 grid gap-5 lg:grid-cols-[230px_1fr]">
      <aside className="h-fit rounded-xl border border-white/10 p-5 text-sm text-slate-300"><strong>On this page</strong>{["Overview","Source files","Syntax model","Compiler and runtime","Compatibility","Workflow","Roadmap"].map(x=><a key={x} className="mt-3 block text-cyan-200" href={"#"+x.toLowerCase().replaceAll(" ","-")}>{x}</a>)}</aside>
      <div className="space-y-5">
        <Panel title="Language overview"><p>Veter is an independently developed programming-language project with its own .vtr source format, evolving compiler/runtime experiments and developer tools.</p><p>Design goals are not automatically available features. Verify each feature against the compiler release you use.</p></Panel>
        <Panel title="Source files"><p>Veter source examples use UTF-8 text and the .vtr extension.</p><Example>{'remember score as 95\ndisplay score'}</Example></Panel>
        <Panel title="Syntax model"><p>The Core 1.0 prototype materials document variables, output, conditions and loops.</p><Example>{'remember score as 95\nchoose when score >= 50\n    display "passed"\nelse choose\n    display "try again"\nclose choice'}</Example></Panel>
        <Panel title="Compiler and runtime"><p>The supplied Core 1.0 materials describe a C++20 compiler prototype. C++20 is the implementation technology; .vtr is the source language format.</p></Panel>
        <Panel title="Compatibility"><p>The homepage browser demo supports a limited command subset. Do not assume every native compiler command is supported in the browser demo, or vice versa.</p></Panel>
        <Panel title="Developer workflow"><ol className="list-decimal space-y-2 pl-5"><li>Choose the compiler/runtime release.</li><li>Read matching release notes.</li><li>Create a .vtr source file.</li><li>Run it with the matching tool.</li><li>Keep tests for features you depend on.</li></ol></Panel>
        <Panel title="Roadmap"><ul className="list-disc space-y-2 pl-5"><li>Formal grammar and versioned specification.</li><li>Compiler diagnostics and regression tests.</li><li>Modules, package management and standard library.</li><li>Debugger, formatter and editor integration.</li><li>Stable cross-platform releases.</li></ul></Panel>
      </div>
    </div>
  </Shell>;
}

function Language() {
  return <Shell title="Meet the Veter programming language." eyebrow="The VETER project">
    <Panel title="What is Veter?"><p>Veter is an independently developed programming-language project with its own language design, .vtr source files, compiler work and learning resources.</p></Panel>
    <Panel title="What does a Veter program look like?"><p>The published Core 1.0 prototype materials document commands such as remember and display.</p><Example>{'remember learner as "Harshith"\ndisplay learner'}</Example></Panel>
    <Panel title="Implementation status"><p>Veter is under active development. Check the <a className="text-cyan-200" href="/docs.html">technical documentation</a>, <a className="text-cyan-200" href="/reference.html">language reference</a> and <a className="text-cyan-200" href="https://github.com/harshith934764-dev/veter">source repository</a> for verified details.</p></Panel>
    <Panel title="Start exploring"><div className="flex flex-wrap gap-4"><a className="text-cyan-200" href="/learn.html">Learning guide</a><a className="text-cyan-200" href="/docs.html">Documentation</a><a className="text-cyan-200" href="/reference.html">Reference</a></div></Panel>
  </Shell>;
}

export function BatchOnePages() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/dashboard.html" || path === "/dashboard") return <Dashboard/>;
  if (path === "/learn.html" || path === "/learn") return <Learn/>;
  if (path === "/docs.html" || path === "/docs") return <Docs/>;
  if (path === "/veter-programming-language.html" || path === "/language") return <Language/>;
  return null;
}
