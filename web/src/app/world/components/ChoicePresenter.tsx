"use client";

import { useState, useRef } from "react";
import { IDailyChoice } from "@/types/definitions";
import { resolveChoice } from "@/lib/api/simulation";
import useWorldStorage from "@/store/WorldStorage";
import useSimulationStorage from "@/store/SimulationStorage";
import formatCurrency from "@/lib/formatCurrency";

interface Signal {
  type: string;
  payload: Record<string, any>;
  priority: number;
}

interface ChoicePresenterProps {
  choices: {
    situation?: string;
    option_a: IDailyChoice;
    option_b: IDailyChoice;
  };
  signals: Signal[];
  heartbeatId: string;
  onPause: () => Promise<void>;
  onResolved: () => Promise<void> | void;
  onDismiss: () => void;
}

type Phase = "notification" | "choosing" | "outcome";

export default function ChoicePresenter({
  choices,
  signals,
  onPause,
  onResolved,
  onDismiss,
}: ChoicePresenterProps) {
  const [phase, setPhase] = useState<Phase>("notification");
  const [expandedOption, setExpandedOption] = useState<"a" | "b" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [impactResult, setImpactResult] = useState<any>(null);
  const statsBeforeRef = useRef<{ health: number; vibe: number; wealth: number; mission: number } | null>(null);
  const hasPausedRef = useRef(false);

  const character = useWorldStorage((s) => s.character);
  const setCharacter = useWorldStorage((s) => s.setCharacter);
  const sandbox = useSimulationStorage((s) => s.sandbox);

  const handleExpand = async () => {
    setPhase("choosing");
    await onPause();
    hasPausedRef.current = true;
  };

  const handleChoice = async (
    choice: "option_a" | "option_b" | "ignore" | { freeform: string }
  ) => {
    if (!character?._id) return;
    setIsSubmitting(true);
    statsBeforeRef.current = {
      health: character.health_index ?? 0,
      vibe: character.vibe_index ?? 0,
      wealth: character.wealth_index ?? 0,
      mission: character.life_mission?.progress ?? 0,
    };

    try {
      const result = await resolveChoice(character._id, choice);

      if (result.stats) {
        setCharacter({
          ...character,
          health_index: result.stats.health,
          vibe_index: result.stats.vibe,
          wealth_index: result.stats.money,
          life_mission: character.life_mission
            ? { ...character.life_mission, progress: result.stats.life_mission }
            : undefined,
        });
      }

      if (choice === "ignore") {
        if (hasPausedRef.current) await onResolved();
        setIsSubmitting(false);
        onDismiss();
        return;
      }

      if (choice === "option_a" || choice === "option_b") {
        result.outcome = {
          health_impact: choices[choice].health_impact,
          vibe_impact: choices[choice].vibe_impact,
          wealth_impact: choices[choice].wealth_impact,
          life_mission_impact: choices[choice].life_mission_impact,
        };
      }

      if (hasPausedRef.current) await onResolved();
      setImpactResult(result);
      setPhase("outcome");
    } catch (err) {
      console.error("Resolve choice failed:", err);
      if (hasPausedRef.current) await onResolved();
      onDismiss();
    }
    setIsSubmitting(false);
  };

  return (
    <div className="w-full rounded-2xl border border-black/10 bg-white/90 p-4 shadow-lg backdrop-blur">
      {phase === "notification" && (
        <div className="relative">
          <div onClick={handleExpand} className="cursor-pointer pr-16">
            {signals.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {signals.map((s, i) => (
                  <span key={i} className="rounded-full border border-amber-300/60 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700">
                    {s.type.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm font-medium text-gray-900">
              {choices.situation || "A crossroads awaits..."}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">Tap to decide</p>
          </div>
          <button
            onClick={() => handleChoice("ignore")}
            className="absolute right-0 top-0 rounded-full bg-red-500 px-2 py-1 text-xs text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {phase === "choosing" && (
        <div>
          <p className="mb-3 text-xs text-gray-500">{choices.situation}</p>
          <div className="space-y-2">
            <button
              onClick={() => handleChoice("option_a")}
              disabled={isSubmitting}
              className="block w-full rounded-xl border border-gray-200 bg-white p-3 text-left text-sm disabled:opacity-50"
            >
              {choices.option_a.action}
              <div className="mt-1 flex gap-2 text-[11px] text-gray-500">
                {choices.option_a.wealth_impact !== 0 && (
                  <span>${formatCurrency(choices.option_a.wealth_impact)}</span>
                )}
                {choices.option_a.health_impact !== 0 && (
                  <span>H{choices.option_a.health_impact > 0 ? "+" : ""}{choices.option_a.health_impact}</span>
                )}
                {choices.option_a.vibe_impact !== 0 && (
                  <span>V{choices.option_a.vibe_impact > 0 ? "+" : ""}{choices.option_a.vibe_impact}</span>
                )}
              </div>
            </button>
            <button
              onClick={() => handleChoice("option_b")}
              disabled={isSubmitting}
              className="block w-full rounded-xl border border-gray-200 bg-white p-3 text-left text-sm disabled:opacity-50"
            >
              {choices.option_b.action}
              <div className="mt-1 flex gap-2 text-[11px] text-gray-500">
                {choices.option_b.wealth_impact !== 0 && (
                  <span>${formatCurrency(choices.option_b.wealth_impact)}</span>
                )}
                {choices.option_b.health_impact !== 0 && (
                  <span>H{choices.option_b.health_impact > 0 ? "+" : ""}{choices.option_b.health_impact}</span>
                )}
                {choices.option_b.vibe_impact !== 0 && (
                  <span>V{choices.option_b.vibe_impact > 0 ? "+" : ""}{choices.option_b.vibe_impact}</span>
                )}
              </div>
            </button>
          </div>
          <button
            onClick={() => handleChoice("ignore")}
            disabled={isSubmitting}
            className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 py-2 text-xs text-red-700"
          >
            Ignore
          </button>
        </div>
      )}

      {phase === "outcome" && impactResult && (
        <div>
          <p className="text-center text-xs text-gray-500">
            {impactResult.action || "Your choice"}
          </p>
          {statsBeforeRef.current && impactResult.stats && (
            <div className="mt-4 space-y-2 text-sm">
              <div>
                Wealth: {sandbox?.currency ?? "$"}{formatCurrency(impactResult.stats.money)}
                {impactResult.stats.money !== statsBeforeRef.current.wealth && (
                  <span className="text-green-600">
                    ({impactResult.stats.money - statsBeforeRef.current.wealth > 0 ? "+" : ""}
                    {impactResult.stats.money - statsBeforeRef.current.wealth})
                  </span>
                )}
              </div>
              <div>
                Health: {impactResult.stats.health}
                {impactResult.stats.health !== statsBeforeRef.current.health && (
                  <span className="text-red-600">
                    ({impactResult.stats.health - statsBeforeRef.current.health > 0 ? "+" : ""}
                    {impactResult.stats.health - statsBeforeRef.current.health})
                  </span>
                )}
              </div>
              <div>
                Vibe: {impactResult.stats.vibe}
                {impactResult.stats.vibe !== statsBeforeRef.current.vibe && (
                  <span className="text-violet-600">
                    ({impactResult.stats.vibe - statsBeforeRef.current.vibe > 0 ? "+" : ""}
                    {impactResult.stats.vibe - statsBeforeRef.current.vibe})
                  </span>
                )}
              </div>
            </div>
          )}
          <button
            onClick={onDismiss}
            className="mt-4 w-full rounded-xl bg-black py-2.5 text-sm font-medium text-white"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
