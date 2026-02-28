"use client";

import useWorldStorage from "@/store/WorldStorage";
import formatCurrency from "@/lib/formatCurrency";

export default function ProfileDialog() {
  const showProfileDialog = useWorldStorage((s) => s.showProfileDialog);
  const profileCharacter = useWorldStorage((s) => s.profileCharacter);
  const closeProfile = useWorldStorage((s) => s.closeProfile);

  if (!showProfileDialog || !profileCharacter) return null;

  const c = profileCharacter;
  const isPlayer = c.is_main;

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
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-black/50">Occupation</span>
              <p>{c.occupation || "—"}</p>
            </div>
            <div>
              <span className="text-black/50">Relationship</span>
              <p>{c.relationship_to_main_character || "stranger"}</p>
            </div>
            <div>
              <span className="text-black/50">Health</span>
              <p>{c.health_index ?? "—"}</p>
            </div>
            <div>
              <span className="text-black/50">Vibe</span>
              <p>{c.vibe_index ?? "—"}</p>
            </div>
            <div>
              <span className="text-black/50">Wealth</span>
              <p>{c.wealth_index != null ? formatCurrency(c.wealth_index) : "—"}</p>
            </div>
            {c.life_mission && (
              <div>
                <span className="text-black/50">Mission</span>
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
