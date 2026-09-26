import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export const dataRoot = $state<{ path: string | null; loaded: boolean }>({
  path: null,
  loaded: false,
});

export async function loadDataRoot(): Promise<void> {
  dataRoot.path = await invoke<string | null>("get_data_root");
  dataRoot.loaded = true;
}

export async function chooseDataRoot(): Promise<void> {
  const path = await open({ directory: true, title: "Choose your MkStudy data folder" });
  if (!path) return;
  await invoke("set_data_root", { path });
  dataRoot.path = path;
}
