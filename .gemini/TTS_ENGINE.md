# 🔊 语音引擎架构 (TTS ENGINE)

## 一、双环境代理设计

为了解决 TTS API 的跨域限制（CORS）和防盗链（Referer 校验），项目采用了双环境代理方案。

### 1.1 开发环境 (Vite Proxy)
在 `vite.config.js` 中配置 `server.proxy`：
- **/api/tts**: 转发至百度翻译 (`fanyi.baidu.com`)。
- **/api/youdao**: 转发至有道词典 (`dict.youdao.com`)。
- **/api/google**: 转发至 Google 静态资源 (`ssl.gstatic.com`)。
- **/api/google_dy**: 转发至 Google 翻译 (`translate.google.com`)。

### 1.2 生产环境 (Cloudflare Functions)
在 `functions/api/` 目录下实现 Serverless 接口：
- **tts.js**, **youdao.js**, **google.js**, **google_dy.js**。
- **核心逻辑**: 手动伪造请求头（UA, Origin, Referer），并透传音频流 Body。
- **优化**: 设置 `Cache-Control: public, max-age=86400`，使 Cloudflare 边缘节点缓存音频，节省流量。

---

## 二、自动降级链路 (Fallback Mechanism) ★

应用内置了高度稳健的发音逻辑，当某个引擎不可用时会自动尝试下一个。

### 2.1 链路顺序
1. **Youdao (美音)**: `type=2`。
2. **Google Dynamic**: 动态合成。
3. **Baidu**: `lan=en&spd=3`。
4. **Google Static**: 仅限单词，匹配牛津词典静态库。

### 2.2 实现细节
- **全局实例**: 始终操作同一个 `new Audio()` 实例，防止因动态创建 Audio 被手机浏览器策略拦截。
- **错误捕获**: 监听 `error` 事件和 `play()` Promise 的 `catch`。
- **静音预防**: 如果捕获到 `NotAllowedError`（用户未交互），则主动终止链路并重置状态，避免静音循环消耗 API。

---

## 三、API 参数说明

### 3.1 百度代理 (`/api/tts`)
- `lan`: 语言 (`en` / `zh`)
- `text`: 要朗读的文本
- `spd`: 速度 (1-9)

### 3.2 有道代理 (`/api/youdao`)
- `audio`: 要朗读的文本
- `type`: 1 为英音，2 为美音

### 3.3 Google 动态代理 (`/api/google_dy`)
- `text`: 要朗读的文本
- 默认：`client=tw-ob`, `tl=en-US`
