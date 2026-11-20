import { chunkVerse, parseVerses, SAMPLES, type SamplePassage, type Verse } from "@biblez/core";
import { useEffect, useMemo, useState } from "react";
import { go } from "../App";
import { ChunkEditor } from "../ChunkEditor";
import { useT } from "../i18n";
import { actions, useApp } from "../store";
import { Icon, Switch } from "../ui";

const autoChunks = (verses: Verse[]) => verses.map((v) => chunkVerse(v.text));

export function Add() {
  const t = useT();
  const { snapshot, ui } = useApp();
  const [mode, setMode] = useState<"samples" | "text">("samples");
  const [sample, setSample] = useState<SamplePassage | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [learnReference, setLearnReference] = useState(true);

  const textVerses = useMemo(() => (text.trim() ? parseVerses(text) : []), [text]);
  const verses = sample ? sample.verses : textVerses;
  const [chunks, setChunks] = useState<string[][]>([]);
  // new text or another passage → start again from the automatic split
  useEffect(() => setChunks(autoChunks(verses)), [verses]);
  const chunkCount = chunks.reduce((n, c) => n + c.length, 0);
  const edited = JSON.stringify(chunks) !== JSON.stringify(autoChunks(verses));

  const existing = new Set(snapshot.collections.map((c) => `${c.title}|${c.translation}`));
  const samples = [...SAMPLES].sort((a, b) => Number(b.language === ui.lang) - Number(a.language === ui.lang));

  const create = () => {
    const id = sample
      ? actions.addCollection({ title: sample.title, verses: sample.verses, chunks, translation: sample.translation, source: "bundled", learnReference })
      : actions.addCollection({ title: title.trim() || verses[0]?.text.slice(0, 30) || "?", verses, chunks, source: "custom", learnReference });
    go(`read/${id}`, true);
  };

  const editor = verses.length > 0 && chunks.length === verses.length && (
    <>
      <div className="row between">
        <h2>{t("reviewChunks")}</h2>
        {edited && <button className="btn ghost" style={{ minHeight: 36, padding: 0 }} onClick={() => setChunks(autoChunks(verses))}>{t("resetChunks")}</button>}
      </div>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>
        {t("detected", { v: verses.length, c: chunkCount })}. {t("chunkHelp")}
      </p>
      <ChunkEditor verses={verses} chunks={chunks} onChange={setChunks} />
    </>
  );

  const referenceToggle = verses.length > 1 && (
    <div className="list">
      <button className="list-row" onClick={() => setLearnReference(!learnReference)} aria-pressed={learnReference}>
        {t("learnReference")}
        <Switch on={learnReference} />
      </button>
    </div>
  );

  // Step 2 for a suggestion: review chunks, then create
  if (sample) {
    return (
      <>
        <div className="row">
          <button className="icon-btn" onClick={() => setSample(null)} aria-label={t("back")} style={{ marginLeft: -10 }}>
            <Icon name="back" />
          </button>
          <div className="stack" style={{ gap: 0 }}>
            <span style={{ fontWeight: 700 }}>{sample.title}</span>
            <span className="tiny muted">{sample.translation}</span>
          </div>
        </div>
        {editor}
        {referenceToggle}
        <div className="grow" />
        <button className="btn primary lg" onClick={create}>{t("create")}</button>
      </>
    );
  }

  return (
    <>
      <div className="row between">
        <button className="btn ghost" onClick={() => history.back()} style={{ marginLeft: -12 }}>{t("cancel")}</button>
        <span style={{ fontWeight: 700 }}>{t("addVerse")}</span>
        <span style={{ width: 80 }} />
      </div>

      <div className="seg" role="group">
        <button aria-pressed={mode === "samples"} onClick={() => setMode("samples")}>{t("suggestions")}</button>
        <button aria-pressed={mode === "text"} onClick={() => setMode("text")}>{t("ownText")}</button>
      </div>

      {mode === "samples" ? (
        <div className="list">
          {samples.map((s) => {
            const added = existing.has(`${s.title}|${s.translation}`);
            return (
              <button key={s.id} className="list-row" onClick={() => setSample(s)} disabled={added} style={{ opacity: added ? 0.5 : 1 }}>
                <span className="stack" style={{ gap: 2 }}>
                  <span>{s.title}</span>
                  <span className="tiny muted" style={{ fontWeight: 400 }}>
                    {s.translation} · {s.verses.length === 1 ? t("singleVerse") : t("verseCount", { n: s.verses.length })}
                    {added ? ` · ${t("alreadyAdded")}` : ""}
                  </span>
                </span>
                <Icon name="chevron" size={20} />
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <label className="field">
            {t("title")}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} />
          </label>
          <label className="field">
            {t("pasteText")}
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("pastePlaceholder")} rows={6} />
          </label>
          {editor}
          {referenceToggle}
          <span className="small muted">{t("privateText")}</span>
          <div className="grow" />
          <button className="btn primary lg" onClick={create} disabled={verses.length === 0}>{t("create")}</button>
        </>
      )}
    </>
  );
}
