/**
 * 数据库适配器
 * 根据环境变量自动选择使用 SQLite（本地）或 Postgres（生产）
 */

// 判断是否使用 SQLite
const USE_SQLITE = process.env.USE_SQLITE === 'true' || !process.env.POSTGRES_URL;

// 动态导入对应的数据库模块
const dbModule = USE_SQLITE 
  ? require('./db-sqlite')
  : require('./db');

console.log(`[DB] Using ${USE_SQLITE ? 'SQLite' : 'Postgres'} database`);

// 导出所有数据库函数
export const {
  initDatabase,
  getOrCreateSession,
  saveSearchHistory,
  getSearchHistory,
  saveVerificationQuestions,
  getVerificationQuestions,
  saveUserAnswer,
  getUserAnswerStats,
} = dbModule;

