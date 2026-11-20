import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating as FsrsRating,
  State,
  type Card as FsrsCard,
  type FSRS,
  type ReviewLog as FsrsLog,
} from "ts-fsrs";
import type { Rating, Review } from "../model";

export { State };
export type { FsrsCard };

export interface ReplayStep {
  review: Review;
  before: FsrsCard;
  after: FsrsCard;
  log: FsrsLog;
}

export interface ReplayResult {
  card: FsrsCard;
  steps: ReplayStep[];
}

const schedulers = new Map<number, FSRS>();

/**
 * FSRS scheduler. One learning step (1m): "again" on a new card brings it back
 * in the same session, "good" graduates it. Relearning step 10m. No fuzz.
 */
export function scheduler(desiredRetention: number): FSRS {
  let f = schedulers.get(desiredRetention);
  if (!f) {
    f = fsrs(
      generatorParameters({
        request_retention: desiredRetention,
        enable_fuzz: false,
        enable_short_term: true,
        learning_steps: ["1m"],
        relearning_steps: ["10m"],
      }),
    );
    schedulers.set(desiredRetention, f);
  }
  return f;
}

export function toFsrsRating(r: Rating): FsrsRating.Again | FsrsRating.Good {
  return r === "again" ? FsrsRating.Again : FsrsRating.Good;
}

/**
 * The card state is never stored as truth: it is derived by replaying the
 * review log. This keeps sync simple and the Anki export complete.
 */
export function replay(reviews: readonly Review[], desiredRetention: number, createdAt: number): ReplayResult {
  const f = scheduler(desiredRetention);
  let card = createEmptyCard(new Date(createdAt));
  const steps: ReplayStep[] = [];
  const sorted = [...reviews].sort((a, b) => a.reviewedAt - b.reviewedAt);
  for (const review of sorted) {
    const before = card;
    const { card: after, log } = f.next(card, new Date(review.reviewedAt), toFsrsRating(review.rating));
    steps.push({ review, before, after, log });
    card = after;
  }
  return { card, steps };
}
