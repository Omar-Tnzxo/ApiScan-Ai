use serde::{Deserialize, Serialize};
use calamine::Reader;
use reqwest::header::AUTHORIZATION;
use thiserror::Error;
use tauri::{command, State, WebviewWindow, Emitter};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Semaphore;
use futures_util::future::join_all;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("File error: {0}")]
    File(String),
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Security error: {0}")]
    Security(String),
    #[error("Error: {0}")]
    Generic(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(self.to_string().as_str())
    }
}

pub struct AppState {
    pub is_running: Arc<AtomicBool>,
}

#[derive(Serialize, Deserialize)]
struct FileData {
    headers: Vec<String>,
    rows: Vec<Vec<String>>, // Empty for large files
    row_count: usize,
    path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TestResult {
    pub key: String,
    pub provider: String,
    pub status: String,
    pub message: String,
    pub quota: Option<String>,
    pub models: Option<Vec<String>>,
    pub details: Option<String>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct ValidationOptions {
    pub auto_detect: bool,
    pub check_quota: bool,
    pub check_models: bool,
    pub proxy: Option<String>,
}

// --- Security Helpers ---

fn verify_origin(window: &WebviewWindow) -> Result<(), AppError> {
    let url = window.url().map_err(|e| AppError::Security(e.to_string()))?;
    let scheme = url.scheme();
    let host = url.host_str().unwrap_or("");

    if (scheme == "tauri" || scheme == "https" || scheme == "http") && 
       (host == "localhost" || host == "tauri.localhost" || host.is_empty()) {
        Ok(())
    } else {
        Err(AppError::Security(format!("Security Violation: Invalid Origin {}://{}", scheme, host)))
    }
}

fn detect_provider(key: &str) -> String {
    let k = key.trim();
    // Most specific prefixes first
    if k.starts_with("sk-ant-") { return "Anthropic".to_string(); }
    if k.starts_with("AIzaSy") { return "Google Gemini".to_string(); }
    if k.starts_with("gsk_") { return "Groq".to_string(); }
    if k.starts_with("hf_") { return "Hugging Face".to_string(); }
    if k.starts_with("xai-") { return "xAI".to_string(); }
    if k.starts_with("pplx-") { return "Perplexity".to_string(); }
    if k.starts_with("r8_") { return "Replicate".to_string(); }
    if k.starts_with("sk-or-") { return "OpenRouter".to_string(); }
    if k.starts_with("fw_") || k.starts_with("fw-") { return "Fireworks AI".to_string(); }
    if k.starts_with("csk-") { return "Cerebras".to_string(); }
    if k.starts_with("snova-") { return "SambaNova".to_string(); }
    if k.starts_with("nvapi-") { return "Nvidia NIM".to_string(); }
    if k.starts_with("sk-novita-") { return "Novita AI".to_string(); }
    if k.starts_with("fal-") { return "Fal AI".to_string(); }
    if k.starts_with("sk-eleven-") { return "ElevenLabs".to_string(); }
    if k.starts_with("sk-or-") { return "OpenRouter".to_string(); }
    if k.starts_with("dsk-") { return "DeepInfra".to_string(); }
    if k.starts_with("ms-") { return "Mistral AI".to_string(); }
    if k.starts_with("sk-") && k.contains("siliconflow") { return "SiliconFlow".to_string(); }
    
    // Generic sk- (OpenAI/DeepSeek/SiliconFlow/Anyscale share this prefix)
    if k.starts_with("sk-") { return "OpenAI".to_string(); }
    "Unknown".to_string()
}

// --- Commands ---

#[command]
async fn parse_file(path: String, window: WebviewWindow) -> Result<FileData, AppError> {
    verify_origin(&window)?;
    
    if path.ends_with(".csv") {
        let mut reader = csv::ReaderBuilder::new()
            .flexible(true)
            .from_path(&path)
            .map_err(|e| AppError::File(e.to_string()))?;
        
        let headers: Vec<String> = reader.headers()
            .map_err(|e| AppError::File(e.to_string()))?
            .iter().map(|s| s.to_string()).collect();

        let mut count = 0;
        for _ in reader.records() { count += 1; }

        Ok(FileData { 
            headers, 
            rows: Vec::<Vec<String>>::new(), 
            row_count: count, 
            path: path.clone() 
        })
    } else if path.ends_with(".xlsx") {
        let manual_res = parse_xlsx_manual(&path);
        match manual_res {
            Ok(data) if data.row_count > 0 => {
                let mut data = data;
                data.path = path.clone();
                Ok(data)
            },
            _ => {
                if let Err(e) = &manual_res { eprintln!("[PARSE_FILE] XLSX manual failed: {}", e); }
                let mut workbook = calamine::open_workbook_auto(&path).map_err(|e| AppError::File(e.to_string()))?;
                let sheets = workbook.sheet_names().to_owned();
                let sheet_name = sheets.first().ok_or_else(|| AppError::File("No sheet".into()))?.clone();
                let range = workbook.worksheet_range(&sheet_name).map_err(|e| AppError::File(e.to_string()))?;
                let headers: Vec<String> = range.rows().next().unwrap_or(&[]).iter().map(|c| c.to_string()).collect();
                let row_count = range.height().saturating_sub(1);
                Ok(FileData { headers, rows: Vec::<Vec<String>>::new(), row_count, path })
            }
        }
    } else if path.ends_with(".xls") {
        let mut workbook = calamine::open_workbook_auto(&path).map_err(|e| AppError::File(e.to_string()))?;
        let sheets = workbook.sheet_names().to_owned();
        let sheet_name = sheets.first().ok_or_else(|| AppError::File("No sheet".into()))?.clone();
        let range = workbook.worksheet_range(&sheet_name).map_err(|e| AppError::File(e.to_string()))?;
        let headers: Vec<String> = range.rows().next().unwrap_or(&[]).iter().map(|c| c.to_string()).collect();
        let row_count = range.height().saturating_sub(1);
        Ok(FileData { headers, rows: Vec::<Vec<String>>::new(), row_count, path })
    } else {
        Err(AppError::File("Format not supported".into()))
    }
}

fn parse_xlsx_manual(path: &str) -> Result<FileData, String> {
    use std::fs::File;
    use std::io::BufReader;
    use zip::ZipArchive;
    use quick_xml::reader::Reader as XmlReader;
    use quick_xml::events::Event;

    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut shared_strings = Vec::new();
    if let Ok(ss_file) = archive.by_name("xl/sharedStrings.xml") {
        let mut reader = XmlReader::from_reader(BufReader::new(ss_file));
        let mut buf = Vec::new();
        let mut in_text = false;
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) if e.name().as_ref() == b"t" => in_text = true,
                Ok(Event::End(ref e)) if e.name().as_ref() == b"t" => in_text = false,
                Ok(Event::Text(ref e)) if in_text => {
                    shared_strings.push(String::from_utf8_lossy(e.as_ref()).to_string());
                }
                Ok(Event::Eof) => break,
                _ => (),
            }
            buf.clear();
        }
    }

    let sheet_name = if archive.by_name("xl/worksheets/sheet1.xml").is_ok() {
        "xl/worksheets/sheet1.xml".to_string()
    } else {
        archive.file_names()
            .find(|name| name.starts_with("xl/worksheets/sheet") && name.ends_with(".xml"))
            .map(|s| s.to_string())
            .ok_or("No worksheet XML")?
    };

    let sheet_file = archive.by_name(&sheet_name).map_err(|e| e.to_string())?;
    let mut reader = XmlReader::from_reader(BufReader::new(sheet_file));
    let mut buf = Vec::new();
    
    let mut row_count: usize = 0;
    let mut first_row_data = Vec::<String>::new();
    let mut current_cell_val = String::new();
    let mut is_shared = false;
    let mut in_v = false;
    let mut col_ptr = 0;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"row" => {
                row_count += 1;
                col_ptr = 0;
            }
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"c" && row_count == 1 => {
                is_shared = false;
                for a in e.attributes().flatten() {
                    if a.key.as_ref() == b"t" && a.value.as_ref() == b"s" { is_shared = true; }
                    if a.key.as_ref() == b"r" {
                        col_ptr = excel_ref_to_col(&String::from_utf8_lossy(a.value.as_ref()));
                    }
                }
            }
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"v" && row_count == 1 => {
                in_v = true;
                current_cell_val.clear();
            }
            Ok(Event::Text(ref e)) if in_v && row_count == 1 => {
                current_cell_val = String::from_utf8_lossy(e.as_ref()).to_string();
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"v" && row_count == 1 => {
                in_v = false;
                let mut val = current_cell_val.clone();
                if is_shared {
                    if let Ok(idx) = val.parse::<usize>() {
                        val = shared_strings.get(idx).cloned().unwrap_or(val);
                    }
                }
                while first_row_data.len() < col_ptr { first_row_data.push(String::new()); }
                if first_row_data.len() == col_ptr { first_row_data.push(val); }
                else { first_row_data[col_ptr] = val; }
            }
            Ok(Event::Eof) => break,
            _ => (),
        }
        buf.clear();
    }

    Ok(FileData { 
        headers: first_row_data, 
        rows: Vec::<Vec<String>>::new(), 
        row_count: row_count.saturating_sub(1), 
        path: String::new() 
    })
}

