import { useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Download, ExternalLink, Play, RotateCcw, Save, Upload, Copy, Terminal, Sparkles } from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";

const starter = 'make name "Veter Language"\nmake score 10 + 5 * 2\nsay "Hello from " + name\nsay score';
const examples: Record<string, string> = {
  starter,
  calculator: 'make price 120\nmake quantity 3\nmake total price * quantity\nsay "Total price:"\nsay total',
  profile: 'make name "Veter learner"\nmake goal "Build something great"\nsay "Hello, " + name\nsay goal',
  rectangle: 'make length 12\nmake width 5\nmake area length * width\nsay "Rectangle area:"\nsay area',
  remainder: 'make total 17\nmake groups 5\nmake left total % groups\nsay "Items left over:"\nsay left',
  invoice: 'make item "Notebook"\nmake price 45\nmake quantity 4\nmake total price * quantity\nsay item\nsay "Amount:"\nsay total',
};

type Token = { t: "value" | "number" | "name" | "op"; v: string };

function tokenize(expr: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }
    if (expr[i] === '"' || expr[i] === "'") {
      const q = expr[i++];
      let v = "";
      while (i < expr.length && expr[i] !== q) {
        if (expr[i] === "\\" && i + 1 < expr.length) { i++; v += expr[i++]; }
        else v += expr[i++];
      }
      if (expr[i] !== q) throw new Error("Unclosed string");
      i++;
      out.push({ t: "value", v });
      continue;
    }
    const m = expr.slice(i).match(/^(?:\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|\+|-|\*|\/|%|\(|\))/);
    if (!m) throw new Error("Unexpected character: " + expr[i]);
    out.push({ t: /^\d/.test(m[0]) ? "number" : /^[A-Za-z_]/.test(m[0]) ? "name" : "op", v: m[0] });
    i += m[0].length;
  }
  return out;
}

function evaluate(expr: string, vars: Record<string, string | number>): string | number {
  const ts = tokenize(expr);
  let p = 0;
  function atom(): string | number {
    const x = ts[p++];
    if (!x) throw new Error("Expected a value");
    if (x.t === "value") return x.v;
    if (x.t === "number") return Number(x.v);
    if (x.t === "name") {
      if (!Object.prototype.hasOwnProperty.call(vars, x.v)) throw new Error("Unknown variable: " + x.v);
      return vars[x.v];
    }
    if (x.v === "(") {
      const v = add();
      if (!ts[p] || ts[p++].v !== ")") throw new Error("Missing )");
      return v;
    }
    if (x.v === "-") return -Number(atom());
    throw new Error("Unexpected token: " + x.v);
  }
  function mul(): string | number {
    let a = atom();
    while (ts[p] && ["*", "/", "%"].includes(ts[p].v)) {
      const op = ts[p++].v, b = Number(atom());
      if ((op === "/" || op === "%") && b === 0) throw new Error("Division by zero");
      a = op === "*" ? Number(a) * b : op === "/" ? Number(a) / b : Number(a) % b;
    }
    return a;
  }
  function add(): string | number {
    let a = mul();
    while (ts[p] && ["+", "-"].includes(ts[p].v)) {
      const op = ts[p++].v, b = mul();
      a = op === "+" ? (typeof a === "string" || typeof b === "string" ? String(a) + String(b) : Number(a) + Number(b)) : Number(a) - Number(b);
    }
    return a;
  }
  const value = add();
  if (p !== ts.length) throw new Error("Could not understand expression near " + ts[p].v);
  return value;
}

function runProgram(source: string): string {
  const vars: Record<string, string | number> = Object.create(null);
  const logs: string[] = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    let m = line.match(/^(make|set)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/);
    if (m) { vars[m[2]] = evaluate(m[3], vars); return; }
    m = line.match(/^(say|show)\s+(.+)$/);
    if (m) { logs.push(String(evaluate(m[2], vars))); return; }
    throw new Error("Line " + (index + 1) + ": this browser demo supports make, set, say and show.");
  });
  return logs.length ? logs.join("\n") : "Program finished with no output.";
}

