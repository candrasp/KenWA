use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use std::io::{BufRead, BufReader};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::{Manager, Listener, Emitter};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};

struct NodeProcess(Mutex<Option<Child>>);

fn get_base_dir() -> PathBuf {
    std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn is_server_running() -> bool {
    TcpStream::connect_timeout(
        &"127.0.0.1:3721".parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok()
}

fn start_server_internal(app: tauri::AppHandle, state: &NodeProcess) -> Result<String, String> {
    if is_server_running() {
        return Ok("Server sudah berjalan".to_string());
    }

    // Resolve root dir (works for both dev and production)
    let root_dir = if cfg!(debug_assertions) {
        let mut p = std::env::current_dir().unwrap();
        if p.ends_with("src-tauri") { p.pop(); }
        p
    } else {
        get_base_dir()
    };

    let node_exe  = root_dir.join("runtime").join("node").join("node.exe");
    let server_js = root_dir.join("server").join("index.js");
    let server_dir = root_dir.join("server");

    // Validate node runtime
    if !node_exe.exists() {
        return Err(format!(
            "Runtime Node.js tidak ditemukan!\nPastikan folder runtime/node/node.exe tersedia di:\n{:?}",
            node_exe
        ));
    }

    // Validate server entry point
    if !server_js.exists() {
        return Err(format!(
            "File server tidak ditemukan!\nPastikan server/index.js tersedia di:\n{:?}",
            server_js
        ));
    }

    let mut cmd = Command::new(&node_exe);
    cmd.arg(&server_js)
        .current_dir(server_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let mut child = cmd.spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Runtime Node.js tidak ditemukan! Pastikan Node.js sudah terinstall.".to_string()
            } else {
                format!("Gagal menjalankan server: {}", e)
            }
        })?;

    // Ambil stdout dan stderr untuk dikirim ke UI
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_stdout = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = app_stdout.emit("server-log", l);
            }
        }
    });

    let app_stderr = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = app_stderr.emit("server-log", format!("ERROR: {}", l));
            }
        }
    });

    *state.0.lock().unwrap() = Some(child);

    for _ in 0..20 {
        std::thread::sleep(Duration::from_millis(500));
        if is_server_running() {
            return Ok("Server berhasil dijalankan".to_string());
        }
    }

    Err("Server tidak merespons setelah 10 detik".to_string())
}

fn kill_node_process(mut child: Child) {
    let pid = child.id();
    let mut cmd = Command::new("taskkill");
    cmd.args(&["/F", "/T", "/PID", &pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let _ = cmd.spawn();
    let _ = child.kill();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let node_state = NodeProcess(Mutex::new(None));

    tauri::Builder::default()
        .manage(node_state)
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Setup Tray Menu
            let title_i = MenuItem::with_id(app, "title", "KenWa WhatsApp Blaster", false, None::<&str>)?;
            let toggle_i = MenuItem::with_id(app, "toggle", "▶ Start Server", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "❌ Quit KenWa", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[
                &title_i,
                &PredefinedMenuItem::separator(app)?,
                &toggle_i,
                &PredefinedMenuItem::separator(app)?,
                &quit_i,
            ])?;

            let toggle_i_clone = toggle_i.clone();

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            let state = app.state::<NodeProcess>();
                            let mut lock = state.0.lock().unwrap();
                            if let Some(child) = lock.take() {
                                kill_node_process(child);
                            }
                            app.exit(0);
                        }
                        "toggle" => {
                            let state = app.state::<NodeProcess>();
                            let app_handle = app.clone();
                            if is_server_running() {
                                let mut lock = state.0.lock().unwrap();
                                if let Some(child) = lock.take() {
                                    kill_node_process(child);
                                    let _ = toggle_i_clone.set_text("▶ Start Server");
                                    let _ = app_handle.emit("server-stopped", "success");
                                }
                            } else {
                                let _ = toggle_i_clone.set_text("⏳ Starting...");
                                let _ = toggle_i_clone.set_enabled(false);
                                match start_server_internal(app_handle.clone(), &state) {
                                    Ok(_) => {
                                        let _ = toggle_i_clone.set_text("⏹ Stop Server");
                                        let _ = toggle_i_clone.set_enabled(true);
                                        let _ = app_handle.emit("server-started", "success");
                                    },
                                    Err(e) => {
                                        let _ = toggle_i_clone.set_text("▶ Start Server");
                                        let _ = toggle_i_clone.set_enabled(true);
                                        let _ = app_handle.emit("server-started", e);
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Event Listeners
            let app_handle = app.handle().clone();
            let toggle_i_event = toggle_i.clone();
            
            app.listen("start-server", move |_event| {
                let state = app_handle.state::<NodeProcess>();
                match start_server_internal(app_handle.clone(), &state) {
                    Ok(_) => {
                        let _ = toggle_i_event.set_text("⏹ Stop Server");
                        let _ = app_handle.emit("server-started", "success");
                    },
                    Err(e) => {
                        let _ = app_handle.emit("server-started", e);
                    }
                }
            });

            let app_handle_stop = app.handle().clone();
            let toggle_i_stop_event = toggle_i.clone();
            
            app.listen("stop-server", move |_event| {
                let state = app_handle_stop.state::<NodeProcess>();
                let mut lock = state.0.lock().unwrap();
                if let Some(child) = lock.take() {
                    kill_node_process(child);
                    let _ = toggle_i_stop_event.set_text("▶ Start Server");
                    let _ = app_handle_stop.emit("server-stopped", "success");
                }
            });

            app.listen("open-browser", move |event| {
                let url = event.payload().trim_matches('"').to_string();
                let mut cmd = Command::new("cmd");
                cmd.args(&["/C", "start", "", &url]);

                #[cfg(target_os = "windows")]
                cmd.creation_flags(0x08000000);

                let _ = cmd.spawn();
            });

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
