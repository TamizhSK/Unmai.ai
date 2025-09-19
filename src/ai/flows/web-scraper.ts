
'use server';
import axios from 'axios';

export async function scrapeUrl(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Failed to scrape URL: ${url}. Status code: ${error.response.status}`);
    }
    throw new Error(`Failed to scrape URL: ${url}. Unknown error: ${error}`);
  }
}
