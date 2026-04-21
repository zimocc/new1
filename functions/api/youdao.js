export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 支持 audio 或者 text 参数，为了灵活性
  const text = url.searchParams.get('audio') || url.searchParams.get('text') || '';
  const type = url.searchParams.get('type') || '2'; // 1: 英音, 2: 美音

  const targetUrl = new URL('https://dict.youdao.com/dictvoice');
  targetUrl.searchParams.set('audio', text);
  targetUrl.searchParams.set('type', type);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Referer': 'https://dict.youdao.com/',
        'Origin': 'https://dict.youdao.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
        return new Response('Youdao TTS request failed', { status: response.status });
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
    return new Response('Youdao TTS proxy error: ' + error.message, { status: 502 });
  }
}