fn excel_ref_to_col(reference: &str) -> usize {
    let mut col_str = String::new();
    for c in reference.chars() {
        if c.is_alphabetic() { col_str.push(c.to_ascii_uppercase()); }
        else { break; }
    }
    let mut result = 0;
    for c in col_str.chars() {
        result = result * 26 + (c as usize - 'A' as usize + 1);
    }
    result.saturating_sub(1)
}

#[command]
async fn start_validation(
    path: String,
    key_column_index: usize,
    provider: String, 
    options: ValidationOptions,
    state: State<'_, AppState>, 
    window: WebviewWindow
) -> Result<(), AppError> {
    verify_origin(&window)?;
    let keys = extract_keys_from_file(&path, key_column_index).map_err(|e| AppError::File(e))?;
    if keys.is_empty() { return Err(AppError::Generic("No keys found".into())); }
    let is_running = state.is_running.clone();
    is_running.store(true, Ordering::SeqCst);
    let sem = Arc::new(Semaphore::new(10));
    tokio::spawn(async move {
        let mut tasks = Vec::new();
        for key in keys {
            if !is_running.load(Ordering::SeqCst) { break; }
            let permit = sem.clone().acquire_owned().await.unwrap();
            let p_init = provider.clone();
            let opt = options.clone();
            let win = window.clone();
            let k = key.clone();
            tasks.push(tokio::spawn(async move {
                let _permit = permit;
                let mut client_builder = reqwest::Client::builder();
                if let Some(proxy_url) = &opt.proxy {
                    if let Ok(proxy) = reqwest::Proxy::all(proxy_url) { client_builder = client_builder.proxy(proxy); }
                }
                let client = client_builder.build().unwrap_or_else(|_| reqwest::Client::new());
                let actual_provider = if opt.auto_detect { detect_provider(&k) } else { p_init };
                let res = validate_single_key(&client, &k, &actual_provider, &opt).await;
                let _ = win.emit("test-result", res);
            }));
            if tasks.len() >= 50 { join_all(tasks.drain(..)).await; }
        }
        join_all(tasks).await;
        is_running.store(false, Ordering::SeqCst);
        let _ = window.emit("test-finished", ());
    });
    Ok(())
}

