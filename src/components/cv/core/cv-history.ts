import { CVDocument, cloneCVDocument } from './cv-document';

export interface CVHistoryState {
  past: CVDocument[];
  present: CVDocument;
  future: CVDocument[];
}

export const CV_HISTORY_LIMIT = 50;

export function createCVHistory(document: CVDocument): CVHistoryState {
  return { past: [], present: cloneCVDocument(document), future: [] };
}

export function commitCVHistory(state: CVHistoryState, next: CVDocument): CVHistoryState {
  const previous = cloneCVDocument(state.present);
  const past = [...state.past, previous].slice(-CV_HISTORY_LIMIT);
  return { past, present: cloneCVDocument(next), future: [] };
}

export function undoCVHistory(state: CVHistoryState): CVHistoryState {
  const previous = state.past[state.past.length - 1];
  if (!previous) return state;
  return {
    past: state.past.slice(0, -1),
    present: cloneCVDocument(previous),
    future: [cloneCVDocument(state.present), ...state.future].slice(0, CV_HISTORY_LIMIT),
  };
}

export function redoCVHistory(state: CVHistoryState): CVHistoryState {
  const next = state.future[0];
  if (!next) return state;
  return {
    past: [...state.past, cloneCVDocument(state.present)].slice(-CV_HISTORY_LIMIT),
    present: cloneCVDocument(next),
    future: state.future.slice(1),
  };
}

export function canUndoCVHistory(state: CVHistoryState): boolean {
  return state.past.length > 0;
}

export function canRedoCVHistory(state: CVHistoryState): boolean {
  return state.future.length > 0;
}
