/**
 * llm.js — 大模型答题分析
 *
 * 支持 DeepSeek / Anthropic 两种 API，自动根据 Key 前缀识别，
 * 也可手动切换。API Key 存储在 localStorage。
 *
 * DeepSeek:    https://api.deepseek.com/chat/completions  (OpenAI 兼容)
 * Anthropic:   https://api.anthropic.com/v1/messages
 */

const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    authHeader: function(key) { return `Bearer ${key}` },
    parseResponse: function(data) { return data.choices?.[0]?.message?.content || '' },
  },
  anthropic: {
    name: 'Anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-6',
    authHeader: function(key) { return key },  // x-api-key
    parseResponse: function(data) { return data.content?.[0]?.text || '' },
  },
}

export function getApiKey() {
  try { return localStorage.getItem('llm_api_key') || '' }
  catch { return '' }
}

export function setApiKey(key) {
  localStorage.setItem('llm_api_key', key.trim())
}

export function hasApiKey() {
  return getApiKey().length > 10
}

/** 自动检测 API 提供商（DeepSeek key 通常以 sk- 开头） */
function detectProvider(key) {
  if (key.startsWith('sk-')) return 'deepseek'
  if (key.startsWith('sk-ant')) return 'anthropic'
  return 'deepseek'  // 默认 DeepSeek
}

/**
 * 分析用户答案
 * @returns {Promise<{score:number, analysis:string, error?:string}>}
 */
export async function analyzeAnswer(question, referenceAnswer, userAnswer) {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { score: 0, analysis: '', error: '请先设置 API Key' }
  }

  const providerId = detectProvider(apiKey)
  const provider = PROVIDERS[providerId]

  const prompt = `你是一位医学考试评卷老师。请评价学生对以下问题的回答。

【题目】
${question}

【参考答案】
${referenceAnswer || '（无标准答案）'}

【学生答案】
${userAnswer}

请按以下格式回复（用中文）：
1. 评分（0-100分）
2. 正确要点（学生答对了哪些）
3. 遗漏要点（参考答案中有但学生没提到的）
4. 错误或需要纠正的地方
5. 总体评价（一句话）

请直接输出评价，不需要JSON格式。`

  // DeepSeek 用 OpenAI 兼容格式，Anthropic 用自己的格式
  const isAnthropic = providerId === 'anthropic'

  const headers = {
    'Content-Type': 'application/json',
    ...(isAnthropic
      ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      : { 'Authorization': `Bearer ${apiKey}` }
    ),
  }

  const body = isAnthropic
    ? { model: provider.model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }
    : { model: provider.model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      return { score: 0, analysis: '', error: `${provider.name} API 错误 (${res.status}): ${err.substring(0, 200)}` }
    }

    const data = await res.json()
    const text = provider.parseResponse(data)

    const scoreMatch = text.match(/(\d{1,3})\s*分/)
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0

    return { score: Math.min(100, Math.max(0, score)), analysis: text }
  } catch (e) {
    return { score: 0, analysis: '', error: `网络错误: ${e.message}` }
  }
}
