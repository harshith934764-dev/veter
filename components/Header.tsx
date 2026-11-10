import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const links = [
  { label: "Explore", href: "/#explore" },
  { label: "Language", href: "/veter-programming-language.html" },
  { label: "AI", href: "/veter-ai.html" },
  { label: "VETER OS", href: "/veteros.html" },
  { label: "Arcade", href: "/games.html" },
  { label: "Docs", href: "/docs.html" },
];

export default function Header() {
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <Link href="/" className="brand" aria-label="VETER home">
          VETER<span>.</span>
        </Link>
        <div className="nav-links">
          {links.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </div>
        <Link href="/downloads.html" className="nav-cta">
          Get VETER <ArrowUpRight size={15} />
        </Link>
      </nav>
    </header>
  );
}
