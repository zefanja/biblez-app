import { buildQueue, cardFace, fallbackCandidate, overview, type Card, type CardStatus } from "@biblez/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { go } from "../App";
import { useT } from "../i18n";
import { remindersSupported, requestReminderPermission } from "../reminders";
import { actions, getState, useApp } from "../store";
import { Icon, StageDots, Toast, useToast } from "../ui";

function nextCard(collectionId: string | undefined): { next: CardStatus | undefined; remaining: number; later: number } {
  const { snapshot, settings } = getState();
  const q = buildQueue(snapshot, Date.now(), settings);
  const inCollection = (s: CardStatus) => {
    if (!collectionId) return true;
    const seg = snapshot.segments.find((x) => x.id === s.card.segmentId);
    return seg?.collectionId === collectionId;
  };
  const list = q.now.filter(inCollection);
  return { next: list[0], remaining: list.length, later: q.later.filter(inCollection).length };
}

export function Study({ collectionId }: { collectionId?: string }) {
  const t = useT();
  const app = useApp();
  const [current, setCurrent] = useState<Card | null>(() => nextCard(collectionId).next?.card ?? null);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [remaining, setRemaining] = useState(() => nextCard(collectionId).remaining);
  const [later, setLater] = useState(0);
  const [fallback, setFallback] = useState<Card | null>(null);
  const [toast, showToast, hideToast] = useToast();
  const shownAt = useRef(Date.now());

  const face = useMemo(() => (current ? cardFace(app.snapshot, current) : null), [current, app.snapshot]);

  const advance = useCallback(() => {
    const n = nextCard(collectionId);
    setCurrent(n.next?.card ?? null);
    setRemaining(n.remaining);
    setLater(n.later);
    setRevealed(false);
    shownAt.current = Date.now();
  }, [collectionId]);

  const saving = useRef(false);
  const rate = useCallback(
    async (rating: "again" | "good") => {
      if (!current || saving.current) return;
      saving.current = true;
      try {
        const result = await actions.review(current.id, rating, Date.now() - shownAt.current);
        setAnswered((a) => a + 1);
        if (result.unlockedStage) showToast(t("unlocked", { n: result.unlockedStage }));
        setFallback(rating === "again" ? fallbackCandidate(getState().snapshot, current.id) : null);
        advance();
      } catch {
        showToast(t("saveFailed"));
      } finally {
        saving.current = false;
      }
    },
    [current, advance, showToast, t],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "BUTTON"].includes(e.target.tagName) && e.key !== "1" && e.key !== "2") return;
      if (!current) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && e.key === "1") void rate("again");
      else if (revealed && (e.key === "2" || e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        void rate("good");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, rate]);

  if (!current || !face) return <Done answered={answered} later={later} />;

  const total = answered + remaining;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  const stageName = t(`stageName${face.stage}` as "stageName1");

  return (
    <>
      <div className="row" style={{ gap: 12 }}>
        <button className="icon-btn" onClick={() => go("", true)} aria-label={t("close")} style={{ marginLeft: -10 }}>
          <Icon name="close" />
        </button>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <span className="small muted" style={{ fontWeight: 600, minWidth: 40, textAlign: "right" }}>{answered + 1}/{total}</span>
      </div>

      <div className="row between">
        <span style={{ fontWeight: 600 }}>{face.reference}</span>
        <span className="row small muted" style={{ gap: 8 }}>
          {t("stage", { n: face.stage })} · {stageName}
          <StageDots stage={face.stage} />
        </span>
      </div>

      {fallback && (
        <div className="tip" style={{ alignItems: "center" }}>
          <span style={{ flex: 1 }}>{t("fallbackOffer", { n: fallback.stage })}</span>
          <button className="btn soft" style={{ minHeight: 40 }} onClick={() => { void actions.reactivate(fallback); setFallback(null); }}>
            {t("fallbackAccept")}
          </button>
        </div>
      )}

      <section className="study-card" aria-live="polite">
        {face.context.length > 0 && <span className="verse small context">{face.context.join(" ")}</span>}
        {face.prompt !== null ? (
          <span className="verse" style={{ letterSpacing: face.stage === 2 ? "1.5px" : undefined }}>{face.prompt}</span>
        ) : (
          <span className="verse muted">{face.context.length ? t("sayWhole") : face.reference}</span>
        )}
        {revealed && (
          <>
            <div className="divider" />
            <span className="verse answer">{face.answer}</span>
          </>
        )}
      </section>

      {!revealed ? (
        <div className="stack">
          <span className="small muted center">{t("sayIt")}</span>
          <button className="btn primary lg" onClick={() => setRevealed(true)}>{t("reveal")}</button>
        </div>
      ) : (
        <div className="stack">
          <span className="small muted center">{t("knewIt")}</span>
          <div className="grid2">
            <button className="btn secondary lg" onClick={() => rate("again")}>{t("again")}</button>
            <button className="btn primary lg" onClick={() => rate("good")} autoFocus>{t("good")}</button>
          </div>
        </div>
      )}
      <Toast message={toast} onDone={hideToast} />
    </>
  );
}

