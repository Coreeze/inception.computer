"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { initializeWorld } from "@/lib/api/simulation";
import { setCharacterID } from "@/lib/api/index";

export default function CreateWorldPage() {
  const router = useRouter();
  const [first_name, setFirst_name] = useState("");
  const [last_name, setLast_name] = useState("");
  const [soul_md, setSoul_md] = useState("");
  const [life_md, setLife_md] = useState("");
  const [life_mission_name, setLife_mission_name] = useState("");
  const [home_city, setHome_city] = useState("Paris");
  const [home_country, setHome_country] = useState("France");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!first_name.trim()) {
      setError("First name is required");
      return;
    }
    setLoading(true);
    try {
      const res = await initializeWorld({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        soul_md: soul_md.trim() || undefined,
        life_md: life_md.trim() || undefined,
        life_mission_name: life_mission_name.trim() || undefined,
        home_city: home_city.trim() || undefined,
        home_country: home_country.trim() || undefined,
      });
      const character = (res as any).character;
      if (character?._id) {
        setCharacterID(character._id);
        router.push("/world");
      } else {
        setError("Failed to create character");
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center font-[family-name:var(--font-mono)] px-6 py-12">
      <h1 className="text-4xl font-serif tracking-tight mb-2">Create your world</h1>
      <p className="text-[#7a756d] mb-8">Who do you want to be?</p>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="First name"
            value={first_name}
            onChange={(e) => setFirst_name(e.target.value)}
            className="flex-1 border border-black/20 rounded-lg px-4 py-2.5 text-sm bg-white"
          />
          <input
            type="text"
            placeholder="Last name"
            value={last_name}
            onChange={(e) => setLast_name(e.target.value)}
            className="flex-1 border border-black/20 rounded-lg px-4 py-2.5 text-sm bg-white"
          />
        </div>

        <input
          type="text"
          placeholder="Life mission (e.g. Live a meaningful life)"
          value={life_mission_name}
          onChange={(e) => setLife_mission_name(e.target.value)}
          className="w-full border border-black/20 rounded-lg px-4 py-2.5 text-sm bg-white"
        />

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="City"
            value={home_city}
            onChange={(e) => setHome_city(e.target.value)}
            className="flex-1 border border-black/20 rounded-lg px-4 py-2.5 text-sm bg-white"
          />
          <input
            type="text"
            placeholder="Country"
            value={home_country}
            onChange={(e) => setHome_country(e.target.value)}
            className="flex-1 border border-black/20 rounded-lg px-4 py-2.5 text-sm bg-white"
          />
        </div>

        <textarea
          placeholder="Soul (who you are at your core)"
          value={soul_md}
          onChange={(e) => setSoul_md(e.target.value)}
          rows={3}
          className="w-full border border-black/20 rounded-lg px-4 py-2.5 text-sm bg-white resize-none"
        />
        <textarea
          placeholder="Life story (your current situation, upbringing, etc.)"
          value={life_md}
          onChange={(e) => setLife_md(e.target.value)}
          rows={4}
          className="w-full border border-black/20 rounded-lg px-4 py-2.5 text-sm bg-white resize-none"
        />

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href="/"
            className="flex-1 border border-black/20 rounded-lg px-4 py-2.5 text-sm text-center"
          >
            Back
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-black text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Creating..." : "Enter World"}
          </button>
        </div>
      </form>
    </main>
  );
}
