import type { TranslationInfo } from "@biblez/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadTranslations } from "../bible";
import { useT } from "../i18n";
import { actions, useApp, type FontSize, type Lang, type Theme } from "../store";
import { shareFile } from "../share";
import { Icon, Switch, Toast, useToast } from "../ui";

const APP_VERSION = "0.1.0";

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className={`seg${options.length === 3 ? " three" : ""}`} role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="list-row">
      <span>{label}</span>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const t = useT();
  const { settings, ui, snapshot } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [toast, showToast, hideToast] = useToast();
  const stamp = new Date().toISOString().slice(0, 10);
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  useEffect(() => { loadTranslations().then(setTranslations).catch(() => {}); }, []);

  const [busy, setBusy] = useState(false);
  const share = async (make: () => Blob, filename: string, title: string) => {
    setBusy(true);
    try {
      const result = await shareFile(make(), filename, title);
      if (result === "downloaded") showToast(t("fileSaved", { name: filename }));
    } catch {
      showToast(t("shareFailed"));
    } finally {
      setBusy(false);
    }
  };
  const exportAnki = () => share(() => actions.exportAnki().blob, `BibleZ-${stamp}.apkg`, t("ankiTitle"));
  const restore = async (file: File) => {
    if (!window.confirm(t("restoreConfirm"))) return;
    try {
      actions.restore(await file.text());
      showToast(t("restoreDone"));
    } catch {
      showToast(t("restoreFailed"));
    }
  };

  return (
    <>
      <h1 style={{ paddingTop: 16 }}>{t("settings")}</h1>

      <span className="label">{t("sLearning")}</span>
      <div className="list">
        <Row label={t("newPerDay")}>
          <span className="stepper">
            <button aria-label="−" onClick={() => actions.updateSettings({ newSegmentsPerDay: Math.max(1, settings.newSegmentsPerDay - 1) })}>−</button>
            <span>{settings.newSegmentsPerDay}</span>
            <button aria-label="+" onClick={() => actions.updateSettings({ newSegmentsPerDay: Math.min(30, settings.newSegmentsPerDay + 1) })}>+</button>
          </span>
        </Row>
        <Row label={t("retention")}>
          <select value={settings.desiredRetention} onChange={(e) => actions.updateSettings({ desiredRetention: Number(e.target.value) })} style={{ border: "none", background: "transparent", fontWeight: 600 }}>
            {[0.8, 0.85, 0.9, 0.95].map((r) => <option key={r} value={r}>{Math.round(r * 100)} %</option>)}
          </select>
        </Row>
        <button className="list-row" onClick={() => actions.updateSettings({ allStagesAtOnce: !settings.allStagesAtOnce })} aria-pressed={settings.allStagesAtOnce}>
          {t("allStages")}
          <Switch on={settings.allStagesAtOnce} />
        </button>
      </div>

      <span className="label">{t("sAppearance")}</span>
      <div className="stack">
        <span className="small muted" style={{ fontWeight: 600 }}>{t("theme")}</span>
        <Seg<Theme> label={t("theme")} value={ui.theme} onChange={(theme) => actions.updateUi({ theme })} options={[["auto", t("themeAuto")], ["light", t("themeLight")], ["dark", t("themeDark")]]} />
        <span className="small muted" style={{ fontWeight: 600 }}>{t("fontSize")}</span>
        <Seg<FontSize> label={t("fontSize")} value={ui.fontSize} onChange={(fontSize) => actions.updateUi({ fontSize })} options={[["s", "A"], ["m", "A+"], ["l", "A++"]]} />
        <span className="small muted" style={{ fontWeight: 600 }}>{t("language")}</span>
        <Seg<Lang> label={t("language")} value={ui.lang} onChange={(lang) => actions.updateUi({ lang })} options={[["de", "Deutsch"], ["en", "English"]]} />
      </div>

      <span className="label">{t("sData")}</span>
      <div className="card stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="download" size={20} />
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700 }}>{t("ankiTitle")}</span>
            <span className="small muted">{t("ankiStats", { v: snapshot.segments.length, r: snapshot.reviews.length })}</span>
          </span>
        </div>
        <span className="small" style={{ lineHeight: 1.5 }}>{t("ankiText")}</span>
        <div className="warn"><Icon name="info" size={18} /><span>{t("ankiWarning")}</span></div>
        <button className="btn primary" onClick={exportAnki} disabled={busy || snapshot.segments.length === 0}>{t("ankiButton")}</button>
      </div>
      <div className="list">
        <button className="list-row" disabled={busy} onClick={() => share(() => actions.backup(), `BibleZ-Backup-${stamp}.json`, t("backupSave"))}>
          {t("backupSave")}
          <Icon name="chevron" size={18} />
        </button>
        <button className="list-row" onClick={() => fileInput.current?.click()}>
          {t("backupRestore")}
          <Icon name="chevron" size={18} />
        </button>
      </div>
      <input ref={fileInput} type="file" accept="application/json,.json" className="visually-hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ""; }} />

      {translations.length > 0 && (
        <>
          <span className="label">{t("sTexts")}</span>
          <div className="list">
            {translations.map((x) => (
              <div key={x.id} className="list-row" style={{ alignItems: "flex-start", padding: "10px 16px" }}>
                <span className="stack" style={{ gap: 2 }}>
                  <span>{x.name}</span>
                  {x.licenseNote && <span className="tiny muted" style={{ fontWeight: 400 }}>{x.licenseNote}</span>}
                </span>
                <span className="value tiny">{x.license === "Public Domain" ? t("publicDomain") : x.license}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="row small muted" style={{ justifyContent: "center", gap: 8 }}>
        <Icon name="lock" size={16} />
        {t("privacy")}
      </div>
      <span className="tiny muted center">{t("version", { v: APP_VERSION })}</span>
      <Toast message={toast} onDone={hideToast} />
    </>
  );
}
