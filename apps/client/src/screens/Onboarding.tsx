import { SAMPLES, segmentsOf } from "@biblez/core";
import { useState } from "react";
import { go } from "../App";
import { useT } from "../i18n";
import { actions, useApp } from "../store";
import { Icon, Logo } from "../ui";

export function Welcome() {
  const t = useT();
  const { ui } = useApp();
  const sample = SAMPLES.find((s) => s.language === ui.lang && s.verses.length === 1) ?? SAMPLES[0]!;
  const preview = sample.verses[0]!.text.split(" ").slice(0, 10).join(" ");

  const [starting, setStarting] = useState(false);
  const start = async () => {
    if (starting) return;
    setStarting(true);
    const id = await actions.addCollection({ title: sample.title, verses: sample.verses, translation: sample.translation, source: "bundled" });
    await actions.updateUi({ onboarded: true });
    go(`read/${id}`);
  };

  return (
    <>
      <div style={{ paddingTop: 20 }}>
        <Logo />
      </div>
      <div className="stack" style={{ marginTop: 20, gap: 12 }}>
        <h1 className="display" style={{ fontSize: "2.1rem", lineHeight: 1.2 }}>{t("appTagline")}</h1>
        <p className="muted" style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.5 }}>{t("appIntro")}</p>
      </div>
      <div className="card stack">
        <span className="eyebrow">{t("firstVerse")}</span>
        <span className="verse small">»{preview} …«</span>
        <span className="small muted">{sample.title} · {sample.translation}</span>
      </div>
      <div className="grow" />
      <div className="stack">
        <button className="btn primary lg" onClick={start} disabled={starting}>{t("startWith", { title: sample.title })}</button>
        <button className="btn ghost" onClick={async () => { await actions.updateUi({ onboarded: true }); go("add"); }}>{t("chooseOther")}</button>
        <p className="small muted center" style={{ margin: 0 }}>{t("privacyShort")}</p>
      </div>
    </>
  );
}

/** "Read the verse calmly" – shown before a new collection is studied for the first time. */
export function Read({ collectionId }: { collectionId: string }) {
  const t = useT();
  const { snapshot } = useApp();
  const collection = snapshot.collections.find((c) => c.id === collectionId);
  if (!collection) {
    go("", true);
    return null;
  }
  const segments = segmentsOf(snapshot, collectionId);
  const multiVerse = collection.kind === "passage";

  return (
    <>
      <div className="row">
        <button className="icon-btn" onClick={() => history.back()} aria-label={t("back")} style={{ marginLeft: -10 }}>
          <Icon name="back" />
        </button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <h2 style={{ fontSize: "1.6rem" }}>{t("readTitle")}</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>{t("readText")}</p>
      </div>
      <div className="card stack" style={{ gap: 14, padding: 22 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>{collection.title}</span>
        <div className="chunk-list">
          {segments.map((s) => (
            <div className="chunk" key={s.id}>
              <span className="tag">{multiVerse ? `${s.verseNumber}${s.part}` : s.part}</span>
              <span className="verse" style={{ lineHeight: 1.45 }}>{s.text}</span>
            </div>
          ))}
        </div>
        {collection.translation && <span className="tiny muted">{collection.translation}</span>}
      </div>
      <div className="tip">
        <Icon name="bulb" size={20} />
        <span>{t("readTip")}</span>
      </div>
      <div className="grow" />
      <button className="btn primary lg" onClick={() => go(`study/${collectionId}`, true)}>{t("ready")}</button>
    </>
  );
}
