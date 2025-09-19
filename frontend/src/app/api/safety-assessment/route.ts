import { NextRequest, NextResponse } from 'next/server';
import { assessSafety } from '../../../../backend/src/ai/flows/safety-assessment';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, contentType } = body;

    if (!content || !contentType) {
      return NextResponse.json(
        { error: 'Content and contentType are required' },
        { status: 400 }
      );
    }

    const result = await assessSafety({ 
      content, 
      contentType: contentType as 'text' | 'url' | 'image' 
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in safety-assessment API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
