// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::api::process::{Command, CommandEvent};

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      // Auto-launch Python FastAPI backend sidecar process on startup
      let (_rx, _child) = Command::new_sidecar("pacekeeper-backend")
        .expect("failed to setup sidecar")
        .spawn()
        .expect("failed to spawn sidecar");
      
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
