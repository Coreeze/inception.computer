"use client";

import useWorldStorage from "@/store/WorldStorage";

export default function PeoplePopup() {
  const showPeoplePopup = useWorldStorage((s) => s.showPeoplePopup);
  const setShowPeoplePopup = useWorldStorage((s) => s.setShowPeoplePopup);
  const character = useWorldStorage((s) => s.character);
  const npcs = useWorldStorage((s) => s.npcs);
  const triggerFocusCoordinates = useWorldStorage((s) => s.triggerFocusCoordinates);
  const openProfile = useWorldStorage((s) => s.openProfile);

  if (!showPeoplePopup) return null;

  const handleLocate = (lon: number, lat: number) => {
    triggerFocusCoordinates(lon, lat);
    setShowPeoplePopup(false);
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setShowPeoplePopup(false)}
    >
      <div
        className="mx-4 max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-black/10 bg-[#f9f7f3] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="People list"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <h2 className="font-mono text-sm font-semibold">People</h2>
          <button
            onClick={() => setShowPeoplePopup(false)}
            className="rounded-full px-2 py-1 text-xs text-black/60"
          >
            Close
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {character && (
            <div className="mb-2 rounded-xl border border-red-200/50 bg-red-50/30 px-3 py-2">
              <div className="font-mono text-sm font-medium">
                {character.first_name} {character.last_name}
              </div>
              <div className="text-[11px] text-black/50">You</div>
              {character.current_action && (
                <div className="mt-1 text-[11px] text-black/60">
                  {character.current_action}
                </div>
              )}
            </div>
          )}
          {npcs.map((npc) => (
            <div
              key={npc._id}
              className="mb-2 rounded-xl border border-black/10 bg-white px-3 py-2"
            >
              <div className="font-mono text-sm font-medium">
                {npc.first_name} {npc.last_name}
              </div>
              <div className="text-[11px] text-black/50">
                {npc.occupation || "Unknown"}
              </div>
              {npc.current_action && (
                <div className="mt-1 text-[11px] text-black/60">
                  {npc.current_action}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => openProfile(npc)}
                  className="rounded border border-black/20 px-2 py-1 text-[10px]"
                >
                  View profile
                </button>
                {npc.current_longitude != null && npc.current_latitude != null && (
                  <button
                    onClick={() =>
                      handleLocate(npc.current_longitude!, npc.current_latitude!)
                    }
                    className="rounded border border-black/20 px-2 py-1 text-[10px]"
                  >
                    Locate on map
                  </button>
                )}
              </div>
            </div>
          ))}
          {(!npcs || npcs.length === 0) && !character?.is_dead && (
            <p className="py-4 text-center text-xs text-black/50">
              No other people yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
