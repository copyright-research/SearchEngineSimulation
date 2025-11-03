import Database from 'better-sqlite3';
import path from 'path';

/**
 * SQLite 数据库工具函数（用于本地开发）
 * 使用文件数据库，无需 Vercel Postgres
 */

// 数据库文件路径
const DB_PATH = path.join(process.cwd(), 'data', 'verification.db');

// 获取或创建数据库连接
function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // 性能优化
  return db;
}

/**
 * 初始化数据库表结构
 */
export function initDatabase() {
  const db = getDb();

  try {
    // 创建 search_sessions 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS search_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 search_history 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid TEXT NOT NULL,
        query TEXT NOT NULL,
        mode TEXT NOT NULL,
        results TEXT,
        ai_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rid) REFERENCES search_sessions(rid) ON DELETE CASCADE
      )
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_history_rid 
      ON search_history(rid)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_history_created_at 
      ON search_history(created_at DESC)
    `);

    // 创建 verification_questions 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS verification_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid TEXT NOT NULL,
        search_history_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        correct_answer INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rid) REFERENCES search_sessions(rid) ON DELETE CASCADE,
        FOREIGN KEY (search_history_id) REFERENCES search_history(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_verification_questions_rid 
      ON verification_questions(rid)
    `);

    // 创建 user_answers 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid TEXT NOT NULL,
        question_id INTEGER NOT NULL,
        user_answer INTEGER NOT NULL,
        is_correct INTEGER NOT NULL,
        answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rid) REFERENCES search_sessions(rid) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES verification_questions(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_user_answers_rid 
      ON user_answers(rid)
    `);

    console.log('SQLite database tables initialized successfully');
    db.close();
    return { success: true };
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
    db.close();
    throw error;
  }
}

/**
 * 创建或获取搜索会话
 */
export function getOrCreateSession(rid: string) {
  const db = getDb();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO search_sessions (rid)
      VALUES (?)
      ON CONFLICT(rid) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);
    
    const result = stmt.get(rid);
    db.close();
    return result;
  } catch (error) {
    db.close();
    console.error('Failed to get or create session:', error);
    throw error;
  }
}

/**
 * 保存搜索历史
 */
export function saveSearchHistory(
  rid: string,
  query: string,
  mode: 'ai' | 'search' | 'search_with_overview',
  results: unknown,
  aiResponse?: string
) {
  const db = getDb();
  
  try {
    // 确保会话存在
    getOrCreateSession(rid);

    const stmt = db.prepare(`
      INSERT INTO search_history (rid, query, mode, results, ai_response)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);
    
    const result = stmt.get(
      rid,
      query,
      mode,
      JSON.stringify(results),
      aiResponse || null
    );
    
    db.close();
    return result;
  } catch (error) {
    db.close();
    console.error('Failed to save search history:', error);
    throw error;
  }
}

/**
 * 获取搜索历史
 */
export function getSearchHistory(rid: string, limit = 50) {
  const db = getDb();
  
  try {
    const stmt = db.prepare(`
      SELECT * FROM search_history
      WHERE rid = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    const results = stmt.all(rid, limit);
    db.close();
    
    // 解析 JSON 字段
    return (results as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      results: JSON.parse(row.results as string),
    }));
  } catch (error) {
    db.close();
    console.error('Failed to get search history:', error);
    throw error;
  }
}

/**
 * 保存验证问题
 */
export function saveVerificationQuestions(
  rid: string,
  searchHistoryId: number,
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
  }>
) {
  const db = getDb();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO verification_questions (rid, search_history_id, question, options, correct_answer)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);
    
    const results = questions.map(q => 
      stmt.get(
        rid,
        searchHistoryId,
        q.question,
        JSON.stringify(q.options),
        q.correctAnswer
      )
    );
    
    db.close();
    return results;
  } catch (error) {
    db.close();
    console.error('Failed to save verification questions:', error);
    throw error;
  }
}

/**
 * 获取验证问题（不包含正确答案）
 */
export function getVerificationQuestions(rid: string) {
  const db = getDb();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        vq.id,
        vq.question,
        vq.options,
        vq.created_at,
        sh.query,
        sh.mode
      FROM verification_questions vq
      JOIN search_history sh ON vq.search_history_id = sh.id
      WHERE vq.rid = ?
      AND vq.id NOT IN (
        SELECT question_id FROM user_answers WHERE rid = ?
      )
      ORDER BY vq.created_at DESC
      LIMIT 5
    `);
    
    const results = stmt.all(rid, rid);
    db.close();
    
    // 解析 JSON 字段
    return (results as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      options: JSON.parse(row.options as string),
    }));
  } catch (error) {
    db.close();
    console.error('Failed to get verification questions:', error);
    throw error;
  }
}

/**
 * 保存用户答案
 */
export function saveUserAnswer(
  rid: string,
  questionId: number,
  userAnswer: number
) {
  const db = getDb();
  
  try {
    // 获取正确答案
    const questionStmt = db.prepare(`
      SELECT correct_answer FROM verification_questions
      WHERE id = ? AND rid = ?
    `);
    
    const question = questionStmt.get(questionId, rid) as Record<string, unknown> | undefined;
    
    if (!question) {
      db.close();
      throw new Error('Question not found');
    }

    const correctAnswer = question.correct_answer as number;
    const isCorrect = userAnswer === correctAnswer ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO user_answers (rid, question_id, user_answer, is_correct)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);
    
    const result = stmt.get(rid, questionId, userAnswer, isCorrect) as Record<string, unknown>;
    db.close();
    
    return {
      ...result,
      is_correct: Boolean(result.is_correct),
      correct_answer: correctAnswer,
    };
  } catch (error) {
    db.close();
    console.error('Failed to save user answer:', error);
    throw error;
  }
}

/**
 * 获取用户答题统计
 */
export function getUserAnswerStats(rid: string) {
  const db = getDb();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_answered,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
        AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) * 100 as accuracy_percentage
      FROM user_answers
      WHERE rid = ?
    `);
    
    const result = stmt.get(rid);
    db.close();
    return result;
  } catch (error) {
    db.close();
    console.error('Failed to get user answer stats:', error);
    throw error;
  }
}

