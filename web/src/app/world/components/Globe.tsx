"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import useWorldStorage from "@/store/WorldStorage";
import useSimulationStorage from "@/store/SimulationStorage";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function Globe() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const characterMarker = useRef<mapboxgl.Marker | null>(null);
  const npcMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  const character = useWorldStorage((s) => s.character);
  const npcs = useWorldStorage((s) => s.npcs);
  const is3DView = useWorldStorage((s) => s.is3DView);
  const focusCharacterTrigger = useWorldStorage((s) => s.focusCharacterTrigger);
  const focusLongitude = useWorldStorage((s) => s.focusLongitude);
  const focusLatitude = useWorldStorage((s) => s.focusLatitude);
  const focusCoordinatesTrigger = useWorldStorage((s) => s.focusCoordinatesTrigger);
  const setShowPeoplePopup = useWorldStorage((s) => s.setShowPeoplePopup);
  const openProfile = useWorldStorage((s) => s.openProfile);
  const sandbox = useSimulationStorage((s) => s.sandbox);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest("[data-open-profile]");
      if (!btn) return;
      const id = btn.getAttribute("data-npc-id");
      if (id) {
        const npc = npcs.find((n) => n._id === id);
        if (npc) openProfile(npc);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [npcs, openProfile]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/standard",
      center: [2.3522, 48.8566],
      zoom: 12,
      projection: "globe",
      pitch: is3DView ? 45 : 0,
    });

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded || !character) return;

    if (!characterMarker.current) {
      const el = document.createElement("div");
      el.className = "character-marker";
      el.style.cssText = `
        width: 52px; height: 52px; border-radius: 50%;
        background: #ff1a1a; border: 3px solid white;
        box-shadow: 0 0 20px rgba(255,26,26,0.5);
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: bold; font-size: 16px;
        font-family: 'IBM Plex Mono', monospace;
      `;
      el.textContent = (character.first_name?.[0] || "?").toUpperCase();

      characterMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([character.current_longitude, character.current_latitude])
        .addTo(map.current);
    } else {
      characterMarker.current.setLngLat([character.current_longitude, character.current_latitude]);
    }
  }, [character, mapLoaded]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const currentNpcIds = new Set(npcs.map((n) => n._id));
    npcMarkers.current.forEach((marker, id) => {
      if (!currentNpcIds.has(id)) {
        marker.remove();
        npcMarkers.current.delete(id);
      }
    });

    for (const npc of npcs) {
      if (npc.is_episodic || !npc.current_longitude || !npc.current_latitude) continue;

      const existing = npcMarkers.current.get(npc._id);
      if (existing) {
        existing.setLngLat([npc.current_longitude, npc.current_latitude]);
      } else {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 36px; height: 36px; border-radius: 50%;
          background: #1a1714; border: 2px solid #d1cbc3;
          display: flex; align-items: center; justify-content: center;
          color: #d1cbc3; font-size: 12px; font-weight: 600;
          font-family: 'IBM Plex Mono', monospace; cursor: pointer;
        `;
        el.textContent = (npc.first_name?.[0] || "?").toUpperCase();

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([npc.current_longitude, npc.current_latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="font-family: 'IBM Plex Mono', monospace; font-size: 12px;">
                <strong>${(npc.first_name || "") + " " + (npc.last_name || "")}</strong><br/>
                <span style="color: #7a756d;">${npc.current_action || "idle"}</span>
                <button data-open-profile data-npc-id="${npc._id}" style="display:block;margin-top:8px;padding:4px 8px;border:1px solid #d1cbc3;border-radius:6px;background:#f9f7f3;cursor:pointer;font-size:11px;font-family:inherit;">
                  View profile
                </button>
              </div>
            `)
          )
          .addTo(map.current!);

        npcMarkers.current.set(npc._id, marker);
      }
    }
  }, [npcs, mapLoaded]);

  useEffect(() => {
    if (!map.current || !character) return;
    map.current.flyTo({
      center: [character.current_longitude, character.current_latitude],
      zoom: 14,
      duration: 1500,
    });
  }, [focusCharacterTrigger]);

  useEffect(() => {
    if (!map.current || focusLongitude == null || focusLatitude == null) return;
    map.current.flyTo({
      center: [focusLongitude, focusLatitude],
      zoom: 15,
      duration: 1000,
    });
  }, [focusCoordinatesTrigger]);

  return (
    <>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Status bar + People */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between gap-2">
        <div className="bg-[#f9f7f3]/90 backdrop-blur-sm border border-[#d1cbc3] px-4 py-2 font-mono text-xs">
          <img src="logo-text.png" alt="inception.computer" className="w-auto h-6" />
          {sandbox && (
            <span className="ml-1.5">
              {sandbox.current_month}/{sandbox.current_day}/{sandbox.current_year}
            </span>
          )}
          {character && (
            <span className="ml-3">
              {character.first_name} {character.last_name}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowPeoplePopup(true)}
          className="rounded-lg border border-[#d1cbc3] bg-[#f9f7f3]/90 px-3 py-1.5 font-mono text-xs backdrop-blur-sm"
        >
          People ({npcs.length + (character ? 1 : 0)})
        </button>
      </div>

      {/* Stats */}
      {character && (
        <div className="absolute top-14 right-4 z-10 bg-[#f9f7f3]/90 backdrop-blur-sm border border-[#d1cbc3] px-4 py-2 font-mono text-xs space-y-1">
          <div>
            <span className="text-[#7a756d] inline-block w-16">health</span>
            <span>{character.health_index ?? 0}</span>
          </div>
          <div>
            <span className="text-[#7a756d] inline-block w-16">vibe</span>
            <span>{character.vibe_index ?? 0}</span>
          </div>
          <div>
            <span className="text-[#7a756d] inline-block w-16">wealth</span>
            <span>{character.wealth_index ?? 0}</span>
          </div>
        </div>
      )}
    </>
  );
}
