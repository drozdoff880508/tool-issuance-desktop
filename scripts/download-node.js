const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NODE_VERSION = '20.18.0';
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`;
const NODE_DIR = path.join(__dirname, '..', 'node');

// Download Node.js if not exists
if (!fs.existsSync(NODE_DIR)) {
  console.log('Downloading Node.js...');
  
  const zipPath = path.join(__dirname, 'node.zip');
  const file = fs.createWriteStream(zipPath);
  
  https.get(NODE_URL, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
      // Follow redirect
      https.get(response.headers.location, (redirectResponse) => {
        redirectResponse.pipe(file);
        redirectResponse.on('end', () => extractNode());
      });
    } else {
      response.pipe(file);
      response.on('end', () => extractNode());
    }
  }).on('error', (err) => {
    console.error('Download failed:', err);
    process.exit(1);
  });
  
  function extractNode() {
    console.log('Extracting Node.js...');
    try {
      // On Windows, use PowerShell to extract
      if (process.platform === 'win32') {
        execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${__dirname}' -Force"`);
        const extractedDir = path.join(__dirname, `node-v${NODE_VERSION}-win-x64`);
        fs.renameSync(extractedDir, NODE_DIR);
      } else {
        // On Unix, use unzip
        execSync(`unzip -o ${zipPath} -d ${__dirname}`);
        const extractedDir = path.join(__dirname, `node-v${NODE_VERSION}-win-x64`);
        fs.renameSync(extractedDir, NODE_DIR);
      }
      fs.unlinkSync(zipPath);
      console.log('Node.js downloaded and extracted successfully!');
    } catch (err) {
      console.error('Extraction failed:', err);
      process.exit(1);
    }
  }
} else {
  console.log('Node.js already exists in node/ directory');
}
