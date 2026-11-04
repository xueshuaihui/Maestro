// Maestro 桌面壳骨架（Tauri v2）
//
// 只验证三件事与需求基线一致：系统托盘（含菜单与退出）、多窗口、webview 内 WebSocket 客户端。
// 构建在 GitHub Actions 的 windows-latest 上完成（本地无 Rust/MSVC 工具链）。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "打开控制台", true, None::<&str>)?;
            let pause = MenuItem::with_id(app, "pause", "暂停全部实例", false, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&open, &pause, &sep, &quit])?;

            // 托盘由 tauri.conf.json 的 app.trayIcon 声明创建，这里挂菜单与事件
            if let Some(tray) = app.tray_by_id("main") {
                tray.set_menu(Some(menu))?;
                tray.set_tooltip(Some("Maestro · 控制平面"))?;
            }

            app.on_menu_event(|app, event| match event.id().as_ref() {
                "open" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "quit" => app.exit(0),
                _ => {}
            });

            // 冒烟：CI 里带 MAESTRO_SMOKE=1 启动时把两个窗口都显示出来，便于截图断言
            if std::env::var("MAESTRO_SMOKE").is_ok() {
                for label in ["main", "graph"] {
                    if let Some(w) = app.get_webview_window(label) {
                        let _ = w.show();
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