function Done({ answered, later }: { answered: number; later: number }) {
  const t = useT();
  const app = useApp();
  const ov = overview(app.snapshot, Date.now(), app.settings);
  const nextDay = ov.forecast.findIndex((n, i) => i > 0 && n > 0);
  const nextLabel = nextDay === 1 ? t("tomorrow") : nextDay > 1 ? `+${nextDay}` : "–";

  return (
    <>
      <div className="grow" style={{ maxHeight: 60 }} />
      <div style={{ width: 72, height: 72, borderRadius: 36, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
        <Icon name="check" size={34} />
      </div>
      <div className="stack center" style={{ gap: 8 }}>
        <h2 className="display" style={{ fontSize: "1.9rem" }}>{t("doneTitle")}</h2>
        <p className="muted" style={{ margin: 0 }}>{t("doneText")}</p>
      </div>
      <div className="grid2">
        <div className="card stack" style={{ gap: 2 }}>
          <span style={{ fontSize: "1.6rem", fontWeight: 700 }}>{answered}</span>
          <span className="small muted">{t("doneReviews")}</span>
        </div>
        <div className="card stack" style={{ gap: 2 }}>
          <span style={{ fontSize: "1.6rem", fontWeight: 700 }}>{nextLabel}</span>
          <span className="small muted">{t("doneNext")}</span>
        </div>
      </div>
      {later > 0 && <div className="tip"><Icon name="info" size={20} /><span>{t("later", { n: later })} {t("waitOrLeave")}</span></div>}
      <ReminderSuggestion />
      <p className="muted center small" style={{ margin: 0, lineHeight: 1.55 }}>{t("doneExplain")}</p>
      <div className="grow" />
      <button className="btn primary lg" onClick={() => go("", true)}>{t("toHome")}</button>
    </>
  );
}

/** One-time offer on the "done" screen (native app only). */
function ReminderSuggestion() {
  const t = useT();
  const { ui } = useApp();
  const [denied, setDenied] = useState(false);
  if (!remindersSupported) return null;
  const time = `${String(ui.reminder.hour).padStart(2, "0")}:${String(ui.reminder.minute).padStart(2, "0")}`;
  if (ui.reminder.enabled) {
    return ui.reminder.suggested ? (
      <div className="tip" style={{ justifyContent: "center", fontWeight: 600 }}><Icon name="check" size={18} />{t("reminderSet", { time })}</div>
    ) : null;
  }
  if (ui.reminder.suggested) return null;
  const enable = async () => {
    if ((await requestReminderPermission()) !== "granted") {
      setDenied(true);
      return;
    }
    await actions.updateUi({ reminder: { ...ui.reminder, enabled: true, suggested: true } });
  };
  return denied ? (
    <div className="warn"><Icon name="info" size={18} /><span>{t("reminderDenied")}</span></div>
  ) : (
    <button className="btn secondary" onClick={enable}>{t("reminderSuggest")}</button>
  );
}
