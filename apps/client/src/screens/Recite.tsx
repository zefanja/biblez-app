import { collectionProgress, firstLetters, maskLastLetters, segmentsOf } from "@biblez/core";
import { useMemo, useState } from "react";
import { go } from "../App";
import { useT } from "../i18n";
import { useApp } from "../store";
import { Icon } from "../ui";

/** 0 = number only, 1 = first letters, 2 = word endings missing, 3 = full text. */
type Level = 0 | 1 | 2 | 3;
const INITIAL_VISIBLE = 2;

export function Recite({ collectionId }: { collectionId: string }) {
  const t = useT();
  const { snapshot, settings } = useApp();
  const collection = snapshot.collections.find((c) => c.id === collectionId);

  const verses = useMemo(() => {
    if (!collection) return [];
    const progress = collectionProgress(snapshot, collectionId, Date.now(), settings);
    const segs = segmentsOf(snapshot, collectionId);
    return progress.verses.map((v) => ({
      number: v.verseNumber,
      text: segs.filter((s) => s.verseNumber === v.verseNumber).map((s) => s.text).join(" "),
      initial: (v.safe ? 0 : v.stage >= 2 ? 1 : 2) as Level,
    }));
    // computed once per visit: reciting does not change the schedule
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  const initial = () => ({ visible: Math.min(INITIAL_VISIBLE, verses.length), levels: verses.map((v) => v.initial) });
  const [state, setState] = useState(initial);

  if (!collection) {
    go("verses", true);
    return null;
  }

  const bump = (i: number) => setState((s) => ({ ...s, levels: s.levels.map((l, j) => (j === i ? (Math.min(3, l + 1) as Level) : l)) }));
  const label = (l: Level) => [t("levelSafe"), t("levelFirst"), t("levelLast"), t("levelFull")][l];
  const render = (text: string, l: Level) => (l === 0 ? "· · · · · · · · · · ·" : l === 1 ? firstLetters(text) : l === 2 ? maskLastLetters(text) : text);
  const hidden = verses.length - state.visible;

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <button className="icon-btn" onClick={() => history.back()} aria-label={t("close")} style={{ marginLeft: -10 }}>
          <Icon name="close" />
        </button>
        <div className="stack grow" style={{ gap: 0 }}>
          <span style={{ fontWeight: 700 }}>{collection.title}</span>
          <span className="tiny muted">{t("recitePlanNote")}</span>
        </div>
        <button className="btn ghost" onClick={() => setState(initial())}>{t("restart")}</button>
      </div>

      <div className="stack" aria-live="polite">
        {verses.slice(0, state.visible).map((v, i) => {
          const l = state.levels[i]!;
          return (
            <button key={v.number} className="recite-verse" onClick={() => bump(i)}>
              <span className="num">{v.number}</span>
              <span className="stack" style={{ gap: 4, flex: 1 }}>
                <span className="verse small" style={{ color: l === 3 ? "var(--text)" : l === 0 ? "var(--muted)" : "var(--context)", letterSpacing: l === 1 ? "1.5px" : undefined }}>
                  {render(v.text, l)}
                </span>
                <span className="tiny muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label(l)}</span>
              </span>
            </button>
          );
        })}
        {hidden > 0 && <span className="small muted center">{t("moreVerses", { n: hidden })}</span>}
      </div>

      <div className="grow" />
      <div className="stack">
        <span className="tiny muted center">{t("reciteTap")}</span>
        <div className="grid2">
          <button className="btn secondary" onClick={() => bump(state.visible - 1)}>{t("moreHelp")}</button>
          <button className="btn primary" onClick={() => setState((s) => ({ ...s, visible: Math.min(verses.length, s.visible + 1) }))} disabled={hidden === 0}>
            {t("nextVerse")}
          </button>
        </div>
        <button className="btn ghost" onClick={() => setState({ visible: verses.length, levels: verses.map(() => 3 as Level) })}>{t("showAll")}</button>
      </div>
    </>
  );
}
