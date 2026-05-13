// lib.rs — KenWA Tauri backend
// Tanggung jawab:
//   1. Spawn server Node.js sebagai sidecar child process
//   2. Terima event IPC dari sidecar → re-emit ke frontend window
//   3. Register Tauri commands (invoke dari JS)
//   4. Konfigurasi window & tray (jika diperlukan)

#[cfg(not(debug_assertions))]
use tauri::Emitter;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;


// ── IPC Commands (dipanggil dari frontend via __TAURI__.invoke) ─────────────

#[tauri::command]
fn get_server_port() -> u16 {
    3721
}

#[tauri::command]
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// ── App Entry ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|_app| {
            // ── Spawn Node.js server sebagai sidecar ──────────────────────
            // Sidecar binary harus ada di src-tauri/binaries/node-server-<target>.exe
            // saat build. Saat dev, beforeDevCommand sudah menjalankan server.
            #[cfg(not(debug_assertions))]
            {
                let app_handle = _app.handle().clone();
                let sidecar_command = _app.shell().sidecar("node-server").unwrap();
                let (mut rx, _child) = sidecar_command
                    .spawn()
                    .expect("Failed to spawn node-server sidecar");

                // Listen output dari sidecar → forward ke frontend sebagai Tauri event
                tauri::async_runtime::spawn(async move {
                    use tauri_plugin_shell::process::CommandEvent;
                    while let Some(event) = rx.recv().await {
                        match event {
                            CommandEvent::Stdout(line) => {
                                // Coba parse JSON event dari Node.js (IPCBridge.emit)
                                if let Ok(msg) = serde_json::from_slice::<serde_json::Value>(&line) {
                                    if let Some(ev_name) = msg.get("event").and_then(|v| v.as_str()) {
                                        let payload = msg.get("payload").cloned()
                                            .unwrap_or(serde_json::Value::Null);
                                        let _ = app_handle.emit(ev_name, payload);
                                    }
                                }
                            }
                            CommandEvent::Stderr(line) => {
                                eprintln!("[sidecar:err] {}", String::from_utf8_lossy(&line));
                            }
                            _ => {}
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_port,
            minimize_window,
            close_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
