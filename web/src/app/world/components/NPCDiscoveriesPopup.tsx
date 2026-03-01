"use client";

import { useState } from "react";
import { generatePlaceImage } from "@/lib/api/world";
import useWorldStorage from "@/store/WorldStorage";

export default function NPCDiscoveriesPopup() {
  const showDiscoveriesPopup = useWorldStorage((s) => s.showDiscoveriesPopup);
  const setShowDiscoveriesPopup = useWorldStorage((s) => s.setShowDiscoveriesPopup);
  const npcs = useWorldStorage((s) => s.npcs);
  const openProfile = useWorldStorage((s) => s.openProfile);
  const triggerFocusCoordinates = useWorldStorage((s) => s.triggerFocusCoordinates);
  const character = useWorldStorage((s) => s.character);
  const mapPlaces = useWorldStorage((s) => s.mapPlaces);
  const updatePlaceImage = useWorldStorage((s) => s.updatePlaceImage);
  const [pendingPlaceID, setPendingPlaceID] = useState<string | null>(null);
  const [placeErrorByID, setPlaceErrorByID] = useState<Record<string, string>>({});

  if (!showDiscoveriesPopup) return null;

  const npcsWithDiscoveries = npcs.filter(
    (n) =>
      (n.discovered_places && n.discovered_places.length > 0) ||
      (n.discovered_people && n.discovered_people.length > 0)
  );

  const handleLocate = (lon: number, lat: number) => {
    triggerFocusCoordinates(lon, lat);
    setShowDiscoveriesPopup(false);
  };

  const handleGeneratePlaceImage = async (placeID: string) => {
    if (!character?._id || pendingPlaceID === placeID) return;
    setPendingPlaceID(placeID);
    setPlaceErrorByID((state) => ({ ...state, [placeID]: "" }));
    try {
      const data = await generatePlaceImage(character._id, placeID);
      if (data?.imageUrl) {
        updatePlaceImage(placeID, data.imageUrl);
      } else {
        setPlaceErrorByID((state) => ({ ...state, [placeID]: "Image generation failed" }));
      }
    } catch (error: unknown) {
      setPlaceErrorByID((state) => ({
        ...state,
        [placeID]: error instanceof Error ? error.message : "Image generation failed",
      }));
    } finally {
      setPendingPlaceID(null);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setShowDiscoveriesPopup(false)}
    >
      <div
        className="mx-4 max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-black/10 bg-[#f9f7f3] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="NPC discoveries"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <h2 className="font-mono text-sm font-semibold">NPC discoveries</h2>
          <button
            onClick={() => setShowDiscoveriesPopup(false)}
            className="rounded-full px-2 py-1 text-xs text-black/60"
          >
            Close
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {mapPlaces.length > 0 && (
            <div className="mb-4 rounded-xl border border-black/10 bg-white px-3 py-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm font-medium">Known places</span>
              </div>
              <div className="space-y-2">
                {mapPlaces.map((place) => (
                  <div key={place._id} className="rounded-lg border border-black/10 bg-[#f9f7f3] p-2">
                    <div className="mb-1 text-xs">
                      <strong>{place.name}</strong>
                      {(place.city || place.country) && (
                        <span className="text-black/60"> — {[place.city, place.country].filter(Boolean).join(", ")}</span>
                      )}
                    </div>
                    {place.image_url ? (
                      <img
                        src={place.image_url}
                        alt={place.name}
                        className="h-28 w-full rounded border border-black/10 object-cover"
                      />
                    ) : (
                      <div className="space-y-1">
                        <div className="flex h-20 w-full items-center justify-center rounded border border-black/10 bg-white/60 text-[11px] text-black/50">
                          No image yet
                        </div>
                        <button
                          onClick={() => handleGeneratePlaceImage(place._id)}
                          disabled={pendingPlaceID === place._id}
                          className="rounded border border-black/20 px-2 py-1 text-[10px] disabled:opacity-40"
                        >
                          {pendingPlaceID === place._id ? "Generating image..." : "Generate image"}
                        </button>
                        {placeErrorByID[place._id] && <p className="text-[11px] text-red-700">{placeErrorByID[place._id]}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {npcsWithDiscoveries.length === 0 ? (
            <p className="py-4 text-center text-xs text-black/50">
              No discoveries yet. NPCs discover places and people as they explore.
            </p>
          ) : (
            npcsWithDiscoveries.map((npc) => (
              <div
                key={npc._id}
                className="mb-4 rounded-xl border border-black/10 bg-white px-3 py-2"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">
                    {npc.first_name} {npc.last_name}
                  </span>
                  <button
                    onClick={() => openProfile(npc)}
                    className="rounded border border-black/20 px-2 py-1 text-[10px]"
                  >
                    Profile
                  </button>
                </div>
                {npc.discovered_places && npc.discovered_places.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[10px] text-black/50">Places</span>
                    <ul className="mt-0.5 space-y-0.5">
                      {npc.discovered_places.map((p, i) => (
                        <li key={i} className="text-xs">
                          <strong>{p.name}</strong>
                          {p.description && (
                            <span className="text-black/60"> — {p.description}</span>
                          )}
                          {p.latitude != null && p.longitude != null && (
                            <button
                              onClick={() => handleLocate(p.longitude!, p.latitude!)}
                              className="ml-1 text-black/40 underline"
                            >
                              locate
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {npc.discovered_people && npc.discovered_people.length > 0 && (
                  <div>
                    <span className="text-[10px] text-black/50">People</span>
                    <ul className="mt-0.5 space-y-0.5">
                      {npc.discovered_people.map((p, i) => (
                        <li key={i} className="text-xs">
                          <strong>
                            {p.first_name} {p.last_name || ""}
                          </strong>
                          {p.occupation && (
                            <span className="text-black/60"> — {p.occupation}</span>
                          )}
                          {p.description && (
                            <span className="block text-black/50">{p.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
