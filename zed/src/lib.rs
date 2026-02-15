use zed_extension_api::{
    self as zed, Result, SlashCommand, SlashCommandOutput, SlashCommandOutputSection, Worktree,
    http_client::{HttpRequest, HttpMethod, make_http_request}
};
use std::sync::atomic::{AtomicU32, Ordering};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

mod config;

// Simplified Firebase client for WASM
struct FirebaseClient;

#[derive(Debug, Serialize, Deserialize)]
struct FirestoreValue {
    #[serde(rename = "integerValue", skip_serializing_if = "Option::is_none")]
    pub integer_value: Option<String>,
    #[serde(rename = "stringValue", skip_serializing_if = "Option::is_none")]
    pub string_value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FirestoreDocument {
    pub fields: HashMap<String, FirestoreValue>,
}

struct MarkAssetExtension {
    counter: AtomicU32,
}

impl MarkAssetExtension {
    fn generate_firebase_code(&self) -> Result<String, String> {
        use config::Config;
        
        // Step 1: Increment counter atomically in Firestore
        let counter_url = format!("{}/{}", Config::firestore_base_url(), Config::counter_path());
        
        // Try to create counter first (will fail if exists, that's OK)
        let initial_doc = FirestoreDocument {
            fields: HashMap::from([
                ("value".to_string(), FirestoreValue {
                    integer_value: Some("0".to_string()),
                    string_value: None,
                }),
            ]),
        };
        
        let initial_body = serde_json::to_string(&initial_doc)
            .map_err(|e| format!("Failed to serialize initial doc: {}", e))?;
            
        let _ = make_http_request(HttpRequest {
            url: counter_url.clone(),
            method: HttpMethod::Post,
            headers: HashMap::from([
                ("Content-Type".to_string(), "application/json".to_string()),
            ]),
            body: Some(initial_body),
        });
        
        // Now increment
        let increment_doc = FirestoreDocument {
            fields: HashMap::from([
                ("value".to_string(), FirestoreValue {
                    integer_value: Some("1".to_string()),
                    string_value: None,
                }),
            ]),
        };
        
        let increment_body = serde_json::to_string(&increment_doc)
            .map_err(|e| format!("Failed to serialize increment doc: {}", e))?;
        
        let response = make_http_request(HttpRequest {
            url: format!("{}?updateMask.fieldPaths=value", counter_url),
            method: HttpMethod::Patch,
            headers: HashMap::from([
                ("Content-Type".to_string(), "application/json".to_string()),
            ]),
            body: Some(increment_body),
        }).map_err(|e| format!("Failed to increment counter: {}", e))?;
        
        let doc: FirestoreDocument = serde_json::from_str(&response.body)
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        
        let counter_value = doc.fields.get("value")
            .and_then(|v| v.integer_value.as_ref())
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(1);
            
        let code = format!("{:03}", counter_value % 1000);
        
        // Step 2: Create session in Firestore
        let session_url = format!("{}/{}", Config::firestore_base_url(), Config::session_path(&code));
        let now = chrono::Utc::now();
        let expires_at = now + chrono::Duration::hours(1);
        
        let session_doc = FirestoreDocument {
            fields: HashMap::from([
                ("created_at".to_string(), FirestoreValue {
                    string_value: Some(now.to_rfc3339()),
                    integer_value: None,
                }),
                ("expires_at".to_string(), FirestoreValue {
                    string_value: Some(expires_at.to_rfc3339()),
                    integer_value: None,
                }),
                ("status".to_string(), FirestoreValue {
                    string_value: Some("active".to_string()),
                    integer_value: None,
                }),
            ]),
        };
        
        let session_body = serde_json::to_string(&session_doc)
            .map_err(|e| format!("Failed to serialize session doc: {}", e))?;
        
        let session_response = make_http_request(HttpRequest {
            url: session_url,
            method: HttpMethod::Post,
            headers: HashMap::from([
                ("Content-Type".to_string(), "application/json".to_string()),
            ]),
            body: Some(session_body),
        }).map_err(|e| format!("Failed to create session: {}", e))?;
            
        if session_response.status == 200 || session_response.status == 201 {
            Ok(code)
        } else {
            Err(format!("Failed to create session: HTTP {}", session_response.status))
        }
    }
    
