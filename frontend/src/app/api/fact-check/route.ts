import { NextRequest, NextResponse } from 'next/server';
import { factCheckClaim } from '../../../../backend/src/ai/flows/fact-check-claim';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claim } = body;

    if (!claim) {
      return NextResponse.json(
        { error: 'Claim is required' },
        { status: 400 }
      );
    }

    const result = await factCheckClaim({ claim });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in fact-check API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
