#!/usr/bin/env node

const http = require('http');
const WebSocket = require('ws');

console.log('🧪 Testing ScreenShare Server...\n');

// Test HTTP server
function testHttpServer() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/',
            method: 'GET'
        }, (res) => {
            console.log(`✅ HTTP Server: ${res.statusCode} - ${res.statusMessage}`);
            resolve();
        });
        
        req.on('error', (err) => {
            console.log(`❌ HTTP Server: ${err.message}`);
            reject(err);
        });
        
        req.end();
    });
}

// Test WebSocket server
function testWebSocketServer() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3000/ws');
        
        ws.on('open', () => {
            console.log('✅ WebSocket Server: Connected successfully');
            ws.close();
            resolve();
        });
        
        ws.on('error', (err) => {
            console.log(`❌ WebSocket Server: ${err.message}`);
            reject(err);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING) {
                ws.close();
                reject(new Error('WebSocket connection timeout'));
            }
        }, 5000);
    });
}

// Test specific endpoints
function testEndpoints() {
    const endpoints = [
        '/viewer.html',
        '/viewer-fullscreen.html',
        '/renderer.html'
    ];
    
    return Promise.all(endpoints.map(endpoint => {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 3000,
                path: endpoint,
                method: 'GET'
            }, (res) => {
                if (res.statusCode === 200) {
                    console.log(`✅ ${endpoint}: Available`);
                } else {
                    console.log(`⚠️  ${endpoint}: ${res.statusCode}`);
                }
                resolve();
            });
            
            req.on('error', () => {
                console.log(`❌ ${endpoint}: Not accessible`);
                resolve();
            });
            
            req.end();
        });
    }));
}

// Main test function
async function runTests() {
    try {
        console.log('🔍 Testing server components...\n');
        
        await testHttpServer();
        await testWebSocketServer();
        await testEndpoints();
        
        console.log('\n🎉 All tests completed!');
        console.log('\n📋 Next steps:');
        console.log('1. Open http://localhost:3000/renderer.html in one browser tab');
        console.log('2. Open http://localhost:3000/viewer.html in another browser tab');
        console.log('3. Start sharing screen in the first tab');
        console.log('4. Connect using the session ID in the second tab');
        console.log('5. Test the full-screen mode!');
        
    } catch (error) {
        console.log(`\n❌ Test failed: ${error.message}`);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure the server is running: node http-server.js');
        console.log('2. Check if port 3000 is available');
        console.log('3. Verify all dependencies are installed: npm install');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
