"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import useWorldStorage from "@/store/WorldStorage";
import useSimulationStorage from "@/store/SimulationStorage";
import { setCharacterID } from "@/lib/api/index";
import { generateWhatsHere, travelCharacter } from "@/lib/api/world";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function Globe() {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const whatsHereRequestId = useRef(0);
  const map = useRef<mapboxgl.Map | null>(null);
  const characterMarker = useRef<mapboxgl.Marker | null>(null);
  const clickedLocationMarker = useRef<mapboxgl.Marker | null>(null);
  const npcMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const discoveryMarkers = useRef<mapboxgl.Marker[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clickedLocation, setClickedLocation] = useState<{ longitude: number; latitude: number } | null>(null);
  const [clickedPoint, setClickedPoint] = useState<{ x: number; y: number } | null>(null);
  const [locationInfo, setLocationInfo] = useState<string | null>(null);
  const [locationInfoLLM, setLocationInfoLLM] = useState<string | null>(null);
  const [isTraveling, setIsTraveling] = useState(false);
  const [isGeneratingWhatsHere, setIsGeneratingWhatsHere] = useState(false);
  const [lastMapboxSummary, setLastMapboxSummary] = useState<string | null>(null);
  const [autoGenerateWhatsHere, setAutoGenerateWhatsHere] = useState(false);

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
  const setCharacter = useWorldStorage((s) => s.setCharacter);
  const mapPlaces = useWorldStorage((s) => s.mapPlaces);
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

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/standard",
      center: [2.3522, 48.8566],
      zoom: 12,
      projection: "globe",
      pitch: is3DView ? 45 : 0,
    });
    map.current = mapInstance;

    const toMeaningfulText = (value: unknown): string | null => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };

    const extractMapboxSummary = (features: mapboxgl.MapboxGeoJSONFeature[]): string | null => {
      for (const feature of features) {
        const props = (feature.properties || {}) as Record<string, unknown>;
        const name =
          toMeaningfulText(props.name_en) ||
          toMeaningfulText(props.name) ||
          toMeaningfulText(props["name:en"]) ||
          toMeaningfulText(props.place_name) ||
          toMeaningfulText(props.text);
        if (!name) continue;
        const category =
          toMeaningfulText(props.class) ||
          toMeaningfulText(props.type) ||
          toMeaningfulText(props.maki) ||
          toMeaningfulText(props.category);
        return category ? `${name} (${category})` : name;
      }
      return null;
    };

    const onMapClick = (e: mapboxgl.MapMouseEvent) => {
      const renderedFeatures = map.current?.queryRenderedFeatures(e.point) || [];
      const mapboxSummary = extractMapboxSummary(renderedFeatures);
      whatsHereRequestId.current += 1;
      setClickedLocation({ longitude: e.lngLat.lng, latitude: e.lngLat.lat });
      updatePopupPointFromCoordinates(e.lngLat.lng, e.lngLat.lat);
      setLocationInfo(null);
      setLocationInfoLLM(null);
      setIsGeneratingWhatsHere(false);
      setLastMapboxSummary(mapboxSummary);
      setAutoGenerateWhatsHere(!!mapboxSummary);

      if (map.current) {
        if (!clickedLocationMarker.current) {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 20px; height: 20px;
            background: #ff3b30;
            border: 2px solid #f9f7f3;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 10px rgba(0,0,0,0.25);
            position: relative;
          `;
          const centerDot = document.createElement("div");
          centerDot.style.cssText = `
            width: 6px; height: 6px; border-radius: 50%;
            background: #f9f7f3;
            position: absolute;
            left: 50%; top: 50%;
            transform: translate(-50%, -50%);
          `;
          el.appendChild(centerDot);
          clickedLocationMarker.current = new mapboxgl.Marker({ element: el });
        }
        clickedLocationMarker.current.setLngLat([e.lngLat.lng, e.lngLat.lat]).addTo(map.current);
      }
    };

    const onMapMove = (e: mapboxgl.MapMouseEvent) => {
      const renderedFeatures = map.current?.queryRenderedFeatures(e.point) || [];
      mapInstance.getCanvas().style.cursor = extractMapboxSummary(renderedFeatures) ? "crosshair" : "";
    };

    mapInstance.on("click", onMapClick);
    mapInstance.on("mousemove", onMapMove);
    mapInstance.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      clickedLocationMarker.current?.remove();
      clickedLocationMarker.current = null;
      mapInstance.off("click", onMapClick);
      mapInstance.off("mousemove", onMapMove);
      mapInstance.getCanvas().style.cursor = "";
      mapInstance.remove();
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

  const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const clearClickedSelection = () => {
    whatsHereRequestId.current += 1;
    setClickedLocation(null);
    setClickedPoint(null);
    setLocationInfo(null);
    setLocationInfoLLM(null);
    setIsGeneratingWhatsHere(false);
    setLastMapboxSummary(null);
    setAutoGenerateWhatsHere(false);
    clickedLocationMarker.current?.remove();
    clickedLocationMarker.current = null;
  };

  const updatePopupPointFromCoordinates = (longitude: number, latitude: number) => {
    if (!map.current || !mapContainer.current) return;
    const projected = map.current.project([longitude, latitude]);
    const panelWidth = 340;
    const panelHeight = 250;
    const margin = 12;
    const offsetX = 14;
    const offsetY = -26;
    const viewportWidth = mapContainer.current.clientWidth;
    const viewportHeight = mapContainer.current.clientHeight;
    const x = Math.min(
      Math.max(projected.x + offsetX, margin),
      Math.max(margin, viewportWidth - panelWidth - margin)
    );
    const y = Math.min(
      Math.max(projected.y + offsetY, margin),
      Math.max(margin, viewportHeight - panelHeight - margin)
    );
    setClickedPoint({ x, y });
  };

  const showWhatsHere = () => {
    if (!clickedLocation) return;

    const nearbyNpcs = npcs.filter((npc) => {
      if (npc.current_longitude == null || npc.current_latitude == null) return false;
      return distanceKm(clickedLocation.latitude, clickedLocation.longitude, npc.current_latitude, npc.current_longitude) <= 2;
    }).length;

    let nearestPlace: { name: string; distance: number } | null = null;
    for (const place of mapPlaces) {
      const d = distanceKm(clickedLocation.latitude, clickedLocation.longitude, place.latitude, place.longitude);
      if (!nearestPlace || d < nearestPlace.distance) {
        nearestPlace = { name: place.name, distance: d };
      }
    }

    const placeDescription =
      nearestPlace && nearestPlace.distance <= 15
        ? `Nearest known place: ${nearestPlace.name} (${nearestPlace.distance.toFixed(1)} km)`
        : "No known place nearby";

    const mapboxLine = lastMapboxSummary ? `Mapbox: ${lastMapboxSummary}. ` : "";
    const quickSummary = `${mapboxLine}${placeDescription}. Nearby NPCs (2 km): ${nearbyNpcs}.`;
    setLocationInfo(quickSummary);
    setLocationInfoLLM(null);

    if (!character?._id) return;

    const requestId = ++whatsHereRequestId.current;
    const requestLocation = { ...clickedLocation };
    setIsGeneratingWhatsHere(true);

    generateWhatsHere(
      character._id,
      requestLocation.longitude,
      requestLocation.latitude,
      quickSummary,
      lastMapboxSummary || undefined
    )
      .then((result) => {
        if (whatsHereRequestId.current !== requestId) return;
        setLocationInfoLLM(result.description || null);
      })
      .catch((error: unknown) => {
        if (whatsHereRequestId.current !== requestId) return;
        const message =
          error instanceof Error && error.message ? `Generated context unavailable: ${error.message}` : "Generated context unavailable.";
        setLocationInfoLLM(message);
      })
      .finally(() => {
        if (whatsHereRequestId.current === requestId) {
          setIsGeneratingWhatsHere(false);
        }
      });
  };

  const travelHere = async () => {
    if (!clickedLocation || !character?._id || isTraveling) return;
    setIsTraveling(true);
    setLocationInfo(null);
    try {
      await travelCharacter(character._id, clickedLocation.longitude, clickedLocation.latitude);
      setCharacter({
        ...character,
        previous_longitude: character.current_longitude,
        previous_latitude: character.current_latitude,
        current_longitude: clickedLocation.longitude,
        current_latitude: clickedLocation.latitude,
        current_place: undefined,
        current_city: undefined,
        current_country: undefined,
        current_action: "traveling",
      });
      triggerFocusCoordinates(clickedLocation.longitude, clickedLocation.latitude);
      clearClickedSelection();
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : "Travel failed";
      setLocationInfo(message);
    } finally {
      setIsTraveling(false);
    }
  };

  useEffect(() => {
    if (!autoGenerateWhatsHere || !clickedLocation) return;
    showWhatsHere();
    setAutoGenerateWhatsHere(false);
  }, [autoGenerateWhatsHere, clickedLocation, showWhatsHere]);

  useEffect(() => {
    if (!map.current || !clickedLocation) return;

    const syncPopupPoint = () => {
      updatePopupPointFromCoordinates(clickedLocation.longitude, clickedLocation.latitude);
    };

    syncPopupPoint();
    map.current.on("move", syncPopupPoint);
    map.current.on("resize", syncPopupPoint);

    return () => {
      map.current?.off("move", syncPopupPoint);
      map.current?.off("resize", syncPopupPoint);
    };
  }, [clickedLocation]);

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

      {clickedLocation && clickedPoint && (
        <div
          className="pointer-events-auto absolute z-20 w-[340px] max-w-[92vw] rounded-xl border border-[#d1cbc3] bg-[#f9f7f3]/95 p-3 font-mono text-xs text-[#1a1714] backdrop-blur-sm shadow-xl"
          style={{ left: `${clickedPoint.x}px`, top: `${clickedPoint.y}px` }}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-[#7a756d]">Selected location</p>
              {lastMapboxSummary && (
                <p className="mt-1 truncate rounded border border-[#d1cbc3] bg-[#fffefc] px-1.5 py-0.5 text-[10px] text-[#5f5a53]">
                  {lastMapboxSummary}
                </p>
              )}
              <p className="mt-1 text-[11px] text-[#5f5a53]">
                {clickedLocation.latitude.toFixed(4)}, {clickedLocation.longitude.toFixed(4)}
              </p>
            </div>
            <button
              onClick={clearClickedSelection}
              className="rounded border border-[#d1cbc3] bg-[#f9f7f3] px-1.5 py-0.5 text-[10px] leading-none text-[#1a1714]"
              aria-label="Close"
            >
              x
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={showWhatsHere}
              className="flex-1 rounded-lg border border-[#d1cbc3] bg-[#fffefc] px-3 py-2 text-xs text-[#1a1714]"
            >
              whats here
            </button>
            <button
              onClick={travelHere}
              disabled={!character?._id || isTraveling}
              className="flex-1 rounded-lg border border-[#b91c1c] bg-[#dc2626] px-3 py-2 text-xs text-[#fffefc] disabled:opacity-50"
            >
              {isTraveling ? "traveling..." : "travel here"}
            </button>
          </div>
          {locationInfo && (
            <div className="mt-3 rounded border border-[#d1cbc3] bg-[#fffefc] px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-[#7a756d]">Quick read</p>
              <p className="mt-1 text-[11px] text-[#5f5a53]">{locationInfo}</p>
            </div>
          )}
          {isGeneratingWhatsHere && <p className="mt-2 text-[11px] text-[#7a756d]">Generating details...</p>}
          {locationInfoLLM && (
            <div className="mt-2 rounded border border-[#d1cbc3] bg-[#fffefc] px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-[#7a756d]">Context</p>
              <p className="mt-1 text-[11px] text-[#5f5a53]">{locationInfoLLM}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
