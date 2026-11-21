//! Maestro desktop shell startup sequence:
//! parse args -> probe init -> single-instance lock -> resolve project root
//! -> spawn daemon child (bundled interpreter) -> build main window ->
//! `ready` probe -> tray. Closing the window hides it to the tray.
//!
//! I1.11 WP-9: the shell subscribes to the daemon's `GET /notifications/stream`
//! (SSE) and delivers every intent through the OS notification centre
//! (notify-rust). `--no-notify` flips only the delivery switch: the SSE
//! subscription, the `notify` probe line and the click path stay live (D-9 /
//! AC-07). Tray numbers are refreshed from `GET /instances` on a 2s cadence
//! (D-8); the shell never recomputes the text itself (D-36).

mod config;
mod probe;
#[path = "single-instance.rs"]
mod single_instance;
mod spawn;
mod tray;

use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Manager, WindowEvent};

pub struct ShellState {
    /// Resolved project root. Set at launch or by the first-run picker.
    pub project_root: Mutex<Option<PathBuf>>,
    /// A remembered/`--project` path that failed validation (first-run page).
    pub invalid_project: Mutex<Option<String>>,
    /// Set once the daemon and the channel/poller/SSE workers were started for
    /// the bound project (prevents a second picker click from duplicating them).
    pub services_started: AtomicBool,
    /// Shared stop flag for the channel/poller/SSE workers.
    pub stop: Arc<AtomicBool>,
    /// Current shell view: `instances` | `graph` | `queue` | `project-missing` | `project-invalid`.
    pub view: Mutex<String>,
    /// The spawned daemon child (None when the project is unresolved or the
    /// bundle is incomplete).
    pub daemon: Mutex<Option<Child>>,
    /// ctl directory when `--ctl` was passed.
    pub ctl_dir: Option<PathBuf>,
    /// User-visible shell labels (fallbacks overlaid by `/ui/labels`).
    pub labels: Mutex<config::Labels>,
    /// Live tray numbers, all sourced from `GET /instances` (D-36: no compute).
    pub tray: Mutex<tray::TrayStatus>,
    /// Last notification intent; the click path (`handle_notify_open`) reads it
    /// when a ctl trigger supplies no explicit id (AC-04 / AC-49).
    pub last_notify: Mutex<Option<Value>>,
    /// Delivery-layer switch: `--no-notify` sets this false. Intents are still
    /// produced, probed and recorded — only the OS delivery is suppressed.
    pub notify_enabled: AtomicBool,
    /// One-shot guard so the A-2 "notification unavailable" hint is recorded once.
    pub notify_hint_shown: AtomicBool,
    /// Last delivered `mergedCount` per `(kind, instanceId)` key (D-46 dedup).
    pub notify_seen: Mutex<HashMap<String, u64>>,
}

struct Args {
    project: Option<String>,
    probe: Option<PathBuf>,
    ctl: Option<PathBuf>,
    no_notify: bool,
}

fn parse_args() -> Args {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let mut args = Args {
        project: None,
        probe: None,
        ctl: None,
        no_notify: false,
    };
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
            // Test-only: force the delivery layer to fail. Never skips the
            // SSE subscription nor alters intent production / probe records.
            "--no-notify" => args.no_notify = true,
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
    let missing_message = match (&view, invalid_path.as_deref()) {
        (v, Some(path)) if v == "project-invalid" => {
            app_labels().project_invalid_for(path)
        }
        (v, _) if v == "project-missing" => app_labels().project_missing,
        _ => String::new(),
    };

    let stop = Arc::new(AtomicBool::new(false));
    let state = ShellState {
        project_root: Mutex::new(project_root.clone()),
        invalid_project: Mutex::new(invalid_path.clone()),
        services_started: AtomicBool::new(false),
        stop: stop.clone(),
        view: Mutex::new(view.clone()),
        daemon: Mutex::new(None),
        ctl_dir: args.ctl.clone(),
        labels: Mutex::new(app_labels()),
        tray: Mutex::new(tray::TrayStatus::default()),
        last_notify: Mutex::new(None),
        notify_enabled: AtomicBool::new(!args.no_notify),
        notify_hint_shown: AtomicBool::new(false),
        notify_seen: Mutex::new(HashMap::new()),
    };

    let ctl_dir = args.ctl.clone();
    let probe_view = view.clone();
    let spawn_root = project_root.clone();
    // Both background tasks poll this flag; the run loop flips it on exit so
    // neither the SSE reader nor the 2s tray poller outlives the app (D-14).
    let stop_run = stop.clone();

    let app = tauri::Builder::default()
        .plugin(single_instance::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            config::remember_project_command,
            config::read_view_command,
            config::write_view_command,
            probe::probe_emit,
            startup_info,
            startup_status,
            pick_project,
            open_project,
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
                if daemon_pid != 0 {
                    start_project_services(app.handle().clone(), root.to_path_buf());
                }
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
        .build(tauri::generate_context!())
        .expect("maestro shell failed to start");

    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            stop_run.store(true, Ordering::Relaxed);
        }
    });
}

