"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postHeartbeat } from "@/lib/api/simulation";
import { isCharacterDeadError, setCharacterID } from "@/lib/api/index";
import useSimulationStorage from "@/store/SimulationStorage";
import useWorldStorage from "@/store/WorldStorage";

import formatCurrency from "@/lib/formatCurrency";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

interface SimulationTimeBarProps {
  showControls?: boolean;
}

export default function SimulationTimeBar({ showControls = true }: SimulationTimeBarProps) {
  const router = useRouter();
  const character = useWorldStorage((s) => s.character);
  const runtimeStatus = useSimulationStorage((s) => s.runtimeStatus);
  const sandbox = useSimulationStorage((s) => s.sandbox);
  const dayStartedAt = useSimulationStorage((s) => s.dayStartedAt);
  const [progress, setProgress] = useState(0);

  const dateDisplay = useMemo(() => {
    if (!sandbox?.current_year || !sandbox?.current_month || !sandbox?.current_day) return null;
    const d = new Date(sandbox.current_year, sandbox.current_month - 1, sandbox.current_day);
    return `${DAYS_SHORT[d.getDay()]}, ${getOrdinal(d.getDate())} ${MONTHS_SHORT[d.getMonth()]}`;
  }, [sandbox?.current_year, sandbox?.current_month, sandbox?.current_day]);

  const dayDurationMs = sandbox?.day_duration_ms ?? 2000;
  const isPlaying = runtimeStatus.runtimeState === "playing";

  useEffect(() => {
    if (!isPlaying || dayStartedAt == null) {
      setProgress(0);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - dayStartedAt;
      const p = Math.min(1, elapsed / dayDurationMs);
      setProgress(p);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [isPlaying, dayStartedAt, dayDurationMs]);

  const setCharacter = useWorldStorage((s) => s.setCharacter);
  const setRuntimeStatus = useSimulationStorage((s) => s.setRuntimeStatus);

  const handleModeChange = async (mode: "normal" | "paused") => {
    if (!character?._id) return;
    try {
      await postHeartbeat(character._id, mode === "normal" ? "play" : "pause");
    } catch (e) {
      if (isCharacterDeadError(e)) {
        setCharacter({ ...character, is_dead: true });
        setRuntimeStatus({ runtimeState: "paused" });
        return;
      }
      console.error("Heartbeat failed:", e);
    }
  };

  if (!sandbox) return null;
  if (character?.is_dead) {
    return (
      <div className="flex w-full flex-col items-center gap-2 pointer-events-auto">
        <div className="w-full rounded-2xl border border-red-200 bg-red-50/80 px-3 py-2.5 text-center">
          <p className="text-sm text-red-800">You have died.</p>
          {character.death_reason && (
            <p className="mt-1 text-xs text-red-600">{character.death_reason}</p>
          )}
          <div className="mt-3 flex justify-center gap-2 text-[11px] text-red-700">
            <span>H {character.health_index ?? 0}</span>
            <span>V {character.vibe_index ?? 0}</span>
            <span>${formatCurrency(character.wealth_index ?? 0)}</span>
            {character.life_mission && (
              <span>M {character.life_mission.progress}</span>
            )}
          </div>
          <button
            onClick={() => {
              setCharacterID(null);
              router.push("/");
            }}
            className="mt-3 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "H", value: character?.health_index ?? 0, color: "text-red-600" },
    { label: "V", value: character?.vibe_index ?? 0, color: "text-violet-600" },
    { label: "$", value: formatCurrency(character?.wealth_index ?? 0), color: "text-green-600" },
    ...(character?.life_mission
      ? [{ label: "M", value: character.life_mission.progress, color: "text-blue-600" }]
      : []),
  ];

  return (
    <div className="flex w-full flex-col items-center gap-2 pointer-events-auto">
      <div className="flex w-full gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex-1 rounded-xl border border-black/10 bg-white/80 px-2 py-1.5 text-center backdrop-blur"
          >
            <span className="text-[10px] text-black/50">{s.label}</span>
            <span className={`ml-1 text-xs font-semibold tabular-nums ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>
      <div className="relative w-full overflow-hidden rounded-2xl border border-black/10 bg-white/80 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-xs text-black/60">{dateDisplay}</span>
          {showControls && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleModeChange("paused")}
                disabled={!isPlaying}
                className="rounded-full border border-black/20 px-2 py-1 text-xs disabled:opacity-40"
              >
                Pause
              </button>
              <button
                onClick={() => handleModeChange("normal")}
                disabled={isPlaying}
                className="rounded-full border border-black/20 px-2 py-1 text-xs disabled:opacity-40"
              >
                Play
              </button>
            </div>
          )}
          <span className="text-xs text-black/60">{sandbox.current_year}</span>
        </div>
        {isPlaying && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-black/30 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
