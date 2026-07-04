import { CanvasState } from "@/types/canvas";

const MAX_HISTORY = 5;

export interface HistoryStack {
  past: CanvasState[];
  future: CanvasState[];
}

export function createHistory(): HistoryStack {
  return { past: [], future: [] };
}

export function pushHistory(
  history: HistoryStack,
  previousState: CanvasState
): HistoryStack {
  const past = [...history.past, previousState].slice(-MAX_HISTORY);
  return { past, future: [] };
}

export function undo(
  history: HistoryStack,
  currentState: CanvasState
): { history: HistoryStack; state: CanvasState } | null {
  if (history.past.length === 0) return null;
  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);
  const newFuture = [currentState, ...history.future].slice(0, MAX_HISTORY);
  return {
    history: { past: newPast, future: newFuture },
    state: previous,
  };
}

export function redo(
  history: HistoryStack,
  currentState: CanvasState
): { history: HistoryStack; state: CanvasState } | null {
  if (history.future.length === 0) return null;
  const next = history.future[0];
  const newFuture = history.future.slice(1);
  const newPast = [...history.past, currentState].slice(-MAX_HISTORY);
  return {
    history: { past: newPast, future: newFuture },
    state: next,
  };
}
