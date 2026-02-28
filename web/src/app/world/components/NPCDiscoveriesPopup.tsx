"use client";

import useWorldStorage from "@/store/WorldStorage";

export default function NPCDiscoveriesPopup() {
  const showDiscoveriesPopup = useWorldStorage((s) => s.showDiscoveriesPopup);
  const setShowDiscoveriesPopup = useWorldStorage((s) => s.setShowDiscoveriesPopup);
  const npcs = useWorldStorage((s) => s.npcs);
  const openProfile = useWorldStorage((s) => s.openProfile);
  const triggerFocusCoordinates = useWorldStorage((s) => s.triggerFocusCoordinates);

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
