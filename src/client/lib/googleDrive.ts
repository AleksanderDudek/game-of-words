// ═══════════════════════════════════════════════════════════════
// Google Drive appdata integration — client-side only OAuth2
// Uses the drive.appdata scope so files live in a hidden app
// folder; requires VITE_GOOGLE_CLIENT_ID to be configured.
// ═══════════════════════════════════════════════════════════════

import type { WordPack } from "./wordPack";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";

// Internal state (module-level singleton)
let _accessToken: string | null = null;

// Minimal ambient types for the GIS library loaded dynamically
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { error?: string; access_token: string }) => void;
          }): { requestAccessToken(opts?: { prompt?: string }): void };
        };
      };
    };
  }
}

function loadGIS(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

export function isDriveAvailable(): boolean {
  return Boolean(CLIENT_ID);
}

export function isDriveConnected(): boolean {
  return _accessToken !== null;
}

/** Trigger the OAuth consent flow and obtain an access token. */
export async function connectDrive(): Promise<void> {
  if (!CLIENT_ID) throw new Error("VITE_GOOGLE_CLIENT_ID is not configured");
  await loadGIS();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error));
          return;
        }
        _accessToken = resp.access_token;
        resolve();
      },
    });
    // Explicit user action → show account chooser but skip the permissions
    // consent screen if the user has already granted access before.
    client.requestAccessToken({ prompt: "select_account" });
  });
}

/**
 * Attempt a silent token refresh (no popup). Resolves to true if successful.
 * Call this on app startup to auto-reconnect Drive without user interaction.
 */
export async function trySilentReconnect(): Promise<boolean> {
  if (!CLIENT_ID) return false;
  try {
    await loadGIS();
    await new Promise<void>((resolve, reject) => {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          _accessToken = resp.access_token;
          resolve();
        },
      });
      // prompt: "" → no popup; fails silently if no prior consent
      client.requestAccessToken({ prompt: "" });
    });
    return true;
  } catch {
    return false;
  }
}

export function disconnectDrive(): void {
  _accessToken = null;
}

// ─── Internal helpers ───

async function driveRequest(
  path: string,
  options: RequestInit = {},
  baseUrl = DRIVE_API,
): Promise<Response> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${_accessToken}`,
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  if (res.status === 401) {
    _accessToken = null;
    throw new Error("Drive session expired — please reconnect");
  }
  return res;
}

// ─── Public API ───

/** List all packs stored in the app's hidden Drive appdata folder. */
export async function listDrivePacks(): Promise<WordPack[]> {
  const res = await driveRequest(
    "/files?spaces=appDataFolder&fields=files(id,name)&q=name+contains+'.pack.json'",
  );
  if (!res.ok) throw new Error("Failed to list Drive packs");
  const data = (await res.json()) as { files: { id: string; name: string }[] };

  const packs: WordPack[] = [];
  for (const file of data.files) {
    const pack = await getDrivePackById(file.id);
    if (pack) packs.push({ ...pack, driveFileId: file.id, source: "drive" });
  }
  return packs;
}

async function getDrivePackById(fileId: string): Promise<WordPack | null> {
  try {
    const res = await driveRequest(`/files/${fileId}?alt=media`);
    if (!res.ok) return null;
    return (await res.json()) as WordPack;
  } catch {
    return null;
  }
}

/** Save or update a pack file in Drive. Returns the Drive file ID. */
export async function saveDrivePack(pack: WordPack): Promise<string> {
  const body = JSON.stringify(pack);

  if (pack.driveFileId) {
    // Update existing file content via simple upload
    const res = await driveRequest(
      `/files/${pack.driveFileId}?uploadType=media`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body },
      DRIVE_UPLOAD_API,
    );
    if (!res.ok) throw new Error("Failed to update pack on Drive");
    return pack.driveFileId;
  }

  // Create new file via multipart upload  
  const boundary = "signal_decay_boundary";
  const metadata = JSON.stringify({ name: `${pack.id}.pack.json`, parents: ["appDataFolder"] });
  const multipart = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    body,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await driveRequest(
    "/files?uploadType=multipart",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipart,
    },
    DRIVE_UPLOAD_API,
  );
  if (!res.ok) throw new Error("Failed to save pack to Drive");
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Delete a pack file from Drive. */
export async function deleteDrivePack(fileId: string): Promise<void> {
  await driveRequest(`/files/${fileId}`, { method: "DELETE" });
}