fn extract_keys_from_file(path: &str, col_idx: usize) -> Result<Vec<String>, String> {
    let mut keys = Vec::new();
    if path.ends_with(".csv") {
        let mut reader = csv::ReaderBuilder::new().flexible(true).from_path(path).map_err(|e| e.to_string())?;
        for result in reader.records() {
            if let Ok(record) = result {
                if let Some(val) = record.get(col_idx) {
                    let k = val.trim();
                    if !k.is_empty() { keys.push(k.to_string()); }
                }
            }
        }
    } else if path.ends_with(".xlsx") {
        use std::fs::File;
        use std::io::BufReader;
        use zip::ZipArchive;
        use quick_xml::reader::Reader as XmlReader;
        use quick_xml::events::Event;
        let file = File::open(path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        let mut shared_strings = Vec::new();
        if let Ok(ss_file) = archive.by_name("xl/sharedStrings.xml") {
            let mut reader = XmlReader::from_reader(BufReader::new(ss_file));
            let mut buf = Vec::new();
            let mut in_text = false;
            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(Event::Start(ref e)) if e.name().as_ref() == b"t" => in_text = true,
                    Ok(Event::End(ref e)) if e.name().as_ref() == b"t" => in_text = false,
                    Ok(Event::Text(ref e)) if in_text => { shared_strings.push(String::from_utf8_lossy(e.as_ref()).to_string()); }
                    Ok(Event::Eof) => break,
                    _ => (),
                }
                buf.clear();
            }
        }
        let sheet_name = if archive.by_name("xl/worksheets/sheet1.xml").is_ok() { "xl/worksheets/sheet1.xml".to_string() }
        else { archive.file_names().find(|n| n.starts_with("xl/worksheets/sheet") && n.ends_with(".xml")).map(|s| s.to_string()).ok_or("No sheet XML")? };
        let sheet_file = archive.by_name(&sheet_name).map_err(|e| e.to_string())?;
        let mut reader = XmlReader::from_reader(BufReader::new(sheet_file));
        let mut buf = Vec::new();
        let mut row_count = 0;
        let mut col_ptr = 0;
        let mut in_v = false;
        let mut is_shared = false;
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) if e.name().as_ref() == b"row" => { row_count += 1; col_ptr = 0; }
                Ok(Event::Start(ref e)) if e.name().as_ref() == b"c" => {
                    is_shared = false;
                    for a in e.attributes().flatten() {
                        if a.key.as_ref() == b"t" && a.value.as_ref() == b"s" { is_shared = true; }
                        if a.key.as_ref() == b"r" { col_ptr = excel_ref_to_col(&String::from_utf8_lossy(a.value.as_ref())); }
                    }
                }
                Ok(Event::Start(ref e)) if e.name().as_ref() == b"v" => in_v = true,
                Ok(Event::End(ref e)) if e.name().as_ref() == b"v" => in_v = false,
                Ok(Event::Text(ref e)) if in_v && row_count > 1 => {
                    if col_ptr == col_idx {
                        let mut val = String::from_utf8_lossy(e.as_ref()).to_string();
                        if is_shared { if let Ok(idx) = val.parse::<usize>() { val = shared_strings.get(idx).cloned().unwrap_or(val); } }
                        let k = val.trim();
                        if !k.is_empty() { keys.push(k.to_string()); }
                    }
                }
                Ok(Event::Eof) => break,
                _ => (),
            }
            buf.clear();
        }
    } else if path.ends_with(".xls") {
        let mut workbook = calamine::open_workbook_auto(path).map_err(|e| e.to_string())?;
        let sheets = workbook.sheet_names().to_owned();
        let sheet_name = sheets.first().ok_or("No sheet")?.clone();
        let range = workbook.worksheet_range(&sheet_name).map_err(|e| e.to_string())?;
        for (i, row) in range.rows().enumerate() {
            if i == 0 { continue; }
            if let Some(val) = row.get(col_idx) {
                let k = val.to_string().trim().to_string();
                if !k.is_empty() { keys.push(k); }
            }
        }
    }
    Ok(keys)
}