/// Labels before the channel is live; the values are the A-3/A-6 baselines.
fn app_labels() -> config::Labels {
    config::Labels::default()
}

// ------------------------------------------------------------ first-run binding

/// Describe the startup state for the shell page. All user-visible wording is
/// resolved here from `Labels`; the page carries no literals of its own.
#[tauri::command]
fn startup_info(app: tauri::AppHandle) -> Value {
    let state = app.state::<ShellState>();
    let project = state
        .project_root
        .lock()
        .unwrap()
        .as_ref()
        .map(|path| path.to_string_lossy().to_string());
    let invalid = state.invalid_project.lock().unwrap().clone();
    let labels = state.labels.lock().unwrap().clone();
    let invalid_message = invalid
        .as_deref()
        .map(|path| labels.project_invalid_for(path));
    json!({
        "project": project,
        "invalid": invalid,
        "invalidMessage": invalid_message,
        "missing": labels.project_missing,
        "connecting": labels.conn_connecting,
        "failed": labels.conn_failed,
        "hint": labels.project_hint,
        "pathLabel": labels.project_path_label,
        "open": labels.project_action_open,
        "browse": labels.project_action_browse,
        "retry": labels.project_action_retry,
        "recentLabel": labels.project_recent,
        "recent": config::recent_projects(5),
    })
}

/// Native folder picker for the first-run page. Runs as an async command so
/// the blocking dialog API never blocks the webview's main thread.
#[tauri::command]
async fn pick_project(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;

    let title = app
        .state::<ShellState>()
        .labels
        .lock()
        .unwrap()
        .project_choose_title
        .clone();
    app.dialog()
        .file()
        .set_title(title)
        .blocking_pick_folder()
        .and_then(|picked| picked.into_path().ok())
        .map(|path| path.to_string_lossy().to_string())
}

/// Whether the daemon HTTP channel for the bound project is serving. The token
/// never leaves the shell; the page only needs the boolean.
#[tauri::command]
fn startup_status(app: tauri::AppHandle) -> Value {
    let root = app.state::<ShellState>().project_root.lock().unwrap().clone();
    let ready = root
        .as_deref()
        .and_then(config::read_desktop_json)
        .map(|meta| {
            let port = meta.get("port").and_then(Value::as_u64).unwrap_or(0);
            let token = meta.get("token").and_then(Value::as_str).unwrap_or("");
            port != 0 && !token.is_empty()
        })
        .unwrap_or(false);
    if ready {
        if let Some(root) = root.as_deref() {
            spawn::navigate_to_ui(&app, root);
        }
    }
    json!({ "ready": ready })
}

