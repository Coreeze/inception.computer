"use client";

import { useState } from "react";
import { generateBeingImage } from "@/lib/api/world";
import useWorldStorage from "@/store/WorldStorage";
import useSimulationStorage from "@/store/SimulationStorage";
import formatCurrency from "@/lib/formatCurrency";

export default function ProfileDialog() {
  const showProfileDialog = useWorldStorage((s) => s.showProfileDialog);
  const profileCharacter = useWorldStorage((s) => s.profileCharacter);
  const closeProfile = useWorldStorage((s) => s.closeProfile);
  const openChatDialog = useWorldStorage((s) => s.openChatDialog);
  const character = useWorldStorage((s) => s.character);
  const updateBeingImage = useWorldStorage((s) => s.updateBeingImage);
  const sandbox = useSimulationStorage((s) => s.sandbox);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  if (!showProfileDialog || !profileCharacter) return null;

  const c = profileCharacter;
  const isPlayer = c.is_main;

  const handleGenerateImage = async () => {
    if (!character?._id || !c._id || c.image_url || isGeneratingImage) return;
    setImageError(null);
    setIsGeneratingImage(true);
    try {
      const data = await generateBeingImage(character._id, c._id);
      if (data?.imageUrl) {
        updateBeingImage(c._id, data.imageUrl);
      } else {
        setImageError("Image generation failed");
      }
    } catch (error: unknown) {
      setImageError(error instanceof Error ? error.message : "Image generation failed");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeProfile}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-black/10 bg-[#f9f7f3] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Character profile"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-[#f9f7f3] px-4 py-3">
          <h2 className="font-mono text-base font-semibold">
            {c.first_name} {c.last_name}
            {isPlayer && (
              <span className="ml-2 text-xs font-normal text-black/50">(You)</span>
            )}
          </h2>
          <button
            onClick={closeProfile}
            className="rounded-full px-2 py-1 text-sm text-black/60"
          >
            Close
          </button>
        </div>
        <div className="space-y-4 p-4 font-mono text-sm">
          <div className="mx-auto w-full max-w-[280px]">
            {c.image_url ? (
              <img
                src={c.image_url}
                alt={`${c.first_name || "Character"} ${c.last_name || ""}`.trim()}
                className="aspect-9/16 w-full rounded-xl border border-black/10 object-cover"
              />
            ) : (
              <div className="space-y-2">
                <div className="relative aspect-9/16 w-full rounded-xl border border-black/10 bg-white/50">
                  <div className="flex h-full w-full flex-col items-center justify-center text-black/40">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      className="h-12 w-12"
                    >
                      <circle cx="12" cy="8" r="3.25" />
                      <path d="M5.5 19c1.7-3 4.1-4.5 6.5-4.5s4.8 1.5 6.5 4.5" />
                      <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" />
                    </svg>
                    <span className="mt-2 text-xs text-black/50">No profile image</span>
                  </div>
                  <button
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage || !character?._id}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded border border-black/20 bg-[#f9f7f3] px-2 py-1 text-[10px] disabled:opacity-40"
                  >
                    {isGeneratingImage ? "Generating..." : "Generate"}
                  </button>
                </div>
                {imageError && <p className="text-xs text-red-700">{imageError}</p>}
              </div>
            )}
          </div>

          {!isPlayer && (
            <button
              onClick={() => openChatDialog({ npcID: c._id })}
              className="rounded-lg border border-black/20 px-3 py-1.5 text-xs"
            >
              Chat with {c.first_name || "NPC"}
            </button>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            {c.occupation && (
              <div>
                <span className="text-black/50">Occupation</span>
                <p>{c.occupation}</p>
              </div>
            )}
            {!isPlayer && (
              <div>
                <span className="text-black/50">Relationship</span>
                <p>{c.relationship_to_main_character || "stranger"}</p>
              </div>
            )}
            {c.health_index != null && (
              <div>
                <span className="text-black/50">health_index</span>
                <p>{c.health_index}</p>
              </div>
            )}
            {c.vibe_index != null && (
              <div>
                <span className="text-black/50">vibe_index</span>
                <p>{c.vibe_index}</p>
              </div>
            )}
            {c.wealth_index != null && (
              <div>
                <span className="text-black/50">wealth</span>
                <p>
                  {formatCurrency(c.wealth_index)}
                  {sandbox?.currency ? ` ${sandbox.currency}` : ""}
                </p>
              </div>
            )}
            {c.monthly_expenses != null && (
              <div>
                <span className="text-black/50">Monthly expenses</span>
                <p>
                  {formatCurrency(c.monthly_expenses)}
                  {sandbox?.currency ? ` ${sandbox.currency}` : ""}
                </p>
              </div>
            )}
            {sandbox?.currency && (
              <div>
                <span className="text-black/50">Currency</span>
                <p>{sandbox.currency}</p>
              </div>
            )}
            {c.life_mission && (
              <div>
                <span className="text-black/50">Life mission</span>
                <p>{c.life_mission.name} ({c.life_mission.progress})</p>
              </div>
            )}
          </div>

          <div>
            <span className="text-black/50 text-xs">Home</span>
            <p>
              {c.home_city}, {c.home_country}
            </p>
            <p className="text-[11px] text-black/40">
              {c.home_longitude?.toFixed(4)}, {c.home_latitude?.toFixed(4)}
            </p>
          </div>

          {c.current_action && (
            <div>
              <span className="text-black/50 text-xs">Current action</span>
              <p>{c.current_action}</p>
              {c.current_place && (
                <p className="text-[11px] text-black/40">at {c.current_place}</p>
              )}
            </div>
          )}

          {c.soul_md && (
            <div>
              <span className="text-black/50 text-xs">Soul</span>
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-white/60 p-3 text-xs">
                {c.soul_md}
              </div>
            </div>
          )}

          {c.life_md && (
            <div>
              <span className="text-black/50 text-xs">Life</span>
              <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/60 p-3 text-xs">
                {c.life_md}
              </div>
            </div>
          )}

          {c.description && (
            <div>
              <span className="text-black/50 text-xs">Description</span>
              <p className="mt-1">{c.description}</p>
            </div>
          )}

          {!isPlayer && (
            <div>
              <span className="text-black/50 text-xs">Discovered places</span>
              {c.discovered_places && c.discovered_places.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {c.discovered_places.map((p, i) => (
                    <li key={i} className="rounded-lg bg-white/60 px-2 py-1 text-xs">
                      <strong>{p.name}</strong>
                      {p.description && <span className="text-black/60"> — {p.description}</span>}
                      {p.latitude != null && p.longitude != null && (
                        <span className="block text-black/40">
                          {p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-black/40">None yet</p>
              )}
            </div>
          )}

          {!isPlayer && (
            <div>
              <span className="text-black/50 text-xs">Discovered people</span>
              {c.discovered_people && c.discovered_people.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {c.discovered_people.map((p, i) => (
                    <li key={i} className="rounded-lg bg-white/60 px-2 py-1 text-xs">
                      <strong>{p.first_name} {p.last_name || ""}</strong>
                      {p.occupation && <span className="text-black/60"> — {p.occupation}</span>}
                      {p.description && <span className="block text-black/50">{p.description}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-black/40">None yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
