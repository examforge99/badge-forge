"use client";

import { useState } from "react";
import { CanvasState, ShapeEffect } from "@/types/canvas";
import { mixColor } from "@/lib/colorMixing";
import {
  listProjects,
  loadProject,
  createProject,
  saveProject,
  ProjectSummary,
} from "@/lib/projects";

export default function StyleEditor() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [importMenuOpen, setImportMenuOpen] = useState(false);

  const [styledProjectId, setStyledProjectId] = useState<string | null>(null);
  const [styledProjectName, setStyledProjectName] = useState<string>("");
  const [state, setState] = useState<CanvasState | null>(null);

  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function showNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2000);
  }

  async function openImportMenu() {
    try {
      const list = await listProjects();
      // Never offer an already-styled copy as an import source —
      // this is what prevented the "(styled) (styled) (styled)" runaway chain.
      const unstyledOnly = list.filter((p) => !p.name.includes("(styled)"));
      setProjects(unstyledOnly);
      setImportMenuOpen(true);
    } catch {
      showNotice("Could not load your badges.");
    }
  }

  async function handleImport(sourceId: string) {
    try {
      const { name, state: sourceState } = await loadProject(sourceId);
      const copyName = `${name} (styled)`;
      const newId = await createProject(copyName, sourceState);
      setStyledProjectId(newId);
      setStyledProjectName(copyName);
      setState(sourceState);
      setSelectedShapeId(null);
      setImportMenuOpen(false);
      showNotice("Imported a copy — the original is untouched.");
    } catch {
      showNotice("Could not import that badge.");
    }
  }

  function applyEffect(shapeId: string, effect: ShapeEffect) {
    if (!state) return;
    const newState: CanvasState = {
      ...state,
      effects: { ...(state.effects ?? {}), [shapeId]: effect },
    };
    setState(newState);
    if (styledProjectId) {
      saveProject(styledProjectId, newState).catch(() =>
        showNotice("Save failed — check your connection.")
      );
    }
  }

  function getShapeEffect(shapeId: string): ShapeEffect {
    return (
      state?.effects?.[shapeId] ?? {
        baseColor: state?.shapes[shapeId]?.fill ?? "#4f46e5",
        mixTarget: "white",
        mixPercentage: 0,
      }
    );
  }

  function renderedFillFor(shapeId: string): string {
    const effect = getShapeEffect(shapeId);
    if (effect.mixPercentage === 0) return effect.baseColor;
    const target = effect.mixTarget === "white" ? "#FFFFFF" : "#000000";
    return mixColor(effect.baseColor, target, effect.mixPercentage);
  }

  // Computes a tight bounding box from the actual imported vertex data,
  // the same technique exportSvg.ts uses — no guessed/fixed viewport.
  function computeViewBox(canvasState: CanvasState): {
    minX: number;
    minY: number;
    width: number;
    height: number;
  } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const shape of Object.values(canvasState.shapes)) {
      for (const vid of shape.vertexIds) {
        const v = canvasState.vertices[vid];
        if (!v) continue;
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
      }
    }
    if (minX === Infinity) {
      return { minX: 0, minY: 0, width: 100, height: 100 };
    }
    const padding = 3;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }

  return (
    <div className="w-full h-screen bg-white flex flex-col">
      {notice && (
        <div className="bg-amber-500 text-black text-sm px-4 py-2 text-center">
          {notice}
        </div>
      )}

      <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-3 flex items-center gap-2">
        <button
          onClick={openImportMenu}
          className="px-3 py-2 bg-indigo-600 text-white text-sm rounded"
        >
          Import Badge
        </button>
        {styledProjectName && (
          <span className="text-sm text-neutral-600 truncate">{styledProjectName}</span>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-white p-6">
        {!state && (
          <div className="text-neutral-400 text-sm px-6 text-center">
            Import a badge from /build to start styling it. The original stays untouched.
          </div>
        )}

        {state &&
          (() => {
            const { minX, minY, width, height } = computeViewBox(state);
            // Flip y so the shape reads right-side-up
            // (model space has +y up, SVG has +y down)
            return (
              <svg
                viewBox={`${minX} ${-minY - height} ${width} ${height}`}
                className="w-full h-full max-w-md"
              >
                {Object.values(state.shapes).map((shape) => {
                  const points = shape.vertexIds
                    .map((vid) => state.vertices[vid])
                    .filter(Boolean)
                    .map((v) => ({ sx: v.x, sy: -v.y }));
                  if (points.length === 0) return null;
                  const [first, ...rest] = points;
                  const d = [
                    `M ${first.sx} ${first.sy}`,
                    ...rest.map((p) => `L ${p.sx} ${p.sy}`),
                  ];
                  if (shape.closed) d.push("Z");

                  return (
                    <path
                      key={shape.id}
                      d={d.join(" ")}
                      fill={renderedFillFor(shape.id)}
                      stroke={shape.stroke}
                      strokeWidth={0.3}
                      onClick={() => setSelectedShapeId(shape.id)}
                      style={{
                        outline:
                          selectedShapeId === shape.id
                            ? "1px solid #f59e0b"
                            : "none",
                      }}
                    />
                  );
                })}
              </svg>
            );
          })()}
      </div>

      {selectedShapeId && state && (
        <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Editing shape
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm">Mix toward:</label>
            <select
              value={getShapeEffect(selectedShapeId).mixTarget}
              onChange={(e) =>
                applyEffect(selectedShapeId, {
                  ...getShapeEffect(selectedShapeId),
                  mixTarget: e.target.value as "white" | "black",
                })
              }
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
            >
              <option value="white">White (tint)</option>
              <option value="black">Black (shade)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm w-20">Amount:</label>
            <input
              type="range"
              min={0}
              max={100}
              value={getShapeEffect(selectedShapeId).mixPercentage}
              onChange={(e) =>
                applyEffect(selectedShapeId, {
                  ...getShapeEffect(selectedShapeId),
                  mixPercentage: Number(e.target.value),
                })
              }
              className="flex-1"
            />
            <span className="text-sm text-neutral-500 w-10 text-right">
              {getShapeEffect(selectedShapeId).mixPercentage}%
            </span>
          </div>
        </div>
      )}

      {importMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end z-50"
          onClick={() => setImportMenuOpen(false)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-neutral-500 text-xs uppercase tracking-wide mb-1">
              Import a badge from /build
            </div>
            {projects.length === 0 && (
              <div className="text-neutral-400 text-sm px-4 py-3">
                No badges found.
              </div>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => handleImport(p.id)}
                className="text-left px-4 py-3 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-900"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
