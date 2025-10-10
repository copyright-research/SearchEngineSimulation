import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response('Prompt is required', { status: 400 });
    }

    console.log('====== Request ======');
    console.log('Prompt:', prompt);
    console.log('=====================');

    const result = streamText({
      model: google('gemini-2.5-flash'),
      prompt,
      temperature: 0.7,
      onFinish: ({ text, finishReason, usage }) => {
        console.log('====== Response ======');
        console.log('Finish Reason:', finishReason);
        console.log('Usage:', usage);
        console.log('Full Text:', text);
        console.log('======================');
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Test Gemini error:', error);
    return new Response('Error testing Gemini', { status: 500 });
  }
}
