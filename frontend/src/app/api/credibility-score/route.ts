import { NextRequest, NextResponse } from 'next/server';
import { getCredibilityScore } from '../../../../backend/src/ai/flows/get-credibility-score';

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

    const result = await getCredibilityScore({ text });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in credibility-score API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
