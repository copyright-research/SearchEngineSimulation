import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

/**
 * 上传 rrweb 录制的增量事件
 * POST /api/rrweb/upload
 * Body: { recordingId: string, events: eventWithTime[], chunkIndex: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { recordingId, sessionId, events, chunkIndex } = await request.json();

    // 验证参数
    if (!recordingId || !sessionId || !events || typeof chunkIndex !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: recordingId, sessionId, events, chunkIndex' },
        { status: 400 }
      );
    }

    // 验证 events 是否为数组
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Events must be a non-empty array' },
        { status: 400 }
      );
    }

    // 构建 blob 路径：recordings/{RID}/{sessionId}/chunk-{index}.json
    // 每个 session 有独立的目录，不会冲突
    const blobPath = `recordings/${recordingId}/${sessionId}/chunk-${chunkIndex}.json`;
    
    // 允许覆盖（当刷新页面或重新上传时）
    const blob = await put(blobPath, JSON.stringify({
      recordingId,
      sessionId,
      chunkIndex,
      eventsCount: events.length,
      events,
      uploadedAt: new Date().toISOString(),
    }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      // 如果文件已存在就报错，不允许覆盖
      // 这样可以检测到重复上传的问题
    });

    console.log(`[rrweb] Uploaded chunk ${chunkIndex} for ${recordingId}: ${blob.url}`);

    return NextResponse.json({
      success: true,
      chunkIndex,
      url: blob.url,
      eventsCount: events.length,
    });

  } catch (error) {
    console.error('[rrweb] Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload recording chunk' },
      { status: 500 }
    );
  }
}

/**
 * 获取录制的所有 sessions
 * GET /api/rrweb/upload?recordingId=xxx
 * GET /api/rrweb/upload?recordingId=xxx&sessionId=yyy (获取特定 session)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recordingId = searchParams.get('recordingId');
    const sessionId = searchParams.get('sessionId');

    if (!recordingId) {
      return NextResponse.json(
        { error: 'Missing recordingId parameter' },
        { status: 400 }
      );
    }

    const { list } = await import('@vercel/blob');

    // 如果指定了 sessionId，返回该 session 的数据
    if (sessionId) {
      // 首先尝试查找 merged 文件
      const mergedList = await list({
        prefix: `recordings/${recordingId}/${sessionId}/merged.json`,
        limit: 1,
      });

      if (mergedList.blobs.length > 0) {
        return NextResponse.json({
          type: 'merged',
          url: mergedList.blobs[0].url,
          sessionId,
        });
      }

      // 否则，返回所有 chunks
      const chunksList = await list({
        prefix: `recordings/${recordingId}/${sessionId}/chunk-`,
        limit: 1000,
      });

      if (chunksList.blobs.length === 0) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      // 按 chunkIndex 排序
      const sortedChunks = chunksList.blobs
        .sort((a, b) => {
          const matchA = a.pathname.match(/chunk-(\d+)\.json$/);
          const matchB = b.pathname.match(/chunk-(\d+)\.json$/);
          const indexA = parseInt(matchA?.[1] || '0');
          const indexB = parseInt(matchB?.[1] || '0');
          return indexA - indexB;
        })
        .map(blob => blob.url);

      return NextResponse.json({
        type: 'chunks',
        urls: sortedChunks,
        count: sortedChunks.length,
        sessionId,
      });
    }

    // 如果没有指定 sessionId，返回所有 sessions
    const allBlobs = await list({
      prefix: `recordings/${recordingId}/`,
      limit: 1000,
    });

    if (allBlobs.blobs.length === 0) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // 提取所有 sessionId
    const sessionsSet = new Set<string>();
    for (const blob of allBlobs.blobs) {
      // 匹配: recordings/{RID}/{sessionId}/...
      const match = blob.pathname.match(/^recordings\/[^/]+\/([^/]+)\//);
      if (match) {
        sessionsSet.add(match[1]);
      }
    }

    const sessions = Array.from(sessionsSet).sort().reverse(); // 最新的在前

    return NextResponse.json({
      type: 'sessions',
      recordingId,
      sessions,
      count: sessions.length,
    });

  } catch (error) {
    console.error('[rrweb] Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recording' },
      { status: 500 }
    );
  }
}

