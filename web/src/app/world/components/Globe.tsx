"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import useWorldStorage from "@/store/WorldStorage";
import useSimulationStorage from "@/store/SimulationStorage";
import { setCharacterID } from "@/lib/api/index";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function Globe() {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const characterMarker = useRef<mapboxgl.Marker | null>(null);
  const npcMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const discoveryMarkers = useRef<mapboxgl.Marker[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const character = useWorldStorage((s) => s.character);
  const triggerFocusCoordinates = useWorldStorage((s) => s.triggerFocusCoordinates);
  const npcs = useWorldStorage((s) => s.npcs);
  const is3DView = useWorldStorage((s) => s.is3DView);
  const focusCharacterTrigger = useWorldStorage((s) => s.focusCharacterTrigger);
  const focusLongitude = useWorldStorage((s) => s.focusLongitude);
  const focusLatitude = useWorldStorage((s) => s.focusLatitude);
  const focusCoordinatesTrigger = useWorldStorage((s) => s.focusCoordinatesTrigger);
  const setShowPeoplePopup = useWorldStorage((s) => s.setShowPeoplePopup);
  const setShowDiscoveriesPopup = useWorldStorage((s) => s.setShowDiscoveriesPopup);
  const showDiscoveriesOnMap = useWorldStorage((s) => s.showDiscoveriesOnMap);
  const setShowDiscoveriesOnMap = useWorldStorage((s) => s.setShowDiscoveriesOnMap);
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
        background: #ff1a1a; border: 3px solid #f9f7f3;
        box-shadow: 0 0 20px rgba(255,26,26,0.5);
        display: flex; align-items: center; justify-content: center;
        color: #1a1714; font-weight: bold; font-size: 16px;
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
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        `;
        const bubble = document.createElement("div");
        bubble.style.cssText = `
          width: 100%; height: 100%; border-radius: 50%;
          background: #1a1714; border: 2px solid #d1cbc3;
          display: flex; align-items: center; justify-content: center;
          color: #d1cbc3; font-size: 12px; font-weight: 600;
          font-family: 'IBM Plex Mono', monospace;
          will-change: transform;
        `;
        bubble.textContent = (npc.first_name?.[0] || "?").toUpperCase();
        el.appendChild(bubble);

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!prefersReducedMotion) {
          const hash = npc._id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          const driftX = 0.8 + (hash % 7) * 0.5;
          const driftY = 0.8 + ((hash >> 2) % 7) * 0.5;
          const duration = 1800 + (hash % 1500);
          const delay = -(hash % duration);
          bubble.animate(
            [
              { transform: "translate(0px, 0px)" },
              { transform: `translate(${driftX}px, ${-driftY}px)` },
              { transform: `translate(${-driftX * 0.8}px, ${driftY}px)` },
              { transform: "translate(0px, 0px)" },
            ],
            { duration, delay, iterations: Infinity, easing: "ease-in-out" }
          );
        }

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([npc.current_longitude, npc.current_latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #1a1714;">
                <strong>${(npc.first_name || "") + " " + (npc.last_name || "")}</strong><br/>
                <span style="color: #7a756d;">${npc.current_action || "idle"}</span>
                <button data-open-profile data-npc-id="${
                  npc._id
                }" style="display:block;margin-top:8px;padding:4px 8px;border:1px solid #d1cbc3;border-radius:6px;background:#f9f7f3;cursor:pointer;font-size:11px;font-family:inherit;">
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
    if (!map.current || !mapLoaded) return;

    discoveryMarkers.current.forEach((m) => m.remove());
    discoveryMarkers.current = [];

    if (showDiscoveriesOnMap) {
      const seenPlaces = new Set<string>();
      const seenPeople = new Set<string>();

      const hashString = (value: string) => {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
          hash = (hash << 5) - hash + value.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash);
      };

      for (const npc of npcs) {
        if (npc.discovered_places) {
          for (const p of npc.discovered_places) {
            if (p.latitude == null || p.longitude == null) continue;
            const key = `${p.longitude.toFixed(4)}_${p.latitude.toFixed(4)}_${p.name}`;
            if (seenPlaces.has(key)) continue;
            seenPlaces.add(key);

            const el = document.createElement("div");
            el.style.cssText = `
              min-width: 22px; height: 22px; border-radius: 6px;
              background: #2563eb; border: 1px solid #f9f7f3;
              display: flex; align-items: center; justify-content: center;
              color: #1a1714; font-size: 10px; font-weight: 600;
              font-family: 'IBM Plex Mono', monospace; cursor: pointer;
              padding: 0 5px;
            `;
            el.textContent = "[P]";

            const marker = new mapboxgl.Marker({ element: el })
              .setLngLat([p.longitude, p.latitude])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(`
                  <div style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #1a1714;">
                    <strong>${p.name}</strong><br/>
                    ${p.description ? `<span style="color: #7a756d;">${p.description}</span><br/>` : ""}
                    <span style="color: #7a756d; font-size: 10px;">Discovered by ${npc.first_name} ${npc.last_name}</span>
                  </div>
                `)
              )
              .addTo(map.current!);

            discoveryMarkers.current.push(marker);
          }
        }

        if (npc.discovered_people && npc.current_longitude != null && npc.current_latitude != null) {
          for (const person of npc.discovered_people) {
            const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
            if (!fullName) continue;
            const key = `${npc._id}_${fullName.toLowerCase()}`;
            if (seenPeople.has(key)) continue;
            seenPeople.add(key);

            const seed = hashString(`${npc._id}_${fullName}`);
            const lonOffset = ((seed % 17) - 8) * 0.003;
            const latOffset = ((((seed >> 4) % 17) - 8) * 0.003) / 2;

            const el = document.createElement("div");
            el.style.cssText = `
              min-width: 22px; height: 22px; border-radius: 6px;
              background: #dc2626; border: 1px solid #f9f7f3;
              display: flex; align-items: center; justify-content: center;
              color: #1a1714; font-size: 10px; font-weight: 600;
              font-family: 'IBM Plex Mono', monospace; cursor: pointer;
              padding: 0 5px;
            `;
            el.textContent = "[@]";

            const marker = new mapboxgl.Marker({ element: el })
              .setLngLat([npc.current_longitude + lonOffset, npc.current_latitude + latOffset])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(`
                  <div style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #1a1714;">
                    <strong>${fullName}</strong><br/>
                    ${person.occupation ? `<span style="color: #7a756d;">${person.occupation}</span><br/>` : ""}
                    ${person.description ? `<span style="color: #7a756d;">${person.description}</span><br/>` : ""}
                    <span style="color: #7a756d; font-size: 10px;">Discovered by ${npc.first_name} ${npc.last_name}</span>
                  </div>
                `)
              )
              .addTo(map.current!);

            discoveryMarkers.current.push(marker);
          }
        }
      }
    }
  }, [npcs, mapLoaded, showDiscoveriesOnMap]);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  const goHome = () => {
    if (character?.home_longitude != null && character?.home_latitude != null) {
      triggerFocusCoordinates(character.home_longitude, character.home_latitude);
    }
    setMenuOpen(false);
  };

  const exitSession = () => {
    setCharacterID(null);
    router.push("/create-world");
    setMenuOpen(false);
  };

  return (
    <>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Status bar + People */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between gap-2">
        <div className="bg-[#f9f7f3]/90 backdrop-blur-sm border border-[#d1cbc3] px-4 py-2 font-mono text-xs text-[#1a1714]">
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowPeoplePopup(true)}
            className="rounded-lg border border-[#d1cbc3] bg-[#f9f7f3]/90 px-3 py-1.5 font-mono text-xs text-[#1a1714] backdrop-blur-sm"
          >
            AI People ({npcs.length + (character ? 1 : 0)})
          </button>
          <button
            onClick={() => setShowDiscoveriesPopup(true)}
            className="rounded-lg border border-[#d1cbc3] bg-[#f9f7f3]/90 px-3 py-1.5 font-mono text-xs text-[#1a1714] backdrop-blur-sm"
          >
            Discoveries
          </button>
          <button
            onClick={() => setShowDiscoveriesOnMap(!showDiscoveriesOnMap)}
            className={`rounded-lg border px-3 py-1.5 font-mono text-xs backdrop-blur-sm ${
              showDiscoveriesOnMap ? "border-[#2563eb] bg-[#2563eb]/20 text-[#2563eb]" : "border-[#d1cbc3] bg-[#f9f7f3]/90 text-[#1a1714]"
            }`}
          >
            On map
          </button>
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg border border-[#d1cbc3] bg-[#f9f7f3]/90 px-3 py-1.5 font-mono text-xs text-[#1a1714] backdrop-blur-sm"
            >
              Menu
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 min-w-[140px] rounded-lg border border-[#d1cbc3] bg-[#f9f7f3] py-1 font-mono text-xs text-[#1a1714] shadow-lg z-50">
                <button
                  onClick={goHome}
                  disabled={character?.home_longitude == null || character?.home_latitude == null}
                  className="block w-full px-4 py-2 text-left disabled:opacity-50"
                >
                  Go home
                </button>
                <button onClick={exitSession} className="block w-full px-4 py-2 text-left">
                  Exit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