#[command]
fn stop_validation(state: State<'_, AppState>) {
    state.is_running.store(false, Ordering::SeqCst);
}

// --- Provider Logic ---

async fn validate_single_key(client: &reqwest::Client, key: &str, provider: &str, options: &ValidationOptions) -> TestResult {
    let mut result = match provider {
        "Anthropic" => check_anthropic(client, key, options.check_models).await,
        "Google Gemini" => check_google_gemini(client, key, options.check_models).await,
        "Cohere" => check_cohere(client, key, options.check_models).await,
        "Hugging Face" => check_hugging_face(client, key, options.check_models).await,
        "Replicate" => check_replicate(client, key, options.check_models).await,
        "Unknown" => TestResult { 
            key: key.to_string(), 
            provider: "Unknown".to_string(), 
            status: "Invalid".into(), 
            message: "Format not recognized".into(), 
            quota: None, models: None, details: None 
        },
        _ => check_openai_compatible(client, get_provider_url(provider), key, provider, options.check_models).await,
    };

    if result.status == "Valid" && options.check_quota {
        if provider == "OpenAI" {
            if let Some(q) = get_openai_quota(client, key).await {
                result.quota = Some(q);
            }
        }
    }

    result
}

async fn check_openai_compatible(client: &reqwest::Client, url: &str, key: &str, provider: &str, fetch_models: bool) -> TestResult {
    let res = client.get(url).header(AUTHORIZATION, format!("Bearer {}", key)).send().await;
    match res {
        Ok(r) => {
            if r.status().is_success() {
                let mut models = None;
                if fetch_models {
                    if let Ok(json) = r.json::<serde_json::Value>().await {
                        models = parse_models_json(&json);
                    }
                }
                TestResult { key: key.to_string(), provider: provider.to_string(), status: "Valid".into(), message: "Active".into(), quota: None, models, details: None }
            } else {
                let msg = format!("HTTP {}", r.status());
                TestResult { key: key.to_string(), provider: provider.to_string(), status: "Invalid".into(), message: msg, quota: None, models: None, details: None }
            }
        }
        Err(e) => TestResult { key: key.to_string(), provider: provider.to_string(), status: "Error".into(), message: e.to_string(), quota: None, models: None, details: None },
    }
}

