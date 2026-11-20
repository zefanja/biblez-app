import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startReminderSync } from "./reminders";
import { initStore } from "./store";
import "./styles.css";

startReminderSync();
void initStore();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
