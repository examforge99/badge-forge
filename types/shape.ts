export interface Point {
  id: string;
  x: number;
  y: number;
}

export interface Shape {
  id: string;
  points: Point[];
  closed: boolean;
  fill: string;
  stroke: string;
}
