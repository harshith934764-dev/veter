import Link from "next/link";

const links = [{ label: "Explore", href: "/#explore" }, { label: "Language", href: "/veter-programming-language.html" }, { label: "AI", href: "/veter-ai.html" }, { label: "Games", href: "/games.html" }, { label: "Docs", href: "/docs.html" }];

export default function Header() {
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080d18]/95 backdrop-blur-xl"><nav className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-5 px-5"><Link href="/" className="text-2xl font-black tracking-tight">VETER<span className="text-emerald-300">.</span></Link><div className="hidden items-center gap-7 md:flex">{links.map((item) => <Link key={item.href} href={item.href} className="text-sm font-semibold text-slate-300 transition hover:text-white">{item.label}</Link>)}</div><Link href="/downloads.html" className="rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-[0_0_28px_#6ee7b755] transition hover:-translate-y-0.5">Get VETER</Link></nav></header>;
}
