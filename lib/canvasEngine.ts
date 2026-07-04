import { CanvasState, ShapeInstance, Vertex } from "@/types/canvas";
import { PRESETS } from "./presets";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

export function createEmptyState(): CanvasState {
  return { vertices: {}, shapes: {} };
}

export function placePreset(
  state: CanvasState,
  presetKey: string
): CanvasState {
  const preset = PRESETS[presetKey];
  if (!preset) return state;

  const newVertices: Record<string, Vertex> = { ...state.vertices };
  const vertexIds: string[] = [];

  for (const point of preset.points) {
    const id = nextId("v");
    newVertices[id] = { id, x: point.x, y: point.y };
    vertexIds.push(id);
  }

  const shapeId = nextId("s");
  const newShape: ShapeInstance = {
    id: shapeId,
    vertexIds,
    closed: preset.closed,
    fill: "#4f46e5",
    stroke: "#1e1b4b",
    sourcePreset: presetKey,
  };

  return {
    vertices: newVertices,
    shapes: { ...state.shapes, [shapeId]: newShape },
  };
}

export function moveVertex(
  state: CanvasState,
  vertexId: string,
  x: number,
  y: number
): CanvasState {
  if (!state.vertices[vertexId]) return state;
  return {
    ...state,
    vertices: {
      ...state.vertices,
      [vertexId]: { ...state.vertices[vertexId], x, y },
    },
  };
}

function collectReferencedVertexIds(state: CanvasState): Set<string> {
  const referenced = new Set<string>();
  for (const shape of Object.values(state.shapes)) {
    for (const vid of shape.vertexIds) {
      referenced.add(vid);
    }
  }
  return referenced;
}

function garbageCollectVertices(state: CanvasState): CanvasState {
  const referenced = collectReferencedVertexIds(state);
  const newVertices: Record<string, Vertex> = {};
  for (const [id, vertex] of Object.entries(state.vertices)) {
    if (referenced.has(id)) {
      newVertices[id] = vertex;
    }
  }
  return { ...state, vertices: newVertices };
}

function removeShapesBelowMinimum(state: CanvasState): CanvasState {
  const newShapes: Record<string, ShapeInstance> = {};
  for (const [id, shape] of Object.entries(state.shapes)) {
    if (shape.vertexIds.length >= 2) {
      newShapes[id] = shape;
    }
  }
  return { ...state, shapes: newShapes };
}

export function deleteVertex(
  state: CanvasState,
  vertexId: string
): CanvasState {
  let next: CanvasState = {
    ...state,
    shapes: Object.fromEntries(
      Object.entries(state.shapes).map(([id, shape]) => [
        id,
        {
          ...shape,
          vertexIds: shape.vertexIds.filter((vid) => vid !== vertexId),
        },
      ])
    ),
  };
  next = removeShapesBelowMinimum(next);
  next = garbageCollectVertices(next);
  return next;
}

export function deleteShape(
  state: CanvasState,
  shapeId: string
): CanvasState {
  const { [shapeId]: _removed, ...remainingShapes } = state.shapes;
  const next: CanvasState = { ...state, shapes: remainingShapes };
  return garbageCollectVertices(next);
}

// Merge vertex B into vertex A. B disappears, A keeps its own coordinates.
// Every shape referencing B now references A instead.
export function mergeVertices(
  state: CanvasState,
  keepId: string,
  mergeId: string
): CanvasState {
  if (keepId === mergeId) return state;
  if (!state.vertices[keepId] || !state.vertices[mergeId]) return state;

  const newShapes: Record<string, ShapeInstance> = {};
  for (const [id, shape] of Object.entries(state.shapes)) {
    newShapes[id] = {
      ...shape,
      vertexIds: shape.vertexIds.map((vid) =>
        vid === mergeId ? keepId : vid
      ),
    };
  }

  let next: CanvasState = { ...state, shapes: newShapes };
  next = garbageCollectVertices(next);
  return next;
                   }
