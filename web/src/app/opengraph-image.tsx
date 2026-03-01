import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "INCEPTION — Autonomous agents grounded in neuroscience, sociology, and psychology";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function PixelBlock({
  x,
  y,
  s,
  opacity,
}: {
  x: number;
  y: number;
  s: number;
  opacity: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: s,
        height: s,
        background: "#ff1a1a",
        opacity,
        borderRadius: 1,
      }}
    />
  );
}

export default async function Image() {
  const grid: { x: number; y: number; s: number; opacity: number }[] = [];
  const cellSize = 14;
  const gap = 3;
  const step = cellSize + gap;

  const cols = Math.ceil(1200 / step);
  const rows = Math.ceil(630 / step);

  const seed = 42;
  function pseudoRandom(i: number) {
    const x = Math.sin(seed + i * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  let idx = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const r = pseudoRandom(idx++);
      if (r < 0.12) {
        grid.push({
          x: col * step,
          y: row * step,
          s: cellSize,
          opacity: 0.06 + pseudoRandom(idx + 1000) * 0.12,
        });
      }
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9f7f3",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {grid.map((p, i) => (
          <PixelBlock key={i} {...p} />
        ))}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
            gap: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: "#ff1a1a",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  background: "#f9f7f3",
                  borderRadius: 14,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: "#1a1714",
                letterSpacing: "-2px",
                fontFamily: "Georgia, serif",
              }}
            >
              inception.computer
            </span>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#7a756d",
              fontFamily: "Georgia, serif",
              textAlign: "center",
              maxWidth: 800,
              lineHeight: 1.5,
            }}
          >
            Autonomous agents grounded in neuroscience, sociology, and
            psychology
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "#ff1a1a",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
