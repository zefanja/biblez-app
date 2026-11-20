// What a card looks like in the app (stage → prompt).

import type { Snapshot } from "./engine";
import type { Card, Collection, Segment, Stage } from "./model";
import { firstLetters, maskLastLetters } from "./text/words";

export interface CardFace {
  collection: Collection;
  segment: Segment;
  stage: Stage;
  /** e.g. "Johannes 3,16c" or "Psalm 23 · Vers 4b" */
  reference: string;
  /** Up to two previous segments, as context. */
  context: string[];
  /** Hint shown before revealing; null on stage 3 (recall from context/reference only). */
  prompt: string | null;
  answer: string;
}

export const CONTEXT_SEGMENTS = 2;

export function segmentsOf(snapshot: Snapshot, collectionId: string): Segment[] {
  return snapshot.segments.filter((s) => s.collectionId === collectionId).sort((a, b) => a.position - b.position);
}

export function segmentReference(collection: Collection, segment: Segment, segmentCount: number): string {
  if (collection.kind === "verse") return segmentCount > 1 ? `${collection.title}${segment.part}` : collection.title;
  return `${collection.title} · ${segment.verseNumber}${segment.part}`;
}

export function stageHint(stage: Stage, text: string): string | null {
  if (stage === 1) return maskLastLetters(text);
  if (stage === 2) return firstLetters(text);
  return null;
}

export function cardFace(snapshot: Snapshot, card: Card): CardFace {
  const segment = snapshot.segments.find((s) => s.id === card.segmentId);
  if (!segment) throw new Error(`segment missing for card ${card.id}`);
  const collection = snapshot.collections.find((c) => c.id === segment.collectionId);
  if (!collection) throw new Error(`collection missing for segment ${segment.id}`);
  const all = segmentsOf(snapshot, collection.id);
  const idx = all.findIndex((s) => s.id === segment.id);
  return {
    collection,
    segment,
    stage: card.stage,
    reference: segmentReference(collection, segment, all.length),
    context: all.slice(Math.max(0, idx - CONTEXT_SEGMENTS), idx).map((s) => s.text),
    prompt: stageHint(card.stage, segment.text),
    answer: segment.text,
  };
}
