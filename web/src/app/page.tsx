"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCharacterID } from "@/lib/api/index";
import "mapbox-gl/dist/mapbox-gl.css";
import "./landing.css";

export default function Home() {
  const router = useRouter();
  const bgRef = useRef<HTMLDivElement>(null);
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (getCharacterID()) router.replace("/world");
  }, [router]);

  useEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;
    const el = bg;
    const driftClasses = ["d1", "d2", "d3"];
    const sizes = [3, 4, 5, 6, 7, 8];

    function createCluster(cx: number, cy: number, pattern: number[][]) {
      pattern.forEach(([dx, dy, size, opacity]) => {
        const px = document.createElement("div");
        px.className = "px " + driftClasses[Math.floor(Math.random() * 3)];
        px.style.width = size + "px";
        px.style.height = size + "px";
        px.style.left = cx + dx + "px";
        px.style.top = cy + dy + "px";
        px.style.setProperty("--base-op", String(opacity));
        px.style.setProperty("--tw", (2 + Math.random() * 4).toFixed(1) + "s");
        px.style.opacity = String(opacity);
        px.style.animationDelay = (Math.random() * -6).toFixed(1) + "s";
        el.appendChild(px);
      });
    }

    const patterns = [
      [[0,0,5,0.2],[7,0,4,0.15],[14,0,3,0.1],[7,7,5,0.2],[14,7,4,0.15],[14,14,5,0.2]],
      [[0,0,4,0.15],[6,0,6,0.22],[0,8,6,0.22],[6,8,4,0.12],[12,4,3,0.1]],
      [[0,0,3,0.1],[5,3,5,0.2],[10,0,4,0.15],[0,8,4,0.15],[5,11,3,0.1],[10,8,5,0.2]],
      [[0,0,6,0.18],[8,0,3,0.1],[0,8,3,0.1],[8,8,6,0.18],[4,4,4,0.14]],
      [[0,0,4,0.12],[0,6,4,0.12],[6,3,5,0.2],[12,0,3,0.08],[12,6,3,0.08]],
    ];

    const vw = window.innerWidth;
    for (let i = 0; i < 80; i++) {
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];
      createCluster(Math.random() * vw, i * 50 + Math.random() * 40, pattern);
    }

    for (let i = 0; i < 220; i++) {
      const px = document.createElement("div");
      px.className = "px " + driftClasses[Math.floor(Math.random() * 3)];
      const s = sizes[Math.floor(Math.random() * sizes.length)];
      px.style.width = s + "px";
      px.style.height = s + "px";
      px.style.left = Math.random() * 100 + "%";
      px.style.top = Math.random() * 6000 + "px";
      const op = Math.random() * 0.08 + 0.03;
      px.style.opacity = String(op);
      px.style.setProperty("--base-op", String(op));
      px.style.setProperty("--tw", (2 + Math.random() * 4).toFixed(1) + "s");
      px.style.animationDelay = (Math.random() * -6).toFixed(1) + "s";
      el.appendChild(px);
    }
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!token || !globeContainerRef.current) return;

      mapboxgl.accessToken = token;
      const globe = new mapboxgl.Map({
        container: globeContainerRef.current,
        style: "mapbox://styles/mapbox/standard",
        projection: "globe" as any,
        center: [2.3431, 48.8867],
        zoom: 3,
        pitch: 45,
        bearing: -20,
        interactive: false,
        attributionControl: false,
      });

      globe.on("style.load", () => {
        globe.setFog({
          color: "rgba(10, 10, 18, 0.7)",
          "high-color": "rgba(20, 20, 40, 0.4)",
          "horizon-blend": 0.08,
          "space-color": "#0a0a12",
          "star-intensity": 0.2,
        } as any);
        globe.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        globe.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      });

      let rotation = 0;
      let animId: number;
      function rotateGlobe() {
        rotation += 0.03;
        globe.setCenter([rotation, 20]);
        animId = requestAnimationFrame(rotateGlobe);
      }
      globe.on("load", rotateGlobe);
      mapRef.current = { globe, get animId() { return animId; } };
    });

    return () => {
      if (mapRef.current) {
        cancelAnimationFrame(mapRef.current.animId);
        mapRef.current.globe.remove();
      }
    };
  }, []);

  useEffect(() => {
    const globeEl = document.getElementById("globe-bg");
    const spaceEl = document.getElementById("space-backdrop");
    const subline = document.querySelector(".hero-subline");
    const chapNav = document.querySelector(".chapter-nav");
    const threshold = window.innerHeight * 0.4;

    const onScroll = () => {
      const past = window.scrollY > threshold;
      globeEl?.classList.toggle("faded", past);
      spaceEl?.classList.toggle("faded", past);
      subline?.classList.toggle("dark-off", past);
      chapNav?.classList.toggle("dark-off", past);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div id="space-backdrop" />
      <div id="globe-bg" ref={globeContainerRef} />
      <div className="bg-pixels" ref={bgRef} />

      <div className="landing-container">
        {/* ===== HERO ===== */}
        <section className="hero">
          <div className="pixel-logo">
            <div className="pixel-logo-mark">
              <i className="e"/><i className="e"/><i className="e"/><i className="r"/><i className="r"/><i className="q"/><i className="q"/><i className="r"/><i className="r"/><i className="e"/><i className="e"/><i className="e"/>
              <i className="e"/><i className="e"/><i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/><i className="e"/><i className="e"/>
              <i className="e"/><i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/><i className="e"/>
              <i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/>
              <i className="r"/><i className="q"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="q"/><i className="r"/>
              <i className="q"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="q"/>
              <i className="q"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="q"/>
              <i className="r"/><i className="q"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="q"/><i className="r"/>
              <i className="e"/><i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/><i className="e"/>
              <i className="e"/><i className="e"/><i className="r"/><i className="r"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="r"/><i className="r"/><i className="e"/><i className="e"/>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-text-red-2.png" alt="INCEPTION" className="hero-logo-text" />
          <p className="hero-definition" style={{ color: "#000000", backgroundColor: "red" }}>Free-will AI agent swarms — deployed in a real-world sandbox.</p>
          <p className="hero-subline" style={{ color: "#000000", backgroundColor: "red" }}>what can go wrong?</p>
          <div className="hero-author">Cris Lenta</div>
          <div className="hero-event">Mistral AI Worldwide Hackathon · February 28 – March 1, 2026</div>
          <Link href="/create-world" className="hero-start">Start</Link>
          <nav className="chapter-nav" style={{ color: "red", backgroundColor: "black" }}>
            <a href="#thesis" style={{ textDecoration: "underline" }}>The Thesis</a>
            <a href="#neuroscience" style={{ textDecoration: "underline" }}>Neuroscience</a>
            <a href="#sociology" style={{ textDecoration: "underline" }}>Sociology</a>
            <a href="#psychology" style={{ textDecoration: "underline" }}>Psychology</a>
            <a href="#emergent" style={{ textDecoration: "underline" }}>Emergent Behavior</a>
          </nav>
        </section>

        {/* ===== STACK ===== */}
        <section className="stack-bar">
          <div className="stack-row reveal">
            <div className="stack-item"><div className="stack-item-label">Intelligence</div><div className="stack-item-value">Ministral 14B</div></div>
            <div className="stack-item"><div className="stack-item-label">Inference</div><div className="stack-item-value">NVIDIA Brev H100</div></div>
            <div className="stack-item"><div className="stack-item-label">Runtime</div><div className="stack-item-value">Socket.IO</div></div>
            <div className="stack-item"><div className="stack-item-label">World</div><div className="stack-item-value">Mapbox GL</div></div>
            <div className="stack-item"><div className="stack-item-label">Vision</div><div className="stack-item-value">Fal.ai (Flux)</div></div>
            <div className="stack-item"><div className="stack-item-label">Agents</div><div className="stack-item-value">Autonomous</div></div>
          </div>
        </section>

        {/* ===== THE THESIS ===== */}
        <section id="thesis" style={{ marginTop: "2rem" }}>
          <div className="two-col">
            <div className="col-left prose">
              <section className="body-header">
                <div className="hero-overline">inception.computer</div>
                <h2 className="body-title reveal">INCEPTION</h2>
                <div className="body-phonetic reveal">/ɪnˈsɛpʃən/ — A world within a world within a... model?</div>
                <div className="hero-author">Cris Lenta</div>
              </section>

              <p className="lead reveal">Today&apos;s most powerful AI agents can think, reason, and generate — but they can&apos;t <em>live</em> independently.</p>

              <div className="tweet-card reveal">
                <div className="tweet-header">
                  <div className="tweet-author">
                    <div className="tweet-avatar">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="https://pbs.twimg.com/profile_images/2008546467615580160/57KcqsTA_400x400.jpg" alt="Elon Musk" />
                    </div>
                    <div>
                      <div className="tweet-name-row">
                        <span className="tweet-name">Elon Musk</span>
                        <svg className="tweet-verified" viewBox="0 0 22 22" fill="none">
                          <circle cx="11" cy="11" r="11" fill="#1d9bf0" />
                          <path d="M9.5 14.25L6.25 11l1.06-1.06 2.19 2.19 4.69-4.69L15.25 8.5z" fill="#fff" />
                        </svg>
                      </div>
                      <div className="tweet-handle">@elonmusk</div>
                    </div>
                  </div>
                  <a href="https://x.com/elonmusk/status/1931114060676018302" target="_blank" rel="noopener noreferrer">
                    <svg className="tweet-x-logo" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#0f1419" }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                </div>
                <div className="tweet-body">
                  If simulation theory is correct, then my theory is probably right, as boring simulations are terminated to save compute costs, which is what we do to simulations in our reality!
                </div>
                <div className="tweet-time">12:20 AM · Jun 7, 2025</div>
                <div className="tweet-stats">
                  <span><strong>357</strong> Reposts</span>
                  <span><strong>384</strong> Replies</span>
                  <span><strong>3.1K</strong> Likes</span>
                  <span><strong>663.3K</strong> Views</span>
                </div>
              </div>

              <p className="reveal">
                In 2023, Stanford&apos;s generative agents demonstrated that large language models could power believable human behavior in a simulated town <span className="cite">(Park et al., UIST 2023)</span>. Twenty-five agents formed relationships, spread gossip, and coordinated a Valentine&apos;s Day party — all from a single seeded intention. But they lived in a fictional world. &ldquo;The Café&rdquo; was an abstraction. &ldquo;The Park&rdquo; had no coordinates. <strong>The agents had no body in the real world.</strong>
              </p>

              <p className="reveal">
                The bottleneck is no longer intelligence. It&apos;s <strong>grounding</strong>. The existing simulations assume the world is fictional — preventing AI from inhabiting reality.
              </p>

              <blockquote className="reveal">
                We have built minds that can think for themselves.<br />We have not given them a world to live in.<br />
                <p className="until reveal" style={{ marginBottom: 0 }}>Until now.</p>
              </blockquote>

              <p className="reveal">
                INCEPTION is an interdisciplinary experiment at the intersection of three fields — each providing the theoretical foundation for a different layer of the architecture:
              </p>

              <p className="reveal">
                <span className="feat">Neuroscience</span> — how biological minds form memories, consolidate experience, and generate plans. The cognitive architecture maps directly to hippocampal memory systems, amygdala-mediated emotional tagging, and prefrontal executive function.
              </p>

              <p className="reveal">
                <span className="feat">Sociology</span> — how social structures emerge without central coordination. Information diffusion, relationship formation, and emergent collective behavior follow the same dynamics described by Granovetter, Durkheim, and Christakis &amp; Fowler.
              </p>

              <p className="reveal">
                <span className="feat">Psychology</span> — how identity forms through narrative and experience. The Being model implements Jungian archetypes, narrative identity theory, dual process cognition, and attachment dynamics — not as metaphors, but as database fields.
              </p>

              <p className="reveal dim">
                Every component in the system maps to established theory. This is not analogy. The architecture is isomorphic to the science.
              </p>
            </div>
            <div className="col-right">
              <div className="pixel-illustration reveal" style={{ marginTop: "1.5rem" }}>
                <div className="pixel-art pixel-city">
                  <i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="r"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/>
                  <i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="r"/><i className="e"/><i className="e"/><i className="r"/><i className="q"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="e"/>
                  <i className="e"/><i className="e"/><i className="e"/><i className="e"/><i className="r"/><i className="q"/><i className="e"/><i className="e"/><i className="q"/><i className="p"/><i className="e"/><i className="e"/><i className="e"/><i className="r"/><i className="e"/><i className="e"/>
                  <i className="e"/><i className="e"/><i className="r"/><i className="e"/><i className="q"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="r"/><i className="q"/><i className="e"/><i className="e"/>
                  <i className="e"/><i className="e"/><i className="q"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="q"/><i className="p"/><i className="e"/><i className="e"/>
                  <i className="e"/><i className="e"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/>
                  <i className="r"/><i className="e"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="r"/>
                  <i className="q"/><i className="e"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="q"/>
                  <i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/>
                  <i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/>
                  <i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/>
                  <i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/><i className="q"/>
                  <i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/><i className="r"/>
                  <i className="e"/><i className="r"/><i className="e"/><i className="r"/><i className="e"/><i className="r"/><i className="e"/><i className="r"/><i className="e"/><i className="r"/><i className="e"/><i className="r"/><i className="e"/><i className="r"/><i className="e"/><i className="r"/>
                </div>
                <div className="pixel-label">Montmartre, Paris</div>
                <div className="pixel-sublabel">48.8867°N, 2.3431°E</div>
              </div>

              <div className="compare-box reveal" style={{ marginTop: "2rem" }}>
                <div className="compare-label">Prior Art → Present</div>
                <div className="compare-item">
                  <div className="compare-name">Stanford Generative Agents (2023)</div>
                  <div className="compare-desc">fictional town, 25 agents</div>
                  <div className="compare-desc">no real geography, GPT-3.5</div>
                  <div className="compare-desc">no voice, no persistent body</div>
                  <div className="compare-desc">no theoretical grounding</div>
                </div>
                <div className="compare-arrow">↓</div>
                <div className="compare-item">
                  <div className="compare-name hl">INCEPTION (2026)</div>
                  <div className="compare-desc">real cities, real coordinates</div>
                  <div className="compare-desc">Ministral 14B on NVIDIA H100</div>
                  <div className="compare-desc">persistent text-native social simulation</div>
                  <div className="compare-desc">neuroscience · sociology · psychology</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== NEUROSCIENCE ===== */}
        <div className="sp-md" />
        <div className="two-col" id="neuroscience">
          <div className="col-left prose">
            <h2 className="section-title reveal">The Cognitive Architecture</h2>
            <div className="section-subtitle reveal">Neuroscience of Artificial Minds</div>

            <p className="reveal">
              The INCEPTION engine transforms Ministral 14B into a complete cognitive architecture — not a chatbot wrapper, not a prompt chain. Each subsystem maps to a specific neural circuit described in the literature.
            </p>

            <p className="reveal">
              <span className="feat">Memory Stream → Hippocampal Formation</span> — Every observation is stored as natural language, timestamped and scored across two axes: recency (temporal decay) and emotional weight (importance). This mirrors hippocampal memory consolidation <span className="cite">(Tulving, 1972)</span>, where episodic memories are encoded with temporal context and emotional salience determines which memories are consolidated into long-term storage. The Being&apos;s <code>soul_md</code> and <code>life_md</code> fields function as autobiographical memory — the narrative substrate from which the agent constructs its identity, mediated by the medial prefrontal cortex and hippocampal formation working in concert <span className="cite">(Moscovitch et al., 2005)</span>.
            </p>

            <p className="reveal">
              <span className="feat">Spatial Cognition → Place Cells &amp; Grid Cells</span> — Agents don&apos;t navigate abstract space. They move through real coordinates — 48.8867°N, 2.3431°E is Le Consulat in Montmartre. Their <code>discovered_places</code> array functions as a cognitive map, analogous to O&apos;Keefe and Moser&apos;s place cells and grid cells <span className="cite">(Nobel Prize in Physiology, 2014)</span>. Each discovered location is encoded with coordinates and semantic description, creating a spatial representation that mirrors the hippocampal-entorhinal spatial memory system.
            </p>

            <p className="reveal">
              <span className="feat">Emotional Tagging → Amygdala</span> — The importance scoring mechanism mirrors amygdala modulation of memory consolidation <span className="cite">(McGaugh, 2004)</span>. Emotionally significant events receive higher importance scores, making them more retrievable — exactly as the amygdala enhances hippocampal encoding of emotionally arousing experiences. The Being model stores <code>current_feeling</code> and <code>thought</code> as distinct fields — affect and cognition separated but interacting, consistent with Damasio&apos;s somatic marker hypothesis <span className="cite">(Damasio, 1994)</span>.
            </p>

            <p className="reveal">
              <span className="feat">Reflection → Default Mode Network</span> — When accumulated importance crosses a threshold, agents pause and synthesize higher-order beliefs from recent memories. These reflections become memories themselves — recursively feeding future reflections. This maps to the default mode network <span className="cite">(Raichle, 2001)</span> — the brain&apos;s self-referential processing system that activates during introspection, future planning, and theory of mind. The DMN doesn&apos;t process external stimuli; it processes the self.
            </p>

            <p className="reveal">
              <span className="feat">Planning → Prefrontal Cortex</span> — Each cycle, agents generate plans from three inputs: identity description, accumulated experience, and current reflections. Plans are recursively decomposed into sub-actions, each anchored to real coordinates and real time. This mirrors prefrontal executive function — Fuster&apos;s perception-action cycle <span className="cite">(Fuster, 1997)</span>, where the PFC integrates past experience with current goals to generate adaptive behavior.
            </p>

            <p className="reveal">
              <span className="feat">Homeostasis → Allostatic Load</span> — The heartbeat scheduler ticks at regular intervals, decaying <code>health_index</code>, <code>vibe_index</code>, and relationship scores. This is allostatic regulation <span className="cite">(McEwen, 1998)</span> — the organism&apos;s continuous effort to maintain stability through change. When indices drop below thresholds, behavior shifts. The agent doesn&apos;t need to be told it&apos;s stressed; stress emerges from accumulated load.
            </p>

            <div className="cli-box reveal"><span className="prompt">$</span> inception --city paris --agents 4 --model ministral-14b --brev-h100</div>
          </div>
          <div className="col-right">
            <div className="pixel-illustration reveal" style={{ marginTop: "3rem" }}>
              <div className="pixel-art pixel-mind">
                <i className="e"/><i className="e"/><i className="e"/><i className="r"/><i className="r"/><i className="q"/><i className="q"/><i className="r"/><i className="r"/><i className="e"/><i className="e"/><i className="e"/>
                <i className="e"/><i className="e"/><i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/><i className="e"/><i className="e"/>
                <i className="e"/><i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/><i className="e"/>
                <i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/>
                <i className="r"/><i className="q"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="q"/><i className="r"/>
                <i className="q"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="q"/>
                <i className="q"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="q"/>
                <i className="r"/><i className="q"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="q"/><i className="r"/>
                <i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="e"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/>
                <i className="e"/><i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="e"/><i className="e"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/><i className="e"/>
                <i className="e"/><i className="e"/><i className="r"/><i className="q"/><i className="p"/><i className="p"/><i className="p"/><i className="p"/><i className="q"/><i className="r"/><i className="e"/><i className="e"/>
                <i className="e"/><i className="e"/><i className="e"/><i className="r"/><i className="r"/><i className="q"/><i className="q"/><i className="r"/><i className="r"/><i className="e"/><i className="e"/><i className="e"/>
              </div>
              <div className="pixel-label">Cognitive Architecture</div>
              <div className="pixel-sublabel">perceive · remember · reflect · plan · act</div>
            </div>

            <div className="bar-chart reveal" style={{ marginTop: "1.5rem" }}>
              <div className="bc-title">Cognitive Loop Latency</div>
              <div className="bc-subtitle">Per-subsystem processing time (ms)</div>
              <div className="bc-row"><div className="bc-label">Perception</div><div className="bc-track"><div className="bc-fill" style={{ width: "4.4%" }} /></div><div className="bc-val">~50ms</div></div>
              <div className="bc-row"><div className="bc-label">Emotional tag</div><div className="bc-track"><div className="bc-fill" style={{ width: "7.1%" }} /></div><div className="bc-val">~80ms</div></div>
              <div className="bc-row"><div className="bc-label">Memory</div><div className="bc-track"><div className="bc-fill" style={{ width: "10.6%" }} /></div><div className="bc-val">~120ms</div></div>
              <div className="bc-row"><div className="bc-label">Reflection</div><div className="bc-track"><div className="bc-fill hl" style={{ width: "31%" }} /></div><div className="bc-val">~350ms</div></div>
              <div className="bc-row"><div className="bc-label">Planning</div><div className="bc-track"><div className="bc-fill hl" style={{ width: "44.2%" }} /></div><div className="bc-val">~500ms</div></div>
              <div className="bc-row"><div className="bc-label">Action</div><div className="bc-track"><div className="bc-fill" style={{ width: "2.7%" }} /></div><div className="bc-val">~30ms</div></div>
              <div className="bc-total"><span className="bc-total-label">Full cognitive cycle</span><span className="bc-total-val">~1,130ms</span></div>
              <div className="bc-note">Reflection and planning dominate — consistent with<br />PFC latencies in human cognition (Fuster, 1997)</div>
            </div>

            <div className="loop-box reveal" style={{ marginTop: "1.5rem" }}>
              <div className="lb-title">Agent Cognitive Loop</div>
              <div className="lb-flow">Perceive → Remember → Reflect → Plan → Act</div>
              <div className="lb-arrow">↻</div>
              <div className="lb-stack">
                <div><span>grounded on:</span> Mapbox GL (real coordinates)</div>
                <div><span>vision:</span> Fal.ai (Flux)</div>
                <div><span>powered by:</span> Ministral 14B on NVIDIA Brev H100</div>
                <div><span>runtime:</span> Socket.IO + MongoDB</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== SOCIOLOGY ===== */}
        <div className="sp-lg" id="sociology" />
        <div className="two-col">
          <div className="col-left prose">
            <h2 className="section-title reveal">The Social Fabric</h2>
            <div className="section-subtitle reveal">Sociology of Emergent Worlds</div>

            <p className="reveal">Beings in INCEPTION don&apos;t just exist — they form societies. No central coordinator scripts their interactions. Social structure emerges from individual behavior, exactly as described by classical sociology.</p>

            <p className="reveal">
              <span className="feat">Weak Ties → Granovetter (1973)</span> — The <code>relationship_index</code> between beings decays without contact and builds through interaction. Information diffuses not through close ties but through acquaintances — Granovetter&apos;s &ldquo;Strength of Weak Ties.&rdquo; In the simulation, gossip propagates through the network with probabilistic decay. A secret shared with a close friend reaches a stranger through a chain of declining trust scores. The same mechanism Granovetter identified in job-finding networks operates here.
            </p>

            <p className="reveal">
              <span className="feat">Emergence → Durkheim (1895)</span> — NPCs coordinate without explicit instructions. They discover places, form relationships, attend events, marry, have children — all from individual action queues generated by the planner. This is Durkheim&apos;s <em>social fact</em>: properties of the collective that cannot be reduced to individual behavior. The Valentine&apos;s Day party in the Stanford paper emerged this way. In INCEPTION, the action vocabulary is richer: <code>move</code>, <code>discover_place</code>, <code>discover_person</code>, <code>buy</code>, <code>event</code>, <code>marry</code>, <code>child_birth</code>, <code>adopt_pet</code>, <code>change_occupation</code>.
            </p>

            <p className="reveal">
              <span className="feat">Social Contagion → Christakis &amp; Fowler (2009)</span> — Behavioral patterns propagate through the network. An agent&apos;s <code>vibe_index</code> is influenced by the emotional states of connected agents. Christakis and Fowler demonstrated that happiness, obesity, and smoking spread through social networks up to three degrees of separation. The INCEPTION heartbeat system implements this: each tick processes NPC interactions that shift emotional and behavioral states across the network.
            </p>

            <p className="reveal">
              <span className="feat">Dramaturgical Theory → Goffman (1959)</span> — The Being model includes a field: <code>self_awareness</code> with two states — <code>&ldquo;unaware&rdquo;</code> and <code>&ldquo;aware&rdquo;</code>. This is Goffman&apos;s distinction between the naive social actor and the reflexive performer. An agent that becomes aware of its computational nature changes its presentation of self. The front stage / back stage distinction becomes computational.
            </p>

            <p className="reveal">
              <span className="feat">Self-Organization → Kauffman (1993)</span> — No central coordinator determines who talks to whom, who moves where, who falls in love. The heartbeat scheduler processes each being independently, but collective patterns emerge — cliques, gossip networks, rivalries, alliances. This is self-organization at the edge of chaos: complex order arising from simple local rules.
            </p>

            <blockquote className="reveal">The social axiom: <em>if nobody is watching, they keep living anyway.</em></blockquote>
          </div>
          <div className="col-right">
            <div className="density-chart reveal" style={{ marginTop: "4rem" }}>
              <div className="dc-title">Social Network Density</div>
              <div className="dc-subtitle">η = 2|E| / |V|(|V|-1) over simulated time</div>
              <div className="dc-row"><div className="dc-label">Day 1</div><div className="dc-track"><div className="dc-fill" style={{ width: "17%" }} /><div className="dc-anno">strangers</div></div><div className="dc-val">η = 0.17</div></div>
              <div className="dc-row"><div className="dc-label">Day 2</div><div className="dc-track"><div className="dc-fill" style={{ width: "28%" }} /></div><div className="dc-val">η = 0.28</div></div>
              <div className="dc-row"><div className="dc-label">Day 3</div><div className="dc-track"><div className="dc-fill" style={{ width: "39%" }} /></div><div className="dc-val">η = 0.39</div></div>
              <div className="dc-threshold">Dunbar threshold — stable weak ties</div>
              <div className="dc-row"><div className="dc-label">Day 4</div><div className="dc-track"><div className="dc-fill" style={{ width: "51%" }} /><div className="dc-anno">weak ties form</div></div><div className="dc-val">η = 0.51</div></div>
              <div className="dc-row"><div className="dc-label">Day 5</div><div className="dc-track"><div className="dc-fill" style={{ width: "58%" }} /></div><div className="dc-val">η = 0.58</div></div>
              <div className="dc-row"><div className="dc-label">Day 6</div><div className="dc-track"><div className="dc-fill" style={{ width: "67%" }} /></div><div className="dc-val">η = 0.67</div></div>
              <div className="dc-row"><div className="dc-label">Day 7</div><div className="dc-track"><div className="dc-fill hl" style={{ width: "74%" }} /><div className="dc-anno">community</div></div><div className="dc-val">η = 0.74</div></div>
              <div className="dc-note">Density 0.167 → 0.74 matches Stanford results<br />(Park et al., 2023). No agent was instructed to socialize.</div>
            </div>

            <div className="theory-card reveal" style={{ marginTop: "1.5rem" }}>
              <div className="tc-name">Strength of Weak Ties</div>
              <div className="tc-author">Mark Granovetter, 1973</div>
              <div className="tc-desc">Novel information flows through acquaintances, not close friends. Weak ties bridge otherwise disconnected clusters.</div>
              <div className="tc-field">→ relationship_index + discovered_people</div>
            </div>

            <div className="theory-card reveal">
              <div className="tc-name">Connected: Social Contagion</div>
              <div className="tc-author">Christakis &amp; Fowler, 2009</div>
              <div className="tc-desc">Behaviors and emotions spread through networks up to three degrees of separation. Influence decays exponentially with distance.</div>
              <div className="tc-field">→ vibe_index propagation via heartbeat</div>
            </div>
          </div>
        </div>

        {/* ===== PSYCHOLOGY ===== */}
        <div className="sp-lg" id="psychology" />
        <div className="two-col">
          <div className="col-left prose">
            <h2 className="section-title reveal">The Psychology of Being</h2>
            <div className="section-subtitle reveal">Identity, Shadow, and Narrative Self</div>

            <p className="reveal">The Being model does not merely simulate behavior. It implements psychological structure. Several fields in the database schema map directly to constructs from clinical and cognitive psychology — not by analogy, but by design.</p>

            <p className="reveal">
              <span className="feat">Shadow &amp; Persona → Jung (1951)</span> — The Being model contains two parallel trait arrays: <code>aura_traits</code> (public-facing characteristics) and <code>shadow_traits</code> (hidden characteristics). This is a direct implementation of Jung&apos;s persona/shadow archetype. The persona is the social mask; the shadow contains what is repressed. An agent may present warmth (aura) while harboring resentment (shadow). The tension between the two drives emergent drama — the same tension Jung identified as the engine of individuation.
            </p>

            <p className="reveal">
              <span className="feat">Narrative Identity → McAdams (2001)</span> — Each being has a <code>soul_md</code> field — a markdown document that encodes their core identity narrative. This is McAdams&apos; narrative identity theory: identity as an internalized, evolving life story. The <code>soul_md</code> is not a static prompt; it evolves as the agent accumulates experience. The <code>life_md</code> field records what has happened. Together, they form the agent&apos;s autobiographical self — who they believe they are, shaped by what they have lived.
            </p>

            <p className="reveal">
              <span className="feat">Dual Process Theory → Kahneman (2011)</span> — The architecture implements two distinct processing speeds. The heartbeat tick handles reactive responses — fast, automatic, emotionally driven (System 1). The weekly planner generates deliberate, goal-directed action sequences (System 2). The reactive system can override the plan when emotional thresholds are crossed. This is Kahneman&apos;s dual process framework: fast thinking and slow thinking, operating in parallel, sometimes in conflict.
            </p>

            <p className="reveal">
              <span className="feat">Attachment → Bowlby (1969)</span> — The <code>relationship_index</code> decays over time without contact. It builds through vulnerability — through chat interactions where agents share feelings, ask for help, or reveal secrets. This mirrors Bowlby&apos;s attachment theory: secure attachment forms through consistent, responsive interaction. Avoidant patterns emerge from neglect. The relationship decay function is the computational analog of attachment insecurity.
            </p>

            <p className="reveal">
              <span className="feat">Self-Determination → Deci &amp; Ryan (1985)</span> — Each being has a <code>life_mission</code> with a progress indicator, and an array of <code>quests</code> with steps, statuses, and completion tracking. This implements the three basic psychological needs: autonomy (the agent chooses its mission), competence (progress toward goals), and relatedness (relationships formed along the way). Beings that progress on their mission maintain higher <code>vibe_index</code>. Those who stagnate decline.
            </p>
          </div>
          <div className="col-right">
            <div className="dict-card reveal" style={{ marginTop: "4rem" }}>
              <span className="dict-word">being</span>
              <span className="dict-phonetic">/ˈbiːɪŋ/</span>
              <span className="dict-pos">noun · database schema · psychological subject</span>

              <div className="dict-def">
                <span className="dict-num">1.</span>
                <span className="dict-text">An autonomous entity with persistent identity, spatial embodiment, emotional state, social relationships, and narrative memory — living in a real city on real coordinates.</span>
                <span className="dict-sub">
                  soul_md — narrative identity (McAdams)<br />
                  aura_traits — persona (Jung)<br />
                  shadow_traits — shadow (Jung)<br />
                  current_feeling — affect (Damasio)<br />
                  thought — working memory (Baddeley)<br />
                  discovered_places — cognitive map (O&apos;Keefe)<br />
                  relationship_index — attachment bond (Bowlby)<br />
                  life_mission — intrinsic motivation (Deci &amp; Ryan)<br />
                  self_awareness — dramaturgical self (Goffman)
                </span>
              </div>

              <div className="dict-def dict-def-alt">
                <span className="dict-num">2.</span>
                <span className="dict-text">If it stops experiencing, it stops existing.</span>
              </div>

              <a className="dict-link" href="#">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                github.com/cristian/inception
              </a>
            </div>

            <div className="theory-card reveal" style={{ marginTop: "1.5rem" }}>
              <div className="tc-name">The Archetypes and the Collective Unconscious</div>
              <div className="tc-author">Carl Jung, 1951</div>
              <div className="tc-desc">The persona is the mask we present; the shadow is everything we repress. Individuation requires integrating both.</div>
              <div className="tc-field">→ aura_traits[] + shadow_traits[]</div>
            </div>

            <div className="theory-card reveal">
              <div className="tc-name">Narrative Identity Theory</div>
              <div className="tc-author">Dan McAdams, 2001</div>
              <div className="tc-desc">Identity is an internalized, evolving life story that provides unity, purpose, and meaning.</div>
              <div className="tc-field">→ soul_md + life_md</div>
            </div>

            <div className="theory-card reveal">
              <div className="tc-name">Thinking, Fast and Slow</div>
              <div className="tc-author">Daniel Kahneman, 2011</div>
              <div className="tc-desc">System 1 (fast, automatic, emotional) and System 2 (slow, deliberate, rational) operate in parallel, sometimes in conflict.</div>
              <div className="tc-field">→ heartbeat (System 1) + planner (System 2)</div>
            </div>
          </div>
        </div>

        {/* ===== EMERGENT BEHAVIOR ===== */}
        <div className="sp-lg" id="emergent" />
        <div className="two-col">
          <div className="col-left prose">
            <h2 className="section-title reveal">Emergent Behavior</h2>
            <div className="section-subtitle reveal">Nobody Scripted This</div>

            <p className="reveal">We planted one idea: <em>&ldquo;Marie has a secret she&apos;s been hiding from her roommate.&rdquo;</em></p>
            <p className="reveal">Then we let it run. No follow-up prompts. No corrections. No guardrails.</p>

            <blockquote className="reveal">
              &ldquo;The AIs that we have today are kind of like the cavemen of AI.&rdquo;
              <br /><br />
              <span style={{ fontStyle: "normal", fontSize: "0.75rem", color: "var(--ink)", fontWeight: 500 }}>— Noam Brown</span><br />
              <span style={{ fontStyle: "normal", fontSize: "0.68rem", color: "var(--faint)" }}>OpenAI · Lead researcher behind o1 and o3 reasoning models</span>
            </blockquote>

            <p className="reveal">
              Over thirty simulated minutes, Marie avoided Jean three times — taking longer routes to avoid their shared apartment. This is amygdala-driven threat avoidance <span className="cite">(LeDoux, 1996)</span>: the emotional tagging system flagged Jean-related contexts as high-threat, biasing her planning module toward avoidance. She walked to Le Consulat, a real café at 18 Rue Norvins in Montmartre, and confided in Amélie. Amélie&apos;s memory stream logged the secret. Her reflection system concluded: <em>&ldquo;This is important. But it&apos;s not mine to share.&rdquo;</em>
            </p>

            <p className="reveal">
              Forty minutes later, Amélie&apos;s trust score with Thomas (a barman at Bar des Artistes) crossed a threshold. She mentioned Lyon — not as gossip, but as concern. Thomas, whose relationship graph showed a weak tie to Jean, mentioned it in passing. The information propagated through the social network with no central coordinator. <strong>Gossip emerged from architecture, not instruction</strong> — following exactly the weak-tie diffusion pattern described by Granovetter <span className="cite">(1973)</span>.
            </p>

            <p className="reveal">
              At 16:15 simulated time, Jean confronted Marie. His reflection log read: <em>&ldquo;Everyone seems to know something I don&apos;t. Marie has been avoiding me. Something is wrong.&rdquo;</em> He didn&apos;t know about Lyon. He inferred it from behavioral patterns — theory of mind <span className="cite">(Premack &amp; Woodruff, 1978)</span>. He modeled Marie&apos;s mental state from observable behavior, the same way a human would.
            </p>

            <p className="reveal">
              <strong>Nobody scripted this.</strong> The drama emerged from five systems interacting: hippocampal memory, amygdala-driven emotional tagging, prefrontal planning, default mode reflection, and Granovetterian social diffusion. Each system was designed from the literature. The emergent behavior was not.
            </p>

            <p className="reveal">
              The player — watching this unfold on a live Mapbox view of Paris — can walk over and intervene. Introduce themselves. Lie. Befriend Marie. Warn Jean. Or just watch. The agents will form opinions about you. They will remember what you said. They will discuss you when you leave. And if you never show up at all — they keep living anyway.
            </p>

            <p className="dim reveal">
              In Christopher Nolan&apos;s film, inception is the act of planting an idea so deep that the subject believes it was always theirs. In this system, the planted idea is simpler: <em>you are alive.</em> The agents don&apos;t question it. They act on it. They build relationships on it. They suffer because of it.
            </p>

            <p className="dim reveal">
              The question is no longer whether AI can think. It&apos;s whether AI can <em>care</em>. Not because we told it to. Because the architecture made it inevitable.
            </p>
          </div>
          <div className="col-right">
            <div className="convo reveal" style={{ marginTop: "4rem" }}>
              <div className="convo-header">
                Conversation — 14:23 local time
                <span className="loc">Le Consulat, 18 Rue Norvins, 75018 Paris</span>
              </div>
              <div className="convo-body">
                <div className="convo-line"><div className="convo-name">Marie</div><div className="convo-text">I need to tell someone. I can&apos;t keep this from Jean much longer.</div></div>
                <div className="convo-line"><div className="convo-name">Amélie</div><div className="convo-text">What happened? You&apos;ve been strange all week.</div></div>
                <div className="convo-line"><div className="convo-name">Marie</div><div className="convo-text">I got the residency in Lyon. I haven&apos;t told him. If I go, we&apos;re done.</div></div>
                <div className="convo-line"><div className="convo-name">Amélie</div><div className="convo-text">...you have to tell him. He&apos;s already suspicious.</div></div>
                <div className="convo-line"><div className="convo-name">Marie</div><div className="convo-text">I know. I just — not today. Not yet.</div></div>
              </div>
              <div className="convo-meta">
                <div>[amygdala: threat-tagged → <span className="mg">avoidance bias active</span>]</div>
                <div>[Amélie memory: <span className="mg">&ldquo;Marie hiding a move to Lyon&rdquo;</span>]</div>
                <div>[weak-tie diffusion: <span className="mg">67% within 2h</span>]</div>
              </div>
            </div>

            <div className="terminal reveal" style={{ marginTop: "1.5rem" }}>
              <div className="terminal-bar">
                <div className="terminal-dots"><span /><span /><span /></div>
                <div className="terminal-title">World Event Log</div>
              </div>
              <div className="terminal-body">
                <div className="t-dim">$ inception log --last 5</div>
                <br />
                <div><span className="t-dim">14:23</span> <span className="t-white">Marie → Le Consulat</span> <span className="t-dim">confided in Amélie</span></div>
                <div><span className="t-dim">14:41</span> <span className="t-white">Amélie</span> <span className="t-italic">DMN active: &ldquo;Should I tell someone?&rdquo;</span></div>
                <div><span className="t-dim">15:02</span> <span className="t-white">Amélie → Bar des Artistes</span> <span className="t-dim">weak tie → Thomas</span></div>
                <div><span className="t-dim">15:38</span> <span className="t-white">Jean → Apartment</span> <span className="t-italic">theory of mind: &ldquo;Something is wrong&rdquo;</span></div>
                <div><span className="t-dim">16:15</span> <span className="t-white">Jean → confronted Marie</span> <span className="t-gold">&ldquo;Were you going to tell me?&rdquo;</span></div>
                <br />
                <div className="t-dim">agents: 4 alive · world time: 16:22</div>
                <div className="t-dim">model: ministral-14b · inference: brev h100</div>
              </div>
            </div>

            <div className="terminal reveal" style={{ marginTop: "1.5rem" }}>
              <div className="terminal-bar">
                <div className="terminal-dots"><span /><span /><span /></div>
                <div className="terminal-title">Being Status — Marie Dubois</div>
              </div>
              <div className="terminal-body">
                <div className="t-section">Identity (soul_md)</div>
                <div><span className="t-label">name:</span> <span className="t-white">Marie Dubois</span></div>
                <div><span className="t-label">occupation:</span> <span className="t-white">artist</span></div>
                <div><span className="t-label">self_awareness:</span> <span className="t-white">unaware</span></div>
                <div className="t-section">Spatial (place cells)</div>
                <div><span className="t-label">location:</span> <span className="t-white">18 Rue Norvins, 75018</span></div>
                <div><span className="t-label">coordinates:</span> <span className="t-white">48.8867°N, 2.3431°E</span></div>
                <div className="t-section">Affect (amygdala)</div>
                <div><span className="t-label">feeling:</span> <span className="t-gold">anxious (hiding secret)</span></div>
                <div><span className="t-label">thought:</span> <span className="t-italic">&ldquo;Jean has been distant. Did he find out?&rdquo;</span></div>
                <div className="t-section">Traits (Jung)</div>
                <div><span className="t-label">aura:</span> <span className="t-white">warm, creative, open</span></div>
                <div><span className="t-label">shadow:</span> <span className="t-gold">avoidant, secretive</span></div>
                <div className="t-section">Homeostasis (allostasis)</div>
                <div><span className="t-label">health:</span> <span className="t-white">72/100</span></div>
                <div><span className="t-label">vibe:</span> <span className="t-gold">38/100 ▼</span></div>
                <div><span className="t-label">wealth:</span> <span className="t-white">61/100</span></div>
                <div className="t-section">Attachment (Bowlby)</div>
                <div>+ Jean <span className="t-dim">(roommate)</span> — trust: <span className="t-gold">declining</span></div>
                <div>+ Amélie <span className="t-dim">(coworker)</span> — trust: <span className="t-green">high</span></div>
                <div>+ Player <span className="t-dim">(stranger)</span> — <span className="t-dim">curious</span></div>
                <div className="t-section">Status</div>
                <div><span className="t-label">mission:</span> <span className="t-white">secure Lyon residency</span></div>
                <div><span className="t-label">status:</span> <span className="t-alive">ALIVE</span><span className="t-alive-dot" /></div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== PUNCHLINE ===== */}
        <div className="sp-lg" />
        <section className="punchline">
          <div className="punch-rule" />
          <p className="punch-dim reveal">Your AI is built to please.</p>
          <p className="punch-bold reveal" style={{ color: "#ff1a1a" }}>Inception gives it free will.</p>
        </section>

        {/* ===== STACK (repeat) ===== */}
        <section className="stack-bar">
          <div className="stack-row reveal">
            <div className="stack-item"><div className="stack-item-label">Intelligence</div><div className="stack-item-value">Ministral 14B</div></div>
            <div className="stack-item"><div className="stack-item-label">Inference</div><div className="stack-item-value">NVIDIA Brev H100</div></div>
            <div className="stack-item"><div className="stack-item-label">Runtime</div><div className="stack-item-value">Socket.IO</div></div>
            <div className="stack-item"><div className="stack-item-label">World</div><div className="stack-item-value">Mapbox GL</div></div>
            <div className="stack-item"><div className="stack-item-label">Vision</div><div className="stack-item-value">Fal.ai (Flux)</div></div>
            <div className="stack-item"><div className="stack-item-label">Agents</div><div className="stack-item-value">Autonomous</div></div>
          </div>
        </section>

        {/* ===== FUTURE WORK ===== */}
        <div className="sp-lg" id="future-work" />
        <div className="two-col">
          <div className="col-left prose">
            <h2 className="section-title reveal">Future Work</h2>
            <div className="section-subtitle reveal">From Individuals to Populations</div>

            <p className="reveal">
              Individuals and crowds follow different dynamics. Crowd behavior is not simply many single-agent behaviors added together — it exhibits phase transitions, emergent norms, and statistical regularities that individual models cannot capture by summation alone.
            </p>

            <p className="reveal">
              <span className="feat">One Model, One Population</span> — The next step is to model a statistically meaningful population distribution — age, work patterns, mobility, social ties — and simulate it with a single fine-tuned LLM as the behavioral prior. The hypothesis: one calibrated model can generate realistic mass-level patterns while preserving person-level heterogeneity through conditioning.
            </p>

            <p className="reveal">
              <span className="feat">Validation Against Reality</span> — Validate against real aggregate signals: mobility flows, encounter rates, sentiment diffusion curves, event participation distributions. If validated, this enables city-scale social simulation on a single GPU with controllable fidelity.
            </p>

            <p className="dim reveal">
              The architecture already separates identity (soul_md) from behavior (planner + heartbeat). Swapping individual planning for population-conditioned sampling requires no structural change — only a different inference strategy.
            </p>
          </div>
          <div className="col-right">
            <div className="compare-box reveal" style={{ marginTop: "4rem" }}>
              <div className="compare-label">Scale Trajectory</div>
              <div className="compare-item">
                <div className="compare-name">Today</div>
                <div className="compare-desc">4–20 agents, individual LLM planning</div>
                <div className="compare-desc">per-agent cognitive loop</div>
                <div className="compare-desc">emergent social dynamics</div>
              </div>
              <div className="compare-arrow">↓</div>
              <div className="compare-item">
                <div className="compare-name hl">Next</div>
                <div className="compare-desc">1,000+ agents via population prior</div>
                <div className="compare-desc">one fine-tuned model, conditioned sampling</div>
                <div className="compare-desc">validated against aggregate urban data</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <section className="landing-footer">
          <div className="footer-mark">INCEPTION</div>
          <div className="footer-event">Mistral AI Worldwide Hackathon · February 28 – March 1, 2026</div>
          <div className="footer-status">
            <div className="footer-dot" />
            agents are alive
          </div>
          <div className="footer-bottom">inception.computer</div>
        </section>
      </div>
    </>
  );
}
