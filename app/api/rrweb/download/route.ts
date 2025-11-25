import { NextRequest, NextResponse } from 'next/server';
import { get } from '@/lib/r2-storage';

/**
 * 代理下载 rrweb 录制文件
 * GET /api/rrweb/download?path=recordings/xxx/yyy/chunk-0.json
 * 
 * 这个端点解决了直接访问 R2 URL 的 CORS 和权限问题
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'Missing path parameter' },
        { status: 400 }
      );
    }

    // 验证路径格式（安全检查）
    if (!path.startsWith('recordings/') || path.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }

    // 从 R2 获取文件
    const file = await get(path);

    // 返回文件内容
    return new NextResponse(file.body, {
      status: 200,
      headers: {
        'Content-Type': file.contentType || 'application/json',
        'Cache-Control': 'public, max-age=3600', // 缓存 1 小时
      },
    });

  } catch (error) {
    console.error('[rrweb] Download error:', error);
    
    // 如果是 NoSuchKey 错误，返回 404
    if (error && typeof error === 'object' && (error as any).name === 'NoSuchKey') {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to download file',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


