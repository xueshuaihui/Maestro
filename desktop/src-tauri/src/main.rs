//! Maestro desktop shell startup sequence:
//! parse args -> probe init -> single-instance lock -> resolve project root
//! -> spawn daemon child (bundled interpreter) -> build main window ->
//! `ready` probe -> tray. Closing the window hides it to the tray.

mod config;
mod probe;
#[path = "single-instance.rs"]
mod single_instance;
mod spawn;
mod tray;

use serde_json::json;
use std::path::PathBuf;
use std::process::Child;
use std::sync::Mutex;
use tauri::WindowEvent;

pub struct ShellState {
    /// Resolved and validated project root (None when unresolved).
    pub project_root: Option<PathBuf>,
    /// Current shell view: `instances` | `graph` | `project-missing` | `project-invalid`.
    pub view: Mutex<String>,
    /// The spawned daemon child (None when the project is unresolved or the
    /// bundle is incomplete).
    pub daemon: Mutex<Option<Child>>,
    /// ctl directory when `--ctl` was passed.
    pub ctl_dir: Option<PathBuf>,
    /// User-visible shell labels (fallbacks overlaid by `/ui/labels`).
    pub labels: Mutex<config::Labels>,
}

struct Args {
    project: Option<String>,
    probe: Option<PathBuf>,
    ctl: Option<PathBuf>,
}

fn parse_args() -> Args {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let mut args = Args { project: None, probe: None, ctl: None };
    let mut i = 0;
    while i < argv.len() {
        let token = argv[i].as_str();
        let value = |argv: &[String], idx: usize| -> Option<String> {
            argv.get(idx + 1).cloned()
        };
        match token {
            "--project" | "--p" => {
                if let Some(v) = value(&argv, i) {
                    args.project = Some(v);
                    i += 1;
                }
            }
            "--probe" => {
                if let Some(v) = value(&argv, i) {
                    args.probe = Some(PathBuf::from(v));
                    i += 1;
                }
            }
            "--ctl" => {
                if let Some(v) = value(&argv, i) {
                    args.ctl = Some(PathBuf::from(v));
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }
    args
}

fn main() {
    let args = parse_args();
    probe::init(args.probe.clone());
    probe::event("launch", json!({}));

    let (project_root, view, invalid_path) = match config::resolve_project(args.project.clone()) {
        Ok(Some(path)) => (Some(path), "instances".to_string(), None),
        Ok(None) => (None, "project-missing".to_string(), None),
        Err(Some(path)) => (None, "project-invalid".to_string(), Some(path)),
        Err(None) => (None, "project-missing".to_string(), None),
    };

    // The invalid-path message (A-3) is emitted with the ready event.
    let missing_message = match (&view, invalid_path) {
        (v, Some(path)) if v == "project-invalid" => {
            app_labels().project_invalid_for(&path)
        }
        (v, _) if v == "project-missing" => app_labels().project_missing,
        _ => String::new(),
    };

    let state = ShellState {
        project_root: project_root.clone(),
        view: Mutex::new(view.clone()),
        daemon: Mutex::new(None),
        ctl_dir: args.ctl.clone(),
        labels: Mutex::new(app_labels()),
    };

    let ctl_dir = args.ctl.clone();
    let probe_view = view.clone();
    let spawn_root = project_root.clone();

    tauri::Builder::default()
        .plugin(single_instance::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            config::remember_project_command,
            config::read_view_command,
            config::write_view_command,
            probe::probe_emit,
        ])
        .setup(move |app| {
            // Daemon child first: it starts serving while the window builds.
            let daemon_pid = spawn_root
                .as_deref()
                .map(|root| spawn::spawn_daemon(app.handle(), root))
                .unwrap_or(0);

            let win = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Maestro")
            .inner_size(1100.0, 700.0)
            .build()?;

            let visible = win.is_visible().unwrap_or(true);
            probe::event(
                "ready",
                json!({
                    "window": {
                        "visible": visible,
                        "title": win.title().unwrap_or_else(|_| "Maestro".into()),
                    },
                    "view": probe_view,
                    "message": missing_message,
                    "daemon": { "pid": daemon_pid },
                }),
            );

            tray::init(app.handle())?;

            if let Some(root) = spawn_root.as_deref() {
                spawn::wait_desktop_channel(app.handle().clone(), root.to_path_buf());
            }
            if let Some(dir) = ctl_dir {
                probe::start_ctl_watcher(app.handle().clone(), dir);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Close-to-tray: hide the window, keep the daemon running.
                api.prevent_close();
                let _ = window.hide();
                probe::event("close-window", json!({ "window": { "visible": false } }));
                probe::event("closed", json!({ "window": { "visible": false } }));
                probe::event("tray-still-present", json!({ "created": true }));
            }
        })
        .run(tauri::generate_context!())
        .expect("maestro shell failed to start");
}

/// Labels before the channel is live; the values are the A-3/A-6 baselines.
fn app_labels() -> config::Labels {
    config::Labels::default()
}
