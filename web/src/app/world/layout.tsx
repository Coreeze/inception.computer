"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { connectSocket } from "@/lib/socketService";
import { getPlayerID, getCharacterID, isCharacterDeadError } from "@/lib/api/index";
import { postHeartbeat } from "@/lib/api/simulation";
import { loadCharacterWorld } from "@/lib/api/world";
import useWorldStorage from "@/store/WorldStorage";
import useSimulationStorage from "@/store/SimulationStorage";
import ChoicePresenter from "./components/ChoicePresenter";
import SimulationTimeBar from "./components/SimulationTimeBar";
import PeoplePopup from "./components/PeoplePopup";
import ProfileDialog from "./components/ProfileDialog";
import NPCDiscoveriesPopup from "./components/NPCDiscoveriesPopup";
import ChatDialog from "./components/ChatDialog";

export default function WorldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const character = useWorldStorage((s) => s.character);
  const setCharacter = useWorldStorage((s) => s.setCharacter);
  const setNpcs = useWorldStorage((s) => s.setNpcs);
  const setMapPlaces = useWorldStorage((s) => s.setMapPlaces);
  const updateSandbox = useSimulationStorage((s) => s.updateSandbox);
  const setSandbox = useSimulationStorage((s) => s.setSandbox);
  const setRuntimeStatus = useSimulationStorage((s) => s.setRuntimeStatus);
  const setIsLoadingSession = useSimulationStorage((s) => s.setIsLoadingSession);
  const setDayStartedAt = useSimulationStorage((s) => s.setDayStartedAt);

  const [queuedChoices, setQueuedChoices] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (!getCharacterID()) router.replace("/create-world");
  }, [router]);

  useEffect(() => {
    const characterID = getCharacterID();
    if (!characterID) return;

    setIsLoadingSession(true);
    loadCharacterWorld(characterID)
      .then((data: any) => {
        setCharacter(data.character);
        setNpcs(data.npcs || []);
        setMapPlaces(data.places || []);
        setSandbox(data.sandbox);
        if (data.sandbox?.free_will_enabled != null) {
          useSimulationStorage.getState().setFreeWillEnabled(data.sandbox.free_will_enabled);
        }
      })
      .catch((err) => console.error("Load world failed:", err))
      .finally(() => setIsLoadingSession(false));
  }, [setCharacter, setNpcs, setMapPlaces, setSandbox, setIsLoadingSession]);

  useEffect(() => {
    const playerID = getPlayerID();
    if (!playerID) return;

    const socket = connectSocket(playerID);
    if (!socket) return;

    const handleChoicesReady = (data: any) => {
      const curr = useWorldStorage.getState().character;
      if (data?.characterId !== curr?._id) return;
      setQueuedChoices(data);
    };

    const handleHeartbeatUpdate = (data: any) => {
      if (data?.date) {
        updateSandbox({
          current_year: data.date.year,
          current_month: data.date.month,
          current_day: data.date.day,
        });
        setDayStartedAt(Date.now());
      }
      const current = useWorldStorage.getState().character;
      if (current) {
        const ca = data?.characterAction;
        setCharacter({
          ...current,
          ...(data.stats
            ? {
                health_index: data.stats.health,
                vibe_index: data.stats.vibe,
                wealth_index: data.stats.money,
                life_mission: current.life_mission
                  ? { ...current.life_mission, progress: data.stats.life_mission }
                  : undefined,
              }
            : {}),
          ...(ca
            ? {
                current_action: ca.current_action,
                current_longitude: ca.current_longitude ?? current.current_longitude,
                current_latitude: ca.current_latitude ?? current.current_latitude,
                current_place: ca.current_place,
                current_city: ca.current_city,
                current_country: ca.current_country,
                player_action_queue: ca.player_action_queue,
                image_url: ca.image_url || current.image_url,
              }
            : {}),
        });
      }
      if (data?.npcUpdates) {
        useWorldStorage.getState().applyNPCUpdates(data.npcUpdates);
      }
      if (data?.newNpcs?.length) {
        useWorldStorage.getState().addNpcs(data.newNpcs);
      }
      if (data?.newPlaces?.length) {
        useWorldStorage.getState().addMapPlaces(data.newPlaces);
      }
    };

    const handleRuntimeStatus = (data: any) => {
      const curr = useWorldStorage.getState().character;
      if (data?.characterId !== curr?._id) return;
      setRuntimeStatus({
        runtimeState: data.runtimeState === "playing" ? "playing" : "paused",
      });
    };

    const handleSessionReplaced = () => {
      setQueuedChoices(null);
      setRuntimeStatus({ runtimeState: "paused" });
    };

    const handleCharacterDied = (data: { characterId?: string; deathReason?: string }) => {
      const curr = useWorldStorage.getState().character;
      if (!curr || data?.characterId !== curr._id) return;
      setCharacter({ ...curr, is_dead: true, death_reason: data.deathReason });
      setRuntimeStatus({ runtimeState: "paused" });
      setQueuedChoices(null);
    };

    socket.on("choices_ready", handleChoicesReady);
    socket.on("character_died", handleCharacterDied);
    socket.on("heartbeat_update", handleHeartbeatUpdate);
    socket.on("runtime_status", handleRuntimeStatus);
    socket.on("session_replaced", handleSessionReplaced);

    return () => {
      socket.off("choices_ready", handleChoicesReady);
      socket.off("heartbeat_update", handleHeartbeatUpdate);
      socket.off("runtime_status", handleRuntimeStatus);
      socket.off("session_replaced", handleSessionReplaced);
      socket.off("character_died", handleCharacterDied);
    };
  }, [setCharacter, updateSandbox, setRuntimeStatus, setDayStartedAt]);

  const handleHeartbeatError = (e: unknown) => {
    if (isCharacterDeadError(e)) {
      setCharacter({ ...character!, is_dead: true });
      setRuntimeStatus({ runtimeState: "paused" });
      return;
    }
    console.error("Heartbeat failed:", e);
  };

  const pauseSimulation = async () => {
    if (!character?._id) return;
    try {
      await postHeartbeat(character._id, "pause");
    } catch (e) {
      handleHeartbeatError(e);
    }
  };

  const resumeAfterChoice = async () => {
    if (!character?._id) return;
    try {
      await postHeartbeat(character._id, "play");
    } catch (e) {
      handleHeartbeatError(e);
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {children}
      <PeoplePopup />
      <ProfileDialog />
      <NPCDiscoveriesPopup />
      <ChatDialog />

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex w-full flex-col items-center gap-2 px-2 pb-4 md:max-w-[450px] md:left-1/2 md:-translate-x-1/2 md:px-0">
        {queuedChoices && (
          <div className="pointer-events-auto w-full">
            <ChoicePresenter
              choices={queuedChoices.choices}
              signals={queuedChoices.signals || []}
              heartbeatId={queuedChoices.heartbeatId}
              onPause={pauseSimulation}
              onResolved={resumeAfterChoice}
              onDismiss={() => setQueuedChoices(null)}
            />
          </div>
        )}
        <SimulationTimeBar showControls={!!character} />
      </div>
    </div>
  );
}
