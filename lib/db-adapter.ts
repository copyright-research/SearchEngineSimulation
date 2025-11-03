/**
 * 数据库适配器
 * 根据环境变量自动选择使用 SQLite（本地）或 Postgres（生产）
 * 
 * 使用方式：
 * - 本地开发：设置 USE_SQLITE=true 使用 SQLite
 * - Vercel 生产：自动使用 Postgres（有 POSTGRES_URL）
 */

// 判断是否使用 SQLite
const USE_SQLITE = process.env.USE_SQLITE === 'true' || !process.env.POSTGRES_URL;

console.log(`[DB] Using ${USE_SQLITE ? 'SQLite' : 'Postgres'} database`);

// 动态导入并重新导出
// 注意：这里使用动态导入，但在 Vercel 部署时会自动使用 Postgres
export {
  initDatabase,
  getOrCreateSession,
  saveSearchHistory,
  getSearchHistory,
  saveVerificationQuestions,
  getVerificationQuestions,
  saveUserAnswer,
  getUserAnswerStats,
} from './db';
