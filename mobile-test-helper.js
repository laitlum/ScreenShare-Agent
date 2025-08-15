#!/usr/bin/env node

const os = require('os');
const http = require('http');
const dns = require('dns');

console.log('📱 Mobile Testing Helper for ScreenShare\n');

// Get local IP addresses
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const localIPs = [];
    
    Object.keys(interfaces).forEach(ifaceName => {
        const iface = interfaces[ifaceName];
        
        iface.forEach(details => {
            // Skip internal and non-IPv4 addresses
            if (details.family === 'IPv4' && !details.internal) {
                localIPs.push({
                    name: ifaceName,
                    address: details.address,
                    netmask: details.netmask,
                    type: details.family
                });
            }
        });
    });
    
    return localIPs;
}

// Test if port is accessible from network
function testPortAccess(ip, port) {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: ip,
            port: port,
            path: '/',
            method: 'GET',
            timeout: 5000
        }, (res) => {
            resolve({ accessible: true, status: res.statusCode });
        });
        
        req.on('error', (err) => {
            resolve({ accessible: false, error: err.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ accessible: false, error: 'Timeout' });
        });
        
        req.end();
    });
}

// Test DNS resolution
function testDNSResolution(ip) {
    return new Promise((resolve) => {
        dns.reverse(ip, (err, hostnames) => {
            if (err) {
                resolve({ resolved: false, hostnames: [] });
            } else {
                resolve({ resolved: true, hostnames: hostnames || [] });
            }
        });
    });
}

// Main function
async function runMobileTestHelper() {
    console.log('🔍 Finding your local IP addresses...\n');
    
    const localIPs = getLocalIPs();
    
    if (localIPs.length === 0) {
        console.log('❌ No local IP addresses found');
        console.log('💡 Make sure you are connected to a network');
        return;
    }
    
    console.log('📋 Found local IP addresses:');
    localIPs.forEach((ip, index) => {
        console.log(`  ${index + 1}. ${ip.address} (${ip.name})`);
    });
    
    console.log('\n🧪 Testing network accessibility...\n');
    
    for (const ip of localIPs) {
        console.log(`🔍 Testing ${ip.address}...`);
        
        // Test DNS resolution
        const dnsResult = await testDNSResolution(ip.address);
        if (dnsResult.resolved) {
            console.log(`  ✅ DNS: Resolves to ${dnsResult.hostnames.join(', ')}`);
        } else {
            console.log(`  ⚠️  DNS: No reverse DNS resolution`);
        }
        
        // Test port accessibility
        const portResult = await testPortAccess(ip.address, 3000);
        if (portResult.accessible) {
            console.log(`  ✅ Port 3000: Accessible (Status: ${portResult.status})`);
        } else {
            console.log(`  ❌ Port 3000: Not accessible (${portResult.error})`);
        }
        
        console.log('');
    }
    
    // Find the best IP for mobile testing
    const bestIP = localIPs.find(ip => {
        // Prefer WiFi interfaces
        return ip.name.toLowerCase().includes('en') || 
               ip.name.toLowerCase().includes('wlan') ||
               ip.name.toLowerCase().includes('wi-fi');
    }) || localIPs[0];
    
    console.log('🎯 Recommended IP for mobile testing:');
    console.log(`  ${bestIP.address} (${bestIP.name})`);
    
    console.log('\n📱 Mobile Testing URLs:');
    console.log(`  Regular Viewer: http://${bestIP.address}:3000/viewer.html`);
    console.log(`  Full-Screen Viewer: http://${bestIP.address}:3000/viewer-fullscreen.html`);
    console.log(`  Agent (on computer): http://localhost:3000/renderer.html`);
    
    console.log('\n🚀 Next Steps:');
    console.log('1. Start the server: node signaling-server.js');
    console.log('2. Open agent on computer: http://localhost:3000/renderer.html');
    console.log('3. Open viewer on mobile: http://' + bestIP.address + ':3000/viewer.html');
    console.log('4. Start sharing screen and copy session ID');
    console.log('5. Connect from mobile using the session ID');
    
    console.log('\n💡 Pro Tips:');
    console.log('- Ensure both devices are on the same WiFi network');
    console.log('- Check firewall settings if connection fails');
    console.log('- Use Chrome or Safari on mobile for best compatibility');
    console.log('- Test with the full-screen viewer for clean interface');
    
    // Test if server is running
    console.log('\n🔍 Checking if server is running...');
    try {
        const serverTest = await testPortAccess('localhost', 3000);
        if (serverTest.accessible) {
            console.log('✅ Server is running on localhost:3000');
        } else {
            console.log('❌ Server is not running on localhost:3000');
            console.log('💡 Start the server with: node signaling-server.js');
        }
    } catch (error) {
        console.log('❌ Error checking server status');
    }
}

// Run if this file is executed directly
if (require.main === module) {
    runMobileTestHelper().catch(console.error);
}

module.exports = { getLocalIPs, testPortAccess, testDNSResolution };
