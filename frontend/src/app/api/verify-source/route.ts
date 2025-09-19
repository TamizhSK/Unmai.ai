import { NextRequest, NextResponse } from 'next/server';
import { verifySource } from '../../../../backend/src/ai/flows/verify-source';

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

    const result = await verifySource({ 
      content, 
      contentType: contentType as 'text' | 'url' | 'image' 
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in verify-source API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
