import { NextRequest, NextResponse } from 'next/server';
import { searchGoogle } from '@/lib/google-search';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// 全局每日限制（保护 Google API 免费额度）
// Google 免费额度: 100 次/天，这里设置 90 次保留缓冲
const globalLimiter = rateLimit({
  interval: 24 * 60 * 60 * 1000, // 24 小时
  maxRequests: 90, // 90 次请求/天
});

// 单个 IP 限制（防止单个用户滥用）
// 每个 IP 每小时最多 10 次请求
const ipLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 小时
  maxRequests: 10, // 10 次请求
});

export async function GET(request: NextRequest) {
  try {
    // 1. 全局每日限制检查（优先）
    const globalCheck = globalLimiter.check('global');
    if (!globalCheck.success) {
      const resetDate = new Date(globalCheck.resetTime);
      return NextResponse.json(
        {
          error: 'Daily quota exceeded. Service will reset tomorrow.',
          resetAt: resetDate.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Global': 'exceeded',
            'X-RateLimit-Reset': resetDate.toISOString(),
          },
        }
      );
    }

    // 2. 单个 IP 限制检查
    const clientIp = getClientIp(request);
    const ipCheck = ipLimiter.check(clientIp);

    if (!ipCheck.success) {
      const resetDate = new Date(ipCheck.resetTime);
      return NextResponse.json(
        {
          error: 'Too many requests from your IP. Please try again later.',
          resetAt: resetDate.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
            'Retry-After': Math.ceil((ipCheck.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 3. 验证查询参数
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const start = searchParams.get('start');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // 4. 查询长度限制（防止恶意超长查询）
    if (query.length > 200) {
      return NextResponse.json(
        { error: 'Search query is too long (max 200 characters)' },
        { status: 400 }
      );
    }

    const startIndex = start ? parseInt(start, 10) : 1;

    // 5. 执行搜索
    const results = await searchGoogle(query, startIndex);

    // 6. 返回结果，带上 Rate Limit 信息
    return NextResponse.json(results, {
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': ipCheck.remaining.toString(),
        'X-RateLimit-Reset': new Date(ipCheck.resetTime).toISOString(),
        'X-RateLimit-Global-Remaining': globalCheck.remaining.toString(),
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An error occurred while searching',
      },
      { status: 500 }
    );
  }
}
