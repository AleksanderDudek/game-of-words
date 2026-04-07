import { useState, useEffect, useCallback } from "react";
import { v4 as uuid } from "uuid";
import type { WordPack } from "@/client/lib/wordPack";
import * as storage from "@/client/lib/packStorage";
import * as drive from "@/client/lib/googleDrive";
import type { WordPackEntry } from "@/shared/types";

export interface UsePackStorage {
  packs: WordPack[];
  driveConnected: boolean;
  driveAvailable: boolean;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  addPackFromFile: (file: File) => Promise<void>;
  savePack: (pack: WordPack) => Promise<void>;
  deletePack: (pack: WordPack) => Promise<void>;
  connectDrive: () => Promise<void>;
  disconnectDrive: () => void;
  syncToDrive: (pack: WordPack) => Promise<void>;
}

export function usePackStorage(): UsePackStorage {
  const [packs, setPacks] = useState<WordPack[]>([]);
  const [driveConnected, setDriveConnected] = useState(drive.isDriveConnected());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const local = await storage.listPacks();
      setPacks(local.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load packs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // On mount, attempt a silent Drive reconnect so the user doesn't have to
  // click "Connect" again after a page refresh.
  useEffect(() => {
    if (!drive.isDriveAvailable() || drive.isDriveConnected()) return;
    drive.trySilentReconnect().then((ok) => {
      if (ok) {
        setDriveConnected(true);
        drive.listDrivePacks()
          .then((drivePacks) => Promise.all(drivePacks.map((p) => storage.savePack(p))))
          .then(() => reload())
          .catch(() => {});
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPackFromFile = useCallback(async (file: File) => {
    setError(null);
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("File is not valid JSON");
    }

    if (!parsed || typeof parsed !== "object") throw new Error("Invalid pack format");
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.name !== "string" || obj.name.trim().length === 0)
      throw new Error('Pack must have a "name" field');
    if (!Array.isArray(obj.words) || (obj.words as unknown[]).length === 0)
      throw new Error('Pack must have a non-empty "words" array');

    for (const entry of obj.words as unknown[]) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as Record<string, unknown>).word !== "string" ||
        typeof (entry as Record<string, unknown>).hint !== "string"
      ) {
        throw new Error('Each word entry must have "word" and "hint" string fields');
      }
    }

    const pack: WordPack = {
      id: uuid(),
      name: (obj.name as string).trim().slice(0, 50),
      description:
        typeof obj.description === "string" ? obj.description.trim().slice(0, 200) : undefined,
      words: (obj.words as WordPackEntry[]).slice(0, 500).map((e) => ({
        word: String(e.word).toLowerCase().trim().slice(0, 50),
        hint: String(e.hint).trim().slice(0, 200),
      })),
      createdAt: Date.now(),
      source: "local",
    };

    await storage.savePack(pack);
    await reload();
  }, [reload]);

  const handleSavePack = useCallback(async (pack: WordPack) => {
    setError(null);
    await storage.savePack(pack);
    await reload();
  }, [reload]);

  const handleDeletePack = useCallback(async (pack: WordPack) => {
    setError(null);
    await storage.deletePack(pack.id);
    if (pack.driveFileId && drive.isDriveConnected()) {
      await drive.deleteDrivePack(pack.driveFileId).catch(() => {});
    }
    await reload();
  }, [reload]);

  const handleConnectDrive = useCallback(async () => {
    setError(null);
    try {
      await drive.connectDrive();
      setDriveConnected(true);
      // Pull packs from Drive and merge into IndexedDB
      const drivePacks = await drive.listDrivePacks();
      for (const pack of drivePacks) {
        await storage.savePack(pack);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect Drive");
    }
  }, [reload]);

  const handleDisconnectDrive = useCallback(() => {
    drive.disconnectDrive();
    setDriveConnected(false);
  }, []);

  const syncToDrive = useCallback(async (pack: WordPack) => {
    if (!drive.isDriveConnected()) throw new Error("Drive not connected");
    setError(null);
    const fileId = await drive.saveDrivePack(pack);
    const updated: WordPack = { ...pack, driveFileId: fileId, source: "drive" };
    await storage.savePack(updated);
    await reload();
  }, [reload]);

  return {
    packs,
    driveConnected,
    driveAvailable: drive.isDriveAvailable(),
    loading,
    error,
    reload,
    addPackFromFile,
    savePack: handleSavePack,
    deletePack: handleDeletePack,
    connectDrive: handleConnectDrive,
    disconnectDrive: handleDisconnectDrive,
    syncToDrive,
  };
}