    fn check_firebase_session(&self, code: &str) -> Result<String, String> {
        use config::Config;
        
        let session_url = format!("{}/{}", Config::firestore_base_url(), Config::session_path(code));
        
        let response = make_http_request(HttpRequest {
            url: session_url,
            method: HttpMethod::Get,
            headers: HashMap::new(),
            body: None,
        }).map_err(|e| format!("Failed to check session: {}", e))?;
            
        if response.status == 404 {
            return Ok("Session not found".to_string());
        }
        
        let doc: FirestoreDocument = serde_json::from_str(&response.body)
            .map_err(|e| format!("Failed to parse response: {}", e))?;
            
        let default_status = "unknown".to_string();
        let status = doc.fields.get("status")
            .and_then(|v| v.string_value.as_ref())
            .unwrap_or(&default_status);
            
        Ok(format!("Session {} status: {}", code, status))
    }
}

impl zed::Extension for MarkAssetExtension {
    fn new() -> Self {
        Self {
            counter: AtomicU32::new(0),
        }
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        Err("MarkAsset does not provide language servers".into())
    }

    fn run_slash_command(
        &self,
        command: SlashCommand,
        args: Vec<String>,
        _worktree: Option<&Worktree>,
    ) -> Result<SlashCommandOutput, String> {
        match command.name.as_str() {
            "asset-code" => {
                // Try Firebase first, fallback to local counter
                match self.generate_firebase_code() {
                    Ok(code) => {
                        let text = format!(
                            "📱 Upload assets using code: {}\n\n✨ Generated Firebase session: {}\n🔥 Session created successfully!\n📸 Upload files using this code\n⏰ Code expires in 1 hour", 
                            code, code
                        );
                        
                        Ok(SlashCommandOutput {
                            sections: vec![SlashCommandOutputSection {
                                range: (0..text.len()).into(),
                                label: "Firebase Session Code".to_string(),
                            }],
                            text,
                        })
                    },
                    Err(firebase_error) => {
                        // Fallback to local counter
                        let local_counter = self.counter.fetch_add(1, Ordering::SeqCst);
                        let fallback_code = format!("{:03}", local_counter % 1000);
                        
                        let text = format!(
                            "📱 Upload assets using code: {}\n\n⚠️ Firebase Error: {}\n🔄 Using local code: {}\n📸 Upload files using this code", 
                            fallback_code, firebase_error, fallback_code
                        );
                        
                        Ok(SlashCommandOutput {
                            sections: vec![SlashCommandOutputSection {
                                range: (0..text.len()).into(),
                                label: "Local Fallback Code".to_string(),
                            }],
                            text,
                        })
                    }
                }
            }
            "asset-check" => {
                if args.is_empty() {
                    return Err("Please provide a 3-digit code to check (e.g. /asset-check 123)".to_string());
                }
                
                let code = &args[0];
                
                // Check Firebase session
                match self.check_firebase_session(code) {
                    Ok(status_msg) => {
                        let text = format!("🔍 Checking Firebase session: {}\n\n{}\n\n📸 Upload files to see them here", code, status_msg);
                        
                        Ok(SlashCommandOutput {
                            sections: vec![SlashCommandOutputSection {
                                range: (0..text.len()).into(),
                                label: "Firebase Session Status".to_string(),
                            }],
                            text,
                        })
                    },
                    Err(error) => {
                        let text = format!("🔍 Checking session: {}\n\n❌ Error: {}\n\n📸 Make sure you created the session first", code, error);
                        
                        Ok(SlashCommandOutput {
                            sections: vec![SlashCommandOutputSection {
                                range: (0..text.len()).into(),
                                label: "Session Check Error".to_string(),
                            }],
                            text,
                        })
                    }
                }
            }
            _ => Err(format!("Unknown command: {}", command.name)),
        }
    }
}

zed::register_extension!(MarkAssetExtension);