import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudioFlow } from '../../../../backend/src/ai/flows/transcribe-audio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioData } = body;

    if (!audioData) {
      return NextResponse.json(
        { error: 'Audio data is required' },
        { status: 400 }
      );
    }

    const result = await transcribeAudioFlow({ audioData });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in transcribe-audio API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
