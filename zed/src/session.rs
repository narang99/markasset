use crate::config::Config;
use crate::firestore::{FirestoreClient, Session};
use chrono::Utc;

pub struct SessionManager {
    firestore: FirestoreClient,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            firestore: FirestoreClient::new(),
        }
    }
    
    pub async fn generate_code(&self) -> Result<String, String> {
        // Step 1: Increment counter atomically
        let counter_value = self.firestore.increment_counter().await.map_err(|e| e.to_string())?;
        
        // Step 2: Generate 3-digit code with wrap-around
        let code_num = counter_value % (Config::MAX_CODE_VALUE + 1);
        let code = format!("{:0width$}", code_num, width = Config::CODE_LENGTH);
        
        // Step 3: Try to create session
        match self.firestore.create_session(&code).await {
            Ok(_session) => Ok(code),
            Err(e) => {
                // If session exists (collision), return error
                let error_msg = e.to_string();
                if error_msg.contains("409") || error_msg.contains("already exists") {
                    Err(format!("Session {} already exists. Please try again.", code))
                } else {
                    Err(error_msg)
                }
            }
        }
    }
    
    pub async fn check_session_status(&self, code: &str) -> Result<SessionStatus, String> {
        match self.firestore.get_session(code).await.map_err(|e| e.to_string())? {
            Some(session) => {
                // Check if expired
                if session.expires_at < Utc::now() {
                    Ok(SessionStatus::Expired)
                } else if session.files.is_empty() {
                    Ok(SessionStatus::WaitingForFiles)
                } else {
                    Ok(SessionStatus::HasFiles(session.files))
                }
            },
            None => Ok(SessionStatus::NotFound),
        }
    }
    
    pub async fn get_session(&self, code: &str) -> Result<Option<Session>, String> {
        self.firestore.get_session(code).await.map_err(|e| e.to_string())
    }
}

#[derive(Debug, Clone)]
pub enum SessionStatus {
    NotFound,
    Expired,
    WaitingForFiles,
    HasFiles(Vec<String>),
}