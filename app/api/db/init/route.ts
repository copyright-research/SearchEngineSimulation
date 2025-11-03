import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db-adapter';

/**
 * 初始化数据库表结构
 * GET /api/db/init
 * 
 * 注意：这个端点应该只在首次部署时调用一次
 * 在生产环境中，建议添加认证保护
 */
export async function GET(request: NextRequest) {
  try {
    // 简单的安全检查：只在开发环境或有特定密钥时允许
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET || 'dev-only';
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await initDatabase();

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

