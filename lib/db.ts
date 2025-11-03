import { sql } from '@vercel/postgres';

/**
 * 数据库工具函数
 * 用于管理用户搜索历史、聊天记录和验证问题
 */

/**
 * 初始化数据库表结构
 * 在首次部署时需要调用此函数
 */
export async function initDatabase() {
  try {
    // 创建 search_sessions 表 - 存储搜索会话信息
    await sql`
      CREATE TABLE IF NOT EXISTS search_sessions (
        id SERIAL PRIMARY KEY,
        rid VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 创建 search_history 表 - 存储搜索历史
    await sql`
      CREATE TABLE IF NOT EXISTS search_history (
        id SERIAL PRIMARY KEY,
        rid VARCHAR(255) NOT NULL,
        query TEXT NOT NULL,
        mode VARCHAR(50) NOT NULL,
        results JSONB,
        ai_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rid) REFERENCES search_sessions(rid) ON DELETE CASCADE
      )
    `;

    // 创建索引
    await sql`
      CREATE INDEX IF NOT EXISTS idx_search_history_rid 
      ON search_history(rid)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_search_history_created_at 
      ON search_history(created_at DESC)
    `;

    // 创建 verification_questions 表 - 存储验证问题
    await sql`
      CREATE TABLE IF NOT EXISTS verification_questions (
        id SERIAL PRIMARY KEY,
        rid VARCHAR(255) NOT NULL,
        search_history_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rid) REFERENCES search_sessions(rid) ON DELETE CASCADE,
        FOREIGN KEY (search_history_id) REFERENCES search_history(id) ON DELETE CASCADE
      )
    `;

    // 创建索引
    await sql`
      CREATE INDEX IF NOT EXISTS idx_verification_questions_rid 
      ON verification_questions(rid)
    `;

    // 创建 user_answers 表 - 存储用户答案
    await sql`
      CREATE TABLE IF NOT EXISTS user_answers (
        id SERIAL PRIMARY KEY,
        rid VARCHAR(255) NOT NULL,
        question_id INTEGER NOT NULL,
        user_answer INTEGER NOT NULL,
        is_correct BOOLEAN NOT NULL,
        answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rid) REFERENCES search_sessions(rid) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES verification_questions(id) ON DELETE CASCADE
      )
    `;

    // 创建索引
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_answers_rid 
      ON user_answers(rid)
    `;

    console.log('Database tables initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * 创建或获取搜索会话
 */
export async function getOrCreateSession(rid: string) {
  try {
    // 尝试获取现有会话
    const result = await sql`
      INSERT INTO search_sessions (rid)
      VALUES (${rid})
      ON CONFLICT (rid) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Failed to get or create session:', error);
    throw error;
  }
}

/**
 * 保存搜索历史
 */
export async function saveSearchHistory(
  rid: string,
  query: string,
  mode: 'ai' | 'search' | 'search_with_overview',
  results: unknown,
  aiResponse?: string
) {
  try {
    // 确保会话存在
    await getOrCreateSession(rid);

    const result = await sql`
      INSERT INTO search_history (rid, query, mode, results, ai_response)
      VALUES (${rid}, ${query}, ${mode}, ${JSON.stringify(results)}, ${aiResponse || null})
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Failed to save search history:', error);
    throw error;
  }
}

/**
 * 获取搜索历史
 */
export async function getSearchHistory(rid: string, limit = 50) {
  try {
    const result = await sql`
      SELECT * FROM search_history
      WHERE rid = ${rid}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  } catch (error) {
    console.error('Failed to get search history:', error);
    throw error;
  }
}

/**
 * 保存验证问题
 */
export async function saveVerificationQuestions(
  rid: string,
  searchHistoryId: number,
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
  }>
) {
  try {
    const results = [];
    for (const q of questions) {
      const result = await sql`
        INSERT INTO verification_questions (rid, search_history_id, question, options, correct_answer)
        VALUES (${rid}, ${searchHistoryId}, ${q.question}, ${JSON.stringify(q.options)}, ${q.correctAnswer})
        RETURNING *
      `;
      results.push(result.rows[0]);
    }
    return results;
  } catch (error) {
    console.error('Failed to save verification questions:', error);
    throw error;
  }
}

/**
 * 获取验证问题（不包含正确答案）
 */
export async function getVerificationQuestions(rid: string) {
  try {
    const result = await sql`
      SELECT 
        vq.id,
        vq.question,
        vq.options,
        vq.created_at,
        sh.query,
        sh.mode
      FROM verification_questions vq
      JOIN search_history sh ON vq.search_history_id = sh.id
      WHERE vq.rid = ${rid}
      AND vq.id NOT IN (
        SELECT question_id FROM user_answers WHERE rid = ${rid}
      )
      ORDER BY vq.created_at DESC
      LIMIT 5
    `;
    return result.rows;
  } catch (error) {
    console.error('Failed to get verification questions:', error);
    throw error;
  }
}

/**
 * 保存用户答案
 */
export async function saveUserAnswer(
  rid: string,
  questionId: number,
  userAnswer: number
) {
  try {
    // 获取正确答案
    const questionResult = await sql`
      SELECT correct_answer FROM verification_questions
      WHERE id = ${questionId} AND rid = ${rid}
    `;

    if (questionResult.rows.length === 0) {
      throw new Error('Question not found');
    }

    const correctAnswer = questionResult.rows[0].correct_answer;
    const isCorrect = userAnswer === correctAnswer;

    const result = await sql`
      INSERT INTO user_answers (rid, question_id, user_answer, is_correct)
      VALUES (${rid}, ${questionId}, ${userAnswer}, ${isCorrect})
      RETURNING *
    `;

    return {
      ...result.rows[0],
      correct_answer: correctAnswer,
    };
  } catch (error) {
    console.error('Failed to save user answer:', error);
    throw error;
  }
}

/**
 * 获取用户答题统计
 */
export async function getUserAnswerStats(rid: string) {
  try {
    const result = await sql`
      SELECT 
        COUNT(*) as total_answered,
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100 as accuracy_percentage
      FROM user_answers
      WHERE rid = ${rid}
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Failed to get user answer stats:', error);
    throw error;
  }
}

