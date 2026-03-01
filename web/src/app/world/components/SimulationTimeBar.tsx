"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postHeartbeat, doStuffSuggest, doStuffSelect } from "@/lib/api/simulation";
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
  const applyCharacterAction = useWorldStorage((s) => s.applyCharacterAction);

  const [doStuffLoading, setDoStuffLoading] = useState(false);
  const [doStuffOptions, setDoStuffOptions] = useState<{ option_a: any; option_b: any } | null>(null);
  const [doStuffSelecting, setDoStuffSelecting] = useState(false);

  const handleDoStuff = async () => {
    if (!character?._id || doStuffLoading) return;
    setDoStuffLoading(true);
    setDoStuffOptions(null);
    try {
      const res = await doStuffSuggest(character._id);
      if (res?.suggestions) {
        setDoStuffOptions(res.suggestions);
      }
    } catch (e) {
      console.error("Do stuff suggest failed:", e);
    } finally {
      setDoStuffLoading(false);
    }
  };

  const handleSelectDoStuff = async (option: any) => {
    if (!character?._id || doStuffSelecting) return;
    setDoStuffSelecting(true);
    try {
      const res = await doStuffSelect(character._id, option);
      if (res?.characterAction) {
        applyCharacterAction(res.characterAction);
      }
      setDoStuffOptions(null);
    } catch (e) {
      console.error("Do stuff select failed:", e);
    } finally {
      setDoStuffSelecting(false);
    }
  };

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
      {doStuffOptions && (
        <div className="w-full rounded-2xl border border-black/10 bg-white/95 px-3.5 py-3 backdrop-blur-md shadow-lg">
          <p className="text-[10px] uppercase tracking-widest text-black/30 mb-2.5">do stuff</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleSelectDoStuff(doStuffOptions.option_a)}
              disabled={doStuffSelecting}
              className="flex-1 rounded-xl border border-black/8 bg-black/[0.03] px-3 py-2.5 text-left disabled:opacity-40"
            >
              <p className="text-[13px] font-medium text-black/85 leading-tight">{doStuffOptions.option_a.action}</p>
              <p className="text-[10px] text-black/35 mt-1 leading-tight">{doStuffOptions.option_a.reason}</p>
            </button>
            <button
              onClick={() => handleSelectDoStuff(doStuffOptions.option_b)}
              disabled={doStuffSelecting}
              className="flex-1 rounded-xl border border-black/8 bg-black/[0.03] px-3 py-2.5 text-left disabled:opacity-40"
            >
              <p className="text-[13px] font-medium text-black/85 leading-tight">{doStuffOptions.option_b.action}</p>
              <p className="text-[10px] text-black/35 mt-1 leading-tight">{doStuffOptions.option_b.reason}</p>
            </button>
          </div>
          <button
            onClick={() => setDoStuffOptions(null)}
            className="mt-2 w-full text-center text-[10px] text-black/25"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="w-full rounded-2xl border border-black/10 bg-white/85 backdrop-blur-md overflow-hidden shadow-sm">
        {character?.current_action && (
          <div className="px-3.5 pt-2.5 pb-2 border-b border-black/5">
            <p className="text-[13px] font-medium text-black/80 leading-tight">{character.current_action}</p>
            {character.current_place && (
              <p className="text-[10px] text-black/35 mt-0.5">{character.current_place}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 px-3.5 py-2 border-b border-black/5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-0.5">
              <span className="text-[9px] font-medium uppercase tracking-wide text-black/30">{s.label}</span>
              <span className={`text-[12px] font-semibold tabular-nums ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        <div className="px-3.5 pt-2 pb-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] tabular-nums text-black/50">{dateDisplay}</span>
            {showControls && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleDoStuff}
                  disabled={!isPlaying || doStuffLoading}
                  className="rounded-full border border-black/8 bg-black/[0.03] px-2.5 py-1 text-[11px] font-medium text-black/50 disabled:opacity-25"
                >
                  {doStuffLoading ? "..." : "do stuff"}
                </button>
                <div className="flex items-center rounded-full border border-black/8 bg-black/[0.03] p-0.5">
                  <button
                    onClick={() => handleModeChange("paused")}
                    disabled={!isPlaying}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      !isPlaying
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-black/35"
                    }`}
                  >
                    Pause
                  </button>
                  <button
                    onClick={() => handleModeChange("normal")}
                    disabled={isPlaying}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      isPlaying
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-black/35"
                    }`}
                  >
                    Play
                  </button>
                </div>
              </div>
            )}
            <span className="text-[11px] tabular-nums text-black/50">{sandbox.current_year}</span>
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-black/20 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
