"use client";

import dynamic from "next/dynamic";

const Globe = dynamic(
  () => import("./components/Globe"),
  { ssr: false }
);

export default function WorldPage() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <Globe />
    </div>
  );
}
