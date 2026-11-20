import { useEffect, useState, type ReactNode } from "react";

type IconName = "back" | "close" | "plus" | "check" | "sun" | "book" | "sliders" | "bulb" | "download" | "info" | "lock" | "chevron";

const PATHS: Record<IconName, ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  book: (<><path d="M4 5.5c2.7-1.2 5.3-1.2 8 1 2.7-2.2 5.3-2.2 8-1v13c-2.7-1.2-5.3-1.2-8 1-2.7-2.2-5.3-2.2-8-1z" /><path d="M12 6.5v13" /></>),
  sliders: (<><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>),
  bulb: (<><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></>),
  download: (<><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></>),
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  chevron: <path d="M9 6l6 6-6 6" />,
};

export function Icon({ name, size = 22, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flexShrink: 0 }}>
      {PATHS[name]}
    </svg>
  );
}

export function Logo() {
  return (
    <div className="row" style={{ gap: 10 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path d="M9 10.5c2.5-1 5-1 7 .8 2-1.8 4.5-1.8 7-.8v11c-2.5-1-5-1-7 .8-2-1.8-4.5-1.8-7-.8z" fill="none" stroke="var(--on-accent)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M16 11.3v11" stroke="var(--on-accent)" strokeWidth="1.6" />
      </svg>
      <span style={{ fontSize: 20, fontWeight: 700 }}>BibleZ</span>
    </div>
  );
}

export function StageDots({ stage }: { stage: number }) {
  return (
    <span className="dots" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= stage ? "on" : ""} />
      ))}
    </span>
  );
}

/** One bar per verse, coloured by progress (0..1). */
export function VerseBars({ values }: { values: number[] }) {
  const color = (v: number) => (v >= 0.99 ? "var(--accent)" : v >= 0.66 ? "var(--accent-mid)" : v > 0.05 ? "var(--accent-faint)" : "var(--line)");
  return (
    <div className="bars" style={{ gridTemplateColumns: `repeat(${Math.max(1, values.length)}, minmax(0, 1fr))` }} aria-hidden="true">
      {values.map((v, i) => (
        <span key={i} style={{ background: color(v) }} />
      ))}
    </div>
  );
}

export function Switch({ on }: { on: boolean }) {
  return <span className={`switch${on ? " on" : ""}`} aria-hidden="true" />;
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}

export function useToast(): [string | null, (m: string) => void, () => void] {
  const [msg, setMsg] = useState<string | null>(null);
  return [msg, setMsg, () => setMsg(null)];
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