async fn check_google_gemini(client: &reqwest::Client, key: &str, fetch_models: bool) -> TestResult {
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={}", key);
    let res = client.get(url).send().await;
    match res {
        Ok(r) => {
            if r.status().is_success() {
                let mut models = None;
                if fetch_models {
                    if let Ok(json) = r.json::<serde_json::Value>().await {
                        // Gemini response structure is unique - return ALL models
                        if let Some(m_list) = json.get("models").and_then(|l| l.as_array()) {
                            let mut m_ids: Vec<String> = m_list.iter()
                                .filter_map(|m| m.get("name").and_then(|n| n.as_str()))
                                .map(|s| s.replace("models/", ""))
                                .collect();
                            // Sort: flagship first
                            m_ids.sort_by(|a, b| {
                                let a_flag = a.contains("pro") || a.contains("ultra") || a.contains("thinking");
                                let b_flag = b.contains("pro") || b.contains("ultra") || b.contains("thinking");
                                b_flag.cmp(&a_flag)
                            });
                            models = Some(m_ids);
                        }
                    }
                }
                TestResult { key: key.to_string(), provider: "Google Gemini".into(), status: "Valid".into(), message: "Active".into(), quota: None, models, details: None }
            } else {
                TestResult { key: key.to_string(), provider: "Google Gemini".into(), status: "Invalid".into(), message: format!("HTTP {}", r.status()), quota: None, models: None, details: None }
            }
        }
        Err(e) => TestResult { key: key.to_string(), provider: "Google Gemini".into(), status: "Error".into(), message: e.to_string(), quota: None, models: None, details: None },
    }
}

async fn check_anthropic(client: &reqwest::Client, key: &str, fetch_models: bool) -> TestResult {
    let res = client.get("https://api.anthropic.com/v1/models")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .send().await;
    match res {
        Ok(r) => {
            if r.status().is_success() {
                let mut models = None;
                if fetch_models {
                    if let Ok(json) = r.json::<serde_json::Value>().await {
                        models = parse_models_json(&json);
                    }
                }
                TestResult { key: key.to_string(), provider: "Anthropic".into(), status: "Valid".into(), message: "Active".into(), quota: None, models, details: None }
            } else {
                TestResult { key: key.to_string(), provider: "Anthropic".into(), status: "Invalid".into(), message: "Unauthorized".into(), quota: None, models: None, details: None }
            }
        }
        Err(_) => TestResult { key: key.to_string(), provider: "Anthropic".into(), status: "Error".into(), message: "Network Error".into(), quota: None, models: None, details: None },
    }
}

