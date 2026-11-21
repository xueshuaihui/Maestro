//! Tray menu (info line -> open -> pause/resume -> quit), the quit flow
//! (running-instance confirm -> stop request over the pipe -> SIGTERM
//! backstop -> exit), and the ctl action dispatcher.
//!
//! Menu text only ever comes from `config::Labels` (baked-in defaults or
//! `/ui/labels`): no user-facing literal is embedded in this file. The tray
//! numbers are rendered from daemon projections (`ShellState::tray`), never
//! recomputed here (D-36).

use serde_json::{json, Value};
use std::process::Child;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

use crate::probe;
use crate::ShellState;

/// Live tray numbers, all sourced from daemon projections. `None` = the
/// daemon channel is down; the info line then renders the disconnected form.
#[derive(Default)]
pub struct TrayStatus {
    pub instances: Option<u32>,
    pub pending: Option<u32>,
    /// Instance ids currently in a pausable phase (`running` / `suspended`),
    /// taken verbatim from the `/instances` projection.
    pub running_ids: Vec<String>,
    /// Whether the last successful pause round left instances paused (the
    /// menu item then shows the resume label).
    pub paused: bool,
}

impl TrayStatus {
    /// The tuple that decides whether the menu needs a rebuild + probe line.
    fn key(&self) -> (Option<u32>, Option<u32>, usize, bool) {
        (self.instances, self.pending, self.running_ids.len(), self.paused)
    }

    /// The pause/resume menu item is enabled whenever something is pausable,
    /// or while a previous pause round is still in effect (resume stays
    /// clickable).
    fn pause_enabled(&self) -> bool {
        self.paused || !self.running_ids.is_empty()
    }
}

/// 16x16 opaque tray icon, generated as raw RGBA (no asset files needed).
fn tray_icon_rgba() -> tauri::image::Image<'static> {
    let mut rgba = Vec::with_capacity(16 * 16 * 4);
    for y in 0..16u32 {
        for x in 0..16u32 {
            // Dark rounded square with a lighter diagonal mark.
            let inside = x >= 2 && x < 14 && y >= 2 && y < 14;
            let mark = (x + y) >= 12 && (x + y) <= 17 && x >= 4 && x < 12 && y >= 4 && y < 12;
            let (r, g, b) = if mark { (230, 230, 235) } else { (40, 44, 52) };
            let alpha = if inside { 255 } else { 0 };
            rgba.extend_from_slice(&[r, g, b, alpha]);
        }
    }
    tauri::image::Image::new_owned(rgba, 16, 16)
}

fn labels_of(app: &AppHandle) -> crate::config::Labels {
    let state = app.state::<ShellState>();
    let labels = state.labels.lock().unwrap().clone();
    labels
}

/// Rebuild the four-item menu (A-9 fixed order: info line -> open ->
/// pause/resume -> quit) from the current labels + tray status. The info line
/// is a disabled (read-only) item.
fn rebuild_menu(app: &AppHandle) {
    let labels = labels_of(app);
    let (status_text, pause_text, pause_enabled) = {
        let state = app.state::<ShellState>();
        let tray = state.tray.lock().unwrap();
        (
            labels.tray_status_for(tray.instances, tray.pending),
            if tray.paused {
                labels.tray_resume.clone()
            } else {
                labels.tray_pause.clone()
            },
            tray.pause_enabled(),
        )
    };
    if let Some(tray_icon) = app.tray_by_id("maestro-tray") {
        if let Ok(menu) = Menu::with_items(
            app,
            &[
                &MenuItem::with_id(app, "tray-status", &status_text, false, None::<&str>).unwrap(),
                &MenuItem::with_id(app, "tray-open", &labels.tray_open, true, None::<&str>).unwrap(),
                &MenuItem::with_id(app, "tray-pause", &pause_text, pause_enabled, None::<&str>)
                    .unwrap(),
                &MenuItem::with_id(app, "tray-quit", &labels.tray_quit, true, None::<&str>).unwrap(),
            ],
        ) {
            let _ = tray_icon.set_menu(Some(menu));
        }
    }
}

/// Emit the `tray-status` probe line (D-9: instances / pendingEscalations /
/// menuPauseLabel / enabled) with the current menu shape.
fn emit_status(app: &AppHandle) {
    let labels = labels_of(app);
    let state = app.state::<ShellState>();
    let tray = state.tray.lock().unwrap();
    probe::event(
        "tray-status",
        json!({
            "instances": tray.instances,
            "pendingEscalations": tray.pending,
            "menuPauseLabel": if tray.paused { labels.tray_resume } else { labels.tray_pause },
            "enabled": tray.pause_enabled(),
            "menuItems": ["tray-status", "tray-open", "tray-pause", "tray-quit"],
        }),
    );
}

