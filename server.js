/**
 * 生产环境服务器
 * 功能：1. 托管 dist 静态文件  2. 代理百度 TTS 语音接口
 * 
 * 使用方式：
 *   npm run build     # 先构建前端
 *   node server.js    # 启动生产服务器
 */

import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// ========== 百度 TTS 代理（直接转发，无中间件兼容性问题） ==========
app.get('/api/tts', async (req, res) => {
  try {
    const { lan, text, spd } = req.query
    const url = `https://fanyi.baidu.com/gettts?lan=${lan || 'en'}&text=${encodeURIComponent(text || '')}&spd=${spd || 3}`

    const response = await fetch(url, {
      headers: {
        Referer: 'https://fanyi.baidu.com/',
        Origin: 'https://fanyi.baidu.com',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      return res.status(response.status).send('TTS request failed')
    }

    // 设置正确的音频 Content-Type
    res.set('Content-Type', response.headers.get('content-type') || 'audio/mpeg')
    res.set('Cache-Control', 'public, max-age=86400') // 缓存 1 天

    // 将百度返回的音频流直接管道转发给客户端
    const arrayBuffer = await response.arrayBuffer()
    res.send(Buffer.from(arrayBuffer))
  } catch (err) {
    console.error('[TTS Proxy Error]', err.message)
    res.status(502).send('TTS proxy error')
  }
})

// ========== 静态文件托管 ==========
app.use(express.static(join(__dirname, 'dist')))

// SPA 回退：所有未匹配路由返回 index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// ========== 启动服务 ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🚀 生产服务器已启动！`)
  console.log(`  ➜  本地访问:   http://localhost:${PORT}/`)
  console.log(`  ➜  局域网访问: http://0.0.0.0:${PORT}/\n`)
})
