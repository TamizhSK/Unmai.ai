// Popup script to handle UI logic
import verityAPI from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const selectionPrompt = document.getElementById('selection-prompt');
  const contentPreview = document.getElementById('content-preview');
  const resultsContainer = document.getElementById('results-container');
  const errorContainer = document.getElementById('error-container');
  const loading = document.getElementById('loading');
  const selectedTextElement = document.getElementById('selected-text');
  const errorMessageElement = document.getElementById('error-message');
  
  // Get buttons
  const refreshBtn = document.getElementById('refresh-btn');
  const analyzeBtn = document.getElementById('analyze-btn');
  const retryBtn = document.getElementById('retry-btn');
  const newAnalysisBtn = document.getElementById('new-analysis-btn');
  
  // Check if there's selected text from context menu
  chrome.storage.local.get(['selectedText'], (result) => {
    if (result.selectedText) {
      showContentPreview(result.selectedText);
      // Clear the stored text
      chrome.storage.local.remove(['selectedText']);
    } else {
      // Try to get selected text from the active tab
      refreshSelectedContent();
    }
  });
  
  // Event listeners
  refreshBtn.addEventListener('click', refreshSelectedContent);
  analyzeBtn.addEventListener('click', analyzeContent);
  retryBtn.addEventListener('click', retryAnalysis);
  newAnalysisBtn.addEventListener('click', resetAnalysis);
  
  // Function to refresh selected content
  async function refreshSelectedContent() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const response = await chrome.tabs.sendMessage(tab.id, {action: "getSelectedText"});
      
      if (response && response.selectedText) {
        showContentPreview(response.selectedText);
      } else {
        showSelectionPrompt();
      }
    } catch (error) {
      console.error('Error getting selected text:', error);
      showSelectionPrompt();
    }
  }
  
  // Function to show content preview
  function showContentPreview(text) {
    selectedTextElement.textContent = text;
    selectionPrompt.classList.add('hidden');
    contentPreview.classList.remove('hidden');
    resultsContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');
    loading.classList.add('hidden');
  }
  
  // Function to show selection prompt
  function showSelectionPrompt() {
    selectionPrompt.classList.remove('hidden');
    contentPreview.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');
    loading.classList.add('hidden');
  }
  
  // Function to show loading state
  function showLoading() {
    selectionPrompt.classList.add('hidden');
    contentPreview.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');
    loading.classList.remove('hidden');
  }
  
  // Function to show results
  function showResults(analysisResults) {
    // Display credibility score
    const score = analysisResults.credibility.credibilityScore;
    const scoreFill = document.getElementById('score-fill');
    const scoreText = document.getElementById('score-text');
    const credibilitySummary = document.getElementById('credibility-summary');
    
    scoreFill.style.width = `${score}%`;
    scoreText.textContent = `${score}/100`;
    
    // Set color based on score
    if (score < 40) {
      scoreFill.style.backgroundColor = '#ef4444'; // red
    } else if (score < 70) {
      scoreFill.style.backgroundColor = '#f59e0b'; // yellow
    } else {
      scoreFill.style.backgroundColor = '#10b981'; // green
    }
    
    credibilitySummary.textContent = analysisResults.credibility.assessmentSummary;
    
    // Display misleading indicators
    const indicatorsList = document.getElementById('indicators-list');
    indicatorsList.innerHTML = '';
    
    if (analysisResults.credibility.misleadingIndicators && 
        analysisResults.credibility.misleadingIndicators.length > 0) {
      analysisResults.credibility.misleadingIndicators.forEach(indicator => {
        const li = document.createElement('li');
        li.textContent = indicator;
        indicatorsList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No major misleading indicators found';
      indicatorsList.appendChild(li);
    }
    
    // Display educational insights
    const insightsContent = document.getElementById('insights-content');
    insightsContent.textContent = analysisResults.insights.insights;
    
    // Show results
    selectionPrompt.classList.add('hidden');
    contentPreview.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    loading.classList.add('hidden');
  }
  
  // Function to show error
  function showError(message) {
    errorMessageElement.textContent = message || 'An error occurred during analysis. Please try again.';
    selectionPrompt.classList.add('hidden');
    contentPreview.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    errorContainer.classList.remove('hidden');
    loading.classList.add('hidden');
  }
  
  // Function to analyze content
  async function analyzeContent() {
    const text = selectedTextElement.textContent;
    if (!text) {
      showError('No content selected for analysis.');
      return;
    }
    
    showLoading();
    
    try {
      const results = await verityAPI.analyzeContent(text);
      showResults(results);
    } catch (error) {
      console.error('Analysis error:', error);
      showError('Failed to analyze content. Please check your internet connection and try again.');
    }
  }
  
  // Function to retry analysis
  function retryAnalysis() {
    analyzeContent();
  }
  
  // Function to reset analysis
  function resetAnalysis() {
    refreshSelectedContent();
  }
});