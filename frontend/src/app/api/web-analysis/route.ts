import { NextRequest, NextResponse } from 'next/server';
import { performWebAnalysis } from '../../../../backend/src/ai/flows/perform-web-analysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, contentType } = body;

    if (!query || !contentType) {
      return NextResponse.json(
        { error: 'Query and contentType are required' },
        { status: 400 }
      );
    }

    const result = await performWebAnalysis({ 
      query, 
      contentType: contentType as 'text' | 'url' 
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in web-analysis API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