/// Bind a project root, remember it and start the daemon + channel workers.
/// Used by both the first-run page (`invoke`) and the ctl acceptance seam.
pub fn bind_project(app: &tauri::AppHandle, raw: &str) -> Result<u32, String> {
    let trimmed = raw.trim();
    let labels = app.state::<ShellState>().labels.lock().unwrap().clone();
    if trimmed.is_empty() {
        return Err(labels.project_missing.clone());
    }
    let root = PathBuf::from(trimmed);
    if !root.is_dir() {
        return Err(labels.project_invalid_for(trimmed));
    }
    let current = app.state::<ShellState>().project_root.lock().unwrap().clone();
    if let Some(current) = current {
        if current == root {
            return Ok(0);
        }
        return Err(labels.conn_failed.clone());
    }

    config::remember_project(&root);
    {
        let state = app.state::<ShellState>();
        *state.project_root.lock().unwrap() = Some(root.clone());
        *state.invalid_project.lock().unwrap() = None;
        *state.view.lock().unwrap() = "instances".to_string();
    }

    let pid = spawn::spawn_daemon(app, &root);
    if pid == 0 {
        app.state::<ShellState>().project_root.lock().unwrap().take();
        return Err(labels.conn_failed);
    }
    start_project_services(app.clone(), root.clone());
    probe::event(
        "project-opened",
        json!({ "root": root, "daemonPid": pid }),
    );
    Ok(pid)
}

#[tauri::command]
fn open_project(app: tauri::AppHandle, root: String) -> Result<Value, String> {
    let pid = bind_project(&app, &root)?;
    Ok(json!({ "ok": true, "daemonPid": pid }))
}

/// Start the per-project background workers exactly once. `stop` is owned by
/// the shell state so lazily bound projects use the same shutdown flag.
fn start_project_services(app: tauri::AppHandle, root: PathBuf) {
    let (stop, already) = {
        let state = app.state::<ShellState>();
        (
            state.stop.clone(),
            state.services_started.swap(true, Ordering::SeqCst),
        )
    };
    if already {
        return;
    }
    probe::start_window_probe_watcher(root.clone());
    spawn::wait_desktop_channel(app.clone(), root.clone());
    // D-8: info-line numbers from /instances every 2s (and on channel loss ->
    // null -> "实例 — · 待处理升级 —").
    start_tray_status_poller(app.handle().clone(), root.clone(), stop.clone());
    // Notification delivery: always subscribe; the delivery switch inside
    // `deliver_intent` is what `--no-notify` flips.
    start_notify_stream(app, root, stop);
}

// ------------------------------------------------------- loopback HTTP helpers

/// One loopback request against the daemon desktop channel. Auth is a Bearer
/// token read from `.orch/desktop.json`; the shell never logs it. The body
/// payload is extracted between the first `{`/`[` and last `}`/`]`, which also
/// tolerates Node's chunked framing (the envelope is always one JSON value).
fn http_request(
    port: u16,
    path: &str,
    token: &str,
    method: &str,
    body: Option<&str>,
) -> Option<Value> {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(3))).ok()?;
    let mut request = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: Bearer {token}\r\nConnection: close\r\n"
    );
    if let Some(body) = body {
        request.push_str(&format!(
            "Content-Type: application/json\r\nContent-Length: {}\r\n",
            body.len()
        ));
    }
    request.push_str("\r\n");
    if let Some(body) = body {
        request.push_str(body);
    }
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    stream.read_to_string(&mut response).ok()?;
    let payload = response.split("\r\n\r\n").nth(1)?;
    let start = payload.find(['{', '['])?;
    let end = payload.rfind(['}', ']'])?;
    serde_json::from_str(&payload[start..=end]).ok()
}

fn http_get_json(port: u16, path: &str, token: &str) -> Option<Value> {
    http_request(port, path, token, "GET", None)
}

/// POST used by `tray.rs` for `/control/pause` and `/control/resume` (D-8).
pub fn http_post_json(port: u16, path: &str, token: &str) -> Option<Value> {
    http_request(port, path, token, "POST", Some("{}"))
}

// ------------------------------------------------------------- tray numbers

