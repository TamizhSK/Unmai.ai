import { NextRequest, NextResponse } from 'next/server';
import { detectDeepfake } from '../../../../backend/src/ai/flows/detect-deepfake';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { media, contentType, sourceCredibility } = body;

    if (!media || !contentType) {
      return NextResponse.json(
        { error: 'Media and contentType are required' },
        { status: 400 }
      );
    }

    const result = await detectDeepfake({ 
      media, 
      contentType: contentType as 'image' | 'video' 
    }, sourceCredibility);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in detect-deepfake API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
