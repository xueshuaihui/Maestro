//! Daemon child lifecycle: spawn the bundled interpreter with an absolute
//! in-package path (never resolving through the user's search path), query
//! the existing IPC pipe, and drive the shutdown sequence.

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tauri::Manager;

use crate::ShellState;

/// Locate the bundled resources directory for the running executable.
pub fn resource_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().resource_dir().ok()
}

/// Spawn the daemon child:
/// `<resources>/runtime/node <resources>/src/daemon/serve-entry.js --project <root> --desktop`
/// The interpreter path is absolute inside the package; the user's search
/// path is never consulted (AC-29 architectural rule).
/// Returns the child pid (0 when the bundle is incomplete).
pub fn spawn_daemon(app: &tauri::AppHandle, root: &Path) -> u32 {
    let Some(resources) = resource_dir(app) else { return 0 };
    let node = resources.join("runtime").join("node");
    let entry = resources.join("src").join("daemon").join("serve-entry.js");
    if !node.is_file() || !entry.is_file() {
        eprintln!("maestro-shell: bundled runtime incomplete (node/entry missing)");
        return 0;
    }
    let child = Command::new(&node)
        .arg(&entry)
        .arg("--project")
        .arg(root)
        .arg("--desktop")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    match child {
        Ok(child) => {
            let pid = child.id();
            *app.state::<ShellState>().daemon.lock().unwrap() = Some(child);
            pid
        }
        Err(err) => {
            eprintln!("maestro-shell: daemon spawn failed: {err}");
            0
        }
    }
}

// ---------------------------------------------------------------- pipe client

fn pipe_path(root: &Path) -> PathBuf {
    root.join(".orch").join("core.sock")
}

/// One request/response over the NDJSON pipe. `None` when the core is absent.
pub fn ipc_request(root: &Path, method: &str, params: Value) -> Option<Value> {
    let id = format!("shell-{}", std::process::id());
    let frame = json!({ "v": 1, "kind": "req", "id": id, "method": method, "params": params });
    let mut stream = UnixStream::connect(pipe_path(root)).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
    stream
        .write_all(format!("{}\n", serde_json::to_string(&frame).ok()?).as_bytes())
        .ok()?;
    let reader = BufReader::new(stream);
    for line in reader.lines() {
        let Ok(line) = line else { break };
        let Ok(value) = serde_json::from_str::<Value>(&line) else { continue };
        if value.get("kind").and_then(Value::as_str) == Some("res")
            && value.get("id").and_then(Value::as_str) == Some(id.as_str())
        {
            return Some(value);
        }
    }
    None
}

/// Number of instances in `running`/`suspended` state (A-6 confirm trigger).
pub fn running_instance_count(root: &Path) -> u32 {
    let Some(response) = ipc_request(root, "instance.list", json!({})) else { return 0 };
    let items = response
        .get("result")
        .and_then(|r| r.get("items"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    items
        .iter()
        .filter(|item| {
            matches!(
                item.get("state").and_then(Value::as_str),
                Some("running") | Some("suspended")
            )
        })
        .count() as u32
}

/// Deliver a pre-encoded request frame without waiting for a response.
pub fn send_frame(root: &Path, frame: &str) -> bool {
    match UnixStream::connect(pipe_path(root)) {
        Ok(mut stream) => stream.write_all(format!("{frame}\n").as_bytes()).is_ok(),
        Err(_) => false,
    }
}

/// Whether the core pipe still accepts connections.
pub fn pipe_alive(root: &Path) -> bool {
    UnixStream::connect(pipe_path(root)).is_ok()
}

/// Stop the daemon: the caller sends the encoded stop request frame, then we
/// wait for the pipe to disappear, escalating to SIGTERM / SIGKILL on the
/// child process as a backstop. Returns true when the pipe is gone.
pub fn stop_daemon(root: &Path, frame: &str, child_pid: Option<u32>) -> bool {
    send_frame(root, frame);
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        if !pipe_alive(root) {
            reap_child(child_pid);
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    if let Some(pid) = child_pid {
        signal(pid, "TERM");
    }
    let deadline = Instant::now() + Duration::from_secs(2);
    while Instant::now() < deadline {
        if !pipe_alive(root) {
            reap_child(child_pid);
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    if let Some(pid) = child_pid {
        signal(pid, "KILL");
    }
    reap_child(child_pid);
    !pipe_alive(root)
}

/// Deliver a signal via `/bin/kill` (absolute path; no search-path lookup).
fn signal(pid: u32, name: &str) {
    let _ = Command::new("/bin/kill")
        .args([format!("-{name}"), pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

fn reap_child(child_pid: Option<u32>) {
    // The daemon child normally exits on its own after receiving the stop
    // request. `wait()` on the Child handle is performed by quit() so the OS
    // entry is reaped; nothing further is needed here.
    let _ = child_pid;
}

/// Poll `<root>/.orch/desktop.json` until present (daemon HTTP channel up),
/// then refresh labels and point the window at the served UI.
pub fn wait_desktop_channel(app: tauri::AppHandle, root: PathBuf) {
    std::thread::spawn(move || {
        for _ in 0..100 {
            if let Some(meta) = crate::config::read_desktop_json(&root) {
                let port = meta.get("port").and_then(Value::as_u64).unwrap_or(0) as u16;
                if let Some(labels) = crate::config::fetch_labels(&root) {
                    let state = app.state::<ShellState>();
                    *state.labels.lock().unwrap() = labels;
                    drop(state);
                    crate::tray::refresh(app.clone());
                }
                if port != 0 {
                    // Decision M (B-25): WebView navigation cannot attach an
                    // Authorization header, so the token rides in the query.
                    // Only static GETs accept it; the page captures it and the
                    // shell never logs or prints it.
                    let token = meta.get("token").and_then(Value::as_str).unwrap_or("");
                    if let Some(win) = app.get_webview_window("main") {
                        let url: tauri::Url =
                            format!("http://127.0.0.1:{port}/ui/?token={token}").parse().unwrap();
                        let _ = win.navigate(url);
                    }
                }
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    });
}
