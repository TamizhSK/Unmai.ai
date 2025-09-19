import { NextRequest, NextResponse } from 'next/server';
import { safeSearchUrl } from '../../../../backend/src/ai/flows/safe-search-url';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const result = await safeSearchUrl({ url });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in safe-search API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
