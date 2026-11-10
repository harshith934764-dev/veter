import { useMemo, useState } from "react";
import { Gamepad2, Search, Trophy, Swords, Activity, ExternalLink, Play, Smartphone, Zap } from "lucide-react";

const games = [
  {name:"VETER Arcade 220",category:"Arcade",desc:"A collection of 220 lightweight browser challenges: puzzles, memory, maths, typing and reaction.",href:"/arcade-100.html",tag:"220 CHALLENGES"},
  {name:"Sports Arena",category:"Sports",desc:"Cricket, football, kabaddi, basketball, tennis, volleyball, badminton and hockey.",href:"/sports-games.html",tag:"8 SPORTS"},
  {name:"VETER World",category:"World",desc:"Explore the VETER World interactive simulation prototype.",href:"/veter-world.html",tag:"3D WORLD"},
  {name:"VETER City",category:"World",desc:"Explore the city-life simulation prototype.",href:"/veter-world-city.html",tag:"CITY SIM"},
  {name:"Battle Royale 3D",category:"Action",desc:"Open the existing browser arena prototype.",href:"/battle-royale-3d.html",tag:"3D ARENA"},
  {name:"Classic Games",category:"Arcade",desc:"Snake, memory, number games and tic-tac-toe in the existing games collection.",href:"/products.html#panel-games",tag:"CLASSICS"}
];
const sports = [
  ["🏏","Cricket","Batting, overs, wickets and target chase.","cricket"],
  ["⚽","Football","Penalty shots and goalkeeper challenges.","football"],
  ["🤼","Kabaddi","Raid, tag defenders and return across the line.","kabaddi"],
  ["🏀","Basketball","Move, aim and shoot against the clock.","basketball"],
  ["🎾","Tennis","Serve, return and win points.","tennis"],
  ["🏐","Volleyball","Serve and send the ball into the opponent court.","volleyball"],
  ["🏸","Badminton","Rally with quick serves and smash shots.","badminton"],
  ["🏑","Hockey","Aim for goal and beat the goalkeeper.","hockey"]
] as const;

