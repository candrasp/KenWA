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

struct NodeProcess {
    child: Mutex<Option<Child>>,
    should_run: Mutex<bool>,
    is_initialized: Mutex<bool>,
}

fn get_base_dir() -> PathBuf {
    let path = std::env::current_exe().unwrap();
    
    if cfg!(debug_assertions) {
        // Di mode DEV, root adalah folder project (KenWa)
        let mut p = std::env::current_dir().unwrap();
        if p.ends_with("src-tauri") { p.pop(); }
        p
    } else {
        // Di mode PROD, root adalah tempat .exe berada
        path.parent().unwrap().to_path_buf()
    }
}

fn perform_initialization_sync(state: &NodeProcess) -> Result<(), String> {
    let root_dir = get_base_dir();
    let server_dir = root_dir.join("server");
    let data_dir = server_dir.join("data");
    let auth_dir = data_dir.join("auth");

    println!("[Rust] Root Dir: {:?}", root_dir);
    println!("[Rust] Data Dir: {:?}", data_dir);

    if !data_dir.exists() {
        println!("[Rust] Creating data directory...");
        std::fs::create_dir_all(&data_dir).map_err(|e| format!("Gagal membuat folder data: {}", e))?;
    }
    if !auth_dir.exists() {
        println!("[Rust] Creating auth directory...");
        std::fs::create_dir_all(&auth_dir).map_err(|e| format!("Gagal membuat folder auth: {}", e))?;
    }

    *state.is_initialized.lock().unwrap() = true;
    println!("[Rust] Initialization success!");
    Ok(())
}

#[tauri::command]
async fn initialize_app(state: tauri::State<'_, NodeProcess>) -> Result<String, String> {
    // Tetap sediakan command ini untuk UI jika ingin cek status, 
    // tapi pengerjaan utamanya sudah dilakukan di setup.
    if *state.is_initialized.lock().unwrap() {
        return Ok("Already initialized".to_string());
    }
    perform_initialization_sync(&state)?;
    Ok("Initialization complete".to_string())
}

fn is_server_running() -> bool {
    TcpStream::connect_timeout(
        &"127.0.0.1:3721".parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok()
}

fn start_server_internal(app: tauri::AppHandle, state: &NodeProcess) -> Result<String, String> {
    if !*state.is_initialized.lock().unwrap() {
        return Err("App belum diinisialisasi".to_string());
    }
    
    if is_server_running() {
        return Ok("Server sudah berjalan".to_string());
    }

    let root_dir = get_base_dir();
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

    *state.child.lock().unwrap() = Some(child);
    *state.should_run.lock().unwrap() = true;

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

fn stop_server_internal(state: &NodeProcess) {
    let mut lock = state.child.lock().unwrap();
    if let Some(child) = lock.take() {
        kill_node_process(child);
    }
    *state.should_run.lock().unwrap() = false;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let node_state = NodeProcess {
        child: Mutex::new(None),
        should_run: Mutex::new(false),
        is_initialized: Mutex::new(false),
    };

    tauri::Builder::default()
        .manage(node_state)
        .invoke_handler(tauri::generate_handler![initialize_app])
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // JALANKAN INISIALISASI DI SINI (Sangat Aman)
            let state = app.state::<NodeProcess>();
            if let Err(e) = perform_initialization_sync(&state) {
                eprintln!("Initialization failed: {}", e);
            }

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
                            stop_server_internal(&state);
                            app.exit(0);
                        }
                        "toggle" => {
                            let state = app.state::<NodeProcess>();
                            let app_handle = app.clone();
                            if is_server_running() {
                                stop_server_internal(&state);
                                let _ = toggle_i_clone.set_text("▶ Start Server");
                                let _ = app_handle.emit("server-stopped", "success");
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
                stop_server_internal(&state);
                let _ = toggle_i_stop_event.set_text("▶ Start Server");
                let _ = app_handle_stop.emit("server-stopped", "success");
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
