// Domain model (product brief, section 3 and 7).
// Every scheduled Card maps 1:1 to an Anki card; Reviews are append-only.

export type Rating = "again" | "good";

/** 1 = last letters masked (Anki Card 1), 2 = first letters (Card 2), 3 = context/reference only (Card 4). */
export type Stage = 1 | 2 | 3;
export const STAGES: readonly Stage[] = [1, 2, 3];

export interface Collection {
  id: string;
  title: string;
  /** "verse" = a single verse, "passage" = several verses. */
  kind: "verse" | "passage";
  translation: string | null;
  source: "bundled" | "custom";
  /** Show the reference prominently on stage 3 (always true for single verses). */
  learnReference: boolean;
  createdAt: number;
  ankiDeckId: number;
  /**
   * Note type id in the user's Anki collection when the collection was imported
   * from Anki; exports reuse it so Anki updates the existing notes. null = BibleZ's own.
   */
  ankiNotetypeId?: number | null;
}

export interface Segment {
  id: string;
  collectionId: string;
  /** Order within the collection, starting at 0. */
  position: number;
  verseNumber: string;
  /** "a", "b", … within the verse. */
  part: string;
  text: string;
  ankiNoteId: number;
  ankiGuid: string;
}

export interface Card {
  id: string;
  segmentId: string;
  stage: Stage;
  ankiCardId: number;
  /** When this stage became active; null = still locked. */
  unlockedAt: number | null;
  /** When the next stage took over; the card then rests (suspended in Anki). */
  retiredAt: number | null;
}

export interface Review {
  id: string;
  cardId: string;
  reviewedAt: number;
  rating: Rating;
  durationMs: number;
}

export interface Settings {
  newSegmentsPerDay: number;
  desiredRetention: number;
  /** Stability (days) a stage needs before the next one unlocks. */
  unlockStabilityDays: number;
  /** Stability (days) on stage 3 for a verse to count as "safe". */
  safeStabilityDays: number;
  /** Hour at which a new learning day starts (like Anki's rollover). */
  dayStartHour: number;
  /** Advanced: all stages active at once (classic Anki behaviour). */
  allStagesAtOnce: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  newSegmentsPerDay: 5,
  desiredRetention: 0.9,
  unlockStabilityDays: 7,
  safeStabilityDays: 21,
  dayStartHour: 4,
  allStagesAtOnce: false,
};
