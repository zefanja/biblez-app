import { chunkVerse, parseVerses, SAMPLES, type SamplePassage } from "@biblez/core";
import { useMemo, useState } from "react";
import { go } from "../App";
import { useT } from "../i18n";
import { actions, useApp } from "../store";
import { Icon, Switch } from "../ui";

export function Add() {
  const t = useT();
  const { snapshot, ui } = useApp();
  const [mode, setMode] = useState<"samples" | "text">("samples");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [learnReference, setLearnReference] = useState(true);

  const verses = useMemo(() => (text.trim() ? parseVerses(text) : []), [text]);
  const chunks = useMemo(() => verses.map((v) => chunkVerse(v.text)), [verses]);
  const chunkCount = chunks.reduce((n, c) => n + c.length, 0);
  const existing = new Set(snapshot.collections.map((c) => `${c.title}|${c.translation}`));
  const samples = [...SAMPLES].sort((a, b) => Number(b.language === ui.lang) - Number(a.language === ui.lang));

  const addSample = (s: SamplePassage) => {
    const id = actions.addCollection({ title: s.title, verses: s.verses, translation: s.translation, source: "bundled", learnReference });
    go(`read/${id}`, true);
  };
  const addText = () => {
    const id = actions.addCollection({ title: title.trim() || verses[0]?.text.slice(0, 30) || "?", verses, chunks, source: "custom", learnReference });
    go(`read/${id}`, true);
  };

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
              <button key={s.id} className="list-row" onClick={() => addSample(s)} disabled={added} style={{ opacity: added ? 0.5 : 1 }}>
                <span className="stack" style={{ gap: 2 }}>
                  <span>{s.title}</span>
                  <span className="tiny muted" style={{ fontWeight: 400 }}>
                    {s.translation} · {s.verses.length === 1 ? t("singleVerse") : t("verseCount", { n: s.verses.length })}
                    {added ? ` · ${t("alreadyAdded")}` : ""}
                  </span>
                </span>
                <Icon name="plus" size={20} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          <label className="field">
            {t("title")}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} />
          </label>
          <label className="field">
            {t("pasteText")}
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("pastePlaceholder")} rows={7} />
          </label>
          {verses.length > 0 && (
            <>
              <div className="tip"><Icon name="check" size={18} /><span>{t("detected", { v: verses.length, c: chunkCount })}</span></div>
              <div className="card chunk-list" style={{ maxHeight: 280, overflow: "auto" }}>
                {verses.map((v, vi) => chunks[vi]!.map((c, ci) => (
                  <div className="chunk" key={`${vi}-${ci}`}>
                    <span className="tag">{v.number}{String.fromCharCode(97 + ci)}</span>
                    <span className="verse small">{c}</span>
                  </div>
                )))}
              </div>
            </>
          )}
          <span className="small muted">{t("privateText")}</span>
        </div>
      )}

      {(mode === "text" ? verses.length > 1 : true) && (
        <div className="list">
          <button className="list-row" onClick={() => setLearnReference(!learnReference)} aria-pressed={learnReference}>
            {t("learnReference")}
            <Switch on={learnReference} />
          </button>
        </div>
      )}

      {mode === "text" && (
        <>
          <div className="grow" />
          <button className="btn primary lg" onClick={addText} disabled={verses.length === 0}>{t("create")}</button>
        </>
      )}
    </>
  );
}
