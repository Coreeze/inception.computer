"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useOdyssey } from "@odysseyml/odyssey/react";

export default function HolodeckBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamActiveRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [promptText, setPromptText] = useState("");

  const apiKey = process.env.NEXT_PUBLIC_ODYSSEY_API_KEY || "";

  const odyssey = useOdyssey({
    apiKey,
    handlers: {
      onConnected: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      },
      onStreamStarted: () => {
        streamActiveRef.current = true;
        setVideoReady(true);
      },
      onDisconnected: () => {
        streamActiveRef.current = false;
      },
      onError: () => {
        setFailed(true);
      },
      onStreamError: () => {
        setFailed(true);
      },
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        await odyssey.connect();
        if (cancelled) return;
        await odyssey.startStream({
          prompt:
            "Slow cinematic flythrough of an infinite holodeck space, glowing soft blue grid lines receding into a bright white vanishing point, ethereal and calm, minimal futuristic void",
          portrait: false,
        });
      } catch {
        setFailed(true);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamActiveRef.current) {
        odyssey.endStream().catch(() => {});
      }
      odyssey.disconnect();
    };
  }, []);

  const handleRestart = useCallback(async () => {
    const newPrompt = promptText.trim();
    if (!newPrompt) return;
    setPromptText("");
    setVideoReady(false);
    try {
      if (streamActiveRef.current) {
        await odyssey.endStream();
        streamActiveRef.current = false;
      }
      if (!odyssey.isConnected) await odyssey.connect();
      await odyssey.startStream({ prompt: newPrompt, portrait: false });
    } catch {
      setFailed(true);
    }
  }, [promptText, odyssey]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-linear-to-b from-slate-50 via-white to-blue-50/30">
      {!failed && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-1000 ${videoReady ? "opacity-100" : "opacity-0"}`}
        />
      )}

      <svg
        className={`absolute inset-0 z-1 h-full w-full transition-opacity duration-1000 ${videoReady && !failed ? "opacity-30" : "opacity-100"}`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const y = 50 + (i + 1) * 6;
          const curve = (i + 1) * 3;
          const opacity = 0.3 + i * 0.07;
          return (
            <path key={`floor-${i}`} d={`M 0 ${y} Q 50 ${y - curve} 100 ${y}`} fill="none" stroke="#FF0000" strokeWidth={0.05} opacity={opacity} />
          );
        })}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const y = 50 - (i + 1) * 6;
          const curve = (i + 1) * 3;
          const opacity = 0.3 + i * 0.07;
          return (
            <path key={`ceiling-${i}`} d={`M 0 ${y} Q 50 ${y + curve} 100 ${y}`} fill="none" stroke="#FF0000" strokeWidth={0.05} opacity={opacity} />
          );
        })}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const x = 50 - (i + 1) * 6;
          const curve = (i + 1) * 3;
          const opacity = 0.3 + i * 0.07;
          return (
            <path key={`left-${i}`} d={`M ${x} 0 Q ${x + curve} 50 ${x} 100`} fill="none" stroke="#FF0000" strokeWidth={0.05} opacity={opacity} />
          );
        })}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const x = 50 + (i + 1) * 6;
          const curve = (i + 1) * 3;
          const opacity = 0.3 + i * 0.07;
          return (
            <path key={`right-${i}`} d={`M ${x} 0 Q ${x - curve} 50 ${x} 100`} fill="none" stroke="#FF0000" strokeWidth={0.05} opacity={opacity} />
          );
        })}
      </svg>

      {/* Soft white overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 h-screen w-screen bg-gradient-radial from-white to-white/30" />

      {videoReady && !failed && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRestart();
          }}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5"
        >
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Change scene..."
            className="w-44 rounded-full border border-black/10 bg-white/50 px-3 py-1.5 text-[11px] text-slate-600 placeholder-slate-400 backdrop-blur-sm focus:border-black/20 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!promptText.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-slate-500 backdrop-blur-sm disabled:opacity-30"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}
