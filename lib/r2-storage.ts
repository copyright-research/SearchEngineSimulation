import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

// 初始化 R2 客户端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET || '';

// 验证环境变量
function validateR2Config() {
  if (!process.env.R2_ENDPOINT) {
    throw new Error('R2_ENDPOINT environment variable is not set');
  }
  if (!process.env.R2_ACCESS_KEY_ID) {
    throw new Error('R2_ACCESS_KEY_ID environment variable is not set');
  }
  if (!process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_SECRET_ACCESS_KEY environment variable is not set');
  }
  if (!BUCKET_NAME) {
    throw new Error('R2_BUCKET environment variable is not set');
  }
}

/**
 * 上传文件到 R2
 * @param path 文件路径（类似 Vercel Blob 的 pathname）
 * @param content 文件内容（字符串或 Buffer）
 * @param options 上传选项
 * @returns 上传结果，包含 URL 和其他元数据
 */
export async function put(
  path: string,
  content: string | Buffer,
  options?: {
    access?: 'public' | 'private';
    contentType?: string;
    addRandomSuffix?: boolean;
  }
) {
  try {
    validateR2Config();

    // 处理路径
    const finalPath = path;
    // 注意: 如果将来需要添加随机后缀，可以在这里实现
    // if (options?.addRandomSuffix === true) {
    //   finalPath = `${path}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    // }

    // 准备内容
    const body = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

    console.log(`[R2] Uploading to path: ${finalPath}, size: ${body.length} bytes`);

    // 上传到 R2
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: finalPath,
      Body: body,
      ContentType: options?.contentType || 'application/octet-stream',
      // R2 默认是私有的，如果需要公开访问，需要配置 bucket 的公开访问策略
      // 或者使用预签名 URL
    });

    await r2Client.send(command);

    // 构建公开 URL
    // R2 公开访问有两种方式：
    // 1. 使用 R2.dev 子域名: https://<bucket>.r2.dev/<path>
    // 2. 使用自定义域名: https://<custom-domain>/<path>
    // 注意: R2_ENDPOINT 是 S3 API 端点，不是公开访问 URL
    const publicUrl = `https://${BUCKET_NAME}.r2.dev/${finalPath}`;

    console.log(`[R2] Upload successful: ${publicUrl}`);

    return {
      url: publicUrl,
      pathname: finalPath,
      contentType: options?.contentType || 'application/octet-stream',
      uploadedAt: new Date(),
    };
  } catch (error) {
    console.error('[R2] Upload failed - Full details:');
    console.error('Path:', path);
    console.error('Content size:', typeof content === 'string' ? content.length : content.length, 'bytes');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error('Error type:', (error as any)?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    
    if (error && typeof error === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const awsError = error as any;
      console.error('Error code:', awsError.code);
      console.error('Error name:', awsError.name);
      console.error('Error $metadata:', JSON.stringify(awsError.$metadata, null, 2));
      
      // AggregateError 特殊处理
      if (error instanceof AggregateError) {
        console.error('AggregateError - Individual errors:');
        error.errors.forEach((err, index) => {
          console.error(`  Error ${index + 1}:`, err);
          if (err && typeof err === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const innerError = err as any;
            console.error(`    Code: ${innerError.code}`);
            console.error(`    Message: ${innerError.message}`);
          }
        });
      }
    }
    
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    console.error('R2 Client Config:', {
      endpoint: process.env.R2_ENDPOINT,
      bucket: BUCKET_NAME,
      hasAccessKeyId: !!process.env.R2_ACCESS_KEY_ID,
      hasSecretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
    });
    
    throw error;
  }
}

/**
 * 列出 R2 中的文件
 * @param options 列表选项
 * @returns 文件列表
 */
export async function list(options?: {
  prefix?: string;
  limit?: number;
  cursor?: string;
}) {
  validateR2Config();

  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: options?.prefix || '',
    MaxKeys: options?.limit || 1000,
    ContinuationToken: options?.cursor,
  });

  const response = await r2Client.send(command);

  // 转换为类似 Vercel Blob 的格式
  const blobs = (response.Contents || []).map(item => ({
    url: `https://${BUCKET_NAME}.r2.dev/${item.Key}`,
    pathname: item.Key || '',
    size: item.Size || 0,
    uploadedAt: item.LastModified,
  }));

  return {
    blobs,
    cursor: response.NextContinuationToken,
    hasMore: response.IsTruncated || false,
  };
}

/**
 * 获取文件内容
 * @param path 文件路径
 * @returns 文件内容
 */
export async function get(path: string) {
  validateR2Config();

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: path,
  });

  const response = await r2Client.send(command);
  
  if (!response.Body) {
    throw new Error('File not found or empty');
  }

  // 将流转换为字符串
  const bodyString = await response.Body.transformToString();

  return {
    url: `https://${BUCKET_NAME}.r2.dev/${path}`,
    pathname: path,
    contentType: response.ContentType,
    size: response.ContentLength,
    uploadedAt: response.LastModified,
    body: bodyString,
  };
}

/**
 * 删除文件
 * @param pathOrUrl 文件路径或 URL
 */
export async function del(pathOrUrl: string) {
  validateR2Config();

  // 如果是 URL，提取路径
  let path = pathOrUrl;
  if (pathOrUrl.startsWith('http')) {
    const url = new URL(pathOrUrl);
    path = url.pathname.replace(/^\//, '');
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: path,
  });

  await r2Client.send(command);
}

