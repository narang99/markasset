use crate::config::Config;
use std::path::Path;
use tokio::fs;
use tokio::io::AsyncWriteExt;

pub struct FileDownloader;

impl FileDownloader {
    pub fn new() -> Self {
        Self
    }
    
    pub async fn download_file(
        &self, 
        code: &str, 
        filename: &str, 
        destination_dir: &Path
    ) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        
        // Construct Firebase Storage download URL
        let storage_path = Config::storage_path(code, filename);
        let download_url = format!("{}?alt=media", Config::storage_base_url());
        let full_url = format!("{}/{}", download_url, storage_path);
        
        // Download file
        let response = client.get(&full_url).send().await?;
        
        if !response.status().is_success() {
            return Err(format!("Failed to download file: {}", response.status()).into());
        }
        
        let file_bytes = response.bytes().await?;
        
        // Ensure destination directory exists
        fs::create_dir_all(destination_dir).await?;
        
        // Write file to destination
        let file_path = destination_dir.join(filename);
        let mut file = fs::File::create(&file_path).await?;
        file.write_all(&file_bytes).await?;
        
        Ok(file_path.to_string_lossy().to_string())
    }
    
    pub async fn download_session_files(
        &self,
        code: &str,
        filenames: &[String],
        destination_dir: &Path
    ) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut downloaded_files = Vec::new();
        
        for filename in filenames {
            match self.download_file(code, filename, destination_dir).await {
                Ok(file_path) => downloaded_files.push(file_path),
                Err(e) => {
                    eprintln!("Failed to download {}: {}", filename, e);
                    // Continue with other files
                }
            }
        }
        
        if downloaded_files.is_empty() {
            return Err("No files were successfully downloaded".into());
        }
        
        Ok(downloaded_files)
    }
}