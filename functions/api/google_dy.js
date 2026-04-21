export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const text = url.searchParams.get('text') || url.searchParams.get('audio') || '';
  if (!text) {
      return new Response('Missing text', { status: 400 });
  }

  // 建设 Google Dynamic TTS 请求URL
  const targetUrl = new URL('https://translate.google.com/translate_tts');
  targetUrl.searchParams.set('ie', 'UTF-8');
  targetUrl.searchParams.set('client', 'tw-ob');
  targetUrl.searchParams.set('tl', 'en-US');
  targetUrl.searchParams.set('q', text);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
        return new Response('Google Dynamic TTS request failed', { status: response.status });
    }

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*'); 
    
    if (!newHeaders.has('Content-Type')) {
        newHeaders.set('Content-Type', 'audio/mpeg');
    }
    
    newHeaders.set('Cache-Control', 'public, max-age=86400');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });

  } catch (error) {
    return new Response('Google Dynamic TTS proxy error: ' + error.message, { status: 502 });
  }
}
