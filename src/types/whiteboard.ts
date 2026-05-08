export type Point = { x: number; y: number };
export type StrokeStyle = { color: string; width: number };
export type User = { id: string; name: string; color: string };

export type Stroke = {
  strokeID: string;
  author: { id: string; name: string };
  points: Point[];
  style: StrokeStyle;
  zIndex: number;
};

export type ChatMessage = {
  id: string;
  author: { id: string; name: string };
  body: string;
  createdAt: string;
};

export type Cursor = {
  user: User;
  x: number;
  y: number;
};
