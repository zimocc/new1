# 🛠️ 开发与规范 (DEVELOPMENT)

## 一、本地开发指南

### 1.1 环境要求
- **Node.js**: v20+ (推荐使用最新 LTS)
- **IDE**: VS Code + Vue Official (Volar) 插件

### 1.2 常用命令
- **安装依赖**: `npm install`
- **启动开发预览**: `npm run dev`
- **构建生产产物**: `npm run build`
- **本地预览构建包**: `npm run preview`

### 1.3 局域网测试
开发服务器启动后，手机可通过 `http://<电脑IP>:5173/` 访问。确保电脑和手机在同一 WiFi 下。

---

## 二、Git 提交规范 ★

本项目严格遵守以下 commit 格式，必须包含前缀和编号列表：

- **feat**: 新功能。
- **upd**: 更新、优化。
- **fix**: 修复 Bug。

**示例格式**:
```text
feat: 1. 添加了新概念英语一册数据
      2. 实现了循环听写模式的逻辑优化
      
fix:  1. 修复了移动端 Modal 弹出时底层滚动的穿透问题
```

---

## 三、部署流程

### 3.1 Cloudflare Pages 部署
1. 推送代码至 GitHub 仓库。
2. 在 Cloudflare 控制台关联项目。
3. **构建配置**:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Functions**: 确保 `functions/` 目录位于根目录，Cloudflare 会自动识别并部署 API。

---

## 四、维护注意事项

- **App.vue 维护**: 由于逻辑集中，修改样式时建议使用搜索定位 CSS 选择器。
- **TTS 代理同步**: 修改 `vite.config.js` 中的代理逻辑时，务必同步更新 `functions/api/` 下对应的脚本。
- **数据一致性**: 转换脚本生成的 `.js` 文件不建议手动修改，应修改原始 `.xlsx` 后重新运行脚本。
