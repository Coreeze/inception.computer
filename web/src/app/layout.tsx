import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INCEPTION — Autonomous agents grounded in neuroscience, sociology, and psychology",
  description:
    "A life engine where autonomous AI agents live in real cities with persistent memory, self-reflection, and emergent social behavior.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,300;1,8..60,400;1,8..60,500&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Libre+Franklin:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased bg-[#f9f7f3] text-[#1a1714]"
        style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
      >
        {children}
      </body>
    </html>
  );
}
