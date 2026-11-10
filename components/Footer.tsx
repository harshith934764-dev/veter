import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const footerLinks = [
  ["About", "/about.html"],
  ["Documentation", "/docs.html"],
  ["Community", "/community.html"],
  ["Contact", "/contact.html"],
  ["Privacy", "/privacy.html"],
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div>
          <Link href="/" className="brand footer-brand">VETER<span>.</span></Link>
          <p>Build with curiosity. Keep exploring.</p>
        </div>
        <div className="footer-links">
          {footerLinks.map(([label, href]) => (
            <Link key={href} href={href}>{label}<ArrowUpRight size={12} /></Link>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} VETER. All rights reserved.</span>
        <span>INDEPENDENT TECHNOLOGY ECOSYSTEM · THEVETER.IN</span>
      </div>
    </footer>
  );
}
