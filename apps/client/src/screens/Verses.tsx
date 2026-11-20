import { collectionProgress, segmentsOf } from "@biblez/core";
import { go } from "../App";
import { useT } from "../i18n";
import { actions, useApp } from "../store";
import { Icon, StageDots, VerseBars } from "../ui";

const DAY = 86_400_000;

export function Verses() {
  const t = useT();
  const { snapshot, settings } = useApp();
  const now = Date.now();
  const list = snapshot.collections.map((c) => collectionProgress(snapshot, c.id, now, settings)).reverse();

  return (
    <>
      <div className="row between" style={{ paddingTop: 16 }}>
        <h1>{t("myVerses")}</h1>
        <a className="icon-btn filled" href="#/add" aria-label={t("addVerse")}>
          <Icon name="plus" size={20} />
        </a>
      </div>
      {list.length === 0 && <p className="muted">{t("emptyVerses")}</p>}
      {list.map((p) => {
        const safe = p.verses.every((v) => v.safe);
        const days = p.nextDue ? Math.max(1, Math.round((p.nextDue - now) / DAY)) : null;
        return (
          <div key={p.collection.id} className="card stack" style={{ gap: 12 }}>
            <a href={`#/verse/${p.collection.id}`} className="row between" style={{ textDecoration: "none", color: "inherit", alignItems: "flex-start" }}>
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{p.collection.title}</span>
                <span className="small muted">
                  {p.collection.kind === "verse" ? t("singleVerse") : t("verseCount", { n: p.verses.length })} · {p.collection.translation ?? t("customText")}
                </span>
              </div>
              {p.dueToday > 0 ? (
                <span className="badge warn-b">{t("due", { n: p.dueToday })}</span>
              ) : safe ? (
                <span className="badge ok row" style={{ gap: 4 }}><Icon name="check" size={14} />{t("isSafe")}</span>
              ) : null}
            </a>
            <VerseBars values={p.verses.map((v) => v.progress)} />
            {p.dueToday === 0 && days !== null && (
              <span className="small muted">{days === 1 ? t("nextReviewTomorrow") : t("nextReviewIn", { n: days })}</span>
            )}
            <div className="grid2">
              <button className="btn primary" style={{ minHeight: 44 }} onClick={() => go(`study/${p.collection.id}`)} disabled={p.dueToday === 0}>{t("learn")}</button>
              <button className="btn soft" style={{ minHeight: 44 }} onClick={() => go(`recite/${p.collection.id}`)}>{t("recite")}</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function CollectionDetail({ collectionId }: { collectionId: string }) {
  const t = useT();
  const { snapshot, settings } = useApp();
  const collection = snapshot.collections.find((c) => c.id === collectionId);
  if (!collection) {
    go("verses", true);
    return null;
  }
  const progress = collectionProgress(snapshot, collectionId, Date.now(), settings);
  const segments = segmentsOf(snapshot, collectionId);

  const remove = () => {
    if (window.confirm(t("deleteConfirm", { title: collection.title }))) {
      actions.deleteCollection(collectionId);
      go("verses", true);
    }
  };

  return (
    <>
      <div className="row between">
        <button className="icon-btn" onClick={() => history.back()} aria-label={t("back")} style={{ marginLeft: -10 }}>
          <Icon name="back" />
        </button>
        <button className="btn danger" onClick={remove}>{t("delete")}</button>
      </div>
      <div className="stack" style={{ gap: 2 }}>
        <h1 style={{ fontSize: "1.7rem" }}>{collection.title}</h1>
        <span className="small muted">{collection.translation ?? t("customText")}</span>
      </div>
      <div className="grid2">
        <button className="btn primary" onClick={() => go(`study/${collectionId}`)} disabled={progress.dueToday === 0}>{t("learn")}</button>
        <button className="btn soft" onClick={() => go(`recite/${collectionId}`)}>{t("recite")}</button>
      </div>
      <div className="list">
        {progress.verses.map((v) => (
          <div key={v.verseNumber} className="list-row" style={{ alignItems: "flex-start", padding: "12px 16px" }}>
            <span className="tiny" style={{ color: "var(--accent)", fontWeight: 700, minWidth: 22, paddingTop: 4 }}>{v.verseNumber}</span>
            <span className="verse small" style={{ flex: 1, fontWeight: 400 }}>
              {segments.filter((s) => s.verseNumber === v.verseNumber).map((s) => s.text).join(" ")}
            </span>
            <span className="stack" style={{ alignItems: "flex-end", gap: 4 }}>
              {v.safe ? <span className="badge ok">{t("isSafe")}</span> : <StageDots stage={v.stage} />}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
