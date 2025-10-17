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
  // 只保护 /replay 路径（不包括登录页面）
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
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/replay/:path*',
  ],
};