fn sync_menu(app: &AppHandle, emit: bool) {
    rebuild_menu(app);
    if emit {
        emit_status(app);
    }
}

/// Build the tray with the four fixed menu items and record `tray-created`.
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let menu = Menu::with_items(
        app,
        &[
            // Placeholder info line; `update_status` replaces the menu as soon
            // as the first projection numbers arrive.
            &MenuItem::with_id(
                app,
                "tray-status",
                &labels_of(app).tray_status_for(None, None),
                false,
                None::<&str>,
            )?,
            &MenuItem::with_id(app, "tray-open", &labels_of(app).tray_open, true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "tray-pause",
                &labels_of(app).tray_pause,
                false,
                None::<&str>,
            )?,
            &MenuItem::with_id(app, "tray-quit", &labels_of(app).tray_quit, true, None::<&str>)?,
        ],
    )?;
    let _tray = TrayIconBuilder::with_id("maestro-tray")
        .icon(tray_icon_rgba())
        .icon_as_template(true)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-open" => open_main_window(app),
            "tray-pause" => {
                // pause_all performs blocking HTTP; never block the menu
                // event dispatch thread.
                let handle = app.clone();
                std::thread::spawn(move || pause_all(&handle));
            }
            "tray-quit" => {
                let handle = app.clone();
                std::thread::spawn(move || quit(handle));
            }
            _ => {}
        })
        .build(app)?;
    probe::event("tray-created", json!({ "created": true }));
    Ok(())
}

/// Rebuild the tray menu after labels have been fetched from the channel.
/// No probe line here: label refreshes must not inflate the tray-status
/// series the acceptance tests read.
pub fn refresh(app: AppHandle) {
    rebuild_menu(&app);
}

/// Push new projection numbers into the tray (called by the status listener
/// every 2s or on a queue-stream push). Rebuilds + records only on change.
pub fn update_status(
    app: &AppHandle,
    instances: Option<u32>,
    pending: Option<u32>,
    running_ids: Vec<String>,
) {
    let changed = {
        let state = app.state::<ShellState>();
        let mut tray = state.tray.lock().unwrap();
        let before = tray.key();
        tray.instances = instances;
        tray.pending = pending;
        tray.running_ids = running_ids;
        tray.key() != before
    };
    if changed {
        sync_menu(app, true);
    }
}

/// Flip the pause flag; rebuilds + records only when the label actually
/// changes (so the tray-status series carries one line per transition).
fn set_paused(app: &AppHandle, value: bool) {
    let changed = {
        let state = app.state::<ShellState>();
        let mut tray = state.tray.lock().unwrap();
        let before = tray.paused;
        tray.paused = value;
        tray.paused != before
    };
    if changed {
        sync_menu(app, true);
    }
}

/// Menu / ctl `tray-pause`: pause every pausable instance through the daemon
/// write face (`POST /control/pause`, D-8), collect the summary and show it
/// (A-9). Nothing to pause -> fixed hint, no error, no state change (AC-48).
pub fn pause_all(app: &AppHandle) {
    let (root, labels, targeted) = {
        let state = app.state::<ShellState>();
        let labels = state.labels.lock().unwrap().clone();
        let targeted = state.tray.lock().unwrap().running_ids.clone();
        let project = state.project_root.lock().unwrap().clone();
        (project, labels, targeted)
    };
    let mut paused = 0u32;
    let mut skipped = targeted.len() as u32;
    let mut ok = false;
    if let Some(root) = root.as_deref() {
        if let Some(meta) = crate::config::read_desktop_json(root) {
            let port = meta.get("port").and_then(Value::as_u64).unwrap_or(0) as u16;
            let token = meta.get("token").and_then(Value::as_str).unwrap_or("");
            if port != 0 {
                if let Some(resp) = crate::http_post_json(port, "/control/pause", token) {
                    ok = resp.get("ok").and_then(Value::as_bool).unwrap_or(false);
                    paused = resp.get("paused").and_then(Value::as_u64).unwrap_or(0) as u32;
                    skipped = resp.get("skipped").and_then(Value::as_u64).unwrap_or(0) as u32;
                }
            }
        }
    }
    // A full failure (channel down / every instance skipped) is not an error:
    // zero paused -> the fixed "nothing to pause" hint (D-8 / AC-48).
    if !ok {
        paused = 0;
        skipped = targeted.len() as u32;
    }
    let message = labels.tray_pause_summary_for(paused, skipped);
    if paused > 0 {
        set_paused(app, true);
    }
    probe::event(
        "tray-pause",
        json!({ "paused": paused, "affected": targeted, "skipped": skipped, "message": message }),
    );
}

