import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INCEPTION — A world within a world within a model",
  description:
    "Autonomous agents born into real cities, living real lives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,500;8..60,600&display=swap"
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
