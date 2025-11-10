import { NextResponse } from 'next/server';
import { list } from '@/lib/r2-storage';

/**
 * 获取所有录制列表
 * GET /api/rrweb/list
 */
export async function GET() {
  try {
    // 列出所有录制
    const allBlobs = await list({
      prefix: 'recordings/',
      limit: 1000,
    });

    // 按 recordingId 和 sessionId 分组
    interface RecordingInfo {
      recordingId: string;
      sessionId: string;
      chunksCount: number;
      hasMerged: boolean;
      firstChunkTime?: string;
      lastChunkTime?: string;
      totalEvents?: number;
    }

    const recordingsMap = new Map<string, RecordingInfo>();

    for (const blob of allBlobs.blobs) {
      // 匹配 recordings/{RID}/{sessionId}/chunk-{index}.json
      const chunkMatch = blob.pathname.match(/^recordings\/([^/]+)\/([^/]+)\/chunk-(\d+)\.json$/);
      if (chunkMatch) {
        const [, recordingId, sessionId] = chunkMatch;
        const key = `${recordingId}/${sessionId}`;
        
        if (!recordingsMap.has(key)) {
          recordingsMap.set(key, {
            recordingId,
            sessionId,
            chunksCount: 0,
            hasMerged: false,
            firstChunkTime: blob.uploadedAt ? new Date(blob.uploadedAt).toISOString() : undefined,
          });
        }
        
        const info = recordingsMap.get(key)!;
        info.chunksCount += 1;
        
        // 更新最后一个 chunk 的时间
        if (blob.uploadedAt) {
          const uploadTime = new Date(blob.uploadedAt).toISOString();
          if (!info.lastChunkTime || uploadTime > info.lastChunkTime) {
            info.lastChunkTime = uploadTime;
          }
          if (!info.firstChunkTime || uploadTime < info.firstChunkTime) {
            info.firstChunkTime = uploadTime;
          }
        }
      }

      // 匹配 recordings/{RID}/{sessionId}/merged.json
      const mergedMatch = blob.pathname.match(/^recordings\/([^/]+)\/([^/]+)\/merged\.json$/);
      if (mergedMatch) {
        const [, recordingId, sessionId] = mergedMatch;
        const key = `${recordingId}/${sessionId}`;
        
        if (!recordingsMap.has(key)) {
          recordingsMap.set(key, {
            recordingId,
            sessionId,
            chunksCount: 0,
            hasMerged: true,
            firstChunkTime: blob.uploadedAt ? new Date(blob.uploadedAt).toISOString() : undefined,
          });
        } else {
          recordingsMap.get(key)!.hasMerged = true;
        }
      }
    }

    // 转换为数组并排序（最新的在前）
    const recordings = Array.from(recordingsMap.values()).sort((a, b) => {
      const timeA = a.lastChunkTime || a.firstChunkTime || '';
      const timeB = b.lastChunkTime || b.firstChunkTime || '';
      return timeB.localeCompare(timeA);
    });

    return NextResponse.json({
      success: true,
      count: recordings.length,
      recordings,
    });

  } catch (error) {
    console.error('[rrweb] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list recordings' },
      { status: 500 }
    );
  }
}

