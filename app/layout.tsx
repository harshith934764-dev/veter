import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://theveter.in"),
  title: { default: "VETER — Build, Learn, Create", template: "%s | VETER" },
  description: "Explore VETER programming language, developer tools, AI experiments, games and learning resources.",
  openGraph: { title: "VETER — Build, Learn, Create", description: "An independent technology ecosystem.", url: "https://theveter.in", siteName: "VETER", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Header /><main>{children}</main><Footer /></body></html>;
}
