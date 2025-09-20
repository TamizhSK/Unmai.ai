#!/usr/bin/env node

// Backend Integration Test Script
const API_BASE = 'http://localhost:3001';

async function testAPI(endpoint, data, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`📡 Endpoint: POST ${endpoint}`);
  console.log(`📤 Payload:`, JSON.stringify(data, null, 2));
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Success:`, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.log(`❌ Error:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting Verity Backend Integration Tests\n');
  
  // Test 1: Health Check
  try {
    const healthResponse = await fetch(`${API_BASE}/health`);
    const health = await healthResponse.json();
    console.log('✅ Health Check:', health);
  } catch (error) {
    console.log('❌ Backend not running. Start with: cd backend && npm run dev');
    return;
  }
  
  // Test 2: Fact Check
  await testAPI('/api/fact-check', {
    claim: 'The Earth is flat'
  }, 'Fact Check - Simple claim');
  
  // Test 3: Web Analysis
  await testAPI('/api/web-analysis', {
    query: 'latest news about artificial intelligence',
    contentType: 'text'
  }, 'Web Analysis - Current events');
  
  // Test 4: URL Analysis (Safe Search + Verify Source)
  await testAPI('/api/safe-search', {
    url: 'https://www.bbc.com/news'
  }, 'Safe Search - BBC News');
  
  await testAPI('/api/verify-source', {
    content: 'https://www.bbc.com/news',
    contentType: 'url'
  }, 'Verify Source - BBC News');
  
  // Test 5: Credibility Score
  await testAPI('/api/credibility-score', {
    text: 'Scientists have discovered a new planet in our solar system'
  }, 'Credibility Score - Scientific claim');
  
  // Test 6: Educational Insights
  await testAPI('/api/educational-insights', {
    text: 'How do vaccines work?'
  }, 'Educational Insights - Health topic');
  
  // Test 7: Safety Assessment
  await testAPI('/api/safety-assessment', {
    content: 'This is a test message',
    contentType: 'text'
  }, 'Safety Assessment - Text content');
  
  // Test 8: Translation
  await testAPI('/api/translate-text', {
    text: 'Hello, how are you?',
    targetLanguage: 'es'
  }, 'Translation - English to Spanish');
  
  console.log('\n🏁 Backend Integration Tests Complete');
}

// Run the tests
runTests().catch(console.error);
