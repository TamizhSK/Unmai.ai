#!/usr/bin/env node

/**
 * Connectivity Test Script for Unmai.ai
 * Tests frontend-backend connectivity and API endpoints
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`[INFO] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`[SUCCESS] ${message}`, 'green');
}

function logWarning(message) {
  log(`[WARNING] ${message}`, 'yellow');
}

function logError(message) {
  log(`[ERROR] ${message}`, 'red');
}

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Unmai-Connectivity-Test/1.0',
        'Accept': 'application/json',
        ...options.headers
      },
      timeout: options.timeout || 10000
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          ok: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Test backend health endpoint
async function testBackendHealth(backendUrl) {
  logInfo(`Testing backend health: ${backendUrl}/health`);
  
  try {
    const response = await makeRequest(`${backendUrl}/health`);
    
    if (response.ok) {
      logSuccess('Backend health check passed');
      
      try {
        const healthData = JSON.parse(response.data);
        logInfo(`Backend status: ${healthData.status}`);
        if (healthData.customSearch) {
          logInfo(`Custom Search configured: ${healthData.customSearch.configured}`);
        }
      } catch (e) {
        logWarning('Backend health response is not valid JSON');
      }
      
      return true;
    } else {
      logError(`Backend health check failed: HTTP ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`Backend health check failed: ${error.message}`);
    return false;
  }
}

// Test backend API endpoint
async function testBackendAPI(backendUrl) {
  logInfo('Testing backend API endpoint: /api/analyze');
  
  try {
    const response = await makeRequest(`${backendUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        type: 'text', 
        payload: { text: 'test connectivity' } 
      })
    });
    
    if (response.ok) {
      logSuccess('Backend API test passed');
      return true;
    } else {
      logError(`Backend API test failed: HTTP ${response.statusCode}`);
      logError(`Response: ${response.data}`);
      return false;
    }
  } catch (error) {
    logError(`Backend API test failed: ${error.message}`);
    return false;
  }
}

// Test frontend accessibility
async function testFrontend(frontendUrl) {
  logInfo(`Testing frontend accessibility: ${frontendUrl}`);
  
  try {
    const response = await makeRequest(frontendUrl);
    
    if (response.ok) {
      logSuccess('Frontend accessibility test passed');
      
      // Check if it's a Next.js app
      if (response.data.includes('__NEXT_DATA__') || response.data.includes('_next')) {
        logInfo('Detected Next.js application');
      }
      
      return true;
    } else {
      logError(`Frontend accessibility test failed: HTTP ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`Frontend accessibility test failed: ${error.message}`);
    return false;
  }
}

// Test CORS configuration
async function testCORS(backendUrl) {
  logInfo('Testing CORS configuration');
  
  try {
    const response = await makeRequest(`${backendUrl}/health`, {
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    const corsHeaders = response.headers['access-control-allow-origin'];
    if (corsHeaders) {
      logSuccess(`CORS configured: ${corsHeaders}`);
      return true;
    } else {
      logWarning('CORS headers not found - may cause frontend connectivity issues');
      return false;
    }
  } catch (error) {
    logWarning(`CORS test failed: ${error.message}`);
    return false;
  }
}

// Main test function
async function runConnectivityTests() {
  log('🔍 Starting Connectivity Tests for Unmai.ai', 'cyan');
  
  // Get URLs from environment or use defaults
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  logInfo(`Backend URL: ${backendUrl}`);
  logInfo(`Frontend URL: ${frontendUrl}`);
  
  const results = {
    backendHealth: false,
    backendAPI: false,
    frontend: false,
    cors: false
  };
  
  // Run tests
  results.backendHealth = await testBackendHealth(backendUrl);
  
  if (results.backendHealth) {
    results.backendAPI = await testBackendAPI(backendUrl);
    results.cors = await testCORS(backendUrl);
  }
  
  results.frontend = await testFrontend(frontendUrl);
  
  // Summary
  log('\n📊 Test Results Summary:', 'cyan');
  log(`Backend Health: ${results.backendHealth ? '✅ PASS' : '❌ FAIL'}`, results.backendHealth ? 'green' : 'red');
  log(`Backend API: ${results.backendAPI ? '✅ PASS' : '❌ FAIL'}`, results.backendAPI ? 'green' : 'red');
  log(`Frontend: ${results.frontend ? '✅ PASS' : '❌ FAIL'}`, results.frontend ? 'green' : 'red');
  log(`CORS: ${results.cors ? '✅ PASS' : '⚠️  WARN'}`, results.cors ? 'green' : 'yellow');
  
  const allPassed = results.backendHealth && results.backendAPI && results.frontend;
  
  if (allPassed) {
    log('\n🎉 All connectivity tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some connectivity tests failed. Check the logs above for details.', 'red');
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node scripts/test-connectivity.js [options]

Options:
  --backend-url <url>   Backend URL to test (default: http://localhost:3001)
  --frontend-url <url>  Frontend URL to test (default: http://localhost:3000)
  --help, -h           Show this help message

Environment Variables:
  BACKEND_URL          Backend URL to test
  FRONTEND_URL         Frontend URL to test

Examples:
  node scripts/test-connectivity.js
  node scripts/test-connectivity.js --backend-url https://api.unmai.ai
  BACKEND_URL=https://api.unmai.ai node scripts/test-connectivity.js
`);
    process.exit(0);
  }
  
  // Parse URLs from command line
  const backendUrlIndex = args.indexOf('--backend-url');
  if (backendUrlIndex !== -1 && args[backendUrlIndex + 1]) {
    process.env.BACKEND_URL = args[backendUrlIndex + 1];
  }
  
  const frontendUrlIndex = args.indexOf('--frontend-url');
  if (frontendUrlIndex !== -1 && args[frontendUrlIndex + 1]) {
    process.env.FRONTEND_URL = args[frontendUrlIndex + 1];
  }
  
  runConnectivityTests().catch(error => {
    logError(`Connectivity test failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  testBackendHealth,
  testBackendAPI,
  testFrontend,
  testCORS,
  runConnectivityTests
};