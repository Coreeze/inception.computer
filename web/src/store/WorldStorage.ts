"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { IBeing, IPlannedAction, MapPlace } from "@/types/definitions";

interface ChatDialogData {
  npcID?: string;
  placeID?: string;
}

interface WorldState {
  character: IBeing | null;
  setCharacter: (character: IBeing) => void;

  npcs: IBeing[];
  setNpcs: (npcs: IBeing[]) => void;

  focusCharacterTrigger: number;
  triggerFocusCharacter: () => void;

  focusLongitude: number | null;
  focusLatitude: number | null;
  focusCoordinatesTrigger: number;
  triggerFocusCoordinates: (longitude: number, latitude: number) => void;

  showPeoplePopup: boolean;
  setShowPeoplePopup: (show: boolean) => void;

  showProfileDialog: boolean;
  profileCharacter: IBeing | null;
  openProfile: (character: IBeing) => void;
  closeProfile: () => void;
  showDoAnythingPopup: boolean;
  setShowDoAnythingPopup: (show: boolean) => void;
  showPlacesPopup: boolean;
  setShowPlacesPopup: (show: boolean) => void;
  showHistoryPopup: boolean;
  setShowHistoryPopup: (show: boolean) => void;
  showCalendarPopup: boolean;
  setShowCalendarPopup: (show: boolean) => void;
  showEntitiesPopup: boolean;
  setShowEntitiesPopup: (show: boolean) => void;
  showDiscoveriesPopup: boolean;
  setShowDiscoveriesPopup: (show: boolean) => void;
  showDiscoveriesOnMap: boolean;
  setShowDiscoveriesOnMap: (show: boolean) => void;

  showChatDialog: boolean;
  chatDialogData: ChatDialogData | null;
  openChatDialog: (data: ChatDialogData) => void;
  closeChatDialog: () => void;

  cameraFollowsCharacter: boolean;
  setCameraFollowsCharacter: (follow: boolean) => void;
  is3DView: boolean;
  setIs3DView: (is3D: boolean) => void;

  pinnedStats: string[];
  setPinnedStats: (stats: string[]) => void;

  updateNPCPlans: (
    npcPlans: Array<{ npcId: string; ai_action_queue: IPlannedAction[] }>
  ) => void;
  applyNPCUpdates: (
    updates: Array<{
      npcId: string;
      current_action?: string;
      current_longitude?: number;
      current_latitude?: number;
      current_place?: string;
      current_city?: string;
      current_country?: string;
      discovered_places?: { name: string; description?: string; latitude?: number; longitude?: number }[];
      discovered_people?: { first_name: string; last_name?: string; description?: string; occupation?: string }[];
      wealth_index?: number;
    }>
  ) => void;
  applyQueueUpdate: (playerQueue: IPlannedAction[]) => void;
  applyCharacterAction: (action: {
    current_action?: string;
    current_longitude?: number;
    current_latitude?: number;
    current_place?: string;
    current_city?: string;
    current_country?: string;
    player_action_queue: IPlannedAction[];
  }) => void;

  mapPlaces: MapPlace[];
  setMapPlaces: (places: MapPlace[]) => void;
  addMapPlace: (place: MapPlace) => void;
}

