import type { DocumentData } from '../types';
import { createEmptyDocument } from '../types';

const KEY = 'pi-invoice-draft-v1';

export function loadDraft(): DocumentData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createEmptyDocument('PI');
    const parsed = JSON.parse(raw) as DocumentData;
    if (!parsed?.items?.length) return createEmptyDocument('PI');
    return parsed;
  } catch {
    return createEmptyDocument('PI');
  }
}

export function saveDraft(doc: DocumentData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    // ignore quota errors
  }
}
