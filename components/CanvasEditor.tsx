"use client";

import { useState, useRef, useCallback } from "react";
import { CanvasState, Draft } from "@/types/canvas";
import { PRESETS } from "@/lib/presets";
import {
  createEmptyState,
  placePreset,
  moveVertex,
  deleteVertex,
  mergeVertices,
} from "@/lib/canvasEngine";
import { createHistory, pushHistory, undo, redo, HistoryStack } from "@/lib/history";

function pointsToPath(
  vertexIds: string[],
  vertices: CanvasState["vertices"],
  closed: boolean
): string {
  if (vertexIds.length === 0) return "";
  const coords = vertexIds.map((id) => vertices[id]).filter(Boolean);
  if (coords.length === 0) return "";
  const [first, ...rest] = coords;
  const d = [`M ${first.x} ${first.y}`, ...rest.map((p) => `L ${p.x} ${p.y}`)];
  if (closed) d.push("Z");
  return d.join(" ");
}

export default function CanvasEditor() {
  const [state, setState] = useState<CanvasState>(createEmptyState());
  const [history, setHistory] = useState<HistoryStack>(createHistory());

  // Selection: up to two vertex IDs, oldest drops when a third is pressed
  const [selected, setSelected] = useState<string[]>([]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Viewport: camera pan/zoom, never touches vertex coordinates
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 8 });
  const panStart = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const longPressTimer = useRef<number | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2000);
  }, []);

  // The one gate every permanent command passes through
  const runCommand = useCallback(
    (fn: () => void) => {
      if (draft !== null) {
        showNotice("Resolve your current edit first — confirm or cancel it.");
        return;
      }
      fn();
    },
    [draft, showNotice]
  );

  function commitStateChange(newState: CanvasState) {
    setHistory((h) => pushHistory(h, state));
    setState(newState);
  }

  function handlePlacePreset(presetKey: string) {
    runCommand(() => {
      commitStateChange(placePreset(state, presetKey));
    });
  }

  function handleUndo() {
    runCommand(() => {
      const result = undo(history, state);
      if (!result) {
        showNotice("Nothing to undo.");
        return;
      }
      setHistory(result.history);
      setState(result.state);
      setSelected([]);
    });
  }

  function handleRedo() {
    runCommand(() => {
      const result = redo(history, state);
      if (!result) {
        showNotice("Nothing to redo.");
        return;
      }
      setHistory(result.history);
      setState(result.state);
      setSelected([]);
    });
  }

  function handleDeleteVertex(vertexId: string) {
    runCommand(() => {
      commitStateChange(deleteVertex(state, vertexId));
      setSelected((s) => s.filter((id) => id !== vertexId));
    });
  }

  function handleMerge() {
    runCommand(() => {
      if (selected.length !== 2) {
        showNotice("Select two vertices to merge.");
        return;
      }
      const [first, second] = selected;
      // second (most recently pressed) merges into first (anchor)
      commitStateChange(mergeVertices(state, first, second));
      setSelected([first]);
    });
  }

  function handleLongPressVertex(vertexId: string) {
    runCommand(() => {
      setSelected((prev) => {
        if (prev.includes(vertexId)) return prev;
        const next = [...prev, vertexId];
        return next.length > 2 ? next.slice(1) : next;
      });
    });
  }

  function startDraftForSelected() {
    runCommand(() => {
      if (selected.length === 0) {
        showNotice("Long-press a vertex first.");
        return;
      }
      const vertexId = selected[selected.length - 1];
      const v = state.vertices[vertexId];
      if (!v) return;
      setDraft({ vertexId, x: v.x, y: v.y });
    });
  }

  function confirmDraft() {
    if (!draft) return;
    commitStateChange(moveVertex(state, draft.vertexId, draft.x, draft.y));
    setDraft(null);
  }

  function cancelDraft() {
    setDraft(null);
  }

  // Viewport pan handlers — finger drag only ever moves the camera
  function handlePointerDown(e: React.PointerEvent) {
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      vx: viewport.x,
      vy: viewport.y,
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!panStart.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setViewport((vp) => ({
      ...vp,
      x: panStart.current!.vx + dx,
      y: panStart.current!.vy + dy,
    }));
  }

  function handlePointerUp() {
    panStart.current = null;
  }

  function handleZoom(delta: number) {
    setViewport((vp) => ({
      ...vp,
      scale: Math.max(2, Math.min(40, vp.scale + delta)),
    }));
  }

  // Long-press detection on a vertex circle
  function vertexPointerDown(vertexId: string) {
    longPressTimer.current = window.setTimeout(() => {
      handleLongPressVertex(vertexId);
    }, 450);
  }

  function vertexPointerUp() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  // Model -> screen projection
  function toScreen(x: number, y: number) {
    return {
      sx: viewport.x + x * viewport.scale,
      sy: viewport.y - y * viewport.scale, // flip y so positive is up
    };
  }

  return (
    <div className="w-full h-screen bg-neutral-950 flex flex-col">
      {notice && (
        <div className="bg-amber-600 text-white text-sm px-4 py-2 text-center">
          {notice}
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full touch-none bg-neutral-900"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {Object.values(state.shapes).map((shape) => {
            const screenPath = shape.vertexIds
              .map((vid) => state.vertices[vid])
              .filter(Boolean)
              .map((v, i) => {
                const { sx, sy } = toScreen(v.x, v.y);
                return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
              })
              .join(" ");
            const d = shape.closed ? `${screenPath} Z` : screenPath;
            return (
              <path
                key={shape.id}
                d={d}
                fill={shape.fill}
                stroke={shape.stroke}
                strokeWidth={2}
              />
            );
          })}

          {Object.values(state.vertices).map((v) => {
            const { sx, sy } = toScreen(v.x, v.y);
            const isSelected = selected.includes(v.id);
            return (
              <circle
                key={v.id}
                cx={sx}
                cy={sy}
                r={isSelected ? 10 : 7}
                fill={isSelected ? "#facc15" : "#fff"}
                stroke="#4f46e5"
                strokeWidth={2}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  vertexPointerDown(v.id);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  vertexPointerUp();
                }}
              />
            );
          })}
        </svg>

        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button
            onClick={() => handleZoom(2)}
            className="w-10 h-10 bg-neutral-800 text-white rounded-full"
          >
            +
          </button>
          <button
            onClick={() => handleZoom(-2)}
            className="w-10 h-10 bg-neutral-800 text-white rounded-full"
          >
            −
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-neutral-800 p-3 flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handlePlacePreset(key)}
              className="px-3 py-2 bg-indigo-600 text-white text-sm rounded whitespace-nowrap"
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={handleUndo} className="px-3 py-2 bg-neutral-700 text-white text-sm rounded">
            Undo
          </button>
          <button onClick={handleRedo} className="px-3 py-2 bg-neutral-700 text-white text-sm rounded">
            Redo
          </button>
          <button onClick={handleMerge} className="px-3 py-2 bg-neutral-700 text-white text-sm rounded">
            Merge
          </button>
          <button
            onClick={() => selected.length > 0 && handleDeleteVertex(selected[selected.length - 1])}
            className="px-3 py-2 bg-red-700 text-white text-sm rounded"
          >
            Delete Vertex
          </button>
          <button onClick={startDraftForSelected} className="px-3 py-2 bg-neutral-700 text-white text-sm rounded">
            Edit Coordinates
          </button>
        </div>

        {draft && (
          <div className="flex gap-2 items-center bg-neutral-900 p-3 rounded">
            <label className="text-white text-sm">
              X:
              <input
                type="number"
                value={draft.x}
                onChange={(e) => setDraft({ ...draft, x: Number(e.target.value) })}
                className="ml-1 w-20 bg-neutral-700 text-white px-2 py-1 rounded"
              />
            </label>
            <label className="text-white text-sm">
              Y:
              <input
                type="number"
                value={draft.y}
                onChange={(e) => setDraft({ ...draft, y: Number(e.target.value) })}
                className="ml-1 w-20 bg-neutral-700 text-white px-2 py-1 rounded"
              />
            </label>
            <button onClick={confirmDraft} className="px-3 py-1 bg-green-600 text-white text-sm rounded">
              Confirm
            </button>
            <button onClick={cancelDraft} className="px-3 py-1 bg-neutral-600 text-white text-sm rounded">
              Cancel
            </button>
          </div>
        )}

        {selected.length > 0 && (
          <div className="text-neutral-400 text-xs">
            Selected: {selected.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
