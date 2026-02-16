export interface WorkspaceOption {
  name: string;
  index: number;
  selected: boolean;
}

export function renderWorkspacePicker(workspaces: WorkspaceOption[]): string {
  if (workspaces.length <= 1) return '';

  const optionsHtml = workspaces
    .map(ws => `<option value="${ws.index}" ${ws.selected ? 'selected' : ''}>${ws.name}</option>`)
    .join('');

  return `
    <div class="workspace-picker">
      <label class="section-label">Workspace:</label>
      <select class="workspace-select" onchange="selectWorkspace(this.value)">
        ${optionsHtml}
      </select>
    </div>`;
}

export interface FolderOption {
  alias: string;
  message: string;
  value: string;
  disabled: boolean;
  selected: boolean;
}

export function renderFolderOption(opt: FolderOption): string {
  const classes = ['folder-option', opt.selected ? 'selected' : '', opt.disabled ? 'disabled' : ''].filter(Boolean).join(' ');
  const onclick = opt.disabled ? '' : 'onclick="selectOption(this)"';
  const disabledAttr = opt.disabled ? 'disabled' : '';
  const checkedAttr = opt.selected ? 'checked' : '';

  return `
    <label class="${classes}" ${onclick}>
      <input type="radio" name="folder" value="${opt.value}" ${checkedAttr} ${disabledAttr}>
      <div class="option-text">
        <div class="option-alias">${opt.alias}</div>
        <div class="option-path">${opt.message}</div>
      </div>
    </label>`;
}

export function renderFolderPicker(options: FolderOption[]): string {
  const optionsHtml = options.map(renderFolderOption).join('');
  return `
    <div class="folder-options">
      <label class="section-label">Download to:</label>
      ${optionsHtml}
    </div>`;
}

export function renderFilesList(files: any[]): string {
  return files.map(f => `<div class="file-item">${f.original_name || 'Unknown file'}</div>`).join('');
}

export function renderStateContent(state: string, message: string, sessionCode: string): string {
  switch (state) {
    case 'loading':
      return `<div class="status">${message}</div>`;

    case 'waiting':
      return `
        <div class="session-code">${sessionCode}</div>
        <div class="status">
          Waiting for uploads...
          <span class="polling-indicator"></span>
        </div>
        <p>Use this code on the upload page</p>`;

    case 'files-ready':
      return `
        <div class="session-code">${sessionCode}</div>
        <div class="status success">${message}</div>`;

    case 'downloading':
      return `<div class="status">${message}</div>`;

    case 'completed':
      return `
        <div class="status success">${message}</div>
        <p>Session completed successfully!</p>`;

    case 'error':
      return `<div class="status error">${message}</div>`;

    default:
      return '';
  }
}

export function renderStyles(): string {
  return `
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 400px;
      margin: 0 auto;
      text-align: center;
    }
    .session-code {
      font-size: 48px;
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
      margin: 20px 0;
      font-family: var(--vscode-editor-font-family);
      user-select: all;
      cursor: text;
      padding: 10px;
      border: 2px dashed var(--vscode-textLink-foreground);
      border-radius: 8px;
    }
    .status {
      font-size: 16px;
      margin: 15px 0;
    }
    .polling-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--vscode-textLink-foreground);
      animation: pulse 1.5s infinite;
      margin-left: 5px;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
    .files-section {
      margin: 20px 0;
      text-align: left;
    }
    .file-item {
      padding: 8px 12px;
      margin: 5px 0;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-family: var(--vscode-editor-font-family);
    }
    .button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin: 5px;
    }
    .button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .error {
      color: var(--vscode-errorForeground);
    }
    .success {
      color: var(--vscode-terminal-ansiGreen);
    }
    .workspace-picker {
      margin: 15px 0;
      text-align: left;
    }
    .workspace-picker label.section-label {
      display: block;
      margin-bottom: 8px;
    }
    .workspace-select {
      width: 100%;
      padding: 8px 10px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      cursor: pointer;
    }
    .workspace-select:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .folder-options {
      margin: 15px 0;
      text-align: left;
    }
    .folder-options label.section-label {
      display: block;
      margin-bottom: 8px;
    }
    .folder-option {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      margin: 6px 0;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      cursor: pointer;
    }
    .folder-option:hover:not(.disabled) {
      border-color: var(--vscode-focusBorder);
    }
    .folder-option.selected {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
    }
    .folder-option.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .folder-option input[type="radio"] {
      margin-top: 2px;
      accent-color: var(--vscode-focusBorder);
    }
    .folder-option .option-text {
      flex: 1;
      min-width: 0;
    }
    .folder-option .option-alias {
      font-size: 13px;
      font-family: var(--vscode-editor-font-family);
      color: var(--vscode-textPreformat-foreground);
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      display: inline-block;
    }
    .folder-option .option-path {
      font-size: 11px;
      opacity: 0.7;
      font-family: var(--vscode-editor-font-family);
      word-break: break-all;
      margin-top: 2px;
    }`;
}

export function renderScript(defaultFolderValue: string): string {
  return `
    const vscode = acquireVsCodeApi();

    function selectOption(label) {
      if (label.classList.contains('disabled')) return;
      document.querySelectorAll('.folder-option').forEach(el => el.classList.remove('selected'));
      label.classList.add('selected');
      label.querySelector('input[type="radio"]').checked = true;
    }

    function downloadFiles() {
      const checked = document.querySelector('input[name="folder"]:checked');
      const folder = checked ? checked.value : '${defaultFolderValue}';
      vscode.postMessage({ command: 'downloadFiles', folder });
    }

    function selectWorkspace(index) {
      vscode.postMessage({ command: 'selectWorkspace', index: parseInt(index) });
    }

    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }`;
}

export function renderPage(stateHtml: string, stylesHtml: string, scriptHtml: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MarkAsset Upload Session</title>
      <style>${stylesHtml}</style>
    </head>
    <body>
      <div class="container">
        <h2>MarkAsset Upload Session</h2>
        ${stateHtml}
        <div style="margin-top: 30px;">
          <button class="button secondary" onclick="cancel()">Cancel</button>
        </div>
      </div>
      <script>${scriptHtml}</script>
    </body>
    </html>`;
}
