//! Daemon child lifecycle: spawn the bundled interpreter with an absolute
//! in-package path (never resolving through the user's search path), query
//! the existing IPC pipe, and drive the shutdown sequence.

use serde_json::{json, Value};
#[cfg(unix)]
use std::io::{BufRead, BufReader};
use std::io::Write;
#[cfg(unix)]
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
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
#[allow(unused_mut)] // Windows 分支要拿 `child` 做 try_wait / take(stderr)，Unix 不需要
pub fn spawn_daemon(app: &tauri::AppHandle, root: &Path) -> u32 {
    let Some(resources) = resource_dir(app) else { return 0 };
    // The bundled interpreter is `node` on Unix and `node.exe` on Windows; the
    // Unix branch text is unchanged from before the cross-platform split.
    #[cfg(windows)]
    let node = resources.join("runtime").join("node.exe");
    #[cfg(not(windows))]
    let node = resources.join("runtime").join("node");
    let entry = resources.join("src").join("daemon").join("serve-entry.js");
    if !node.is_file() || !entry.is_file() {
        eprintln!("maestro-shell: bundled runtime incomplete (node/entry missing)");
        return 0;
    }
    // 传给解释器的两段路径按平台规范化：
    // Windows 侧统一成正斜杠并剥掉 `\\?\` 逐字前缀——Node 对二者都能解析，
    // 但子进程曾崩在 `realpathSync('C:')`，说明原样传出去的字符串被解坏了。
    #[cfg(windows)]
    let (entry_arg, root_arg) = (win_path_arg(&entry), win_path_arg(root));
    #[cfg(not(windows))]
    let (entry_arg, root_arg) = (entry.clone(), root.to_path_buf());

    let mut command = Command::new(&node);
    command
        .arg(&entry_arg)
        .arg("--project")
        .arg(&root_arg)
        .arg("--desktop")
        .stdout(Stdio::null());
    // Windows: 子进程 cwd 显式设成项目根，并把 stderr 收进 `.orch/daemon-spawn.log`。
    // 为什么（真实 CI 实测，run 43716408317）：打包后的 Windows 版壳能拿到 pid，
    // 但子进程什么也没落盘；而用同一份包内运行时**直接**起 daemon 却能正常
    // 监听命名管道并写出 desktop.json —— 说明差异在「壳怎么起」这一侧，
    // 而壳把 stderr 接到 null 导致无从归因。Unix 分支逐字不变（AC 红线）。
    #[cfg(windows)]
    {
        command.current_dir(root);
        command.stderr(Stdio::piped());
        // GUI 子系统壳没有控制台；console 子进程默认会被 CreateProcess 新建控制台。
        // CREATE_NO_WINDOW 让 node.exe 静默运行，stderr 仍由上面的 pipe 接管。
        command.creation_flags(0x0800_0000);
        // 路径口径留证：CI 实测子进程崩在 `realpathSync('C:')`，说明 node 收到的
        // 入口不是完整路径。把壳这一侧真正传出去的三段字符串写进探针流，
        // 才能分清是「壳给出的字符串就被改了」还是「CreateProcess 传参被打散」。
        crate::probe::event(
            "daemon-spawn",
            json!({
                "node": node.display().to_string(),
                "entry": entry.display().to_string(),
                "root": root.display().to_string(),
                "entryArg": entry_arg,
                "rootArg": root_arg,
            }),
        );
    }
    #[cfg(not(windows))]
    {
        command.stderr(Stdio::null());
    }
    match command.spawn() {
        Ok(mut child) => {
            let pid = child.id();
            #[cfg(windows)]
            {
                capture_stderr(child.stderr.take(), root);
                // 启动即退出说明子进程没能跑起来（缺 DLL / 参数被拒 / 解释器拒绝执行），
                // 把退出码写进探针流，CI 日志里就能直接看到病因。
                std::thread::sleep(Duration::from_millis(700));
                if let Ok(Some(status)) = child.try_wait() {
                    crate::probe::event(
                        "daemon-exit",
                        json!({ "pid": pid, "code": status.code().unwrap_or(-1) }),
                    );
                }
            }
            *app.state::<ShellState>().daemon.lock().unwrap() = Some(child);
            pid
        }
        Err(err) => {
            eprintln!("maestro-shell: daemon spawn failed: {err}");
            0
        }
    }
}

