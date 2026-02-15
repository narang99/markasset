// Configuration for MarkAsset Extension
// Update these values to match your Firebase project

pub struct Config;

impl Config {
    // Firebase Project Configuration
    pub const PROJECT_ID: &'static str = "markasset-project";
    pub const API_KEY: &'static str = "AIzaSyAk0nWceP8APJ1O25hG3iEMYnIfH5sFKMI";

    // User Configuration (for no-auth phase)
    pub const USER_ID: &'static str = "anonymous";

    // Session Configuration
    pub const SESSION_EXPIRY_HOURS: u64 = 1;
    pub const CODE_LENGTH: usize = 3;
    pub const MAX_CODE_VALUE: u32 = 999;

    // Firestore URLs
    pub fn firestore_base_url() -> String {
        format!("https://firestore.googleapis.com/v1/projects/{}/databases/(default)/documents", Self::PROJECT_ID)
    }

    pub fn counter_path() -> String {
        format!("users/{}/meta/session_counter", Self::USER_ID)
    }

    pub fn session_path(code: &str) -> String {
        format!("users/{}/sessions/{}", Self::USER_ID, code)
    }

    pub fn files_path(file_id: &str) -> String {
        format!("users/{}/files/{}", Self::USER_ID, file_id)
    }

    // Storage URLs
    pub fn storage_base_url() -> String {
        format!("https://firebasestorage.googleapis.com/v0/b/{}.appspot.com/o", Self::PROJECT_ID)
    }

    pub fn storage_path(code: &str, filename: &str) -> String {
        format!("uploads%2F{}%2F{}%2F{}", Self::USER_ID, code, filename)
    }
}
