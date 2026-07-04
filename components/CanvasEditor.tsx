"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CanvasState, Draft } from "@/types/canvas";
import { PRESETS } from "@/lib/presets";
import {
  createEmptyState,
  placePreset,
  moveVertex,
  deleteVertex,
  mergeVertices,
  translateShape,
} from "@/lib/canvasEngine";
import { createHistory, pushHistory, undo, redo, HistoryStack } from "@/lib/history";
import {
  listProjects,
  createProject,
  loadProject,
  saveProject,
  ProjectSummary,
} from "@/lib/projects";
import { downloadSvg } from "@/lib/exportSvg";

const LAST_PROJECT_KEY = "badge-forge-last-project";

function isPointInPolygon(
  px: number,
  py: number,
  polygon: { x: number; y: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function CanvasEditor() {
  const [state, setState] = useState<CanvasState>(createEmptyState());
  const [history, setHistory] = useState<HistoryStack>(createHistory());

  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("Untitled Badge");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 8 });
  const panStart = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const shapeDrag = useRef<{ shapeId: string; lastModelX: number; lastModelY: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const longPressTimer = useRef<number | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2000);
  }, []);

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
    if (projectId) {
      saveProject(projectId, newState).catch(() =>
        showNotice("Save failed — check your connection.")
      );
    }
  }

  async function handleNewProject() {
    runCommand(async () => {
      const fresh = createEmptyState();
      try {
        const id = await createProject("Untitled Badge", fresh);
        setProjectId(id);
        setProjectName("Untitled Badge");
        setState(fresh);
        setHistory(createHistory());
        setSelected([]);
        localStorage.setItem(LAST_PROJECT_KEY, id);
      } catch {
        showNotice("Could not create a new project.");
      }
    });
  }

  async function handleOpenProjectList() {
    try {
      const list = await listProjects();
      setProjects(list);
      setProjectMenuOpen(true);
    } catch {
      showNotice("Could not load your projects.");
    }
  }

  async function handleOpenProject(id: string) {
    runCommand(async () => {
      try {
        const { name, state: loadedState } = await loadProject(id);
        setProjectId(id);
        setProjectName(name);
        setState(loadedState);
        setHistory(createHistory());
        setSelected([]);
        setProjectMenuOpen(false);
        localStorage.setItem(LAST_PROJECT_KEY, id);
      } catch {
        showNotice("Could not open that project.");
      }
    });
  }

  function handleExport() {
    runCommand(() => {
      downloadSvg(state, projectName || "badge");
    });
  }

  // Initial load: reopen the last project you had open, or create one.
  // Bypasses runCommand deliberately — nothing can be pending on first mount.
  useEffect(() => {
    async function initialLoad() {
      const lastId = localStorage.getItem(LAST_PROJECT_KEY);
      if (lastId) {
        try {
          const { name, state: loadedState } = await loadProject(lastId);
          setProjectId(lastId);
          setProjectName(name);
          setState(loadedState);
          return;
        } catch {
          // saved id no longer valid (e.g. deleted project) — fall through
        }
      }
      const fresh = createEmptyState();
      try {
        const id = await createProject("Untitled Badge", fresh);
        setProjectId(id);
        setProjectName("Untitled Badge");
        setState(fresh);
        localStorage.setItem(LAST_PROJECT_KEY, id);
      } catch {
        showNotice("Could not create a new project.");
      }
    }
    initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (projectId) {
        saveProject(projectId, result.state).catch(() =>
          showNotice("Save failed — check your connection.")
        );
      }
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
      if (projectId) {
        saveProject(projectId, result.state).catch(() =>
          showNotice("Save failed — check your connection.")
        );
      }
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
      commitStateChange(mergeVertices(state, first, second));
      setSelected([first]);
    });
  }

  function handleLongPressVertex(vertexId: string) {
    runCommand(() => {
      setSelected((prev) => {
        if (prev.includes(vertexId)) {
          return prev.filter((id) => id !== vertexId);
        }
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

  function toModel(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - viewport.x) / viewport.scale,
      y: -(sy - viewport.y) / viewport.scale,
    };
  }

  function toScreen(x: number, y: number) {
    return {
      sx: viewport.x + x * viewport.scale,
      sy: viewport.y - y * viewport.scale,
    };
  }

  function hitTestVertex(modelX: number, modelY: number): string | null {
    const radiusModel = 10 / viewport.scale;
    for (const v of Object.values(state.vertices)) {
      const dx = v.x - modelX;
      const dy = v.y - modelY;
      if (Math.sqrt(dx * dx + dy * dy) <= radiusModel) return v.id;
    }
    return null;
  }

  function hitTestShape(modelX: number, modelY: number): string | null {
    for (const shape of Object.values(state.shapes)) {
      const poly = shape.vertexIds
        .map((vid) => state.vertices[vid])
        .filter(Boolean)
        .map((v) => ({ x: v.x, y: v.y }));
      if (poly.length >= 3 && isPointInPolygon(modelX, modelY, poly)) {
        return shape.id;
      }
    }
    return null;
  }

  function handleBackgroundPointerDown(e: React.PointerEvent) {
    const { x: mx, y: my } = toModel(e.clientX, e.clientY);
    if (hitTestVertex(mx, my)) return;
    const shapeId = hitTestShape(mx, my);
    if (shapeId) return;
    panStart.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
  }

  function handleBackgroundPointerMove(e: React.PointerEvent) {
    if (shapeDrag.current) {
      const { x: mx, y: my } = toModel(e.clientX, e.clientY);
      const dx = mx - shapeDrag.current.lastModelX;
      const dy = my - shapeDrag.current.lastModelY;
      if (dx !== 0 || dy !== 0) {
        setState((s) => translateShape(s, shapeDrag.current!.shapeId, dx, dy));
        shapeDrag.current.lastModelX = mx;
        shapeDrag.current.lastModelY = my;
      }
      return;
    }
    if (!panStart.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setViewport((vp) => ({ ...vp, x: panStart.current!.vx + dx, y: panStart.current!.vy + dy }));
  }

  function handleBackgroundPointerUp(e: React.PointerEvent) {
    if (shapeDrag.current) {
      commitStateChange(state);
      shapeDrag.current = null;
      return;
    }
    if (panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const wasTap = distance < 5;
      panStart.current = null;
      if (wasTap && draft === null && selected.length > 0) {
        setSelected([]);
      }
    }
  }

  function shapeBodyPointerDown(e: React.PointerEvent, shapeId: string) {
    e.stopPropagation();
    longPressTimer.current = window.setTimeout(() => {
      const { x: mx, y: my } = toModel(e.clientX, e.clientY);
      shapeDrag.current = { shapeId, lastModelX: mx, lastModelY: my };
    }, 350);
  }

  function shapeBodyPointerUp(e: React.PointerEvent) {
    e.stopPropagation();
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    handleBackgroundPointerUp(e);
  }

  function handleZoom(delta: number) {
    setViewport((vp) => ({ ...vp, scale: Math.max(2, Math.min(40, vp.scale + delta)) }));
  }


 function handlePlacePreset(presetKey: string) {
  runCommand(() => {
    commitStateChange(placePreset(state, presetKey));
  });
 }
 
  function vertexPointerDown(e: React.PointerEvent, vertexId: string) {
    e.stopPropagation();
    longPressTimer.current = window.setTimeout(() => {
      handleLongPressVertex(vertexId);
    }, 450);
  }

  function vertexPointerUp(e: React.PointerEvent) {
    e.stopPropagation();
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <div className="w-full h-screen bg-white flex flex-col">
      {notice && (
        <div className="bg-amber-500 text-black text-sm px-4 py-2 text-center">
          {notice}
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full touch-none bg-white"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={handleBackgroundPointerUp}
          onPointerLeave={handleBackgroundPointerUp}
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
                onPointerDown={(e) => shapeBodyPointerDown(e, shape.id)}
                onPointerUp={shapeBodyPointerUp}
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
                fill={isSelected ? "#f59e0b" : "#111"}
                stroke="#4f46e5"
                strokeWidth={2}
                onPointerDown={(e) => vertexPointerDown(e, v.id)}
                onPointerUp={vertexPointerUp}
              />
            );
          })}
        </svg>

        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button onClick={() => handleZoom(2)} className="w-10 h-10 bg-neutral-800 text-white rounded-full">+</button>
          <button onClick={() => handleZoom(-2)} className="w-10 h-10 bg-neutral-800 text-white rounded-full">−</button>
        </div>
      </div>

      <div className="bg-neutral-100 border-t border-neutral-300 p-3 flex flex-col gap-3 relative">
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setShapeMenuOpen((v) => !v)}
            className="px-3 py-2 bg-indigo-600 text-white text-sm rounded"
          >
            Shapes ▾
          </button>
          <button onClick={handleNewProject} className="px-3 py-2 bg-neutral-700 text-white text-sm rounded">
            New
          </button>
          <button onClick={handleOpenProjectList} className="px-3 py-2 bg-neutral-700 text-white text-sm rounded">
            Open
          </button>
          <button onClick={handleExport} className="px-3 py-2 bg-emerald-600 text-white text-sm rounded">
            Export
          </button>
          <span className="px-2 text-sm text-neutral-600 truncate max-w-[120px]">{projectName}</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={handleUndo} className="px-3 py-2 bg-neutral-700 text-white text-sm rounded">Undo</button>
          <button onClick={handleRedo} className="px-3 py-2 bg-neutral-700 text-white text-sm rounded">Redo</button>
          <button onClick={handleMerge} className="px-3 py-2 bg-neutral-700 text-white text-sm rounded">Merge</button>
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
          <div className="flex gap-2 items-center bg-white border border-neutral-300 p-3 rounded">
            <label className="text-sm">
              X:
              <input
                type="number"
                value={draft.x}
                onChange={(e) => setDraft({ ...draft, x: Number(e.target.value) })}
                className="ml-1 w-20 bg-neutral-100 px-2 py-1 rounded border border-neutral-300"
              />
            </label>
            <label className="text-sm">
              Y:
              <input
                type="number"
                value={draft.y}
                onChange={(e) => setDraft({ ...draft, y: Number(e.target.value) })}
                className="ml-1 w-20 bg-neutral-100 px-2 py-1 rounded border border-neutral-300"
              />
            </label>
            <button onClick={confirmDraft} className="px-3 py-1 bg-green-600 text-white text-sm rounded">Confirm</button>
            <button onClick={cancelDraft} className="px-3 py-1 bg-neutral-400 text-white text-sm rounded">Cancel</button>
          </div>
        )}

        {selected.length > 0 && (
          <div className="text-neutral-600 text-xs">Selected: {selected.join(", ")}</div>
        )}
      </div>

      {shapeMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end z-50"
          onClick={() => setShapeMenuOpen(false)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-4 flex flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-neutral-500 text-xs uppercase tracking-wide mb-1">
              Choose a shape
            </div>
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => {
                  handlePlacePreset(key);
                  setShapeMenuOpen(false);
                }}
                className="text-left px-4 py-3 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-900"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {projectMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end z-50"
          onClick={() => setProjectMenuOpen(false)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-neutral-500 text-xs uppercase tracking-wide mb-1">
              Your projects
            </div>
            {projects.length === 0 && (
              <div className="text-neutral-400 text-sm px-4 py-3">No saved projects yet.</div>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => handleOpenProject(p.id)}
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
