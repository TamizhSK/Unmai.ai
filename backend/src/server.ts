import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { factCheckClaim } from './ai/flows/fact-check-claim';
import { getCredibilityScore } from './ai/flows/get-credibility-score';
import { detectDeepfake } from './ai/flows/detect-deepfake';
import { provideEducationalInsights } from './ai/flows/provide-educational-insights';
import { assessSafety } from './ai/flows/safety-assessment';
import { verifySource } from './ai/flows/verify-source';
import { performWebAnalysis } from './ai/flows/perform-web-analysis';
import { detectSyntheticContent } from './ai/flows/detect-synthetic-content';
import { analyzeContentForMisinformation } from './ai/flows/analyze-content-for-misinformation';
import { safeSearchUrl } from './ai/flows/safe-search-url';
import { transcribeAudioFlow } from './ai/flows/transcribe-audio';
import { explainMisleadingIndicators } from './ai/flows/explain-misleading-indicators';
import { translateTextFlow } from './ai/flows/translate-text';

config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.post('/api/fact-check', async (req, res) => {
  try {
    const { claim } = req.body;
    if (!claim) {
      return res.status(400).json({ error: 'Claim is required' });
    }
    const result = await factCheckClaim({ claim });
    res.json(result);
  } catch (error) {
    console.error('Error in fact-check:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/credibility-score', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const result = await getCredibilityScore({ content: text, contentType: 'text' });
    res.json(result);
  } catch (error) {
    console.error('Error in credibility-score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/detect-deepfake', async (req, res) => {
  try {
    const { media, contentType, sourceCredibility } = req.body;
    if (!media || !contentType) {
      return res.status(400).json({ error: 'Media and contentType are required' });
    }
    const result = await detectDeepfake({ 
      media, 
      contentType: contentType as 'image' | 'video' 
    }, sourceCredibility);
    res.json(result);
  } catch (error) {
    console.error('Error in detect-deepfake:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/educational-insights', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const result = await provideEducationalInsights({ text });
    res.json(result);
  } catch (error) {
    console.error('Error in educational-insights:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/safety-assessment', async (req, res) => {
  try {
    const { content, contentType } = req.body;
    if (!content || !contentType) {
      return res.status(400).json({ error: 'Content and contentType are required' });
    }
    const result = await assessSafety({ 
      content, 
      contentType: contentType as 'text' | 'url' | 'image' 
    });
    res.json(result);
  } catch (error) {
    console.error('Error in safety-assessment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/verify-source', async (req, res) => {
  try {
    const { content, contentType } = req.body;
    if (!content || !contentType) {
      return res.status(400).json({ error: 'Content and contentType are required' });
    }
    const result = await verifySource({ 
      content, 
      contentType: contentType as 'text' | 'url' 
    });
    res.json(result);
  } catch (error) {
    console.error('Error in verify-source:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/web-analysis', async (req, res) => {
  try {
    const { query, contentType } = req.body;
    if (!query || !contentType) {
      return res.status(400).json({ error: 'Query and contentType are required' });
    }
    const result = await performWebAnalysis({ 
      query, 
      contentType: contentType as 'text' | 'url' 
    });
    res.json(result);
  } catch (error) {
    console.error('Error in web-analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/detect-synthetic', async (req, res) => {
  try {
    const { media, contentType } = req.body;
    if (!media || !contentType) {
      return res.status(400).json({ error: 'Media and contentType are required' });
    }
    const result = await detectSyntheticContent({ 
      media, 
      contentType: contentType as 'image' | 'video' 
    });
    res.json(result);
  } catch (error) {
    console.error('Error in detect-synthetic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/analyze-misinformation', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const result = await analyzeContentForMisinformation({ content });
    res.json(result);
  } catch (error) {
    console.error('Error in analyze-misinformation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/safe-search', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const result = await safeSearchUrl({ url });
    res.json(result);
  } catch (error) {
    console.error('Error in safe-search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audioData } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }
    const result = await transcribeAudioFlow({ audioData });
    res.json(result);
  } catch (error) {
    console.error('Error in transcribe-audio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/translate-text', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'Text and targetLanguage are required' });
    }
    const result = await translateTextFlow({ text, targetLanguage });
    res.json(result);
  } catch (error) {
    console.error('Error in translate-text:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/explain-indicators', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const result = await explainMisleadingIndicators({ content });
    res.json(result);
  } catch (error) {
    console.error('Error in explain-indicators:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
