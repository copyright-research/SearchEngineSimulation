import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 检查是否已经通过认证（通过 Cookie）
function isAuthenticated(request: NextRequest): boolean {
  const authCookie = request.cookies.get('replay-auth');
  const validToken = process.env.REPLAY_AUTH_TOKEN;
  
  if (!authCookie || !validToken) {
    return false;
  }
  
  // 验证 token 是否匹配
  return authCookie.value === validToken;
}

export function middleware(request: NextRequest) {
  // 1. 保护 /replay 路径（不包括登录页面）
  if (request.nextUrl.pathname.startsWith('/replay') && 
      !request.nextUrl.pathname.startsWith('/replay/login')) {
    
    // 检查环境变量是否配置
    if (!process.env.REPLAY_AUTH_TOKEN) {
      console.warn('[Middleware] REPLAY_AUTH_TOKEN not configured');
      return NextResponse.next();
    }
    
    // 检查是否已认证
    if (!isAuthenticated(request)) {
      // 重定向到登录页
      const loginUrl = new URL('/replay/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. 强制要求 / 和 /ai 必须带上 RID 参数
  const requireRIDPaths = ['/', '/ai'];
  if (requireRIDPaths.includes(request.nextUrl.pathname)) {
    const rid = request.nextUrl.searchParams.get('RID');
    
    if (!rid) {
      // 没有 RID，返回 403 或重定向到提示页面
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>RID Required</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              border-radius: 16px;
              padding: 48px 40px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              max-width: 500px;
              text-align: center;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 24px;
            }
            h1 {
              color: #1a202c;
              font-size: 28px;
              font-weight: 700;
              margin: 0 0 16px 0;
            }
            p {
              color: #4a5568;
              font-size: 16px;
              line-height: 1.6;
              margin: 0 0 24px 0;
            }
            .example {
              background: #f7fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 16px;
              font-family: 'Monaco', 'Courier New', monospace;
              font-size: 14px;
              color: #2d3748;
              word-break: break-all;
              margin-bottom: 24px;
            }
            .highlight {
              color: #667eea;
              font-weight: 600;
            }
            a {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px 32px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            a:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">🔒</div>
            <h1>Recording ID Required</h1>
            <p>
              This page requires a <span class="highlight">Recording ID (RID)</span> to access. 
              Please include it in the URL.
            </p>
            <div class="example">
              ${request.nextUrl.pathname}?<span class="highlight">RID=session-001</span>
            </div>
            <p style="font-size: 14px; color: #718096;">
              Example: Use any unique identifier like "test-001", "user-session", etc.
            </p>
          </div>
        </body>
        </html>
        `,
        {
          status: 403,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        }
      );
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/ai',
    '/replay/:path*',
  ],
};