/// Windows 侧交给 Node 的路径形态：剥 `\\?\` 前缀 + 统一正斜杠。
///
/// 两种前缀都要处理：`\\?\C:\a` → `C:/a`，`\\?\UNC\srv\share` → `//srv/share`。
#[cfg(windows)]
fn win_path_arg(path: &Path) -> String {
    let raw = path.display().to_string();
    let stripped = if let Some(rest) = raw.strip_prefix(r"\\?\UNC\") {
        format!("//{rest}")
    } else if let Some(rest) = raw.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        raw
    };
    stripped.replace('\\', "/")
}

/// Drain the daemon's stderr into `<root>/.orch/daemon-spawn.log`（Windows only）。
///
/// 子进程正常时这个文件是空的（daemon 自己只写 `core.log`）；非空即等于拿到了
/// 「解释器为什么拒绝启动这段脚本」的第一手证据。
#[cfg(windows)]
fn capture_stderr(stderr: Option<std::process::ChildStderr>, root: &Path) {
    let Some(mut stderr) = stderr else { return };
    let dir = root.join(".orch");
    let _ = std::fs::create_dir_all(&dir);
    let log = dir.join("daemon-spawn.log");
    std::thread::spawn(move || {
        use std::io::Read;
        let mut buf = Vec::new();
        let _ = stderr.read_to_end(&mut buf);
        if buf.is_empty() {
            return;
        }
        // 按字节截断再转字符串（按 char 截断会切到 UTF-8 中间字节而 panic）。
        let text = String::from_utf8_lossy(&buf[..buf.len().min(16 * 1024)]).to_string();
        let _ = std::fs::write(&log, text);
    });
}

// ---------------------------------------------------------------- pipe client

#[cfg(unix)]
fn pipe_path(root: &Path) -> PathBuf {
    root.join(".orch").join("core.sock")
}

/// One request/response over the NDJSON pipe. `None` when the core is absent.
#[cfg(unix)]
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
#[cfg(unix)]
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

/// Windows: the core IPC endpoint is a named pipe whose name is derived inside
/// the Node side, and `.orch/core.json` is explicitly off-limits as a lookup
/// source (`src/daemon/server.js:409`). The desktop HTTP channel is the
/// platform-neutral equivalent, so the count is read from `GET /instances`.
#[cfg(windows)]
pub fn running_instance_count(root: &Path) -> u32 {
    let Some(meta) = crate::config::read_desktop_json(root) else { return 0 };
    let Some(port) = meta.get("port").and_then(Value::as_u64) else { return 0 };
    let Some(token) = meta.get("token").and_then(Value::as_str) else { return 0 };
    let Some(payload) = http_get_json(port as u16, "/instances", token) else { return 0 };
    payload
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .iter()
        .filter(|item| {
            matches!(
                item.get("phase").and_then(Value::as_str),
                Some("running") | Some("suspended")
            )
        })
        .count() as u32
}

/// Deliver a pre-encoded request frame without waiting for a response.
#[cfg(unix)]
pub fn send_frame(root: &Path, frame: &str) -> bool {
    match UnixStream::connect(pipe_path(root)) {
        Ok(mut stream) => stream.write_all(format!("{frame}\n").as_bytes()).is_ok(),
        Err(_) => false,
    }
}

/// Whether the core pipe still accepts connections.
#[cfg(unix)]
pub fn pipe_alive(root: &Path) -> bool {
    UnixStream::connect(pipe_path(root)).is_ok()
}

