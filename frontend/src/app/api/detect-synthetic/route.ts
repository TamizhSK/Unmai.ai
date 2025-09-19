import { NextRequest, NextResponse } from 'next/server';
import { detectSyntheticContent } from '../../../../backend/src/ai/flows/detect-synthetic-content';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { media, contentType } = body;

    if (!media || !contentType) {
      return NextResponse.json(
        { error: 'Media and contentType are required' },
        { status: 400 }
      );
    }

    const result = await detectSyntheticContent({ 
      media, 
      contentType: contentType as 'image' | 'video' 
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in detect-synthetic API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
