# 🏗️ 技术架构 (ARCHITECTURE)

## 一、技术栈

| 层面 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3 (Composition API + `<script setup>`) | ^3.5.31 |
| 构建工具 | Vite | ^8.0.3 |
| 状态管理 | Pinia | ^3.0.4 |
| 路由 | Vue Router | ^5.0.4 |
| 数据转换 | SheetJS (xlsx) | ^0.18.5 |
| 部署平台 | Cloudflare Pages + Functions | — |
| Node 要求 | ^20.19.0 \|\| >=22.12.0 | — |

---

## 二、目录结构

```
new1/
├── index.html                   # SPA 入口 HTML
├── vite.config.js               # Vite 配置（含 4 个 TTS 代理规则）
├── package.json
├── .gitignore
│
├── src/
│   ├── main.js                  # Vue 应用挂载入口
│   ├── App.vue                  # ★ 核心单文件组件（~1100 行，含模板+样式）
│   ├── router/
│   │   └── index.js             # Vue Router（当前无实际路由，SPA 单页）
│   ├── stores/
│   │   └── counter.js           # Pinia Store 模板（未实际使用）
│   └── data/
│       ├── nce1.js              # 新概念英语一册词汇数据
│       ├── 1Ans.js              # 一年级上册(新启航)
│       ├── 1Bns.js              # 一年级下册(新启航)
│       ├── 3A.js                # 三年级上册(人教PEP)
│       ├── 3B.js                # 三年级下册(人教PEP)
│       ├── NCE/                 # 新概念 Excel 原始数据
│       ├── primary-school-new-start/  # 小学新启航 Excel 原始数据
│       ├── primary-school-peb/        # 小学人教PEP Excel 原始数据
│       └── generate-data/       # 数据转换脚本
│           ├── convertCsv.js    # CSV → JS 转换器
│           ├── convertExcel.js  # Excel → JS 转换器（Lesson 模式）
│           └── convertExcelUnit.js  # Excel → JS 转换器（Unit 模式）
│
├── functions/
│   └── api/                     # Cloudflare Pages Functions
│       ├── tts.js               # 百度翻译 TTS 代理
│       ├── youdao.js            # 有道词典 TTS 代理
│       ├── google.js            # Google 牛津静态音频代理
│       └── google_dy.js         # Google 动态翻译 TTS 代理
│
├── public/
│   ├── favicon.ico
│   └── favicon1.ico
│
└── dist/                        # 构建产物（.gitignore）
```

---

## 三、架构特征

### 3.1 单文件组件集中式架构

整个应用的业务逻辑、模板和样式全部集中在 `src/App.vue` 中（约 1137 行），没有拆分子组件。

**原因**:
- 应用功能单一，页面结构简单
- 避免组件间复杂通信
- 所有状态为局部 ref，无跨组件共享需求

**后续拆分建议**:
- 若功能增长，可抽取: `WordCard.vue`, `DictationController.vue`, `LessonModal.vue`, `TextbookModal.vue`, `HelpModal.vue`

### 3.2 无实际路由

`Vue Router` 已集成但 `routes: []` 为空。当前为纯 SPA 单页，所有导航通过组件内 `ref` 状态切换。

### 3.3 Pinia Store 未实际使用

`stores/counter.js` 为脚手架默认生成，未在业务中使用。所有状态通过 `<script setup>` 中的 `ref/computed` 管理。

### 3.4 双环境 TTS 代理

| 环境 | 代理实现 |
|------|----------|
| 本地开发 | `vite.config.js` 中的 `server.proxy` 规则 |
| 线上生产 | `functions/api/*.js` — Cloudflare Pages Functions |

两套实现需保持 URL 路径 `/api/tts`, `/api/youdao`, `/api/google`, `/api/google_dy` 一致。

---

## 四、关键设计决策

1. **全局唯一 Audio 实例**: 使用 `new Audio()` 创建单例 `globalAudio`，避免移动端浏览器自动播放策略导致定时器内部创建的 Audio 被静音。
2. **相对路径 base**: `vite.config.js` 中 `base: './'`，兼容 Cloudflare Pages 子目录部署和 Live Server 本地预览。
3. **LocalStorage 持久化**: 以 `${textbookId}_progress_lesson` / `${textbookId}_progress_word` 为 key，支持多教材独立进度。
4. **LAN 访问**: `server.host: '0.0.0.0'`，允许手机等局域网设备通过 IP 直接访问开发服务器测试。
