//! Tray menu (two fixed items), the quit flow (running-instance confirm ->
//! stop request over the pipe -> SIGTERM backstop -> exit), and the ctl
//! action dispatcher.

use serde_json::json;
use std::process::Child;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

use crate::probe;
use crate::ShellState;

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

/// Build the tray with the two fixed menu items and record `tray-created`.
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let labels = {
        let state = app.state::<ShellState>();
        let current = state.labels.lock().unwrap().clone();
        current
    };
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "tray-open", &labels.tray_open, true, None::<&str>)?,
            &MenuItem::with_id(app, "tray-quit", &labels.tray_quit, true, None::<&str>)?,
        ],
    )?;
    let _tray = TrayIconBuilder::with_id("maestro-tray")
        .icon(tray_icon_rgba())
        .icon_as_template(true)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-open" => open_main_window(app),
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
pub fn refresh(app: AppHandle) {
    let labels = {
        let state = app.state::<ShellState>();
        let current = state.labels.lock().unwrap().clone();
        current
    };
    if let Some(tray) = app.tray_by_id("maestro-tray") {
        if let Ok(menu) = Menu::with_items(
            &app,
            &[
                &MenuItem::with_id(&app, "tray-open", &labels.tray_open, true, None::<&str>)
                    .unwrap(),
                &MenuItem::with_id(&app, "tray-quit", &labels.tray_quit, true, None::<&str>)
                    .unwrap(),
            ],
        ) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

pub fn open_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// ctl dispatcher (probe.rs watcher -> here, always on the main thread).
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
        let snapshot = (
            state.project_root.clone(),
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
