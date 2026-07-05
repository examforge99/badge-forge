export interface Vertex {
  id: string;
  x: number;
  y: number;
}

export interface ShapeInstance {
  id: string;
  vertexIds: string[];
  closed: boolean;
  fill: string;
  stroke: string;
  sourcePreset: string;
}

export interface PresetPoint {
  x: number;
  y: number;
}

export interface Preset {
  name: string;
  points: PresetPoint[];
  closed: boolean;
}

export interface ShapeEffect {
  baseColor: string;
  mixTarget: "white" | "black"; // tint or shade
  mixPercentage: number; // 0-100
}

export interface CanvasState {
  vertices: Record<string, Vertex>;
  shapes: Record<string, ShapeInstance>;
  effects?: Record<string, ShapeEffect>; // shapeId -> effect, written by /style
}

export interface Draft {
  vertexId: string;
  x: number;
  y: number;
}
