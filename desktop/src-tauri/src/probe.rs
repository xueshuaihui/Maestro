//! Append-only probe events (JSON Lines) and the ctl directory watcher.
//!
//! Both seams are only active when the corresponding argument was passed at
//! launch (`--probe <file>` / `--ctl <dir>`). A production start without those
//! arguments never writes probe files and never polls ctl directories.

use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

static PROBE_FILE: OnceLock<PathBuf> = OnceLock::new();

/// Install the probe sink. Only explicit `--probe <file>` enables it.
pub fn init(file: Option<PathBuf>) {
    if let Some(path) = file {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = PROBE_FILE.set(path);
    }
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Append one JSON event line: `{"event": <name>, ...extra, "t": <ms>}`.
pub fn event(name: &str, extra: serde_json::Value) {
    let Some(path) = PROBE_FILE.get() else { return };
    event_to(path, name, extra);
}

/// Append an event line to an explicit probe file (used by the
/// single-instance callback, which runs in the primary instance but must
/// record into the second instance's probe file).
pub fn event_to(path: &std::path::Path, name: &str, extra: serde_json::Value) {
    let mut object = match extra {
        serde_json::Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    object.insert("event".into(), serde_json::Value::String(name.into()));
    object.insert("t".into(), serde_json::json!(now_ms()));
    let line = serde_json::Value::Object(object).to_string();
    append_line(path, &line);
}

fn append_line(path: &std::path::Path, line: &str) {
    use std::io::Write;
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{line}");
        let _ = file.flush();
    }
}

/// Poll the ctl directory (100ms cadence) and dispatch triggers through the
/// main-thread handler. Each trigger file is renamed to `.done` after firing.
pub fn start_ctl_watcher(app: tauri::AppHandle, dir: PathBuf) {
    std::thread::spawn(move || loop {
        let tick = |result: std::io::Result<bool>, label: &str| {
            if let Err(err) = result {
                event("ctl-error", serde_json::json!({ "label": label, "cause": err.to_string() }));
            }
        };
        for name in ["close-window", "tray-open", "tray-quit"] {
            let path = dir.join(name);
            if path.exists() {
                event("ctl-fired", serde_json::json!({ "action": name }));
                tick(std::fs::rename(&path, dir.join(format!("{name}.done"))).map(|_| true), name);
                // Window methods are thread-safe in Tauri 2 (they dispatch to the
                // main thread internally), so no run_on_main_thread hop is needed.
                crate::tray::handle_ctl(&app, name);
            }
        }
        // `open-instance/` sub-directory: each entry (file or dir) is an instance id.
        let open_dir = dir.join("open-instance");
        if let Ok(entries) = std::fs::read_dir(&open_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".done") {
                    continue;
                }
                event("ctl-fired", serde_json::json!({ "action": "open-instance", "id": name }));
                let _ = std::fs::rename(entry.path(), open_dir.join(format!("{name}.done")));
                crate::tray::handle_open_instance(&app, &name);
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    });
}

/// Block until `<dir>/<name>` appears (renamed to `.done`), or timeout (ms).
pub fn wait_ctl_file(dir: &std::path::Path, name: &str, timeout_ms: u64) -> bool {
    let path = dir.join(name);
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
    while std::time::Instant::now() < deadline {
        if path.exists() {
            let _ = std::fs::rename(&path, dir.join(format!("{name}.done")));
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    false
}
