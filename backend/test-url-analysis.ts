import { analyzeUrlSafety } from './src/ai/flows/analyze-url-safety.js';
import { environmentInitializer } from './src/lib/environment-initializer.js';

async function test() {
  await environmentInitializer.initialize();
  console.log('Testing URL analysis for https://xhamster.com/');
  const result = await analyzeUrlSafety({ url: 'https://xhamster.com/' });
  console.log('Analysis Label:', result.analysisLabel);
  console.log('One-line Description:', result.oneLineDescription);
  console.log('Total metadata:', JSON.stringify(result.metadata, null, 2));
}

test().catch(console.error);
