const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  let filePath = '';
  
  if (req.url === '/' || req.url === '/index.html') {
    filePath = path.join(__dirname, 'viewer.html');
  } else if (req.url.endsWith('.js')) {
    filePath = path.join(__dirname, req.url);
  } else {
    // Try to serve the requested file
    filePath = path.join(__dirname, req.url);
  }
  
  console.log(`📁 Serving file: ${filePath}`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
    return;
  }
  
  // Get file extension for content type
  const ext = path.extname(filePath);
  let contentType = 'text/plain';
  
  switch (ext) {
    case '.html':
      contentType = 'text/html';
      break;
    case '.js':
      contentType = 'application/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
  }
  
  console.log(`✅ Serving ${filePath} as ${contentType}`);
  
  // Read and serve file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`❌ Error reading file: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error reading file');
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP server running on port ${PORT}`);
  console.log(`📱 Local access: http://localhost:${PORT}`);
  console.log(`📱 Network access: http://YOUR_LOCAL_IP:${PORT}`);
  console.log(`🔗 Example session: http://localhost:${PORT}?session=D0AGEVHU`);
  console.log(`📁 Serving files from: ${__dirname}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.log(`💡 Try using a different port or stop the service using port ${PORT}`);
  } else {
    console.error('❌ Server error:', err);
  }
});
