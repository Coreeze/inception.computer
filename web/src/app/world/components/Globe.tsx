"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import useWorldStorage from "@/store/WorldStorage";
import useSimulationStorage from "@/store/SimulationStorage";
import { setCharacterID } from "@/lib/api/index";
import { generateBeingImage, generateWhatsHere, travelCharacter } from "@/lib/api/world";
import { setFreeWill } from "@/lib/api/simulation";

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
  const updateBeingImage = useWorldStorage((s) => s.updateBeingImage);
  const mapPlaces = useWorldStorage((s) => s.mapPlaces);
  const sandbox = useSimulationStorage((s) => s.sandbox);
  const freeWillEnabled = useSimulationStorage((s) => s.freeWillEnabled);
  const setFreeWillEnabled = useSimulationStorage((s) => s.setFreeWillEnabled);
  const generatingImageIds = useRef<Set<string>>(new Set());

  const buildPopupAvatarHTML = (imageURL?: string, altLabel?: string, generateButtonHTML?: string) => {
    const safeAlt = altLabel || "Character";
    if (imageURL) {
      return `<img src="${imageURL}" alt="${safeAlt}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block;" />`;
    }
    return `
      <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#ebe7e0;color:#7a756d;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:38px;height:38px;opacity:0.9;">
          <circle cx="12" cy="8" r="3.25"></circle>
          <path d="M5.5 19c1.7-3 4.1-4.5 6.5-4.5s4.8 1.5 6.5 4.5"></path>
          <rect x="2.5" y="2.5" width="19" height="19" rx="3.5"></rect>
        </svg>
        <span style="margin-top:4px;font-size:10px;">No image</span>
        ${generateButtonHTML || ""}
      </div>
    `;
  };

  const buildGenerateImageButtonHTML = (beingID: string, isMain: boolean, hasImage?: string) => {
    if (hasImage) return "";
    if (isMain) {
      return `<button data-generate-main-image="1" style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);padding:4px 8px;border:1px solid #d1cbc3;border-radius:6px;background:#f9f7f3;cursor:pointer;font-size:11px;font-family:inherit;">Generate</button>`;
    }
    return `<button data-generate-image data-npc-id="${beingID}" style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);padding:4px 8px;border:1px solid #d1cbc3;border-radius:6px;background:#f9f7f3;cursor:pointer;font-size:11px;font-family:inherit;">Generate</button>`;
  };

  const createAvatarMarkerElement = (imageURL: string | undefined, borderColor: string, fallbackLabel: string) => {
    const el = document.createElement("div");
    el.style.cssText = `
      width: 42px; height: 42px; border-radius: 50%;
      overflow: hidden;
      border: 2px solid ${borderColor};
      box-shadow: 0 2px 10px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      background: #ebe7e0;
      color: #7a756d;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      z-index: 20;
    `;
    if (imageURL) {
      const img = document.createElement("img");
      img.src = imageURL;
      img.alt = fallbackLabel;
      img.style.cssText = "width:100%;height:100%;object-fit:cover;object-position:top;display:block;";
      el.appendChild(img);
    } else {
      el.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="width:24px;height:24px;opacity:0.9;">
          <circle cx="12" cy="8" r="3.25"></circle>
          <path d="M5.5 19c1.7-3 4.1-4.5 6.5-4.5s4.8 1.5 6.5 4.5"></path>
        </svg>
      `;
    }
    return el;
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const generateMainBtn = (e.target as HTMLElement).closest("[data-generate-main-image]");
      if (generateMainBtn && character?._id && !character.image_url && !generatingImageIds.current.has(character._id)) {
        generatingImageIds.current.add(character._id);
        generateBeingImage(character._id, character._id)
          .then((data) => {
            if (data?.imageUrl) updateBeingImage(character._id, data.imageUrl);
          })
          .finally(() => {
            generatingImageIds.current.delete(character._id);
          });
        return;
      }

      const generateNpcBtn = (e.target as HTMLElement).closest("[data-generate-image]");
      if (generateNpcBtn && character?._id) {
        const npcId = generateNpcBtn.getAttribute("data-npc-id");
        if (npcId && !generatingImageIds.current.has(npcId)) {
          generatingImageIds.current.add(npcId);
          generateBeingImage(character._id, npcId)
            .then((data) => {
              if (data?.imageUrl) updateBeingImage(npcId, data.imageUrl);
            })
            .finally(() => {
              generatingImageIds.current.delete(npcId);
            });
        }
        return;
      }

      const mainBtn = (e.target as HTMLElement).closest("[data-open-main-profile]");
      if (mainBtn && character) {
        openProfile(character);
        return;
      }
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
  }, [character, npcs, openProfile, updateBeingImage]);

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
          toMeaningfulText(props.class) || toMeaningfulText(props.type) || toMeaningfulText(props.maki) || toMeaningfulText(props.category);
        return category ? `${name} (${category})` : name;
      }
      return null;
    };

    const onMapClick = (e: mapboxgl.MapMouseEvent) => {
      const clickTarget = e.originalEvent.target;
      const clickedMarkerOrPopup = clickTarget instanceof Element ? clickTarget.closest(".mapboxgl-marker, .mapboxgl-popup") : null;
      if (clickedMarkerOrPopup) {
        clearClickedSelection();
        return;
      }

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
            z-index: 10;
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

    const characterPopup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #1a1714;">
        <div style="width:126px;height:224px;border-radius:8px;overflow:hidden;border:1px solid #d1cbc3;margin-bottom:8px;">
          ${buildPopupAvatarHTML(
            character.image_url,
            `${character.first_name || ""} ${character.last_name || ""}`.trim(),
            buildGenerateImageButtonHTML(character._id, true, character.image_url)
          )}
        </div>
        <span style="color: #7a756d;">${character.occupation || "Unknown occupation"}</span><br/>
        <strong>${(character.first_name || "") + " " + (character.last_name || "")}</strong><br/>
        <span style="color: #7a756d;">${character.current_action || "idle"}</span>
        <button data-open-main-profile style="display:block;margin-top:8px;padding:4px 8px;border:1px solid #d1cbc3;border-radius:6px;background:#f9f7f3;cursor:pointer;font-size:11px;font-family:inherit;">
          View profile
        </button>
      </div>
    `);

    if (!characterMarker.current) {
      const el = createAvatarMarkerElement(
        character.image_url,
        "#ff1a1a",
        `${character.first_name || "Character"} ${character.last_name || ""}`.trim()
      );
      el.className = "character-marker";

      characterMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([character.current_longitude, character.current_latitude])
        .setPopup(characterPopup)
        .addTo(map.current);
    } else {
      const markerEl = characterMarker.current.getElement();
      markerEl.innerHTML = "";
      const updated = createAvatarMarkerElement(
        character.image_url,
        "#ff1a1a",
        `${character.first_name || "Character"} ${character.last_name || ""}`.trim()
      );
      markerEl.style.cssText = updated.style.cssText;
      markerEl.className = "character-marker";
      markerEl.innerHTML = updated.innerHTML;
      characterMarker.current.setLngLat([character.current_longitude, character.current_latitude]);
      characterMarker.current.setPopup(characterPopup);
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
        const markerEl = existing.getElement();
        markerEl.innerHTML = "";
        const updated = createAvatarMarkerElement(npc.image_url, "#d1cbc3", `${npc.first_name || "NPC"} ${npc.last_name || ""}`.trim());
        markerEl.style.cssText = updated.style.cssText;
        markerEl.innerHTML = updated.innerHTML;
        existing.setLngLat([npc.current_longitude, npc.current_latitude]);
        existing.setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #1a1714;">
                <div style="width:126px;height:224px;border-radius:8px;overflow:hidden;border:1px solid #d1cbc3;margin-bottom:8px;">
                  ${buildPopupAvatarHTML(
                    npc.image_url,
                    `${npc.first_name || ""} ${npc.last_name || ""}`.trim(),
                    buildGenerateImageButtonHTML(npc._id, false, npc.image_url)
                  )}
                </div>
                <span style="color: #7a756d;">${npc.occupation || "Unknown occupation"}</span><br/>
                <strong>${(npc.first_name || "") + " " + (npc.last_name || "")}</strong><br/>
                <span style="color: #7a756d;">${npc.current_action || "idle"}</span>
                <button data-open-profile data-npc-id="${
                  npc._id
                }" style="display:block;margin-top:8px;padding:4px 8px;border:1px solid #d1cbc3;border-radius:6px;background:#f9f7f3;cursor:pointer;font-size:11px;font-family:inherit;">
                  View profile
                </button>
              </div>
            `)
        );
      } else {
        const el = createAvatarMarkerElement(npc.image_url, "#d1cbc3", `${npc.first_name || "NPC"} ${npc.last_name || ""}`.trim());

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([npc.current_longitude, npc.current_latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #1a1714;">
                <div style="width:126px;height:224px;border-radius:8px;overflow:hidden;border:1px solid #d1cbc3;margin-bottom:8px;">
                  ${buildPopupAvatarHTML(
                    npc.image_url,
                    `${npc.first_name || ""} ${npc.last_name || ""}`.trim(),
                    buildGenerateImageButtonHTML(npc._id, false, npc.image_url)
                  )}
                </div>
                <span style="color: #7a756d;">${npc.occupation || "Unknown occupation"}</span><br/>
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

      const discoverySources = [
        ...(character ? [{ ...character, _discoverer: `${character.first_name} ${character.last_name}` }] : []),
        ...npcs.map((n) => ({ ...n, _discoverer: `${n.first_name || ""} ${n.last_name || ""}`.trim() })),
      ];

      for (const npc of discoverySources) {
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
              z-index: 5;
            `;
            el.textContent = "[P]";

            const marker = new mapboxgl.Marker({ element: el })
              .setLngLat([p.longitude, p.latitude])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(`
                  <div style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #1a1714;">
                    <strong>${p.name}</strong><br/>
                    ${p.description ? `<span style="color: #7a756d;">${p.description}</span><br/>` : ""}
                    <span style="color: #7a756d; font-size: 10px;">Discovered by ${(npc as any)._discoverer || "Unknown"}</span>
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
              z-index: 5;
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
                    <span style="color: #7a756d; font-size: 10px;">Discovered by ${(npc as any)._discoverer || "Unknown"}</span>
                  </div>
                `)
              )
              .addTo(map.current!);

            discoveryMarkers.current.push(marker);
          }
        }
      }
    }
  }, [npcs, character, mapLoaded, showDiscoveriesOnMap]);

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

  const toggleFreeWill = async () => {
    if (!character?._id) return;
    const next = !freeWillEnabled;
    setFreeWillEnabled(next);
    try {
      await setFreeWill(character._id, next);
    } catch {
      setFreeWillEnabled(!next);
    }
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
    const x = Math.min(Math.max(projected.x + offsetX, margin), Math.max(margin, viewportWidth - panelWidth - margin));
    const y = Math.min(Math.max(projected.y + offsetY, margin), Math.max(margin, viewportHeight - panelHeight - margin));
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

    generateWhatsHere(character._id, requestLocation.longitude, requestLocation.latitude, quickSummary, lastMapboxSummary || undefined)
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
      <style jsx global>{`
        .mapboxgl-popup {
          z-index: 60 !important;
        }
      `}</style>
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
                <label className="flex w-full items-center gap-2 px-4 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={freeWillEnabled}
                    onChange={toggleFreeWill}
                    className="accent-[#1a1714]"
                  />
                  free will
                </label>
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
            <button onClick={showWhatsHere} className="flex-1 rounded-lg border border-[#d1cbc3] bg-[#fffefc] px-3 py-2 text-xs text-[#1a1714]">
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
