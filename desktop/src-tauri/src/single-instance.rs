//! Application-level single instance lock (tauri-plugin-single-instance).
//! When a second launch happens, the callback runs in the PRIMARY instance:
//! record the `activated` probe event (into the second instance's probe file
//! when provided), focus the existing window, and keep running. The second
//! process exits inside the plugin before any window or daemon is created
//! (AC-36).

use tauri::plugin::TauriPlugin;

pub fn init() -> TauriPlugin<tauri::Wry> {
    tauri_plugin_single_instance::init(|app, argv, _cwd| {
        let probe_path = probe_file_from_argv(&argv);
        match probe_path {
            Some(path) => crate::probe::event_to(
                &path,
                "activated",
                serde_json::json!({ "pid": std::process::id() }),
            ),
            None => crate::probe::event(
                "activated",
                serde_json::json!({ "pid": std::process::id() }),
            ),
        }
        crate::tray::open_main_window(app);
    })
}

/// Parse `--probe <file>` out of the second instance's argv.
fn probe_file_from_argv(argv: &[String]) -> Option<std::path::PathBuf> {
    let mut index = 0;
    while index < argv.len() {
        if argv[index] == "--probe" {
            return argv.get(index + 1).map(std::path::PathBuf::from);
        }
        index += 1;
    }
    None
}
