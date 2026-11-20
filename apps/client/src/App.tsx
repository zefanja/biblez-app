import { useEffect, useSyncExternalStore } from "react";
import { useT } from "./i18n";
import { Add } from "./screens/Add";
import { CollectionDetail, Verses } from "./screens/Verses";
import { Read, Welcome } from "./screens/Onboarding";
import { Recite } from "./screens/Recite";
import { SettingsScreen } from "./screens/Settings";
import { Study } from "./screens/Study";
import { Today } from "./screens/Today";
import { useApp } from "./store";
import { Icon } from "./ui";

// ---------------------------------------------------------------- routing

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
}
export function go(path: string, replace = false) {
  const url = `#/${path.replace(/^\//, "")}`;
  if (replace) window.location.replace(url);
  else window.location.hash = url;
}

// ------------------------------------------------------------------ chrome

function Tabs({ active }: { active: "today" | "verses" | "settings" }) {
  const t = useT();
  const tab = (id: typeof active, href: string, icon: "sun" | "book" | "sliders", label: string) => (
    <a className="tab" href={href} aria-current={active === id ? "page" : undefined}>
      <Icon name={icon} size={24} />
      {label}
    </a>
  );
  return (
    <div className="tabs">
      <nav aria-label="Hauptnavigation">
        {tab("today", "#/", "sun", t("today"))}
        {tab("verses", "#/verses", "book", t("verses"))}
        {tab("settings", "#/settings", "sliders", t("settings"))}
      </nav>
    </div>
  );
}

export function App() {
  const app = useApp();
  const t = useT();
  const route = useRoute();

  useEffect(() => {
    const root = document.documentElement;
    if (app.ui.theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", app.ui.theme);
    root.setAttribute("data-font", app.ui.fontSize);
    root.lang = app.ui.lang;
  }, [app.ui.theme, app.ui.fontSize, app.ui.lang]);

  if (!app.ready) return <div className="screen center muted">{t("loading")}</div>;
  if (app.error) {
    return (
      <div className="screen">
        <h2>{t("errorStart")}</h2>
        <pre className="small muted" style={{ whiteSpace: "pre-wrap" }}>{app.error}</pre>
      </div>
    );
  }

  const [page = "", arg] = route;
  const firstRun = !app.ui.onboarded && app.snapshot.collections.length === 0;

  let content: React.ReactNode;
  let tabs: "today" | "verses" | "settings" | null = null;
  switch (page) {
    case "welcome":
      content = <Welcome />;
      break;
    case "read":
      content = <Read collectionId={arg ?? ""} />;
      break;
    case "study":
      content = <Study collectionId={arg} />;
      break;
    case "verses":
      content = <Verses />;
      tabs = "verses";
      break;
    case "verse":
      content = <CollectionDetail collectionId={arg ?? ""} />;
      break;
    case "recite":
      content = <Recite collectionId={arg ?? ""} />;
      break;
    case "add":
      content = <Add />;
      break;
    case "settings":
      content = <SettingsScreen />;
      tabs = "settings";
      break;
    default:
      if (firstRun) {
        content = <Welcome />;
      } else {
        content = <Today />;
        tabs = "today";
      }
  }

  return (
    <div className="app">
      <main className={`screen${tabs ? " with-tabs" : ""}`}>{content}</main>
      {tabs && <Tabs active={tabs} />}
    </div>
  );
}