async fn check_cohere(client: &reqwest::Client, key: &str, fetch_models: bool) -> TestResult {
    let res = client.get("https://api.cohere.com/v1/models")
        .header(AUTHORIZATION, format!("Bearer {}", key))
        .send().await;
    match res {
        Ok(r) => {
            if r.status().is_success() {
                let mut models = None;
                if fetch_models {
                    if let Ok(json) = r.json::<serde_json::Value>().await {
                        if let Some(data) = json.get("models").and_then(|d| d.as_array()) {
                            let mut m_ids: Vec<String> = data.iter()
                                .filter_map(|m| m.get("name").and_then(|n| n.as_str()))
                                .map(|s| s.to_string())
                                .collect();
                            m_ids.sort_by(|a, b| {
                                let a_flag = a.contains("command") || a.contains("embed");
                                let b_flag = b.contains("command") || b.contains("embed");
                                b_flag.cmp(&a_flag).then(a.cmp(b))
                            });
                            models = Some(m_ids);
                        }
                    }
                }
                TestResult { key: key.to_string(), provider: "Cohere".into(), status: "Valid".into(), message: "Active".into(), quota: None, models, details: None }
            } else {
                TestResult { key: key.to_string(), provider: "Cohere".into(), status: "Invalid".into(), message: format!("HTTP {}", r.status()), quota: None, models: None, details: None }
            }
        }
        Err(e) => TestResult { key: key.to_string(), provider: "Cohere".into(), status: "Error".into(), message: e.to_string(), quota: None, models: None, details: None },
    }
}

async fn check_hugging_face(client: &reqwest::Client, key: &str, fetch_models: bool) -> TestResult {
    let res = client.get("https://huggingface.co/api/whoami-v2")
        .header(AUTHORIZATION, format!("Bearer {}", key))
        .send().await;
    match res {
        Ok(r) => {
            if r.status().is_success() {
                let mut models = None;
                if fetch_models {
                    if let Ok(resp) = client.get("https://huggingface.co/api/models?inference=warm&pipeline_tag=text-generation&sort=likes&limit=50")
                        .header(AUTHORIZATION, format!("Bearer {}", key))
                        .send().await {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if let Some(data) = json.as_array() {
                                let m_ids: Vec<String> = data.iter()
                                    .filter_map(|m| m.get("id").and_then(|n| n.as_str()))
                                    .map(|s| s.to_string())
                                    .collect();
                                models = Some(m_ids);
                            }
                        }
                    }
                }
                TestResult { key: key.to_string(), provider: "Hugging Face".into(), status: "Valid".into(), message: "Active".into(), quota: None, models, details: None }
            } else {
                TestResult { key: key.to_string(), provider: "Hugging Face".into(), status: "Invalid".into(), message: format!("HTTP {}", r.status()), quota: None, models: None, details: None }
            }
        }
        Err(e) => TestResult { key: key.to_string(), provider: "Hugging Face".into(), status: "Error".into(), message: e.to_string(), quota: None, models: None, details: None },
    }
}

async fn check_replicate(client: &reqwest::Client, key: &str, fetch_models: bool) -> TestResult {
    let res = client.get("https://api.replicate.com/v1/predictions?limit=1")
        .header(AUTHORIZATION, format!("Token {}", key))
        .send().await;
    match res {
        Ok(r) => {
            if r.status().is_success() {
                let models = if fetch_models { Some(vec!["replicate/models (use web dashboard)".to_string()]) } else { None };
                TestResult { key: key.to_string(), provider: "Replicate".into(), status: "Valid".into(), message: "Active".into(), quota: None, models, details: None }
            } else {
                TestResult { key: key.to_string(), provider: "Replicate".into(), status: "Invalid".into(), message: format!("HTTP {}", r.status()), quota: None, models: None, details: None }
            }
        }
        Err(e) => TestResult { key: key.to_string(), provider: "Replicate".into(), status: "Error".into(), message: e.to_string(), quota: None, models: None, details: None },
    }
}

async fn get_openai_quota(client: &reqwest::Client, key: &str) -> Option<String> {
    let res = client.get("https://api.openai.com/dashboard/billing/subscription")
        .header(AUTHORIZATION, format!("Bearer {}", key))
        .send().await;
    
    if let Ok(r) = res {
        if r.status().is_success() {
            return Some("Subscription Active".into());
        }
    }
    None
}

