# Copyright Search - 配置指南

## 🚀 快速开始

### 1. 配置 Google Custom Search API

#### 获取 API Key

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Custom Search API**
   - 导航到 "APIs & Services" > "Library"
   - 搜索 "Custom Search API"
   - 点击 "Enable"
4. 创建 API 凭据
   - 导航到 "APIs & Services" > "Credentials"
   - 点击 "Create Credentials" > "API Key"
   - 复制生成的 API Key

#### 创建自定义搜索引擎

1. 访问 [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. 点击 "Get Started" 或 "Add"
3. 配置搜索引擎：
   - **搜索范围**：选择 "Search the entire web"（搜索整个网络）
   - **名称**：给搜索引擎起个名字
   - 点击 "Create"
4. 在搜索引擎设置页面，复制 **Search Engine ID** (cx)

### 2. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```bash
GOOGLE_API_KEY=你的_API_Key
GOOGLE_SEARCH_ENGINE_ID=你的_Search_Engine_ID
```

**注意**：`.env.local` 文件已添加到 `.gitignore`，不会被提交到 Git。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 📊 免费配额

Google Custom Search API 免费配额：
- **每天 100 次查询**
- 超出配额后需要付费
- 对于日访问几十次的小规模应用完全够用

## 🎨 功能特性

✅ 现代化 UI 设计
✅ 响应式布局（移动端友好）
✅ 实时搜索反馈
✅ 键盘快捷键（`/` 聚焦搜索框）
✅ 搜索结果缩略图展示
✅ 搜索时间和结果数统计
✅ 优雅的加载动画
✅ 错误处理

## 🔧 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS v4
- **API**: Google Custom Search API
- **部署**: 推荐 Vercel

## 📦 部署到 Vercel

1. 将代码推送到 GitHub
2. 访问 [Vercel](https://vercel.com/)
3. 导入 GitHub 仓库
4. 在 "Environment Variables" 中添加：
   - `GOOGLE_API_KEY`
   - `GOOGLE_SEARCH_ENGINE_ID`
5. 点击 Deploy

## 🎯 自定义搜索范围（可选）

如果你想限制搜索范围（例如只搜索特定网站）：

1. 返回 [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. 选择你的搜索引擎
3. 在 "Sites to search" 中：
   - 添加特定网站域名
   - 或保持 "Search the entire web" 搜索全网

## 💡 提示

- 搜索框支持键盘快捷键 `/` 快速聚焦
- 按 `Esc` 可以取消焦点
- 搜索结果会显示缩略图（如果可用）
- 搜索时间和结果数会实时显示

## 🐛 常见问题

### API Key 不工作？

1. 确认 Custom Search API 已启用
2. 检查 API Key 是否有使用限制
3. 确认环境变量配置正确（需要重启开发服务器）

### 超出配额？

- 免费版每天 100 次查询
- 考虑添加客户端缓存减少 API 调用
- 或升级到付费计划

### 搜索结果为空？

- 检查 Search Engine ID 是否正确
- 确认搜索引擎配置为搜索整个网络
- 尝试不同的搜索关键词

---

**Enjoy searching! 🔍**
