import {
  chunkVerse, extractPassage, formatReference, isReference, parseReference, parseVerses, POPULAR_REFERENCES, validateReference,
  type TranslationInfo, type Verse,
} from "@biblez/core";
import { useEffect, useMemo, useState } from "react";
import { go } from "../App";
import { DEFAULT_TRANSLATION, loadBook, loadIndex, loadTranslations } from "../bible";
import { ChunkEditor } from "../ChunkEditor";
import { useT, type T } from "../i18n";
import { actions, useApp } from "../store";
import { Icon, Switch } from "../ui";

const autoChunks = (verses: Verse[]) => verses.map((v) => chunkVerse(v.text));
const EMPTY: Verse[] = [];

type Lookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ok"; title: string; verses: Verse[] };

/** Resolves a typed reference against the chosen translation. */
function useReferenceLookup(input: string, translation: TranslationInfo | undefined, t: T): Lookup {
  const [result, setResult] = useState<Lookup>({ state: "idle" });
  useEffect(() => {
    if (!translation || !input.trim()) {
      setResult({ state: "idle" });
      return;
    }
    const parsed = parseReference(input);
    if (!isReference(parsed)) {
      setResult({ state: "error", message: parsed === "book" ? t("refBook") : t("refFormat") });
      return;
    }
    let cancelled = false;
    setResult({ state: "loading" });
    const timer = setTimeout(async () => {
      try {
        const index = await loadIndex(translation.id);
        const problem = validateReference(index, parsed);
        if (problem) {
          const messages = { chapter: t("refChapter"), verse: t("refVerse"), missing_book: t("refBook"), too_long: t("refTooLong") };
          if (!cancelled) setResult({ state: "error", message: messages[problem] });
          return;
        }
        const book = await loadBook(translation.id, parsed.book);
        const verses = extractPassage(book, parsed, translation.language);
        if (!cancelled) setResult({ state: "ok", title: formatReference(parsed, translation.language), verses });
      } catch {
        if (!cancelled) setResult({ state: "error", message: t("loadFailed") });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, translation, t]);
  return result;
}

export function Add() {
  const t = useT();
  const { snapshot, ui } = useApp();
  const [mode, setMode] = useState<"reference" | "text">("reference");
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [translationId, setTranslationId] = useState(ui.translation ?? DEFAULT_TRANSLATION[ui.lang]);
  const [reference, setReference] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [learnReference, setLearnReference] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadTranslations().then(setTranslations).catch(() => setLoadError(true));
  }, []);
  const translation = translations.find((x) => x.id === translationId) ?? translations[0];
  const lookup = useReferenceLookup(reference, translation, t);

  const textVerses = useMemo(() => (text.trim() ? parseVerses(text) : EMPTY), [text]);
  const verses = mode === "reference" ? (lookup.state === "ok" ? lookup.verses : EMPTY) : textVerses;
  const [chunks, setChunks] = useState<string[][]>([]);
  useEffect(() => setChunks(autoChunks(verses)), [verses]);
  const chunkCount = chunks.reduce((n, c) => n + c.length, 0);
  const edited = JSON.stringify(chunks) !== JSON.stringify(autoChunks(verses));

  const collectionTitle = mode === "reference" && lookup.state === "ok" ? lookup.title : title.trim();
  const duplicate = mode === "reference" && snapshot.collections.some((c) => c.title === collectionTitle && c.translation === translation?.name);

  const chooseTranslation = (id: string) => {
    setTranslationId(id);
    actions.updateUi({ translation: id });
  };

  const create = () => {
    const id =
      mode === "reference" && translation
        ? actions.addCollection({ title: collectionTitle, verses, chunks, translation: translation.name, source: "bundled", learnReference })
        : actions.addCollection({ title: collectionTitle || verses[0]?.text.slice(0, 30) || "?", verses, chunks, source: "custom", learnReference });
    go(`read/${id}`, true);
  };

  const suggestions = POPULAR_REFERENCES.map((p) => p[translation?.language ?? ui.lang]);
  const byLanguage = (lang: "de" | "en") => translations.filter((x) => x.language === lang);
  const otherLang: "de" | "en" = ui.lang === "de" ? "en" : "de";

  return (
    <>
      <div className="row between">
        <button className="btn ghost" onClick={() => history.back()} style={{ marginLeft: -12 }}>{t("cancel")}</button>
        <span style={{ fontWeight: 700 }}>{t("addVerse")}</span>
        <span style={{ width: 80 }} />
      </div>

      <div className="seg" role="group">
        <button aria-pressed={mode === "reference"} onClick={() => setMode("reference")}>{t("bibleReference")}</button>
        <button aria-pressed={mode === "text"} onClick={() => setMode("text")}>{t("ownText")}</button>
      </div>

      {mode === "reference" ? (
        <>
          {loadError && <div className="warn"><Icon name="info" size={18} /><span>{t("loadFailed")}</span></div>}
          <div className="ref-grid">
            <label className="field">
              {t("reference")}
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("referencePlaceholder")} autoComplete="off" autoCapitalize="words" enterKeyHint="done" />
            </label>
            <label className="field">
              {t("translation")}
              <select value={translation?.id ?? ""} onChange={(e) => chooseTranslation(e.target.value)}>
                {([ui.lang, otherLang] as const).map((lang) => (
                  <optgroup key={lang} label={lang === "de" ? "Deutsch" : "English"}>
                    {byLanguage(lang).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          {lookup.state === "error" && <span className="small" style={{ color: "var(--warn-text)" }} role="alert">{lookup.message}</span>}
          {lookup.state === "loading" && <span className="small muted">{t("loading")}</span>}
          {lookup.state === "idle" && (
            <div className="stack" style={{ gap: 8 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>{t("suggestions")}</span>
              <div className="chips">
                {suggestions.map((s) => <button key={s} className="chip" onClick={() => setReference(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {lookup.state === "ok" && translation && (
            <span className="small muted">
              <strong style={{ color: "var(--text)" }}>{lookup.title}</strong> · {translation.name} · {translation.license === "Public Domain" ? t("publicDomain") : translation.license}
              {duplicate ? ` · ${t("alreadyAdded")}` : ""}
            </span>
          )}
        </>
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
        </>
      )}

      {verses.length > 0 && chunks.length === verses.length && (
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
      )}

      {verses.length > 1 && (
        <div className="list">
          <button className="list-row" onClick={() => setLearnReference(!learnReference)} aria-pressed={learnReference}>
            {t("learnReference")}
            <Switch on={learnReference} />
          </button>
        </div>
      )}
      {mode === "text" && <span className="small muted">{t("privateText")}</span>}
      <div className="grow" />
      <button className="btn primary lg" onClick={create} disabled={verses.length === 0 || duplicate}>{t("create")}</button>
    </>
  );
}
