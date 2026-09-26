use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const DATA_SUBDIRS: [&str; 2] = ["formulas", "calculator"];

// Lives in the OS app-config dir, not the data folder: it has to record where the data folder is.
#[derive(Serialize, Deserialize, Default, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    data_root: Option<PathBuf>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("config.json"))
        .map_err(|e| e.to_string())
}

fn read_config(path: &Path) -> AppConfig {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write_config(path: &Path, config: &AppConfig) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn init_data_root(root: &Path) -> Result<(), String> {
    if !root.is_dir() {
        return Err(format!("{} is not a folder", root.display()));
    }
    for sub in DATA_SUBDIRS {
        fs::create_dir_all(root.join(sub))
            .map_err(|e| format!("Could not create {sub}/ in {}: {e}", root.display()))?;
    }
    Ok(())
}

fn resolve_in(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let rel = Path::new(relative);
    let is_plain = rel.components().count() > 0
        && rel.components().all(|c| matches!(c, Component::Normal(_)));
    if !is_plain {
        return Err(format!("Invalid data file path: {relative}"));
    }
    Ok(root.join(rel))
}

fn data_file(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    let root = read_config(&config_path(app)?)
        .data_root
        .ok_or("No data folder is set")?;
    resolve_in(&root, relative)
}

// Write-then-rename so sync clients (OneDrive, Dropbox) never pick up a half-written file.
fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_data_file(app: AppHandle, path: String) -> Result<Option<String>, String> {
    match fs::read_to_string(data_file(&app, &path)?) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn write_data_file(app: AppHandle, path: String, contents: String) -> Result<(), String> {
    write_atomic(&data_file(&app, &path)?, &contents)
}

#[tauri::command]
fn get_data_root(app: AppHandle) -> Result<Option<PathBuf>, String> {
    let config = read_config(&config_path(&app)?);
    Ok(config.data_root.filter(|path| path.is_dir()))
}

#[tauri::command]
fn set_data_root(app: AppHandle, path: PathBuf) -> Result<(), String> {
    init_data_root(&path)?;
    write_config(
        &config_path(&app)?,
        &AppConfig {
            data_root: Some(path),
        },
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_data_root,
            set_data_root,
            read_data_file,
            write_data_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mkstudy-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn init_creates_data_subfolders() {
        let root = scratch_dir("init");
        init_data_root(&root).unwrap();
        for sub in DATA_SUBDIRS {
            assert!(root.join(sub).is_dir(), "{sub}/ missing");
        }
        init_data_root(&root).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn init_rejects_missing_folder() {
        let missing = scratch_dir("missing").join("does-not-exist");
        assert!(init_data_root(&missing).is_err());
    }

    #[test]
    fn data_paths_must_stay_inside_the_root() {
        let root = Path::new("C:/data");
        assert_eq!(
            resolve_in(root, "calculator/scratchpad.txt").unwrap(),
            root.join("calculator/scratchpad.txt")
        );
        for bad in ["", "../escape.txt", "calculator/../../x", "C:/Windows/x", "/etc/passwd"] {
            assert!(resolve_in(root, bad).is_err(), "accepted {bad:?}");
        }
    }

    #[test]
    fn atomic_write_replaces_existing_file() {
        let dir = scratch_dir("write");
        let path = dir.join("sub").join("file.txt");
        write_atomic(&path, "first").unwrap();
        write_atomic(&path, "second").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "second");
        assert!(!path.with_extension("tmp").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn config_round_trips_and_defaults_when_absent() {
        let dir = scratch_dir("config");
        let path = dir.join("nested").join("config.json");
        assert_eq!(read_config(&path), AppConfig::default());

        let config = AppConfig {
            data_root: Some(dir.join("data")),
        };
        write_config(&path, &config).unwrap();
        assert_eq!(read_config(&path), config);
        fs::remove_dir_all(dir).unwrap();
    }
}
