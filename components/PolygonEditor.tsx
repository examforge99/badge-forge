"use client";
import { useState, useRef } from "react";
import type { Shape, Point } from "@/types/shape";

function pointsToPath(points: Point[], closed: boolean): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const d = [`M ${first.x} ${first.y}`, ...rest.map(p => `L ${p.x} ${p.y}`)];
  if (closed) d.push("Z");
  return d.join(" ");
}

export default function PolygonEditor() {
  const [shape, setShape] = useState<Shape>({
    id: "shape-1",
    points: [
      { id: "a", x: 100, y: 40 },
      { id: "b", x: 160, y: 100 },
      { id: "c", x: 130, y: 170 },
      { id: "d", x: 70, y: 170 },
      { id: "e", x: 40, y: 100 },
    ],
    closed: true,
    fill: "#4f46e5",
    stroke: "#1e1b4b",
  });

  const draggingId = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  function svgCoords(e: React.PointerEvent): { x: number; y: number } {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(id: string) {
    draggingId.current = id;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingId.current) return;
    const { x, y } = svgCoords(e);
    setShape(prev => ({
      ...prev,
      points: prev.points.map(p =>
        p.id === draggingId.current ? { ...p, x, y } : p
      ),
    }));
  }

  function handlePointerUp() {
    draggingId.current = null;
  }

  async function saveShape() {
    localStorage.setItem("badge-shape", JSON.stringify(shape));
    // swap this for a Supabase insert once Phase 1's tables exist
    alert("Saved (local for now)");
  }

  return (
    <div className="flex flex-col gap-4 items-center p-4">
      <svg
        ref={svgRef}
        width={240}
        height={220}
        className="bg-neutral-900 rounded-lg touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <path
          d={pointsToPath(shape.points, shape.closed)}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={2}
        />
        {shape.points.map(p => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={8}
            fill="#fff"
            stroke="#4f46e5"
            strokeWidth={2}
            onPointerDown={() => handlePointerDown(p.id)}
            className="cursor-grab active:cursor-grabbing"
          />
        ))}
      </svg>
      <button
        onClick={saveShape}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
      >
        Save
      </button>
    </div>
  );
}
