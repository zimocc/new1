export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 支持 text 参数
  const text = url.searchParams.get('text') || url.searchParams.get('audio') || '';
  if (!text) {
      return new Response('Missing text', { status: 400 });
  }

  // 构建目标URL: https://ssl.gstatic.com/dictionary/static/sounds/oxford/xxx--_us_1.mp3
  // 静态词典文件通常为全小写，且单词中不能含有奇怪特殊符号，但原样保留
  let word = text.toLowerCase().trim();
  // 空格替换成下划线这种处理在这个静态源不一定支持（该源主要是单字），
  // 但我们可以直接拼接，如果获取不到 404，由前端接管回退。
  const targetUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(word)}--_us_1.mp3`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
        return new Response('Google Static TTS request failed', { status: response.status });
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
    return new Response('Google Static TTS proxy error: ' + error.message, { status: 502 });
  }
}
