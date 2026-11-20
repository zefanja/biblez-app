// Hands a generated file (Anki export, backup) to the user:
//  - native app (Capacitor): write to the cache directory, open the system share sheet
//    (AnkiDroid, Drive, mail, …)
//  - mobile browser: Web Share API with files, where supported
//  - otherwise: regular download

import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type ShareResult = "shared" | "downloaded" | "cancelled";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const isCancel = (e: unknown) => /cancel|abort/i.test(String((e as Error)?.message ?? e)) || (e as Error)?.name === "AbortError";

export async function shareFile(blob: Blob, filename: string, title: string): Promise<ShareResult> {
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache });
    try {
      await Share.share({ title, files: [written.uri], dialogTitle: title });
      return "shared";
    } catch (e) {
      if (isCancel(e)) return "cancelled";
      throw e;
    }
  }

  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
  const coarsePointer = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  if (coarsePointer && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if (isCancel(e)) return "cancelled";
      // fall through to a download if sharing failed for another reason
    }
  }
  download(blob, filename);
  return "downloaded";
}
