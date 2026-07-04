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

// Split a shared vertex back into independent vertices, one per shape
// that currently references it. All new vertices start stacked at the
// same coordinates as the original. If only one shape references it,
// there's nothing to split, so the state is returned unchanged.
export function splitVertex(
  state: CanvasState,
  vertexId: string
): CanvasState {
  const sharingShapeIds = Object.values(state.shapes)
    .filter((shape) => shape.vertexIds.includes(vertexId))
    .map((shape) => shape.id);

  if (sharingShapeIds.length <= 1) return state;

  const original = state.vertices[vertexId];
  if (!original) return state;

  const newVertices: Record<string, Vertex> = { ...state.vertices };
  const newShapes: Record<string, ShapeInstance> = { ...state.shapes };

  for (const shapeId of sharingShapeIds) {
    const freshId = nextId("v");
    newVertices[freshId] = { id: freshId, x: original.x, y: original.y };

    const shape = newShapes[shapeId];
    newShapes[shapeId] = {
      ...shape,
      vertexIds: shape.vertexIds.map((vid) =>
        vid === vertexId ? freshId : vid
      ),
    };
  }

  let next: CanvasState = { vertices: newVertices, shapes: newShapes };
  next = garbageCollectVertices(next);
  return next;
}

// How many shapes currently reference this vertex. Used to decide
// whether "Split" should be offered for a selected vertex.
export function countShapesSharingVertex(
  state: CanvasState,
  vertexId: string
): number {
  return Object.values(state.shapes).filter((shape) =>
    shape.vertexIds.includes(vertexId)
  ).length;
}

// Find every shape transitively connected to the given shape via shared
// vertices — i.e. its connected component in the vertex-sharing graph.
// Used so dragging one shape in a fused cluster drags the whole cluster.
export function findConnectedShapes(
  state: CanvasState,
  startShapeId: string
): string[] {
  const visited = new Set<string>();
  const queue: string[] = [startShapeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentShape = state.shapes[currentId];
    if (!currentShape) continue;

    for (const vid of currentShape.vertexIds) {
      for (const [otherId, otherShape] of Object.entries(state.shapes)) {
        if (!visited.has(otherId) && otherShape.vertexIds.includes(vid)) {
          queue.push(otherId);
        }
      }
    }
  }

  return Array.from(visited);
}

export function translateShape(
  state: CanvasState,
  shapeId: string,
  dx: number,
  dy: number
): CanvasState {
  const shape = state.shapes[shapeId];
  if (!shape) return state;

  const newVertices = { ...state.vertices };
  for (const vid of shape.vertexIds) {
    const v = newVertices[vid];
    if (v) {
      newVertices[vid] = { ...v, x: v.x + dx, y: v.y + dy };
    }
  }
  return { ...state, vertices: newVertices };
}

// Translate every shape in a shape's connected component together,
// as one rigid unit — this is what a fused multi-shape badge drag uses.
export function translateConnectedShapes(
  state: CanvasState,
  startShapeId: string,
  dx: number,
  dy: number
): CanvasState {
  const connectedIds = findConnectedShapes(state, startShapeId);
  const vertexIdsToMove = new Set<string>();

  for (const shapeId of connectedIds) {
    const shape = state.shapes[shapeId];
    if (!shape) continue;
    for (const vid of shape.vertexIds) {
      vertexIdsToMove.add(vid);
    }
  }

  const newVertices = { ...state.vertices };
  for (const vid of vertexIdsToMove) {
    const v = newVertices[vid];
    if (v) {
      newVertices[vid] = { ...v, x: v.x + dx, y: v.y + dy };
    }
  }
  return { ...state, vertices: newVertices };
         }
