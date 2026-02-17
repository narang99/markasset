export class GoogleDriveAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.gapiInitialized = false;
  }

  async initializeGapi() {
    if (this.gapiInitialized) return;

    return new Promise((resolve, reject) => {
      if (typeof window.gapi === 'undefined') {
        reject(new Error('Google API client not loaded'));
        return;
      }

      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
          });
          
          // Set the access token
          window.gapi.client.setToken({ access_token: this.accessToken });
          this.gapiInitialized = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async findMarkAssetFolder() {
    await this.initializeGapi();
    
    const response = await window.gapi.client.drive.files.list({
      q: "name='MarkAsset' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)'
    });
    
    if (response.result.files && response.result.files.length > 0) {
      return response.result.files[0].id;
    }

    // Create MarkAsset folder if it doesn't exist
    const createResponse = await window.gapi.client.drive.files.create({
      resource: {
        name: 'MarkAsset',
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });

    return createResponse.result.id;
  }

  async findSessionFolder(code, rootFolderId) {
    await this.initializeGapi();
    
    const response = await window.gapi.client.drive.files.list({
      q: `name='${code}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)'
    });
    
    return response.result.files && response.result.files.length > 0 ? response.result.files[0].id : null;
  }

  async uploadFile(sessionFolderId, file) {
    await this.initializeGapi();

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
      'name': file.name,
      'parents': [sessionFolderId]
    };

    // Convert file to array buffer
    const fileData = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileData);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + file.type + '\r\n\r\n' +
      binaryString +
      close_delim;

    const request = await window.gapi.client.request({
      'path': '/upload/drive/v3/files',
      'method': 'POST',
      'params': { 'uploadType': 'multipart' },
      'headers': {
        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
      },
      'body': multipartRequestBody
    });

    return request.result;
  }

  async getSessionFiles(sessionFolderId) {
    await this.initializeGapi();
    
    const response = await window.gapi.client.drive.files.list({
      q: `'${sessionFolderId}' in parents and name!='session.json' and trashed=false`,
      fields: 'files(id,name,size,mimeType)'
    });
    
    return response.result.files || [];
  }

  async getFileContent(fileId) {
    await this.initializeGapi();
    
    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });
    
    return response.body;
  }
}