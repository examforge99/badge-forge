import { Preset } from "@/types/canvas";

export const PRESETS: Record<string, Preset> = {
  triangle: {
    name: "Triangle",
    closed: true,
    points: [
      { x: 0, y: 10 },
      { x: 10, y: -10 },
      { x: -10, y: -10 },
    ],
  },
  rectangle: {
    name: "Rectangle",
    closed: true,
    points: [
      { x: -8, y: 10 },
      { x: 8, y: 10 },
      { x: 8, y: -10 },
      { x: -8, y: -10 },
    ],
  },
  parallelogram: {
    name: "Parallelogram",
    closed: true,
    points: [
      { x: -4, y: 10 },
      { x: 8, y: 10 },
      { x: 4, y: -10 },
      { x: -8, y: -10 },
    ],
  },
};