fn parse_models_json(json: &serde_json::Value) -> Option<Vec<String>> {
    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
        let mut model_ids: Vec<String> = data.iter()
            .filter_map(|m| m.get("id").and_then(|id| id.as_str()))
            .map(|s| s.to_string())
            .collect();
        
        // Sort: flagship/pro/audio/vision/specialty models first, then alphabetical
        model_ids.sort_by(|a, b| {
            let flag = |s: &str| s.contains("gpt-") || s.contains("claude") || s.contains("gemini")
                || s.contains("o1") || s.contains("o3") || s.contains("pro") || s.contains("ultra")
                || s.contains("opus") || s.contains("sonnet") || s.contains("haiku")
                || s.contains("flash") || s.contains("lite") || s.contains("qwen") || s.contains("glm")
                || s.contains("llama") || s.contains("mistral") || s.contains("embed") || s.contains("tts")
                || s.contains("audio") || s.contains("vision") || s.contains("large") || s.contains("deepseek") || s.contains("sora");
            flag(b).cmp(&flag(a)).then(a.cmp(b))
        });

        // Return ALL models - no limit
        return Some(model_ids);
    }
    None
}

fn get_provider_url(provider: &str) -> &'static str {
    match provider {
        "DeepSeek" => "https://api.deepseek.com/models",
        "Groq" => "https://api.groq.com/openai/v1/models",
        "302.AI" => "https://api.302.ai/v1/models",
        "Together AI" => "https://api.together.xyz/v1/models",
        "xAI" => "https://api.x.ai/v1/models",
        "Mistral AI" => "https://api.mistral.ai/v1/models",
        "Fireworks AI" => "https://api.fireworks.ai/inference/v1/models",
        "Perplexity" => "https://api.perplexity.ai/models",
        "Cerebras" => "https://api.cerebras.ai/v1/models",
        "OpenRouter" => "https://openrouter.ai/api/v1/models",
        "SambaNova" => "https://api.sambanova.ai/v1/models",
        "AI21" => "https://api.ai21.com/studio/v1/models",
        "DeepInfra" => "https://api.deepinfra.com/v1/openai/models",
        "Nvidia NIM" => "https://integrate.api.nvidia.com/v1/models",
        "Moonshot" => "https://api.moonshot.cn/v1/models",
        "Zhipu AI" => "https://open.bigmodel.cn/api/paas/v4/models",
        "DashScope" => "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
        "Cloudflare AI" => "https://api.cloudflare.com/client/v4/accounts/models",
        "SiliconFlow" => "https://api.siliconflow.cn/v1/models",
        "Novita AI" => "https://api.novita.ai/v3/openai/models",
        "OctoAI" => "https://text.octoai.run/v1/models",
        "Anyscale" => "https://api.endpoints.anyscale.com/v1/models",
        "01.AI" => "https://api.01.ai/v1/models",
        "Baichuan AI" => "https://api.baichuan-ai.com/v1/models",
        "MiniMax" => "https://api.minimax.chat/v1/models",
        "StepFun" => "https://api.stepfun.com/v1/models",
        "Fal AI" => "https://api.fal.ai/v1/models",
        "Stability AI" => "https://api.stability.ai/v1/engines/list",
        "Runway" => "https://api.runwayml.com/v1/models",
        "Luma AI" => "https://api.lumalabs.ai/dream-machine/v1/models",
        "ElevenLabs" => "https://api.elevenlabs.io/v1/models",
        "Ideogram" => "https://api.ideogram.ai/models",
        "BFL" => "https://api.bfl.ml/v1/models",
        "Kling AI" => "https://api.klingai.com/v1/models",
        "Haiper AI" => "https://api.haiper.ai/v1/models",
        "Midjourney API" => "https://api.midjourneyapi.xyz/v1/models",
        _ => "https://api.openai.com/v1/models",
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState { is_running: Arc::new(AtomicBool::new(false)) })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![parse_file, start_validation, stop_validation])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
