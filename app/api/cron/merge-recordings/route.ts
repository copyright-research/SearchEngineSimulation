import { NextRequest, NextResponse } from 'next/server';
import { list, put, del } from '@vercel/blob';
import type { eventWithTime } from '@rrweb/types';

/**
 * Cron Job: 定期合并 rrweb 录制的 chunks
 * GET /api/cron/merge-recordings
 * 
 * 配置: vercel.json 中设置定时触发
 * 认证: 通过 CRON_SECRET 环境变量验证
 */
export async function GET(request: NextRequest) {
  try {
    // 验证 Cron Secret
    const authHeader = request.headers.get('Authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!process.env.CRON_SECRET) {
      console.error('[Cron] CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== expectedAuth) {
      console.error('[Cron] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Starting recording merge job...');

    // 列出所有录制（查找所有 chunk 文件的目录）
    const allBlobs = await list({
      prefix: 'recordings/',
      limit: 1000,
    });

    // 按 recordingId + sessionId 分组
    const sessionGroups = new Map<string, typeof allBlobs.blobs>();
    
    for (const blob of allBlobs.blobs) {
      // 提取 recordingId 和 sessionId: recordings/{RID}/{sessionId}/chunk-{index}.json
      const match = blob.pathname.match(/^recordings\/([^/]+)\/([^/]+)\/chunk-\d+\.json$/);
      if (match) {
        const recordingId = match[1];
        const sessionId = match[2];
        const key = `${recordingId}/${sessionId}`;
        if (!sessionGroups.has(key)) {
          sessionGroups.set(key, []);
        }
        sessionGroups.get(key)!.push(blob);
      }
    }

    console.log(`[Cron] Found ${sessionGroups.size} sessions to process`);

    const results = [];

    // 处理每个 session
    for (const [key, chunks] of sessionGroups.entries()) {
      const [recordingId, sessionId] = key.split('/');
      
      try {
        // 检查是否已经有 merged 文件
        const mergedList = await list({
          prefix: `recordings/${recordingId}/${sessionId}/merged.json`,
          limit: 1,
        });

        if (mergedList.blobs.length > 0) {
          console.log(`[Cron] ${recordingId}/${sessionId}: Already merged, skipping`);
          results.push({
            recordingId,
            sessionId,
            status: 'skipped',
            reason: 'already_merged',
          });
          continue;
        }

        // 检查是否有足够的 chunks (至少 2 个)
        if (chunks.length < 2) {
          console.log(`[Cron] ${recordingId}/${sessionId}: Only ${chunks.length} chunk(s), skipping`);
          results.push({
            recordingId,
            sessionId,
            status: 'skipped',
            reason: 'insufficient_chunks',
            chunksCount: chunks.length,
          });
          continue;
        }

        console.log(`[Cron] ${recordingId}/${sessionId}: Merging ${chunks.length} chunks...`);

        // 按 chunkIndex 排序
        const sortedChunks = chunks.sort((a, b) => {
          // 格式: chunk-{index}.json
          const matchA = a.pathname.match(/chunk-(\d+)\.json$/);
          const matchB = b.pathname.match(/chunk-(\d+)\.json$/);
          const indexA = parseInt(matchA?.[1] || '0');
          const indexB = parseInt(matchB?.[1] || '0');
          return indexA - indexB;
        });

        // 下载并合并所有 chunks
        const allEvents: eventWithTime[] = [];
        
        for (const chunk of sortedChunks) {
          const chunkResponse = await fetch(chunk.url);
          const chunkData = await chunkResponse.json();
          
          if (chunkData.events && Array.isArray(chunkData.events)) {
            allEvents.push(...chunkData.events);
          }
        }

        if (allEvents.length === 0) {
          console.log(`[Cron] ${recordingId}/${sessionId}: No events found, skipping`);
          results.push({
            recordingId,
            sessionId,
            status: 'failed',
            reason: 'no_events',
          });
          continue;
        }

        // 创建 merged 文件
        const mergedData = {
          recordingId,
          sessionId,
          events: allEvents,
          mergedAt: new Date().toISOString(),
          chunksCount: chunks.length,
          totalEvents: allEvents.length,
        };

        const mergedBlob = await put(
          `recordings/${recordingId}/${sessionId}/merged.json`,
          JSON.stringify(mergedData),
          {
            access: 'public',
            contentType: 'application/json',
          }
        );

        console.log(`[Cron] ${recordingId}/${sessionId}: Merged ${allEvents.length} events`);

        // 可选: 删除旧的 chunks 以节省存储空间
        // 取消注释以启用自动删除
        /*
        for (const chunk of sortedChunks) {
          await del(chunk.url);
        }
        console.log(`[Cron] ${recordingId}/${sessionId}: Deleted ${chunks.length} chunks`);
        */

        results.push({
          recordingId,
          sessionId,
          status: 'success',
          chunksCount: chunks.length,
          totalEvents: allEvents.length,
          mergedUrl: mergedBlob.url,
        });

      } catch (error) {
        console.error(`[Cron] ${recordingId}/${sessionId}: Merge failed:`, error);
        results.push({
          recordingId,
          sessionId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('[Cron] Merge job completed');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sessionsProcessed: sessionGroups.size,
      results,
    });

  } catch (error) {
    console.error('[Cron] Job failed:', error);
    return NextResponse.json(
      { 
        error: 'Merge job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

