import { NextRequest, NextResponse } from 'next/server';
import { analyzeContentForMisinformation } from '../../../../backend/src/ai/flows/analyze-content-for-misinformation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const result = await analyzeContentForMisinformation({ content });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in analyze-misinformation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
