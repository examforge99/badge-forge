import { CanvasState } from "@/types/canvas";

export function canvasStateToSvgString(state: CanvasState): string {
  const shapes = Object.values(state.shapes);

  if (shapes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>`;
  }

  // Find bounding box across all vertices actually used by shapes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of shapes) {
    for (const vid of shape.vertexIds) {
      const v = state.vertices[vid];
      if (!v) continue;
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
    }
  }

  const padding = 5;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const width = maxX - minX;
  const height = maxY - minY;

  // Flip y for screen-space SVG (model space has +y up, SVG has +y down)
  function toSvgCoords(x: number, y: number) {
    return { sx: x - minX, sy: maxY - y };
  }

  const pathElements = shapes
    .map((shape) => {
      const coords = shape.vertexIds
        .map((vid) => state.vertices[vid])
        .filter(Boolean)
        .map((v) => toSvgCoords(v.x, v.y));
      if (coords.length === 0) return "";

      const [first, ...rest] = coords;
      const d = [
        `M ${first.sx} ${first.sy}`,
        ...rest.map((c) => `L ${c.sx} ${c.sy}`),
      ];
      if (shape.closed) d.push("Z");

      return `<path d="${d.join(" ")}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="1" />`;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${pathElements}
</svg>`;
}

export function downloadSvg(state: CanvasState, filename: string): void {
  const svgString = canvasStateToSvgString(state);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
