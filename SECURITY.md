# 🔒 Security Configuration Guide

## 已实施的安全措施

### 1. ✅ Rate Limiting（速率限制）
**位置**: `lib/rate-limit.ts` + `app/api/search/route.ts`

**配置**:
- 每个 IP 每小时最多 30 次请求
- 基于内存的简单实现（适合小规模应用）

**调整方法**:
```typescript
// 在 app/api/search/route.ts 中修改
const limiter = rateLimit({
  interval: 60 * 60 * 1000, // 时间窗口（毫秒）
  maxRequests: 30,          // 最大请求数
});
```

**推荐配置**:
- 开发/测试: 100 次/小时
- 小规模生产: 30 次/小时
- 中等规模: 50 次/小时

---

### 2. ✅ 输入验证
- 查询长度限制: 最多 200 字符
- 必填参数检查
- 防止注入攻击

---

### 3. ✅ API Key 保护
- API Key 存储在服务端环境变量
- 前端永远不直接访问 Google API
- 通过 Next.js API Routes 代理

---

### 4. ✅ HTTP 安全头
**位置**: `vercel.json`

已配置:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## Vercel 平台层面配置

### 推荐启用的功能

#### 1. **Vercel Firewall** (Pro 计划)
- DDoS 防护
- 地理位置限制
- IP 黑白名单

#### 2. **Vercel Analytics**
- 监控异常流量
- 识别滥用模式

#### 3. **Environment Variables Protection**
已配置 `.env.local`（不会提交到 Git）

部署时在 Vercel Dashboard 配置:
```
Settings > Environment Variables
- GOOGLE_API_KEY
- GOOGLE_SEARCH_ENGINE_ID
```

---

## 升级方案（如果需要更强防护）

### 方案 A: Upstash Redis Rate Limiting
**适合**: 多实例部署、更精确的限流

```bash
npm install @upstash/ratelimit @upstash/redis
```

**优势**:
- 跨实例共享状态
- 更精确的限流
- 持久化存储

**成本**: Upstash 免费套餐足够

---

### 方案 B: Vercel Edge Config
**适合**: 动态黑名单、配置热更新

**用途**:
- 实时封禁恶意 IP
- 动态调整限流参数
- 无需重新部署

---

### 方案 C: Cloudflare 前置
**适合**: 需要企业级防护

**功能**:
- 强大的 DDoS 防护
- Bot 检测
- 全球 CDN
- 免费套餐即可

---

## 监控和告警

### Google Cloud Console
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 导航到 **APIs & Services > Dashboard**
3. 查看 Custom Search API 使用量
4. 设置配额告警:
   - **APIs & Services > Quotas**
   - 设置每日限额（建议 80 次/天，留 20% 缓冲）

### Vercel Dashboard
1. 查看 **Analytics** 了解流量模式
2. 查看 **Logs** 识别异常请求
3. 设置 **Notifications** 接收告警

---

## 紧急响应

### 如果发现滥用

#### 1. 立即限制
修改 `app/api/search/route.ts`:
```typescript
const limiter = rateLimit({
  interval: 60 * 60 * 1000,
  maxRequests: 10, // 临时降低到 10
});
```

#### 2. 临时关闭 API
在 `app/api/search/route.ts` 顶部添加:
```typescript
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Service temporarily unavailable' },
    { status: 503 }
  );
}
```

#### 3. 重新生成 API Key
1. 访问 Google Cloud Console
2. 删除旧的 API Key
3. 创建新的 API Key
4. 更新 Vercel 环境变量
5. 重新部署

---

## 成本估算

### Google Custom Search API
- 免费: 100 次/天
- 付费: $5 / 1,000 次查询

### 当前配置下的最大成本
- 限流: 30 次/小时/IP
- 假设 10 个独立用户: 300 次/小时 = 7,200 次/天
- **远超免费额度，需要付费约 $360/天**

### 建议
如果担心成本，建议:
1. 降低限流到 10 次/小时/IP
2. 添加每日总量限制
3. 考虑添加简单的用户认证

---

## 添加每日总量限制（推荐）

修改 `lib/rate-limit.ts` 添加全局限制:

```typescript
// 全局每日限制（所有用户共享）
const globalLimiter = rateLimit({
  interval: 24 * 60 * 60 * 1000, // 24 小时
  maxRequests: 90, // 预留 10 次缓冲
});

// 在 route.ts 中先检查全局限制
const globalCheck = globalLimiter.check('global');
if (!globalCheck.success) {
  return NextResponse.json(
    { error: 'Daily quota exceeded. Please try again tomorrow.' },
    { status: 429 }
  );
}
```

---

## 总结

✅ **已实施**: Rate Limiting + 输入验证 + API Key 保护  
🔄 **推荐**: 添加每日总量限制  
💰 **成本控制**: 当前配置下需要监控使用量  
🚨 **紧急**: 可以随时降低限流或关闭 API

需要我帮你实现每日总量限制吗？
