import { buildQueue, collectionProgress, overview } from "@biblez/core";
import { go } from "../App";
import { useT } from "../i18n";
import { useApp } from "../store";
import { Icon, VerseBars } from "../ui";

const SECONDS_PER_CARD = 10;

export function Today() {
  const t = useT();
  const { snapshot, settings, ui } = useApp();
  const now = Date.now();
  const queue = buildQueue(snapshot, now, settings);
  const reviews = queue.now.filter((s) => !s.isNew).length;
  const fresh = queue.now.length - reviews;
  const minutes = Math.max(1, Math.round((queue.now.length * SECONDS_PER_CARD) / 60));
  const ov = overview(snapshot, now, settings);
  const maxForecast = Math.max(1, ...ov.forecast);
  const locale = ui.lang === "de" ? "de-DE" : "en-US";
  const dayNames = Array.from({ length: 7 }, (_, i) => new Date(now + i * 86_400_000).toLocaleDateString(locale, { weekday: "short" }).replace(".", ""));
  const progress = snapshot.collections.map((c) => collectionProgress(snapshot, c.id, now, settings)).reverse();

  return (
    <>
      <div className="stack" style={{ gap: 2, paddingTop: 16 }}>
        <span className="muted">{new Date(now).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</span>
        <h1>{t("today")}</h1>
      </div>

      {queue.now.length > 0 ? (
        <div className="hero">
          <div className="stack" style={{ gap: 4 }}>
            <span className="display" style={{ fontSize: "1.5rem" }}>
              {reviews > 0 ? (reviews === 1 ? t("dueOne") : t("dueReviews", { n: reviews })) : t("onlyNew", { n: fresh, m: minutes })}
            </span>
            {reviews > 0 && fresh > 0 && <span className="sub">{t("plusNew", { n: fresh, m: minutes })}</span>}
          </div>
          <button className="btn light lg" onClick={() => go("study")}>{t("letsGo")}</button>
        </div>
      ) : (
        <div className="hero">
          <span className="display" style={{ fontSize: "1.4rem" }}>{t("allDone")}</span>
          <span className="sub">{ov.forecast[1] === 1 ? t("tomorrowOne") : ov.forecast[1] ? t("tomorrowCount", { n: ov.forecast[1] }) : t("nothingTomorrow")}</span>
        </div>
      )}

      {snapshot.reviews.length > 0 && (
        <div className="card stack" style={{ gap: 10 }}>
          <div className="row between">
            <span style={{ fontWeight: 600 }}>{t("next7")}</span>
          </div>
          <div className="forecast" aria-label={t("next7")}>
            {ov.forecast.map((n, i) => (
              <div key={i}>
                <span className="tiny muted">{n}</span>
                <span className={`bar${i === 0 ? " today" : ""}`} style={{ height: `${Math.round((n / maxForecast) * 44) + 4}px` }} />
                <span className="tiny" style={{ fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "var(--text)" : "var(--muted)" }}>{dayNames[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid2">
        <div className="card stack" style={{ gap: 2 }}>
          <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent)" }}>{ov.safeVerses}</span>
          <span className="small" style={{ fontWeight: 600 }}>{t("safe")}</span>
          <span className="tiny muted">{t("safeHint")}</span>
        </div>
        <div className="card stack" style={{ gap: 2 }}>
          <span style={{ fontSize: "1.75rem", fontWeight: 700 }}>{ov.learningVerses}</span>
          <span className="small" style={{ fontWeight: 600 }}>{t("learning")}</span>
          <span className="tiny muted">{t("inCollections", { n: snapshot.collections.length })}</span>
        </div>
      </div>

      <div className="stack">
        <h2>{t("yourVerses")}</h2>
        {progress.slice(0, 3).map((p) => (
          <a key={p.collection.id} className="card tight stack" href={`#/verse/${p.collection.id}`} style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
            <div className="row between">
              <span style={{ fontWeight: 600 }}>{p.collection.title}</span>
              {p.dueToday > 0 && <span className="badge warn-b">{t("due", { n: p.dueToday })}</span>}
            </div>
            <VerseBars values={p.verses.map((v) => v.progress)} />
          </a>
        ))}
        <a className="btn secondary" href="#/add" style={{ borderStyle: "dashed" }}>
          <Icon name="plus" size={18} />
          {t("addVerse")}
        </a>
      </div>
    </>
  );
}