/// D-8 refresh: poll `GET /instances` every 2s and push the projected numbers
/// into the tray. On channel loss every field becomes `None`, which renders the
/// disconnected info line and emits a `tray-status` line with null numbers.
fn start_tray_status_poller(app: tauri::AppHandle, root: PathBuf, stop: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        // Wait for the channel descriptor before the first poll so a cold
        // start never emits a spurious disconnected line.
        while !stop.load(Ordering::Relaxed) {
            if config::read_desktop_json(&root).is_some() {
                break;
            }
            std::thread::sleep(Duration::from_millis(200));
        }
        while !stop.load(Ordering::Relaxed) {
            let status = config::read_desktop_json(&root).and_then(|meta| {
                let port = meta.get("port")?.as_u64()? as u16;
                let token = meta.get("token")?.as_str()?.to_string();
                let payload = http_get_json(port, "/instances", &token)?;
                let items = payload.get("items")?.as_array()?.clone();
                let instances = items.len() as u32;
                let pending = items
                    .iter()
                    .filter_map(|item| {
                        item.get("pending")?.get("escalations")?.as_u64()
                    })
                    .sum::<u64>() as u32;
                let running_ids = items
                    .iter()
                    .filter(|item| {
                        matches!(
                            item.get("phase").and_then(Value::as_str),
                            Some("running") | Some("suspended")
                        )
                    })
                    .filter_map(|item| {
                        item.get("instanceId")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    })
                    .collect::<Vec<_>>();
                Some((Some(instances), Some(pending), running_ids))
            });
            let (instances, pending, running_ids) =
                status.unwrap_or((None, None, Vec::new()));
            tray::update_status(&app, instances, pending, running_ids);
            std::thread::sleep(Duration::from_secs(2));
        }
    });
}

// ----------------------------------------------------------- notification SSE

/// Subscribe to `GET /notifications/stream` and hand every frame to the
/// delivery layer. Reconnects after a drop; both loops observe the stop flag.
fn start_notify_stream(app: tauri::AppHandle, root: PathBuf, stop: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        while !stop.load(Ordering::Relaxed) {
            let channel = config::read_desktop_json(&root).and_then(|meta| {
                let port = meta.get("port")?.as_u64()? as u16;
                let token = meta.get("token")?.as_str()?.to_string();
                if port == 0 { None } else { Some((port, token)) }
            });
            if let Some((port, token)) = channel {
                consume_notify_sse(&app, port, &token, &stop);
            }
            if stop.load(Ordering::Relaxed) {
                break;
            }
            std::thread::sleep(Duration::from_millis(1000));
        }
    });
}

/// Read one SSE connection frame-by-frame: `event: notify` / `data: <json>`.
/// Comment frames (`: connected`), unknown events and malformed payloads are
/// ignored — no panic, no exception into the main loop (AC-07 / BR-05).
fn consume_notify_sse(app: &tauri::AppHandle, port: u16, token: &str, stop: &AtomicBool) {
    let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) else { return };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(60)));
    let request = format!(
        "GET /notifications/stream HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: Bearer {token}\r\nAccept: text/event-stream\r\nConnection: keep-alive\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return;
    }
    let mut reader = BufReader::new(stream);
    // Skip the HTTP response headers (the first blank line terminates them).
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => return,
            Ok(_) => {
                if line == "\r\n" || line == "\n" {
                    break;
                }
            }
            Err(_) => return,
        }
    }
    let mut event_name = String::new();
    let mut data = String::new();
    loop {
        if stop.load(Ordering::Relaxed) {
            return;
        }
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => return, // stream closed -> reconnect
            Ok(_) => {}
            Err(err)
                if matches!(
                    err.kind(),
                    std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
                ) =>
            {
                continue;
            }
            Err(_) => return,
        }
        let text = line.trim_end_matches(['\r', '\n']);
        if text.is_empty() {
            if event_name == "notify" && !data.is_empty() {
                if let Ok(intent) = serde_json::from_str::<Value>(&data) {
                    deliver_intent(app, intent);
                }
            }
            event_name.clear();
            data.clear();
        } else if let Some(v) = text.strip_prefix("event:") {
            event_name = v.trim().to_string();
        } else if let Some(v) = text.strip_prefix("data:") {
            data = v.trim().to_string();
        }
        // ':' comment lines and unknown fields are deliberately ignored.
    }
}