function Shell({title,eyebrow,children}:{title:string;eyebrow:string;children:React.ReactNode}) {
 return <div className="min-h-screen bg-[#07111d] text-slate-100"><header className="sticky top-0 z-30 border-b border-white/10 bg-[#07111d]/90 backdrop-blur"><nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4"><a href="/" className="text-2xl font-black">VETER<span className="text-cyan-300">.</span></a><div className="flex flex-wrap gap-4 text-sm text-slate-300"><a href="/">Home</a><a href="/games.html">Games</a><a href="/sports-games.html">Sports</a><a href="/arcade-100.html">Arcade</a><a href="/veter-world.html">VETER World</a></div></nav></header><main className="mx-auto max-w-7xl px-5 py-10 sm:py-14"><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">{eyebrow}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">{title}</h1><div className="mt-7">{children}</div></main><footer className="border-t border-white/10 px-5 py-7 text-center text-xs text-slate-500">VETER Games · <a className="text-cyan-200" href="https://theveter.in">theveter.in</a></footer></div>;
}
function Tile({icon,title,desc,href,tag}:{icon:React.ReactNode;title:string;desc:string;href:string;tag:string}) {
 return <article className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[.04] p-5 transition hover:-translate-y-1 hover:border-cyan-200/40"><div className="flex items-center justify-between"><span className="grid size-12 place-items-center rounded-xl bg-cyan-200/10 text-cyan-200">{icon}</span><span className="text-[10px] font-bold tracking-widest text-cyan-300">{tag}</span></div><h2 className="mt-4 text-xl font-semibold">{title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{desc}</p><a className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-200" href={href}>Open game <Play size={15}/></a></article>;
}
function Games() {
 const [query,setQuery]=useState(""); const [filter,setFilter]=useState("All");
 const filtered=useMemo(()=>games.filter(g=>(filter==="All"||g.category===filter)&&(g.name+" "+g.desc).toLowerCase().includes(query.toLowerCase())),[query,filter]);
 return <Shell title="Play something brilliant." eyebrow="VETER browser games"><p className="max-w-3xl text-slate-400">Explore browser games and interactive prototypes. The catalogue is being rebuilt with React; the existing game engines are retained so playable experiences continue to work.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><label className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4"><Search size={18} className="text-slate-400"/><input aria-label="Search games" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search games..." className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-500"/></label><div className="flex flex-wrap gap-2">{["All","Arcade","Sports","World","Action"].map(x=><button key={x} onClick={()=>setFilter(x)} className={`rounded-full border px-4 py-2 text-xs font-bold ${filter===x?"border-cyan-200 bg-cyan-200 text-slate-950":"border-white/15 bg-white/5 text-slate-300"}`}>{x}</button>)}</div></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(g=><Tile key={g.name} icon={<Gamepad2/>} title={g.name} desc={g.desc} href={g.href} tag={g.tag}/>)}</div>{filtered.length===0&&<p className="mt-8 rounded-xl border border-white/10 p-6 text-slate-400">No games match that search. Try another word.</p>}<div className="mt-8 rounded-2xl border border-cyan-200/15 bg-cyan-200/5 p-5"><div className="flex items-center gap-3 font-semibold"><Smartphone className="text-cyan-200"/> Made for desktop and mobile</div><p className="mt-2 text-sm text-slate-400">Game engines may have different control support. Follow the instructions shown inside each game.</p></div></Shell>;
}
function Sports() {
 return <Shell title="Choose your sport." eyebrow="VETER sports arena"><p className="max-w-3xl text-slate-400">Pick a sport and choose 2D or 3D. These are original browser-game prototypes, not licensed professional team simulations.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{sports.map(([emoji,name,desc,id])=><article key={id} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><div className="text-4xl">{emoji}</div><h2 className="mt-3 text-xl font-semibold">{name}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{desc}</p><div className="mt-5 flex gap-2"><a className="flex-1 rounded-lg bg-cyan-200 px-3 py-2 text-center text-xs font-black text-slate-950" href={`/sports-engine-legacy.html?sport=${id}&view=2d`}>Play 2D</a><a className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-center text-xs font-bold text-cyan-100" href={`/sports-engine-legacy.html?sport=${id}&view=3d`}>Play 3D</a></div></article>)}</div><p className="mt-7 text-xs text-slate-500">3D mode depends on WebGL support and network access for its renderer. If a game fails to load, try 2D mode.</p></Shell>;
}
function Arcade() {
 return <Shell title="220 quick challenges." eyebrow="VETER arcade"><p className="max-w-3xl text-slate-400">A collection of lightweight browser challenges including arcade, maths, memory, typing, puzzles, reaction and target games.</p><div className="mt-8 grid gap-4 md:grid-cols-2"><Tile icon={<Zap/>} title="Open the playable arcade" desc="Launch the preserved arcade engine with its original game catalogue and in-browser interactions." href="/arcade-engine.html" tag="PLAY NOW"/><Tile icon={<Trophy/>} title="Sports collection" desc="Try cricket, football, kabaddi and five more sports prototypes." href="/sports-games.html" tag="8 SPORTS"/></div><div className="mt-8 rounded-xl border border-amber-200/20 bg-amber-200/5 p-5 text-sm text-amber-100/80">The Arcade React page is the new catalogue interface. The original playable challenge engine is retained separately while its game logic is migrated and tested.</div></Shell>;
}
export function BatchTwoPages() {
 const path=window.location.pathname.replace(/\/$/,"")||"/";
 if(path==="/games.html"||path==="/games") return <Games/>;
 if(path==="/sports-games.html"||path==="/sports") return <Sports/>;
 if(path==="/arcade-100.html"||path==="/arcade") return <Arcade/>;
 return null;
}
