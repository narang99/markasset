use crate::session::{SessionManager, SessionStatus};
use crate::download::FileDownloader;
use std::path::PathBuf;
use std::time::Duration;
use tokio::time;

pub struct MarkAssetCommands {
    session_manager: SessionManager,
    downloader: FileDownloader,
}

impl MarkAssetCommands {
    pub fn new() -> Self {
        Self {
            session_manager: SessionManager::new(),
            downloader: FileDownloader::new(),
        }
    }
    
    /// Generate a new session code and start polling for files
    pub async fn start_session(&self, workspace_dir: PathBuf) -> Result<String, String> {
        // Generate session code
        let code = match self.session_manager.generate_code().await {
            Ok(code) => code,
            Err(e) => return Err(e.to_string()),
        };
        
        println!("Generated session code: {}", code);
        println!("Upload your files using the mobile app with this code.");
        
        // Start polling for files in background
        let code_clone = code.clone();
        let workspace_clone = workspace_dir.clone();
        let session_manager = SessionManager::new();
        let downloader = FileDownloader::new();
        
        tokio::spawn(async move {
            if let Err(e) = Self::poll_for_files(session_manager, downloader, &code_clone, workspace_clone).await {
                eprintln!("Polling error: {}", e);
            }
        });
        
        Ok(code)
    }
    
    /// Poll for files in a session and download them when available
    async fn poll_for_files(
        session_manager: SessionManager,
        downloader: FileDownloader,
        code: &str,
        workspace_dir: PathBuf
    ) -> Result<(), String> {
        let mut interval = time::interval(Duration::from_secs(3)); // Poll every 3 seconds
        let mut consecutive_errors = 0;
        const MAX_ERRORS: u32 = 10;
        const MAX_DURATION: Duration = Duration::from_secs(3600); // 1 hour max
        
        let start_time = std::time::Instant::now();
        
        loop {
            interval.tick().await;
            
            // Check if we've been polling too long
            if start_time.elapsed() > MAX_DURATION {
                println!("Session {} expired (1 hour limit)", code);
                break;
            }
            
            match session_manager.check_session_status(code).await {
                Ok(SessionStatus::HasFiles(filenames)) => {
                    println!("Files found for session {}: {:?}", code, filenames);
                    
                    // Download files
                    match downloader.download_session_files(code, &filenames, &workspace_dir).await {
                        Ok(downloaded_files) => {
                            println!("Successfully downloaded {} files:", downloaded_files.len());
                            for file_path in downloaded_files {
                                println!("  {}", file_path);
                            }
                            break; // Success - stop polling
                        },
                        Err(e) => {
                            eprintln!("Download failed: {}", e);
                            consecutive_errors += 1;
                        }
                    }
                },
                Ok(SessionStatus::WaitingForFiles) => {
                    // Continue polling
                    consecutive_errors = 0;
                },
                Ok(SessionStatus::Expired) => {
                    println!("Session {} has expired", code);
                    break;
                },
                Ok(SessionStatus::NotFound) => {
                    println!("Session {} not found", code);
                    break;
                },
                Err(e) => {
                    eprintln!("Error checking session {}: {}", code, e.to_string());
                    consecutive_errors += 1;
                }
            }
            
            // Stop if too many consecutive errors
            if consecutive_errors >= MAX_ERRORS {
                eprintln!("Too many errors, stopping polling for session {}", code);
                break;
            }
        }
        
        Ok(())
    }
    
    /// Manually check status of a session
    pub async fn check_session(&self, code: &str) -> Result<SessionStatus, String> {
        self.session_manager.check_session_status(code).await.map_err(|e| e.to_string())
    }
    
    /// Manually download files for a session
    pub async fn download_files(&self, code: &str, workspace_dir: PathBuf) -> Result<Vec<String>, String> {
        match self.session_manager.check_session_status(code).await.map_err(|e| e.to_string())? {
            SessionStatus::HasFiles(filenames) => {
                self.downloader.download_session_files(code, &filenames, &workspace_dir).await.map_err(|e| e.to_string())
            },
            SessionStatus::WaitingForFiles => {
                Err("No files available for this session yet".to_string())
            },
            SessionStatus::Expired => {
                Err("Session has expired".to_string())
            },
            SessionStatus::NotFound => {
                Err("Session not found".to_string())
            },
        }
    }
}