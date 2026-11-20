// Daily reminders as local notifications (native app only; nothing leaves the device).
// The next days are scheduled individually from planReminders(): each reminder
// says what is due that day, and days without anything due stay quiet.
// Rescheduled whenever data or preferences change.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { planReminders, REMINDER_DAYS } from "@biblez/core";
import { translate } from "./i18n";
import { onDataChange, type AppState } from "./store";

export const remindersSupported = Capacitor.isNativePlatform();

const CHANNEL = "daily-reminder";
const BASE_ID = 7100; // ids 7100 … 7100+REMINDER_DAYS-1 belong to us
const SECONDS_PER_CARD = 10;

export type PermissionResult = "granted" | "denied";

export async function requestReminderPermission(): Promise<PermissionResult> {
  if (!remindersSupported) return "denied";
  let { display } = await LocalNotifications.checkPermissions();
  if (display !== "granted") ({ display } = await LocalNotifications.requestPermissions());
  return display === "granted" ? "granted" : "denied";
}

let channelReady = false;
async function ensureChannel(lang: "de" | "en") {
  if (channelReady || Capacitor.getPlatform() !== "android") return;
  const t = translate(lang);
  await LocalNotifications.createChannel({ id: CHANNEL, name: t("reminderChannel"), description: t("reminderChannelDesc"), importance: 3, visibility: 1 });
  channelReady = true;
}

export async function syncReminders(state: AppState): Promise<void> {
  if (!remindersSupported || !state.ready) return;
  const ids = Array.from({ length: REMINDER_DAYS }, (_, i) => ({ id: BASE_ID + i }));
  await LocalNotifications.cancel({ notifications: ids });
  const { reminder, lang } = state.ui;
  if (!reminder.enabled) return;
  if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
  await ensureChannel(lang);
  const t = translate(lang);
  const plan = planReminders(state.snapshot, { hour: reminder.hour, minute: reminder.minute }, Date.now(), state.settings);
  if (!plan.length) return;
  await LocalNotifications.schedule({
    notifications: plan.map((p) => {
      const minutes = Math.max(1, Math.round(((p.reviews + p.fresh) * SECONDS_PER_CARD) / 60));
      const body =
        p.reviews > 0
          ? t(p.reviews === 1 ? "reminderBodyOne" : "reminderBody", { n: p.reviews, m: minutes }) + (p.fresh ? ` ${t("reminderPlusNew", { n: p.fresh })}` : "")
          : t("reminderBodyNew", { n: p.fresh });
      return {
        id: BASE_ID + p.day,
        title: t("reminderTitle"),
        body,
        schedule: { at: new Date(p.at) },
        channelId: CHANNEL,
        smallIcon: "ic_stat_biblez",
        iconColor: "#2C6A63",
      };
    }),
  });
}

/** Keeps the scheduled reminders in sync with the data (debounced). */
export function startReminderSync(): void {
  if (!remindersSupported) return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  onDataChange((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => syncReminders(state).catch((e) => console.warn("reminders", e)), 1500);
  });
}
