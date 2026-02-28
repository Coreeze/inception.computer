"use client";
import { create } from "zustand";
import { TimeMode } from "@/types/definitions";

export type RuntimeState = "playing" | "paused";

interface SimulationState {
  sandbox: any;
  setSandbox: (sandbox: any) => void;
  updateSandbox: (patch: Record<string, any>) => void;

  timeMode: TimeMode;
  setTimeMode: (mode: TimeMode) => void;
  runtimeStatus: { runtimeState: RuntimeState };
  setRuntimeStatus: (status: { runtimeState: RuntimeState }) => void;

  isLoadingSession: boolean;
  setIsLoadingSession: (loading: boolean) => void;

  lastStatChanges: {
    health: number;
    vibe: number;
    wealth: number;
  } | null;
  setLastStatChanges: (
    changes: { health: number; vibe: number; wealth: number } | null
  ) => void;

  dayStartedAt: number | null;
  setDayStartedAt: (t: number | null) => void;

  resetSimulation: () => void;
}

const useSimulationStorage = create<SimulationState>()((set) => ({
  sandbox: null,
  setSandbox: (sandbox) => set({ sandbox }),
  updateSandbox: (patch) =>
    set((state) => ({
      sandbox: state.sandbox ? { ...state.sandbox, ...patch } : patch,
    })),

  timeMode: "normal",
  setTimeMode: (mode) => set({ timeMode: mode }),
  runtimeStatus: { runtimeState: "paused" },
  setRuntimeStatus: (status) =>
    set({
      runtimeStatus: status,
      timeMode: status.runtimeState === "playing" ? "normal" : "paused",
    }),

  isLoadingSession: false,
  setIsLoadingSession: (loading) => set({ isLoadingSession: loading }),

  lastStatChanges: null,
  setLastStatChanges: (changes) => set({ lastStatChanges: changes }),

  dayStartedAt: null,
  setDayStartedAt: (t) => set({ dayStartedAt: t }),

  resetSimulation: () =>
    set({
      timeMode: "normal",
      runtimeStatus: { runtimeState: "paused" },
      lastStatChanges: null,
      dayStartedAt: null,
    }),
}));

export default useSimulationStorage;
