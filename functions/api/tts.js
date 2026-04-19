// Cloudflare Pages Function 代理
// 部署到 Cloudflare Pages 时，该文件会自动将其作为 Serverless 接口暴露在 /api/tts 路径下
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 获取请求参数并拼接到百度的网关
  const targetUrl = new URL('https://fanyi.baidu.com/gettts');
  targetUrl.search = url.search;

  try {
    // 发起 Fetch 请求到百度，必须戴上它需要的防盗链 Headers
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Referer': 'https://fanyi.baidu.com/',
        'Origin': 'https://fanyi.baidu.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
        return new Response('TTS request failed', { status: response.status });
    }

    // 透传原始数据以及所需的 Headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*'); 
    
    // 如果百度没有给 Content-Type，我们最好显式补齐给浏览器识别为 Audio
    if (!newHeaders.has('Content-Type')) {
        newHeaders.set('Content-Type', 'audio/mpeg');
    }
    
    // 配置边缘节点缓存，避免同一个单词触发无意义的流量消耗
    newHeaders.set('Cache-Control', 'public, max-age=86400');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });

  } catch (error) {
    return new Response('TTS proxy error: ' + error.message, { status: 502 });
  }
}
