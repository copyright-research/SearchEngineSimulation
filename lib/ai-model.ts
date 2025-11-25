/**
 * AI 模型配置 - 简化版
 * 只需要模型名称，自动推断 provider
 */

import { groq } from '@ai-sdk/groq';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

// 支持的模型名称（直接使用 AI SDK 的模型名）
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b'
] as const;

const GOOGLE_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
] as const;

// 默认模型配置（从环境变量读取）
const DEFAULT_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

/**
 * 获取 AI 模型实例
 * @param modelName 模型名称（如 'llama-3.3-70b-versatile' 或 'gemini-2.0-flash-exp'）
 */
export function getModel(modelName: string = DEFAULT_MODEL): LanguageModel {
  // 自动推断 provider
  if (GROQ_MODELS.includes(modelName as typeof GROQ_MODELS[number])) {
    return groq(modelName);
  }
  
  if (GOOGLE_MODELS.includes(modelName as typeof GOOGLE_MODELS[number])) {
    return google(modelName);
  }
  
  // 未知模型，fallback 到默认
  console.warn(`[AI Model] Unknown model: ${modelName}, using default: ${DEFAULT_MODEL}`);
  return groq(DEFAULT_MODEL);
}

// 便捷函数：优先使用特定变量，否则使用默认 AI_MODEL
export function getChatModel(): LanguageModel {
  return getModel(process.env.AI_MODEL_CHAT || process.env.AI_MODEL);
}

export function getOverviewModel(): LanguageModel {
  return getModel(process.env.AI_MODEL_OVERVIEW || process.env.AI_MODEL);
}

export function getQuestionGeneratorModel(): LanguageModel {
  return getModel(process.env.AI_MODEL_QUESTIONS || process.env.AI_MODEL);
}

export function getQueryRewriterModel(): LanguageModel {
  return getModel(process.env.AI_MODEL_QUERY_REWRITER || process.env.AI_MODEL);
}

