//! Append-only probe events (JSON Lines) and the ctl directory watcher.
//!
//! Both seams are only active when the corresponding argument was passed at
//! launch (`--probe <file>` / `--ctl <dir>`). A production start without those
//! arguments never writes probe files and never polls ctl directories.
//!
//! The window contributes its own events through the `probe_emit` command:
//! the UI builds the JSON line (list rows, graph counts) and the shell only
//! appends it, so no rendered text is re-derived here.

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

/// Tauri command: append one probe event built by the live window.
///
/// The payload is the exact `JSON.stringify` output from `desktop/ui/app.js`
/// (`{event: "rows", ...}` / `{event: "graph-shown", ...}`), so the shell does
/// not recompute any rendered value. Without `--probe` this is a silent
/// no-op. A malformed payload logs one fixed diagnostic to stderr and never
/// echoes the payload (it may carry user-visible text).
#[tauri::command]
pub fn probe_emit(payload: String) {
    let Some(path) = PROBE_FILE.get() else { return };
    if serde_json::from_str::<serde_json::Value>(&payload).is_err() {
        eprintln!("maestro-shell: probe_emit rejected a non-JSON payload");
        return;
    }
    append_line(path, &payload);
}

/// Mirror window-side probe events (decision W) into the `--probe` file.
///
/// The daemon appends the exact JSON lines the window built; the shell only
/// copies complete lines, so no rendered value is re-derived here. Without
/// `--probe` this watcher is never started (zero production overhead).
pub fn start_window_probe_watcher(root: PathBuf) {
    let Some(probe_path) = PROBE_FILE.get().cloned() else { return };
    std::thread::spawn(move || {
        let sink = root.join(".orch").join("window-probe.jsonl");
        let mut offset = 0usize;
        loop {
            if let Ok(data) = std::fs::read(&sink) {
                if data.len() < offset {
                    offset = 0; // a recreated acceptance root
                }
                if data.len() > offset {
                    let chunk = &data[offset..];
                    let complete = chunk
                        .iter()
                        .rposition(|byte| *byte == b'\n')
                        .map(|index| index + 1)
                        .unwrap_or(0);
                    if complete > 0 {
                        let text = String::from_utf8_lossy(&chunk[..complete]);
                        for line in text.lines() {
                            if !line.trim().is_empty() {
                                append_line(&probe_path, line);
                            }
                        }
                        offset += complete;
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    });
}

/// The ctl action dispatch list (I1.11 D-9): the three existing actions plus
/// the four new ones. `tray-quit-confirm` is deliberately NOT in this list —
/// it is consumed by `tray.rs` via `wait_ctl_file` while the quit confirm is
/// pending; dispatching it here would rename the file `.done` before that
/// wait ever sees it and break the I1.10a quit flow. `open-instance/` stays a
/// separate two-segment path handled below.
const CTL_ACTIONS: [&str; 7] = [
    "close-window",
    "tray-open",
    "tray-quit",
    "notify-open",
    "tray-pause",
    "tray-resume",
    "queue-open",
];

/// Poll the ctl directory (100ms cadence) and dispatch triggers through the
/// main-thread handler. Each trigger file is renamed to `.done` after firing.
/// Unknown action names record `ctl-error` and are ignored (never dispatched,
/// never panic); `tray-quit-confirm` is left untouched for the quit flow.
pub fn start_ctl_watcher(app: tauri::AppHandle, dir: PathBuf) {
    std::thread::spawn(move || loop {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".done") || name == "open-instance" || name == "tray-quit-confirm"
                {
                    continue;
                }
                let path = entry.path();
                let is_file = path.is_file();
                if CTL_ACTIONS.contains(&name.as_str()) {
                    event("ctl-fired", serde_json::json!({ "action": name }));
                } else {
                    // D-9: unknown actions are recorded and ignored, not dispatched.
                    event(
                        "ctl-error",
                        serde_json::json!({ "action": name, "cause": "unknown-action" }),
                    );
                    if !is_file {
                        continue; // leave unknown directories in place
                    }
                }
                if std::fs::rename(&path, dir.join(format!("{name}.done"))).is_err() {
                    event(
                        "ctl-error",
                        serde_json::json!({ "label": name, "cause": "rename-failed" }),
                    );
                    continue;
                }
                // Window methods are thread-safe in Tauri 2 (they dispatch to the
                // main thread internally), so no run_on_main_thread hop is needed.
                crate::tray::handle_ctl(&app, &name);
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
