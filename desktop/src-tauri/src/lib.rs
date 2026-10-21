// Вся логика в web/app.js. Rust поднимает окно, плагины и одноразовый сервер для входа в Google.
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};
use tauri::Emitter;

const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Здоровье</title>\
<body style=\"font:16px system-ui;padding:40px\">Вход выполнен. Окно браузера можно закрыть и вернуться в приложение.</body>";

/// Слушает 127.0.0.1 (порт 0 — любой свободный, для Desktop-клиента Google), ждёт один редирект
/// с ?code=…&state=… и отдаёт его путь в окно событием oauth-redirect. Через 5 минут сдаётся.
#[tauri::command]
fn oauth_listen(app: tauri::AppHandle, port: Option<u16>) -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", port.unwrap_or(0))).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(300);
        while Instant::now() < deadline {
            let (mut stream, _) = match listener.accept() {
                Ok(c) => c,
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(100));
                    continue;
                }
            };
            let _ = stream.set_nonblocking(false);
            let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
            let mut buf = [0u8; 8192];
            let n = stream.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]);
            let path = req
                .lines()
                .next()
                .and_then(|l| l.split_whitespace().nth(1))
                .unwrap_or("")
                .to_string();
            if !(path.starts_with("/?") && (path.contains("code=") || path.contains("error="))) {
                let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                continue;
            }
            let head = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                DONE_PAGE.len()
            );
            let _ = stream.write_all(head.as_bytes());
            let _ = stream.write_all(DONE_PAGE.as_bytes());
            let _ = app.emit("oauth-redirect", path);
            break;
        }
    });
    Ok(port)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![oauth_listen])
        .run(tauri::generate_context!())
        .expect("не удалось запустить приложение");
}
