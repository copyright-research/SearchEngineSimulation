// 简单的内存 Rate Limiter（适合小规模应用）
// 如果需要更强大的方案，可以用 Upstash Redis

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// 清理过期的记录（每小时清理一次）
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 60 * 60 * 1000);

interface RateLimitConfig {
  interval: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
}

export function rateLimit(config: RateLimitConfig) {
  return {
    check: (identifier: string): { success: boolean; remaining: number; resetTime: number } => {
      const now = Date.now();
      const key = identifier;

      if (!store[key] || store[key].resetTime < now) {
        // 初始化或重置
        store[key] = {
          count: 1,
          resetTime: now + config.interval,
        };
        return {
          success: true,
          remaining: config.maxRequests - 1,
          resetTime: store[key].resetTime,
        };
      }

      // 检查是否超过限制
      if (store[key].count >= config.maxRequests) {
        return {
          success: false,
          remaining: 0,
          resetTime: store[key].resetTime,
        };
      }

      // 增加计数
      store[key].count++;
      return {
        success: true,
        remaining: config.maxRequests - store[key].count,
        resetTime: store[key].resetTime,
      };
    },
  };
}

// 获取客户端 IP（支持 Vercel 和其他平台）
export function getClientIp(request: Request): string {
  // Vercel 提供的真实 IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // 其他代理
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // 默认
  return 'unknown';
}