/// Menu / ctl `tray-resume`: mirror of `pause_all` against
/// `POST /control/resume`. The label change is recorded through the
/// tray-status line inside `set_paused`.
pub fn resume_all(app: &AppHandle) {
    let root = {
        let state = app.state::<ShellState>();
        let root = state.project_root.lock().unwrap().clone();
        root
    };
    let mut paused = 0u32;
    let mut ok = false;
    if let Some(root) = root.as_deref() {
        if let Some(meta) = crate::config::read_desktop_json(root) {
            let port = meta.get("port").and_then(Value::as_u64).unwrap_or(0) as u16;
            let token = meta.get("token").and_then(Value::as_str).unwrap_or("");
            if port != 0 {
                if let Some(resp) = crate::http_post_json(port, "/control/resume", token) {
                    ok = resp.get("ok").and_then(Value::as_bool).unwrap_or(false);
                    paused = resp.get("paused").and_then(Value::as_u64).unwrap_or(0) as u32;
                }
            }
        }
    }
    if ok && paused > 0 {
        set_paused(app, false);
    }
}

/// Shared shell -> window bridge: ask the live window to switch to the queue
/// view (WP-8 owns the `queue` view key) with an optional selected entry id.
fn eval_open_queue(app: &AppHandle, selected: Option<&str>) {
    if let Some(win) = app.get_webview_window("main") {
        let selected =
            serde_json::to_string(&selected.map(str::to_string)).unwrap_or_else(|_| "null".into());
        let _ = win.eval(&format!(
            "if (window.__MAESTRO_CTL__) window.__MAESTRO_CTL__('open-queue', {{selected: {selected}}});"
        ));
    }
}

