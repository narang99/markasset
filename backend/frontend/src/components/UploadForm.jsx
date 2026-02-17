import { useState, useEffect } from 'react';

export function UploadForm({ isAuthenticated, onSubmit }) {
  const [sessionCode, setSessionCode] = useState('');
  const [files, setFiles] = useState([]);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    // Check for code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && /^[a-z0-9]{4}$/.test(code)) {
      setSessionCode(code);
    }
  }, []);

  useEffect(() => {
    const hasValidCode = /^[a-z0-9]{4}$/.test(sessionCode);
    const hasFiles = files.length > 0;
    setIsValid(hasValidCode && hasFiles && isAuthenticated);
  }, [sessionCode, files, isAuthenticated]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid) {
      onSubmit(sessionCode, files);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="sessionCode">Session Code</label>
        <input
          type="text"
          id="sessionCode"
          placeholder="a1b2"
          maxLength="4"
          pattern="[a-z0-9]{4}"
          value={sessionCode}
          onChange={(e) => setSessionCode(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="fileInput">Select Images</label>
        <input
          type="file"
          id="fileInput"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          required
        />
        {files.length > 0 && (
          <div className="file-info visible">
            Selected: {files.map(file => file.name).join(', ')}
          </div>
        )}
      </div>

      <button type="submit" disabled={!isValid} className="submit-btn">
        Upload Images
      </button>
    </form>
  );
}