//! Shell-side configuration: project root resolution (`--project` > env >
//! remembered projects.json), `MAESTRO_CONFIG_DIR/projects.json` and
//! `.orch/desktop/views/<instanceId>.json` read/write, plus label fetching
//! from the desktop channel with baked-in fallbacks for the interim period
//! before `GET /ui/labels` is served.

use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// User-visible strings used by the shell. Sourced from `GET /ui/labels`
/// whenever the daemon channel is live; otherwise the baked-in defaults below
/// (byte-identical to the A-3/A-6 baselines) keep the shell usable.
#[derive(Clone, Debug)]
pub struct Labels {
    pub tray_open: String,
    pub tray_quit: String,
    pub quit_confirm: String,
    pub quit_confirm_quit: String,
    pub quit_confirm_cancel: String,
    pub project_missing: String,
    pub project_invalid: String,
    /// A-4 连接瞬态/失败文案：首启页在 daemon 尚未写出 `desktop.json` 时使用。
    pub conn_connecting: String,
    pub conn_failed: String,
    /// 首启选择页的交互文案：主操作、浏览、最近项目与输入标签。
    pub project_hint: String,
    pub project_path_label: String,
    pub project_action_open: String,
    pub project_action_browse: String,
    pub project_action_retry: String,
    pub project_recent: String,
    pub project_choose_title: String,
    pub tray_status: String,
    pub tray_status_disconnected: String,
    pub tray_pause: String,
    pub tray_resume: String,
    pub tray_pause_summary: String,
    pub tray_pause_none: String,
    /// A-2 提示：系统通知投递失败时显示一次（经 `/ui/labels` 下发）。
    pub notify_unavailable: String,
}

impl Default for Labels {
    fn default() -> Self {
        Labels {
            tray_open: "打开主窗口".into(),
            tray_quit: "退出".into(),
            quit_confirm: "有 {n} 个实例正在运行，退出将停止守护进程".into(),
            quit_confirm_quit: "退出".into(),
            quit_confirm_cancel: "取消".into(),
            project_missing: "项目 未指定 · 请填写项目目录".into(),
            project_invalid: "项目 不可用 · {path}".into(),
            conn_connecting: "正在连接守护进程…".into(),
            conn_failed: "连接守护进程失败 · 请确认项目目录后重试".into(),
            project_hint: "选择一个项目目录，Maestro 会在其中启动守护进程".into(),
            project_path_label: "项目目录".into(),
            project_action_open: "打开项目".into(),
            project_action_browse: "选择文件夹…".into(),
            project_action_retry: "重试".into(),
            project_recent: "最近打开".into(),
            project_choose_title: "选择 Maestro 项目目录".into(),
            tray_status: "实例 {n} · 待处理升级 {m}".into(),
            tray_status_disconnected: "实例 — · 待处理升级 —".into(),
            tray_pause: "暂停".into(),
            tray_resume: "继续".into(),
            tray_pause_summary: "{n} 个实例已暂停，{m} 个已跳过".into(),
            tray_pause_none: "没有可暂停的实例".into(),
            notify_unavailable: "通知不可用 · 队列仍可用".into(),
        }
    }
}

impl Labels {
    /// Overlay any keys present in the `/ui/labels` payload.
    pub fn merge_payload(&mut self, payload: &Value) {
        let Some(keys) = payload.get("keys").and_then(Value::as_object) else { return };
        let pick = |k: &str| keys.get(k).and_then(Value::as_str).map(str::to_string);
        if let Some(v) = pick("DESKTOP_TRAY_OPEN") { self.tray_open = v; }
        if let Some(v) = pick("DESKTOP_TRAY_QUIT") { self.tray_quit = v; }
        if let Some(v) = pick("DESKTOP_QUIT_CONFIRM") { self.quit_confirm = v; }
        if let Some(v) = pick("DESKTOP_QUIT_CONFIRM_QUIT") { self.quit_confirm_quit = v; }
        if let Some(v) = pick("DESKTOP_QUIT_CONFIRM_CANCEL") { self.quit_confirm_cancel = v; }
        if let Some(v) = pick("DESKTOP_PROJECT_MISSING") { self.project_missing = v; }
        if let Some(v) = pick("DESKTOP_PROJECT_INVALID") { self.project_invalid = v; }
        if let Some(v) = pick("DESKTOP_CONN_CONNECTING") { self.conn_connecting = v; }
        if let Some(v) = pick("DESKTOP_CONN_FAILED") { self.conn_failed = v; }
        if let Some(v) = pick("DESKTOP_TRAY_STATUS") { self.tray_status = v; }
        if let Some(v) = pick("DESKTOP_TRAY_STATUS_DISCONNECTED") { self.tray_status_disconnected = v; }
        if let Some(v) = pick("DESKTOP_TRAY_PAUSE") { self.tray_pause = v; }
        if let Some(v) = pick("DESKTOP_TRAY_RESUME") { self.tray_resume = v; }
        if let Some(v) = pick("DESKTOP_TRAY_PAUSE_SUMMARY") { self.tray_pause_summary = v; }
        if let Some(v) = pick("DESKTOP_TRAY_PAUSE_NONE") { self.tray_pause_none = v; }
        if let Some(v) = pick("DESKTOP_NOTIFY_UNAVAILABLE") { self.notify_unavailable = v; }
    }

