import { NextRequest, NextResponse } from 'next/server';
import { provideEducationalInsights } from '../../../../backend/src/ai/flows/provide-educational-insights';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const result = await provideEducationalInsights({ text });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in educational-insights API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