/// Notification click path (AC-04): bring the main window to the front,
/// switch to the queue view and select the entry from the clicked intent.
/// The exact same function serves the real click callback and ctl
/// `notify-open` — there is no test-only branch.
pub fn handle_notify_open(app: &AppHandle, id_override: Option<&str>) {
    open_main_window(app);
    {
        let state = app.state::<ShellState>();
        *state.view.lock().unwrap() = "queue".to_string();
    }
    let last = {
        let state = app.state::<ShellState>();
        let last = state.last_notify.lock().unwrap().clone();
        last
    };
    let kind = last
        .as_ref()
        .and_then(|v| v.get("kind"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let instance_id = last
        .as_ref()
        .and_then(|v| v.get("instanceId"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let id = id_override
        .map(str::to_string)
        .or_else(|| {
            last.as_ref()
                .and_then(|v| v.get("ids"))
                .and_then(Value::as_array)
                .and_then(|ids| ids.first())
                .and_then(Value::as_str)
                .map(str::to_string)
        });
    let escalation_id = if kind.as_deref() == Some("escalation") { id.clone() } else { None };
    eval_open_queue(app, id.as_deref());
    probe::event(
        "notify-open",
        json!({
            "kind": kind,
            "instanceId": instance_id,
            "id": id,
            "escalationId": escalation_id,
        }),
    );
    probe::event("nav", json!({ "view": "queue", "selected": id }));
}

/// ctl `queue-open`: the same navigation as a click without a specific entry.
pub fn handle_queue_open(app: &AppHandle) {
    open_main_window(app);
    {
        let state = app.state::<ShellState>();
        *state.view.lock().unwrap() = "queue".to_string();
    }
    eval_open_queue(app, None);
    probe::event("nav", json!({ "view": "queue", "selected": Option::<String>::None }));
}

pub fn open_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// ctl dispatcher (probe.rs watcher -> here, always on a watcher thread).
pub fn handle_ctl(app: &AppHandle, action: &str) {
    match action {
        "close-window" => close_to_tray(app),
        "tray-open" => {
            open_main_window(app);
            // A fresh ctl refresh asks the live window to re-read the instance
            // list through its own transport; the window then emits `rows`.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.eval(
                    "if (window.__MAESTRO_CTL__) window.__MAESTRO_CTL__('refresh-list');",
                );
            }
            let visible = app
                .get_webview_window("main")
                .and_then(|win| win.is_visible().ok())
                .unwrap_or(false);
            probe::event(
                "tray-open",
                json!({ "window": { "visible": visible }, "view": current_view(app) }),
            );
        }
        "tray-quit" => {
            probe::event("quit-triggered", json!({}));
            let handle = app.clone();
            std::thread::spawn(move || quit(handle));
        }
        "notify-open" => handle_notify_open(app, None),
        "tray-pause" => pause_all(app),
        "tray-resume" => resume_all(app),
        "queue-open" => handle_queue_open(app),
        _ => {}
    }
}

/// ctl `open-instance/<id>`: ask the live window to open the graph.
///
/// The shell must not synthesise `graph-shown`: AC-26 requires the event to
/// carry `nodes` / `edges` / `dangling` measured by the window that rendered
/// the graph. Only the request is recorded here.
pub fn handle_open_instance(app: &AppHandle, instance_id: &str) {
    {
        let state = app.state::<ShellState>();
        *state.view.lock().unwrap() = "graph".to_string();
    }
    let id = serde_json::to_string(instance_id).unwrap_or_else(|_| "null".into());
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.eval(&format!(
            "if (window.__MAESTRO_CTL__) window.__MAESTRO_CTL__('open-instance', {id});"
        ));
    }
    probe::event(
        "graph-open-request",
        json!({ "instanceId": instance_id, "view": "graph" }),
    );
}

fn current_view(app: &AppHandle) -> String {
    app.state::<ShellState>().view.lock().unwrap().clone()
}

/// Close button equivalent: hide the window, the daemon child keeps running.
pub fn close_to_tray(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    probe::event("close-window", json!({ "window": { "visible": false } }));
    probe::event("closed", json!({ "window": { "visible": false }, "view": current_view(app) }));
    probe::event("tray-still-present", json!({ "created": true }));
}

/// Full quit flow. The stop request frame is sent from this function only —
/// it is the single stop-site of the whole crate (AC-02 architectural rule).
pub fn quit(app: AppHandle) {
    probe::event("quit-start", json!({}));
    // AC-02: the stop request literal must live within 8 lines of `pub fn quit`.
    let frame = json!({
        "v": 1, "kind": "req", "id": "shell-stop", "method": "core.stop", "params": {}
    })
    .to_string();
    quit_after_confirm(app, frame);
}

fn quit_after_confirm(app: AppHandle, frame: String) {
    let (root, child_pid, ctl_dir, labels) = {
        let state = app.state::<ShellState>();
        let child = state.daemon.lock().unwrap().as_ref().map(Child::id);
        let project = state.project_root.lock().unwrap().clone();
        let snapshot = (
            project,
            child,
            state.ctl_dir.clone(),
            state.labels.lock().unwrap().clone(),
        );
        snapshot
    };
    let running = root
        .as_deref()
        .map(crate::spawn::running_instance_count)
        .unwrap_or(0);
    probe::event("quit-inspect", json!({ "running": running }));
    if running > 0 {
        let text = labels.quit_confirm_for(running);
        probe::event(
            "quit-confirm-shown",
            json!({ "running": running, "text": text }),
        );
        let confirmed = match ctl_dir {
            // Test path: the ctl file `tray-quit-confirm` acts as the click.
            Some(dir) => probe::wait_ctl_file(&dir, "tray-quit-confirm", 30_000),
            // Interactive path: native confirm dialog (A-6 buttons).
            None => {
                use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
                app.dialog()
                    .message(&text)
                    .title(&labels.tray_quit)
                    .buttons(MessageDialogButtons::OkCancelCustom(
                        labels.quit_confirm_quit.clone(),
                        labels.quit_confirm_cancel.clone(),
                    ))
                    .blocking_show()
            }
        };
        if !confirmed {
            return;
        }
    }
    let stopped = root
        .map(|r| crate::spawn::stop_daemon(&r, &frame, child_pid))
        .unwrap_or(true);
    probe::event("quit-stop-done", json!({ "daemonStopped": stopped }));
    // Reap the child handle if we own it. The daemon's IPC pipe is already
    // gone at this point (`daemonStopped=true`), so the shell must not stay
    // alive hostage to a slow daemon teardown: poll with a bounded window,
    // then escalate to SIGKILL (the stop request itself has been delivered).
    if let Some(state) = app.try_state::<ShellState>() {
        if let Ok(mut guard) = state.daemon.lock() {
            if let Some(child) = guard.as_mut() {
                let pid = child.id();
                probe::event("quit-reap-start", json!({ "pid": pid }));
                let deadline = std::time::Instant::now() + std::time::Duration::from_secs(8);
                let reaped = loop {
                    match child.try_wait() {
                        Ok(Some(_)) => break true,
                        Ok(None) if std::time::Instant::now() < deadline => {
                            std::thread::sleep(std::time::Duration::from_millis(100));
                        }
                        Ok(None) => break false,
                        Err(_) => break true,
                    }
                };
                if !reaped {
                    probe::event("quit-reap-timeout", json!({ "pid": pid }));
                    let _ = child.kill();
                    let _ = child.wait();
                }
                probe::event("quit-reap-done", json!({ "pid": pid }));
            }
        }
    }
    probe::event("quit", json!({ "daemonStopped": stopped }));
    app.exit(0);
}