    pub fn quit_confirm_for(&self, running: u32) -> String {
        self.quit_confirm.replace("{n}", &running.to_string())
    }

    pub fn project_invalid_for(&self, path: &str) -> String {
        self.project_invalid.replace("{path}", path)
    }

    /// 信息行文本：数字来自守护进程投影（D-36 壳层零计算），任一缺失
    /// （断开 / 未就绪）即渲染断开形态「实例 — · 待处理升级 —」。
    pub fn tray_status_for(&self, instances: Option<u32>, pending: Option<u32>) -> String {
        match (instances, pending) {
            (Some(n), Some(m)) => self
                .tray_status
                .replace("{n}", &n.to_string())
                .replace("{m}", &m.to_string()),
            _ => self.tray_status_disconnected.clone(),
        }
    }

    /// 暂停汇总文案（A-9）：0 个成功时不出现数字句，固定「没有可暂停的实例」。
    pub fn tray_pause_summary_for(&self, paused: u32, skipped: u32) -> String {
        if paused == 0 {
            self.tray_pause_none.clone()
        } else {
            self.tray_pause_summary
                .replace("{n}", &paused.to_string())
                .replace("{m}", &skipped.to_string())
        }
    }
}

// ---------------------------------------------------------------- project root

/// Resolution order (U-1): `--project` arg > `MAESTRO_PROJECT_ROOT` env >
/// first entry of `projects.json` > none (UI asks the user).
/// `Ok(path)` = resolved and valid; `Err(path)` = resolved but unavailable.
pub fn resolve_project(arg: Option<String>) -> Result<Option<PathBuf>, Option<String>> {
    let raw = match arg {
        Some(p) if !p.is_empty() => p,
        _ => std::env::var("MAESTRO_PROJECT_ROOT").unwrap_or_default(),
    };
    let raw = if raw.is_empty() {
        match remembered_project() {
            Some(p) => p,
            None => return Ok(None),
        }
    } else {
        raw
    };
    let path = PathBuf::from(&raw);
    if path.is_dir() {
        Ok(Some(path))
    } else {
        Err(Some(raw))
    }
}

fn config_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("MAESTRO_CONFIG_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    // Windows GUI processes launched from Explorer do not inherit Git-Bash's
    // POSIX-style HOME, and a bare `.` resolves relative to the install dir.
    // USERPROFILE is the reliable per-user base there.
    #[cfg(windows)]
    let home = std::env::var("USERPROFILE")
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| std::env::var("HOME").ok().filter(|value| !value.is_empty()));
    #[cfg(not(windows))]
    let home = std::env::var("HOME")
        .ok()
        .filter(|value| !value.is_empty());
    home.map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".maestro")
}

fn projects_path() -> PathBuf {
    config_dir().join("projects.json")
}

/// First remembered project root, if the file exists and is well-formed.
pub fn remembered_project() -> Option<String> {
    let text = std::fs::read_to_string(projects_path()).ok()?;
    let value: Value = serde_json::from_str(&text).ok()?;
    let first = value.get("projects")?.as_array()?.first()?.as_str()?;
    if first.is_empty() { None } else { Some(first.to_string()) }
}

/// Remembered project roots that still exist, most recent first.
pub fn recent_projects(limit: usize) -> Vec<String> {
    let Some(text) = std::fs::read_to_string(projects_path()).ok() else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&text) else {
        return Vec::new();
    };
    value
        .get("projects")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .filter(|root| !root.is_empty() && Path::new(root).is_dir())
                .take(limit)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

/// Remember a project root (append or move to front of `projects.json`).
pub fn remember_project(root: &Path) {
    let path = projects_path();
    let _ = std::fs::create_dir_all(path.parent().unwrap_or(Path::new(".")));
    let mut projects: Vec<String> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| {
            value
                .get("projects")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
        })
        .unwrap_or_default();
    let entry = root.to_string_lossy().to_string();
    projects.retain(|item| item != &entry);
    projects.insert(0, entry);
    let payload = json!({ "projects": projects, "updatedAt": now_iso() });
    if let Ok(text) = serde_json::to_string_pretty(&payload) {
        let tmp = path.with_extension("json.tmp");
        if std::fs::write(&tmp, text).is_ok() {
            let _ = std::fs::rename(&tmp, &path);
        }
    }
}

