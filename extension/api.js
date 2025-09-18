// API service to communicate with Verity backend
class VerityAPI {
  constructor() {
    this.baseUrl = 'https://verity-app-178461975476.us-central1.run.app';
  }

  async getCredibilityScore(content, contentType = 'text') {
    try {
      const response = await fetch(`${this.baseUrl}/api/analyze/credibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content,
          contentType: contentType
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching credibility score:', error);
      throw error;
    }
  }

  async getEducationalInsights(text) {
    try {
      const response = await fetch(`${this.baseUrl}/api/analyze/insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching educational insights:', error);
      throw error;
    }
  }

  async analyzeContent(content) {
    try {
      // Run both analyses in parallel
      const [credibilityResult, insightsResult] = await Promise.all([
        this.getCredibilityScore(content),
        this.getEducationalInsights(content)
      ]);

      return {
        credibility: credibilityResult,
        insights: insightsResult
      };
    } catch (error) {
      console.error('Error analyzing content:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const verityAPI = new VerityAPI();
export default verityAPI;