/// Stop the daemon: the caller sends the encoded stop request frame, then we
/// wait for the pipe to disappear, escalating to SIGTERM / SIGKILL on the
/// child process as a backstop. Returns true when the pipe is gone.
#[cfg(unix)]
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
#[cfg(unix)]
fn signal(pid: u32, name: &str) {
    let _ = Command::new("/bin/kill")
        .args([format!("-{name}"), pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

// ------------------------------------------------------------ windows branch

/// Minimal HTTP/1.1 GET → JSON helper for the Windows branch (the Node desktop
/// channel is the platform-neutral way to reach the daemon there). Kept local
/// so this change stays inside `spawn.rs`.
#[cfg(windows)]
fn http_get_json(port: u16, path: &str, token: &str) -> Option<Value> {
    use std::io::Read;
    use std::net::TcpStream;

    let mut stream = TcpStream::connect(("127.0.0.1", port)).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(3))).ok()?;
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: Bearer {token}\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    stream.read_to_string(&mut response).ok()?;
    let body = response.split("\r\n\r\n").nth(1)?;
    let start = body.find('{')?;
    let end = body.rfind('}')?;
    serde_json::from_str(&body[start..=end]).ok()
}

/// Windows: the desktop channel descriptor is the liveness signal, since there
/// is no socket file to probe (the named pipe name is not derivable here by
/// design — see `running_instance_count`).
#[cfg(windows)]
fn desktop_channel_alive(root: &Path) -> bool {
    crate::config::read_desktop_json(root).is_some()
}

/// Windows: there is no IPC frame to deliver (the pipe name lives on the Node
/// side), so the child process tree is terminated directly and success is
/// measured by the desktop channel descriptor disappearing.
#[cfg(windows)]
pub fn stop_daemon(root: &Path, _frame: &str, child_pid: Option<u32>) -> bool {
    if let Some(pid) = child_pid {
        // taskkill 也是 console 子系统程序；GUI 壳退出时若不给标志会闪一个黑框。
        let mut kill = Command::new("taskkill");
        kill.creation_flags(0x0800_0000);
        let _ = kill
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let deadline = Instant::now() + Duration::from_secs(7);
    while Instant::now() < deadline {
        if !desktop_channel_alive(root) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    !desktop_channel_alive(root)
}

#[cfg(unix)]
fn reap_child(child_pid: Option<u32>) {
    // The daemon child normally exits on its own after receiving the stop
    // request. `wait()` on the Child handle is performed by quit() so the OS
    // entry is reaped; nothing further is needed here.
    let _ = child_pid;
}

/// Point the main window at the daemon-served UI when `desktop.json` is
/// readable. Returns false while the channel is not up yet. Also called from
/// `startup_status`, so a channel that appears after the waiter timed out can
/// still replace the shell page instead of leaving a permanent spinner.
pub fn navigate_to_ui(app: &tauri::AppHandle, root: &std::path::Path) -> bool {
    let Some(meta) = crate::config::read_desktop_json(root) else {
        return false;
    };
    let port = meta.get("port").and_then(Value::as_u64).unwrap_or(0) as u16;
    let token = meta.get("token").and_then(Value::as_str).unwrap_or("");
    if port == 0 || token.is_empty() {
        return false;
    }
    let Some(win) = app.get_webview_window("main") else {
        return false;
    };
    // Decision M (B-25): WebView navigation cannot attach an Authorization
    // header, so the token rides in the query. Only static GETs accept it; the
    // page captures it and the shell never logs or prints it.
    //
    // Decision Q (Q-1): the project root rides along the same way, so the page
    // can hand it to the view-preference calls (AC-22) and the project guard
    // (AC-31) instead of starting with a null root. `append_pair` percent-encodes
    // both values; neither is ever printed or logged.
    let mut url: tauri::Url = format!("http://127.0.0.1:{port}/ui/").parse().unwrap();
    {
        let mut query = url.query_pairs_mut();
        query.append_pair("token", token);
        query.append_pair("project", &root.to_string_lossy());
    }
    win.navigate(url).is_ok()
}

/// Poll `<root>/.orch/desktop.json` until present (daemon HTTP channel up),
/// then refresh labels and point the window at the served UI.
pub fn wait_desktop_channel(app: tauri::AppHandle, root: PathBuf) {
    std::thread::spawn(move || {
        for _ in 0..100 {
            if crate::config::read_desktop_json(&root).is_some() {
                if let Some(labels) = crate::config::fetch_labels(&root) {
                    let state = app.state::<ShellState>();
                    *state.labels.lock().unwrap() = labels;
                    drop(state);
                    crate::tray::refresh(app.clone());
                }
                navigate_to_ui(&app, &root);
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        // The shell page polls `startup_status` and turns this timeout into the
        // A-4 failure line; `startup_status` also retries navigation if the
        // channel shows up later. The probe line keeps the run diagnosable.
        crate::probe::event(
            "desktop-channel-timeout",
            json!({ "root": root.to_string_lossy() }),
        );
    });
}