fn now_iso() -> String {
    // Seconds-precision ISO-8601 UTC from the epoch (no extra dependency).
    const DAYS_IN_MONTH: [u64; 12] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut days = secs / 86400;
    let rem = secs % 86400;
    let (hour, minute, second) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let mut year = 1970;
    loop {
        let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
        let year_days = if leap { 366 } else { 365 };
        if days >= year_days {
            days -= year_days;
            year += 1;
        } else {
            break;
        }
    }
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let mut month = 1;
    for &len in &DAYS_IN_MONTH {
        let cur = if leap && month == 2 { len + 1 } else { len };
        if days >= cur {
            days -= cur;
            month += 1;
        } else {
            break;
        }
    }
    format!("{year:04}-{month:02}-{days:02}T{hour:02}:{minute:02}:{second:02}Z")
}

// ---------------------------------------------------------------- views

fn view_path(root: &Path, instance_id: &str) -> PathBuf {
    root.join(".orch").join("desktop").join("views").join(format!("{instance_id}.json"))
}

/// Read view offsets for an instance; missing/corrupt files resolve to none.
pub fn read_view(root: &Path, instance_id: &str) -> Option<Value> {
    let text = std::fs::read_to_string(view_path(root, instance_id)).ok()?;
    serde_json::from_str(&text).ok()
}

/// Write view offsets `{offsets, updatedAt}` for an instance.
pub fn write_view(root: &Path, instance_id: &str, offsets: Value) -> Result<(), String> {
    let path = view_path(root, instance_id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let payload = json!({ "offsets": offsets, "updatedAt": now_iso() });
    std::fs::write(&path, serde_json::to_string(&payload).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------- desktop channel

/// Read `<root>/.orch/desktop.json` (written by the daemon HTTP channel).
pub fn read_desktop_json(root: &Path) -> Option<Value> {
    let text = std::fs::read_to_string(root.join(".orch").join("desktop.json")).ok()?;
    serde_json::from_str(&text).ok()
}

/// Minimal loopback HTTP GET (`GET /ui/labels` with Bearer token).
fn http_get_json(port: u16, path: &str, token: &str) -> Option<Value> {
    http_get_json_with(port, path, token, Duration::from_secs(3))
}

fn http_get_json_with(port: u16, path: &str, token: &str, timeout: Duration) -> Option<Value> {
    let mut stream =
        TcpStream::connect(("127.0.0.1", port)).ok()?;
    stream.set_read_timeout(Some(timeout)).ok()?;
    stream.set_write_timeout(Some(timeout)).ok()?;
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: Bearer {token}\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    stream.read_to_string(&mut response).ok()?;
    let body = response.split("\r\n\r\n").nth(1)?;
    // Strip any chunked framing artifacts by taking from the first `{`.
    let start = body.find('{')?;
    let end = body.rfind('}')?;
    serde_json::from_str(&body[start..=end]).ok()
}

/// Liveness check for the desktop channel: the endpoint the window is about
/// to load must answer with the token from `desktop.json`, within 800 ms.
/// A readable file proves nothing after a crash (the port is dead), which is
/// the state that left the shell spinning on "connecting" forever.
pub fn http_get_labels_ok(port: u16, token: &str) -> bool {
    http_get_json_with(port, "/ui/labels", token, Duration::from_millis(800))
        .map(|payload| payload.get("ok").and_then(Value::as_bool) != Some(false))
        .unwrap_or(false)
}

/// Fetch labels from the daemon channel; `None` when unavailable (fallbacks stay).
pub fn fetch_labels(root: &Path) -> Option<Labels> {
    let meta = read_desktop_json(root)?;
    let port = meta.get("port")?.as_u64()? as u16;
    let token = meta.get("token")?.as_str()?.to_string();
    let payload = http_get_json(port, "/ui/labels", &token)?;
    let mut labels = Labels::default();
    labels.merge_payload(&payload);
    Some(labels)
}

// ---------------------------------------------------------------- tauri commands

#[tauri::command]
pub fn remember_project_command(root: String) {
    remember_project(Path::new(&root));
}

#[tauri::command]
pub fn read_view_command(root: String, instance_id: String) -> Option<Value> {
    read_view(Path::new(&root), &instance_id)
}

#[tauri::command]
pub fn write_view_command(root: String, instance_id: String, offsets: Value) -> Result<(), String> {
    write_view(Path::new(&root), &instance_id, offsets)
}
