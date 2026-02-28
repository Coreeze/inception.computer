"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCharacterID } from "@/lib/api/index";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (getCharacterID()) router.replace("/world");
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center font-[family-name:var(--font-mono)] text-center px-6">
      <h1 className="text-6xl font-serif tracking-tight mb-4">INCEPTION</h1>
      <p className="text-lg text-[#7a756d] mb-8 max-w-md">
        A world within a world within a model.
      </p>
      <div className="flex gap-4">
        <Link
          href="/create-world"
          className="border border-[#1a1714] px-6 py-3 text-sm uppercase tracking-widest"
        >
          Create World
        </Link>
        <Link
          href="/world"
          className="border border-[#1a1714] px-6 py-3 text-sm uppercase tracking-widest"
        >
          Enter World
        </Link>
      </div>
    </main>
  );
}