const useWorldStorage = create<WorldState>()(
  persist(
    (set) => ({
      character: null,
      setCharacter: (character) => set({ character }),

      npcs: [],
      setNpcs: (npcs) => set({ npcs }),

      focusCharacterTrigger: 0,
      triggerFocusCharacter: () =>
        set((s) => ({ focusCharacterTrigger: s.focusCharacterTrigger + 1 })),

      focusLongitude: null,
      focusLatitude: null,
      focusCoordinatesTrigger: 0,
      triggerFocusCoordinates: (longitude, latitude) =>
        set((s) => ({
          focusLongitude: longitude,
          focusLatitude: latitude,
          focusCoordinatesTrigger: s.focusCoordinatesTrigger + 1,
        })),

      showPeoplePopup: false,
      setShowPeoplePopup: (show) => set({ showPeoplePopup: show }),

      showProfileDialog: false,
      profileCharacter: null,
      openProfile: (character) =>
        set({ showProfileDialog: true, profileCharacter: character }),
      closeProfile: () =>
        set({ showProfileDialog: false, profileCharacter: null }),
      showDoAnythingPopup: false,
      setShowDoAnythingPopup: (show) => set({ showDoAnythingPopup: show }),
      showPlacesPopup: false,
      setShowPlacesPopup: (show) => set({ showPlacesPopup: show }),
      showHistoryPopup: false,
      setShowHistoryPopup: (show) => set({ showHistoryPopup: show }),
      showCalendarPopup: false,
      setShowCalendarPopup: (show) => set({ showCalendarPopup: show }),
      showEntitiesPopup: false,
      setShowEntitiesPopup: (show) => set({ showEntitiesPopup: show }),
      showDiscoveriesPopup: false,
      setShowDiscoveriesPopup: (show) => set({ showDiscoveriesPopup: show }),
      showDiscoveriesOnMap: false,
      setShowDiscoveriesOnMap: (show) => set({ showDiscoveriesOnMap: show }),

      showChatDialog: false,
      chatDialogData: null,
      openChatDialog: (data) =>
        set({ showChatDialog: true, chatDialogData: data }),
      closeChatDialog: () =>
        set({ showChatDialog: false, chatDialogData: null }),

      cameraFollowsCharacter: false,
      setCameraFollowsCharacter: (follow) =>
        set({ cameraFollowsCharacter: follow }),
      is3DView: false,
      setIs3DView: (is3D) => set({ is3DView: is3D }),

      pinnedStats: ["health", "vibe"],
      setPinnedStats: (stats) => set({ pinnedStats: stats }),

      updateNPCPlans: (npcPlans) =>
        set((state) => ({
          npcs: state.npcs.map((npc) => {
            const plan = npcPlans.find((p) => p.npcId === npc._id);
            return plan
              ? { ...npc, ai_action_queue: plan.ai_action_queue }
              : npc;
          }),
        })),

      applyNPCUpdates: (updates) =>
        set((state) => ({
          npcs: state.npcs.map((npc) => {
            const u = updates.find((u) => u.npcId === npc._id);
            return u
              ? {
                  ...npc,
                  current_action: u.current_action,
                  current_longitude:
                    u.current_longitude ?? npc.current_longitude,
                  current_latitude:
                    u.current_latitude ?? npc.current_latitude,
                  current_place: u.current_place,
                  current_city: u.current_city,
                  current_country: u.current_country,
                  discovered_places: u.discovered_places ?? npc.discovered_places,
                  discovered_people: u.discovered_people ?? npc.discovered_people,
                  wealth_index: u.wealth_index ?? npc.wealth_index,
                }
              : npc;
          }),
        })),

      applyQueueUpdate: (playerQueue) =>
        set((state) => {
          if (!state.character) return {};
          return {
            character: { ...state.character, player_action_queue: playerQueue },
          };
        }),

      applyCharacterAction: (action) =>
        set((state) => {
          if (!state.character) return {};
          return {
            character: {
              ...state.character,
              current_action: action.current_action,
              current_longitude:
                action.current_longitude ?? state.character.current_longitude,
              current_latitude:
                action.current_latitude ?? state.character.current_latitude,
              current_place: action.current_place,
              current_city: action.current_city,
              current_country: action.current_country,
              player_action_queue: action.player_action_queue,
            },
          };
        }),

      mapPlaces: [],
      setMapPlaces: (places) => set({ mapPlaces: places }),
      addMapPlace: (place) =>
        set((state) => ({
          mapPlaces: [
            ...state.mapPlaces.filter((p) => p._id !== place._id),
            place,
          ],
        })),
    }),
    {
      name: "inception-world-storage",
      partialize: (state) => ({
        is3DView: state.is3DView,
        pinnedStats: state.pinnedStats,
        showDiscoveriesOnMap: state.showDiscoveriesOnMap,
      }),
    }
  )
);

export default useWorldStorage;
