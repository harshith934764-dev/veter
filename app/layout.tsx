import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://theveter.in"),
  title: {
    default: "VETER — Independent Technology Ecosystem",
    template: "%s | VETER",
  },
  description:
    "Explore VETER: an independent technology ecosystem for programming, AI experiments, operating systems, browser games and learning.",
  applicationName: "VETER",
  openGraph: {
    title: "VETER — Independent Technology Ecosystem",
    description: "Programming, AI experiments, operating systems and play. Built with curiosity.",
    url: "https://theveter.in",
    siteName: "VETER",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VETER — Independent Technology Ecosystem",
    description: "Programming, AI experiments, operating systems and play.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