const products = [
  { name: "VETEROS", label: "OPERATING SYSTEM", text: "Explore the VETER desktop operating-system project and its evolving system experience.", href: "/veteros.html", action: "Explore VETEROS" },
  { name: "VETER Language", label: "PROGRAMMING LANGUAGE", text: "Learn the original .vtr language, its syntax, compiler and browser playground.", href: "/veter-programming-language.html", action: "Explore language" },
  { name: "VETER City", label: "CITY PROJECT", text: "Explore the VETER City and VETER World interactive simulation projects.", href: "/veter-world-city.html", action: "Explore city" },
  { name: "VETER World", label: "3D SIMULATION", text: "Discover the growing city-life simulation and its playable experiments.", href: "/veter-world.html", action: "Explore world" },
  { name: "VETER Social", label: "COMMUNITY", text: "Connect with creators and share projects in the VETER Social experience.", href: "/social.html", action: "Open VETER Social" },
  { name: "VETER AI", label: "AI ASSISTANT", text: "Try the VETER AI assistant and explore AI-powered developer experiments.", href: "/veter-ai.html", action: "Open VETER AI" },
  { name: "VETER Studio", label: "DEVELOPER TOOL", text: "Explore the VETER Studio development environment and tools.", href: "/studio.html", action: "Open Studio" },
];

