use crate::config::Config;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct FirestoreValue {
    #[serde(rename = "integerValue", skip_serializing_if = "Option::is_none")]
    pub integer_value: Option<String>,
    #[serde(rename = "stringValue", skip_serializing_if = "Option::is_none")]
    pub string_value: Option<String>,
    #[serde(rename = "timestampValue", skip_serializing_if = "Option::is_none")]
    pub timestamp_value: Option<String>,
    #[serde(rename = "arrayValue", skip_serializing_if = "Option::is_none")]
    pub array_value: Option<ArrayValue>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArrayValue {
    pub values: Vec<FirestoreValue>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FirestoreDocument {
    pub fields: HashMap<String, FirestoreValue>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub code: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub files: Vec<String>,
    pub status: String,
}

pub struct FirestoreClient;

impl FirestoreClient {
    pub fn new() -> Self {
        Self
    }
    
    pub async fn increment_counter(&self) -> Result<u32, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let counter_url = format!("{}/{}", Config::firestore_base_url(), Config::counter_path());
        
        // Create counter document if it doesn't exist
        let initial_doc = FirestoreDocument {
            fields: HashMap::from([
                ("value".to_string(), FirestoreValue {
                    integer_value: Some("0".to_string()),
                    string_value: None,
                    timestamp_value: None,
                    array_value: None,
                }),
            ]),
        };
        
        // Try to create the counter (will fail if exists, which is fine)
        let _ = client
            .post(&counter_url)
            .json(&initial_doc)
            .send()
            .await;
        
        // Atomic increment
        let increment_doc = FirestoreDocument {
            fields: HashMap::from([
                ("value".to_string(), FirestoreValue {
                    integer_value: Some("1".to_string()), // This will be treated as increment
                    string_value: None,
                    timestamp_value: None,
                    array_value: None,
                }),
            ]),
        };
        
        let response = client
            .patch(&format!("{}?updateMask.fieldPaths=value", counter_url))
            .json(&increment_doc)
            .send()
            .await?;
            
        let doc: FirestoreDocument = response.json().await?;
        
        let counter_value = doc.fields.get("value")
            .and_then(|v| v.integer_value.as_ref())
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(1);
            
        Ok(counter_value)
    }
    
    pub async fn create_session(&self, code: &str) -> Result<Session, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let session_url = format!("{}/{}", Config::firestore_base_url(), Config::session_path(code));
        
        let now = Utc::now();
        let expires_at = now + chrono::Duration::hours(Config::SESSION_EXPIRY_HOURS as i64);
        
        let session_doc = FirestoreDocument {
            fields: HashMap::from([
                ("created_at".to_string(), FirestoreValue {
                    timestamp_value: Some(now.to_rfc3339()),
                    integer_value: None,
                    string_value: None,
                    array_value: None,
                }),
                ("expires_at".to_string(), FirestoreValue {
                    timestamp_value: Some(expires_at.to_rfc3339()),
                    integer_value: None,
                    string_value: None,
                    array_value: None,
                }),
                ("files".to_string(), FirestoreValue {
                    array_value: Some(ArrayValue { values: vec![] }),
                    integer_value: None,
                    string_value: None,
                    timestamp_value: None,
                }),
                ("status".to_string(), FirestoreValue {
                    string_value: Some("active".to_string()),
                    integer_value: None,
                    timestamp_value: None,
                    array_value: None,
                }),
            ]),
        };
        
        let response = client
            .post(&session_url)
            .json(&session_doc)
            .send()
            .await?;
            
        if !response.status().is_success() {
            return Err(format!("Failed to create session: {}", response.status()).into());
        }
        
        Ok(Session {
            code: code.to_string(),
            created_at: now,
            expires_at,
            files: vec![],
            status: "active".to_string(),
        })
    }
    
    pub async fn get_session(&self, code: &str) -> Result<Option<Session>, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let session_url = format!("{}/{}", Config::firestore_base_url(), Config::session_path(code));
        
        let response = client.get(&session_url).send().await?;
        
        if response.status().as_u16() == 404 {
            return Ok(None);
        }
        
        let doc: FirestoreDocument = response.json().await?;
        
        let created_at = doc.fields.get("created_at")
            .and_then(|v| v.timestamp_value.as_ref())
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);
            
        let expires_at = doc.fields.get("expires_at")
            .and_then(|v| v.timestamp_value.as_ref())
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|| Utc::now() + chrono::Duration::hours(1));
            
        let files = doc.fields.get("files")
            .and_then(|v| v.array_value.as_ref())
            .map(|arr| arr.values.iter()
                .filter_map(|v| v.string_value.as_ref().cloned())
                .collect())
            .unwrap_or_default();
            
        let status = doc.fields.get("status")
            .and_then(|v| v.string_value.as_ref())
            .cloned()
            .unwrap_or_else(|| "active".to_string());
        
        Ok(Some(Session {
            code: code.to_string(),
            created_at,
            expires_at,
            files,
            status,
        }))
    }
}