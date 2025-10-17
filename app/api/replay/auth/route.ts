import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // 从环境变量获取正确的密码
    const correctPassword = process.env.REPLAY_AUTH_TOKEN;

    if (!correctPassword) {
      console.error('[Auth API] REPLAY_AUTH_TOKEN not configured');
      return NextResponse.json(
        { error: 'Authentication not configured' },
        { status: 500 }
      );
    }

    // 验证密码
    if (password === correctPassword) {
      // 创建响应
      const response = NextResponse.json(
        { success: true, message: 'Authentication successful' },
        { status: 200 }
      );

      // 设置 Cookie（7天有效期）
      response.cookies.set('replay-auth', correctPassword, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
      } else {
        // 密码错误
        return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('[Auth API] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

// 登出接口
export async function DELETE() {
  const response = NextResponse.json(
    { success: true, message: 'Logged out' },
    { status: 200 }
  );

  // 删除 Cookie
  response.cookies.delete('replay-auth');

  return response;
}

