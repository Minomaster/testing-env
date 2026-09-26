import { invoke } from "@tauri-apps/api/core";
import type { AngleMode } from "$lib/calc/evaluate";

/** Paths are relative to the data folder; the Rust side rejects anything that would leave it. */
export function readDataFile(path: string): Promise<string | null> {
  return invoke<string | null>("read_data_file", { path });
}

export function writeDataFile(path: string, contents: string): Promise<void> {
  return invoke("write_data_file", { path, contents });
}

export type Settings = {
  calculator?: { angleMode?: AngleMode };
};

const SETTINGS_FILE = "settings.json";

export async function readSettings(): Promise<Settings> {
  const text = await readDataFile(SETTINGS_FILE);
  return text ? (JSON.parse(text) as Settings) : {};
}

export async function updateSettings(change: (settings: Settings) => void): Promise<void> {
  const settings = await readSettings();
  change(settings);
  await writeDataFile(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
}