/// Deliver one intent: probe it verbatim, remember it for the click path, then
/// present (or fail) through the OS notification centre. A failure is a probe
/// line + a one-shot label hint — never a retry, throw, or blocked consumer.
fn deliver_intent(app: &tauri::AppHandle, intent: Value) {
    // Remember the exact intent so `handle_notify_open` (real click and ctl
    // `notify-open` alike) can derive kind / instanceId / selected id from it.
    *app.state::<ShellState>().last_notify.lock().unwrap() = Some(intent.clone());

    // D-9 `notify`: forward the intent verbatim — kind / ids / title / body /
    // mergedCount (plus instanceId/at) land in the JSON Lines record as-is.
    probe::event("notify", intent.clone());

    let title = intent
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let body = intent
        .get("body")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let kind = intent
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let instance_id = intent
        .get("instanceId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let merged = intent
        .get("mergedCount")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    // D-46: a system notification is keyed by (kind, instanceId); re-posting
    // with the same derived id replaces the previous presentation.
    let key = format!("{kind}|{instance_id}");

    if !app.state::<ShellState>().notify_enabled.load(Ordering::Relaxed) {
        delivery_failed(app, "--no-notify");
        return;
    }

    // Optional D-46 optimisation: an identical mergedCount for this key is
    // already on screen; skip the OS call but keep the delivery record live.
    let already = app
        .state::<ShellState>()
        .notify_seen
        .lock()
        .unwrap()
        .get(&key)
        == Some(&merged);
    if already {
        probe::event(
            "notify-delivered",
            json!({ "delivered": true, "reason": "same-merged-count" }),
        );
        return;
    }

    let mut notification = notify_rust::Notification::new();
    notification.summary(&title).body(&body);
    #[cfg(target_os = "macos")]
    notification.id(notification_id_mac(&key));
    #[cfg(not(target_os = "macos"))]
    notification.id(stable_hash(&key) as u32);

    match notification.show() {
        Ok(handle) => {
            app.state::<ShellState>()
                .notify_seen
                .lock()
                .unwrap()
                .insert(key.clone(), merged);
            probe::event("notify-delivered", json!({ "delivered": true }));
            watch_click(app.clone(), handle, intent);
        }
        Err(err) => delivery_failed(app, &format!("show: {err}")),
    }
}

/// Record a delivery failure once as a probe line; the first failure also
/// carries the A-2 hint sourced from `Labels` (no user-facing literal here).
fn delivery_failed(app: &tauri::AppHandle, reason: &str) {
    let state = app.state::<ShellState>();
    let first = !state.notify_hint_shown.swap(true, Ordering::Relaxed);
    let mut extra = json!({ "delivered": false, "reason": reason });
    if first {
        extra["hint"] = json!(state.labels.lock().unwrap().notify_unavailable.clone());
    }
    drop(state);
    probe::event("notify-delivered", extra);
}

/// Wait for the OS notification click on its own thread (the wait blocks until
/// the user acts). A real click calls the exact same `handle_notify_open` as
/// the ctl `notify-open` seam — there is no test-only branch here (AC-04).
fn watch_click(app: tauri::AppHandle, handle: notify_rust::NotificationHandle, intent: Value) {
    std::thread::spawn(move || {
        handle.wait_for_action(move |action| {
            if action != "default" {
                return;
            }
            let first = intent
                .get("ids")
                .and_then(Value::as_array)
                .and_then(|ids| ids.first())
                .and_then(Value::as_str);
            match first {
                Some(id) => tray::handle_notify_open(&app, Some(id)),
                None => tray::handle_notify_open(&app, None),
            }
        });
    });
}

/// Stable request identifier derived from `(kind, instanceId)` (D-46). Re-post
/// with this id replaces the displayed notification on macOS UN.
#[cfg(target_os = "macos")]
fn notification_id_mac(key: &str) -> String {
    format!("maestro-i11-{:016x}", stable_hash(key))
}

fn stable_hash(key: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    key.hash(&mut hasher);
    hasher.finish()
}
