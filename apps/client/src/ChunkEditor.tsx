import { mergeChunks, splitChunk, wordCount, type Verse } from "@biblez/core";
import { useState } from "react";
import { useT } from "./i18n";

const LONG_CHUNK = 8;

interface Props {
  verses: Verse[];
  chunks: string[][];
  onChange: (chunks: string[][]) => void;
}

/**
 * Lets the user adjust the automatic chunking before a collection is created:
 * tap a chunk, then tap the word that should start a new chunk (split), or
 * join two neighbouring chunks of the same verse (merge).
 */
export function ChunkEditor({ verses, chunks, onChange }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const multi = verses.length > 1;

  const update = (vi: number, next: string[]) => onChange(chunks.map((c, i) => (i === vi ? next : c)));

  return (
    <div className="chunk-editor">
      {verses.map((verse, vi) => {
        const verseChunks = chunks[vi] ?? [];
        return (
          <div key={vi} className="chunk-verse">
            {verseChunks.map((text, ci) => {
              const id = `${vi}-${ci}`;
              const isSelected = selected === id;
              const words = text.split(/\s+/).filter(Boolean);
              const count = wordCount(text);
              const tag = `${multi ? verse.number : ""}${String.fromCharCode(97 + ci)}`;
              return (
                <div key={id}>
                  {ci > 0 && (
                    <button
                      className="merge-btn"
                      onClick={() => { update(vi, mergeChunks(verseChunks, ci - 1)); setSelected(null); }}
                      aria-label={t("mergeLabel", { a: `${multi ? verse.number : ""}${String.fromCharCode(96 + ci)}`, b: tag })}
                    >
                      {t("merge")}
                    </button>
                  )}
                  <div className={`chunk-box${isSelected ? " selected" : ""}`}>
                    <button className="chunk-main" onClick={() => setSelected(isSelected ? null : id)} aria-expanded={isSelected}>
                      <span className="tag">{tag}</span>
                      <span className="verse small" style={{ flex: 1 }}>{text}</span>
                      <span className={`tiny ${count > LONG_CHUNK ? "long" : "muted"}`}>{count === 1 ? t("oneWord") : t("words", { n: count })}</span>
                    </button>
                    {isSelected && (
                      <div className="split-area">
                        <span className="tiny muted">{words.length > 1 ? t("splitHint") : t("splitTooShort")}</span>
                        <div className="word-chips">
                          {words.map((w, wi) => (
                            <button
                              key={wi}
                              className="word-chip"
                              disabled={wi === 0}
                              onClick={() => { update(vi, splitChunk(verseChunks, ci, wi)); setSelected(`${vi}-${ci + 1}`); }}
                              aria-label={wi === 0 ? w : t("splitBefore", { word: w })}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