export function LegacyHomeSections() {
  const [code, setCode] = useState(starter);
  const [output, setOutput] = useState("Ready. Press Run code to execute your program.");
  const [example, setExample] = useState("starter");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lineCount = useMemo(() => code.split(/\r?\n/).length, [code]);

  function saveFile() {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "my-veter-project.vtr"; a.click();
    URL.revokeObjectURL(url);
  }

  async function copyOutput() {
    try { await navigator.clipboard.writeText(output); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setOutput((v) => v + "\n(Copy is unavailable in this browser.)"); }
  }

  return <>
    <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8" aria-label="VETER project facts">
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] sm:grid-cols-4">
        {[[".vtr", "Own source format"], ["C++20", "Compiler implementation"], ["Web", "Browser experiences"], ["Open", "Public project"]].map(([v, l]) => <div key={l} className="border-b border-white/10 px-5 py-5 last:border-0 sm:border-b-0 sm:border-r"><strong className="block text-xl text-white">{v}</strong><span className="text-xs text-slate-500">{l}</span></div>)}
      </div>
    </section>

    <section id="language-overview" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="mb-9 text-center"><Badge>THE LANGUAGE</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">A language with its own identity.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">VETER is an independent programming-language project with its own .vtr files, compiler experiments, learning resources and developer tools.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        {[["Language reference", "Explore syntax, examples and the language specification.", "/reference.html", "Open reference"], ["How it works", "Read about the compiler, runtime and implementation.", "/docs.html#implementation", "Technical details"], ["Start learning", "Follow beginner-friendly lessons and practical examples.", "/learn.html", "Learn VETER"]].map(([t,d,h,a]) => <Card key={t}><CardHeader><h3 className="text-lg font-semibold">{t}</h3></CardHeader><CardContent><p className="text-sm leading-6 text-slate-400">{d}</p><a className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200" href={h}>{a}<ArrowRight size={15}/></a></CardContent></Card>)}
      </div>
    </section>

    <section id="products" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="mb-9"><Badge>VETER PRODUCTS</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Explore the ecosystem.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">The original website's project destinations are kept available here. Open each project to use its existing page and features.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map((p) => <Card key={p.name} className="transition hover:-translate-y-1 hover:border-cyan-200/30"><CardHeader><Badge>{p.label}</Badge><h3 className="pt-2 text-xl font-semibold">{p.name}</h3></CardHeader><CardContent><p className="min-h-16 text-sm leading-6 text-slate-400">{p.text}</p><a href={p.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">{p.action}<ArrowRight size={15}/></a></CardContent></Card>)}</div>
      <div className="mt-5 rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.04] p-5 text-sm text-slate-300"><strong className="text-white">More to explore:</strong> <a className="ml-2 text-cyan-200" href="/ecosystem.html">Ecosystem</a> · <a className="text-cyan-200" href="/showcase.html">Showcase</a> · <a className="text-cyan-200" href="/roadmap.html">Roadmap</a> · <a className="text-cyan-200" href="/changelog.html">Changelog</a></div>
    </section>

    <section id="downloads" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="mb-9"><Badge><Download size={12}/> DOWNLOADS</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Get VETER tools.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">Download the currently published installers and runtime packages from the existing repository.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        {[["VETER Studio for Windows", "Windows x64 installer", "/downloads/VeterStudioSetup-1.0.0-x64.exe"], ["VETER Native Runtime", "Windows runtime ZIP package", "/Veter-Native-Runtime-1.0-Windows.zip"], ["VETER Core source", "Compiler source and tests", "https://github.com/harshith934764-dev/veter/tree/main/downloads"]].map(([n,d,h]) => <Card key={n}><CardHeader><h3 className="text-lg font-semibold">{n}</h3></CardHeader><CardContent><p className="text-sm text-slate-400">{d}</p><a href={h} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200" target={h.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{h.startsWith("http") ? "View source" : "Download"}<Download size={15}/></a></CardContent></Card>)}
      </div>
      <p className="mt-5 text-xs leading-6 text-slate-500">Downloads are served from the existing VETER website repository. Check each package's included instructions before installing.</p>
    </section>

    <section id="language" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><Badge><Terminal size={12}/> BROWSER PLAYGROUND</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Try VETER in your browser.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">Write a small program, run it, load examples, and save your work as a .vtr file.</p></div><a href="/veter-programming-language.html" className="text-sm font-semibold text-cyan-200">Full language page <ExternalLink size={14} className="inline"/></a></div>
      <div className="overflow-hidden rounded-2xl border border-indigo-300/20 bg-[#090f28] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="size-2.5 rounded-full bg-rose-400"/><span className="size-2.5 rounded-full bg-amber-300"/><span className="size-2.5 rounded-full bg-emerald-300"/><strong className="text-sm text-slate-200">main.vtr</strong></div><span className="text-xs text-cyan-200">VETER BROWSER DEMO</span></div>
        <div className="grid lg:grid-cols-2">
          <div className="min-w-0 border-b border-white/10 lg:border-b-0 lg:border-r"><div className="flex flex-wrap items-center justify-between gap-2 bg-white/[0.035] px-4 py-3"><label htmlFor="veter-code" className="text-xs font-semibold text-slate-300">EDITOR</label><select aria-label="Load example" value={example} onChange={(e) => { setExample(e.target.value); setCode(examples[e.target.value] || starter); setOutput("Example loaded. Press Run code to try it."); }} className="rounded-lg border border-white/10 bg-[#111a32] px-3 py-2 text-xs text-white"><option value="starter">Starter</option><option value="calculator">Calculator</option><option value="profile">Profile</option><option value="rectangle">Rectangle</option><option value="remainder">Remainder</option><option value="invoice">Invoice</option></select></div>
            <textarea id="veter-code" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); const el = e.currentTarget; const a = el.selectionStart, b = el.selectionEnd; setCode(code.slice(0,a) + "  " + code.slice(b)); requestAnimationFrame(() => el.setSelectionRange(a+2,a+2)); } }} className="min-h-[280px] w-full resize-y border-0 bg-[#080d20] p-5 font-mono text-sm leading-7 text-slate-100 outline-none" />
            <div className="border-t border-white/10 px-4 py-2 text-xs text-slate-500">{lineCount} {lineCount === 1 ? "line" : "lines"} · .vtr</div>
          </div>
          <div className="min-w-0"><div className="bg-white/[0.035] px-4 py-3 text-xs font-semibold text-slate-300">OUTPUT</div><pre aria-live="polite" className="min-h-[280px] whitespace-pre-wrap break-words bg-transparent p-5 font-mono text-sm leading-7 text-emerald-200">{output}</pre></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-4">
          <Button onClick={() => { try { setOutput(runProgram(code)); } catch (e) { setOutput("Veter error: " + (e instanceof Error ? e.message : "Unknown error")); } }}><Play size={15}/> Run code</Button>
          <Button variant="secondary" onClick={() => { setCode(starter); setExample("starter"); setOutput("Example restored. Press Run to execute it."); }}><RotateCcw size={15}/> Reset</Button>
          <Button variant="secondary" onClick={copyOutput}><Copy size={15}/>{copied ? "Copied!" : "Copy output"}</Button>
          <Button variant="secondary" onClick={saveFile}><Save size={15}/> Save .vtr</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={15}/> Open .vtr</Button>
          <input ref={fileRef} type="file" accept=".vtr,.txt,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setCode(await f.text()); setOutput("Loaded " + f.name + ". Press Run code to execute it."); } catch { setOutput("Could not open this file."); } e.target.value = ""; }}/>
          <span className="ml-auto text-xs text-slate-500">Browser demo supports make, set, say, show and basic arithmetic.</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">This is the documented browser-learning subset, not a replacement for the full native compiler or VETER runtime.</p>
    </section>

    <section id="library" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="mb-9"><Badge><BookOpen size={12}/> LEARNING LIBRARY</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Everything to keep learning.</h2></div>
      <div className="grid gap-4 md:grid-cols-3">
        {[["Lessons & examples", "Beginner learning paths and practical exercises.", "/learn.html"], ["Documentation", "Language guides, technical notes and references.", "/docs.html"], ["Reference", "Syntax reference and language specification.", "/reference.html"], ["Developer hub", "Project tools, resources and contribution links.", "/developers.html"], ["Community", "Meet other learners and creators.", "/community.html"], ["Support", "Find help and contact the project.", "/support.html"]].map(([t,d,h]) => <Card key={t}><CardHeader><h3 className="text-lg font-semibold">{t}</h3></CardHeader><CardContent><p className="text-sm leading-6 text-slate-400">{d}</p><a href={h} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">Explore <ArrowRight size={14}/></a></CardContent></Card>)}
      </div>
    </section>

    <section id="start-here" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="rounded-3xl border border-cyan-200/15 bg-gradient-to-br from-blue-500/10 via-cyan-400/[0.06] to-transparent p-7 sm:p-10">
        <Badge><Sparkles size={12}/> START HERE</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Make your first VETER project.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">Start with a lesson, explore the code playground, or join the community. The existing project pages remain available while the React migration continues.</p>
        <div className="mt-6 flex flex-wrap gap-3"><a href="/learn.html"><Button>Start learning <ArrowRight size={15}/></Button></a><a href="/social.html"><Button variant="secondary">Join VETER Social</Button></a><a href="https://github.com/harshith934764-dev/veter" target="_blank" rel="noreferrer"><Button variant="secondary">Contribute on GitHub <ExternalLink size={14}/></Button></a></div>
      </div>
    </section>

    <section id="faq" className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
      <div className="mb-8 text-center"><Badge>FAQ</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Quick answers.</h2></div>
      <div className="space-y-3">{[["What is VETER?", "VETER is an independent programming-language and technology project with developer tools, learning resources and related experiments."], ["Is VETER free to explore?", "The public website, learning resources and source repository can be explored online. Check individual product pages for their current availability."], ["Where can I learn the language?", "Start with the Learn page, documentation and language reference linked throughout this website."], ["Is the browser playground the full compiler?", "No. It is a small learning runner for a documented subset. Use the native compiler and runtime resources for full project work."]].map(([q,a]) => <details key={q} className="rounded-xl border border-white/10 bg-white/[0.025] p-5"><summary className="cursor-pointer font-semibold text-slate-100">{q}</summary><p className="mt-3 text-sm leading-7 text-slate-400">{a}</p></details>)}</div>
    </section>

    <section id="contact" className="mx-auto max-w-7xl px-5 py-16 text-center lg:px-8">
      <Badge>GET IN TOUCH</Badge><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Build with VETER.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">Questions, ideas or feedback? Reach the project through the official channels.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3"><a href="mailto:harshith934764@gmail.com"><Button>Email VETER</Button></a><a href="https://wa.me/919347648599" target="_blank" rel="noreferrer"><Button variant="secondary">WhatsApp</Button></a><a href="https://www.instagram.com/buildwithveter/" target="_blank" rel="noreferrer"><Button variant="secondary">Instagram</Button></a></div>
    </section>
  </>;
}
