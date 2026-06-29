/**
 * dataProcessor.js — 数据清洗 + 统一导出（多学科版本）
 *
 * 所有数据访问函数均需传入 subjectId，按需加载对应学科数据。
 * 纯工具函数不做修改。
 */

import { loadSubjectData, getCachedRawData } from './subjectRegistry.js'

// ===== 题干清洗 =====
function cleanQuestionAndExtractAnswer(question, existingAnswer) {
  if (!question) return { question: '', extractedAnswer: existingAnswer }

  let cleaned = question

  cleaned = cleaned.replace(/[（(]正确答案[：:]\s*([A-Ea-e])[）)]/g, '')
  cleaned = cleaned.replace(/[（(]答案[：:]\s*([A-Ea-e])[）)]/g, '')
  cleaned = cleaned.replace(/[；;]\s*[；;]/g, '；')
  cleaned = cleaned.replace(/[，,]\s*[，,]/g, '，')
  cleaned = cleaned.replace(/\s{2,}/g, ' ')
  cleaned = cleaned.trim()

  return { question: cleaned, extractedAnswer: existingAnswer }
}

// ===== 数据处理 =====
function processData(rawData) {
  const sections = []

  rawData.sections.forEach(sec => {
    if (sec.type === 'preface') return

    const newSec = { ...sec, chapters: [] }

    sec.chapters.forEach(ch => {
      const newCh = { ...ch, topics: [] }

      ch.topics.forEach(t => {
        const newT = { ...t, subTopics: [] }

        t.subTopics.forEach(st => {
          const newSt = { ...st, knowledgePoints: [] }

          st.knowledgePoints.forEach(item => {
            if (item.type === 'text') return

            const newItem = { ...item }

            if (item.type === 'qa' || item.type === 'multiple_choice') {
              const { question, extractedAnswer } = cleanQuestionAndExtractAnswer(
                item.question, item.answer
              )
              newItem.question = question
              newItem.answer = extractedAnswer
              // 清理 ** 粗体标记
              if (newItem.answer) {
                newItem.answer = newItem.answer.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
              }
              // 清理选项中的 **
              if (newItem.options && newItem.options.length) {
                newItem.options = newItem.options.map(function(o) {
                  return { label: o.label, text: (o.text || '').replace(/\*{1,2}/g, '') }
                })
              }
            }

            newSt.knowledgePoints.push(newItem)
          })

          if (newSt.knowledgePoints.length > 0) newT.subTopics.push(newSt)
        })

        if (newT.subTopics.length > 0) newCh.topics.push(newT)
      })

      if (newCh.topics.length > 0) newSec.chapters.push(newCh)
    })

    if (newSec.chapters.length > 0) sections.push(newSec)
  })

  // 统计
  let totalItems = 0, totalChapters = 0, totalTopics = 0
  const itemTypes = {}

  sections.forEach(s => {
    totalChapters += s.chapters.length
    s.chapters.forEach(ch => {
      totalTopics += ch.topics.length
      ch.topics.forEach(t => {
        t.subTopics.forEach(st => {
          st.knowledgePoints.forEach(item => {
            totalItems++
            itemTypes[item.type] = (itemTypes[item.type] || 0) + 1
          })
        })
      })
    })
  })

  return {
    ...rawData,
    sections,
    stats: { totalSections: sections.length, totalChapters, totalTopics, totalItems, itemTypes },
  }
}

// ===== 缓存 =====
const processedCache = new Map()

/**
 * 获取处理后的学科数据（异步，首次调用时加载原始 JSON 并处理）。
 */
export async function getExamData(subjectId) {
  if (processedCache.has(subjectId)) return processedCache.get(subjectId)
  const raw = await loadSubjectData(subjectId)
  const processed = processData(raw)
  processedCache.set(subjectId, processed)
  return processed
}

/** 同步获取已缓存的处理后数据（未加载时返回 null） */
function getCachedData(subjectId) {
  return processedCache.get(subjectId) || null
}

// ===== 数据访问函数（均需 subjectId） =====

/** 获取所有章节名（去重排序） */
export function getAllChapters(subjectId) {
  const data = getCachedData(subjectId)
  if (!data) return []
  const seen = new Set()
  const chapters = []
  data.sections.forEach(sec => {
    sec.chapters.forEach(ch => {
      if (ch.title !== '未分类' && !seen.has(ch.title)) {
        seen.add(ch.title)
        chapters.push({ title: ch.title, sectionTitle: sec.title })
      }
    })
  })
  return chapters
}

/** 获取某章节的所有题目 */
export function getChapterItems(subjectId, chapterName) {
  const data = getCachedData(subjectId)
  if (!data) return []
  const items = []
  data.sections.forEach(sec => {
    sec.chapters.forEach(ch => {
      if (ch.title === chapterName) {
        ch.topics.forEach(t => {
          t.subTopics.forEach(st => {
            st.knowledgePoints.forEach(item => {
              items.push({ ...item, _section: sec.title, _chapter: ch.title, _topic: t.title })
            })
          })
        })
      }
    })
  })
  return items
}

/** 按题型获取所有题目 */
export function getItemsByType(subjectId, type) {
  const data = getCachedData(subjectId)
  if (!data) return []
  const items = []
  data.sections.forEach(sec => {
    sec.chapters.forEach(ch => {
      ch.topics.forEach(t => {
        t.subTopics.forEach(st => {
          st.knowledgePoints.forEach(item => {
            if (type === 'all' || item.type === type ||
                (type === 'mc' && item.type === 'multiple_choice')) {
              items.push({ ...item, _section: sec.title, _chapter: ch.title, _topic: t.title })
            }
          })
        })
      })
    })
  })
  return items
}

/** 搜索题目 */
export function searchItems(subjectId, query) {
  const data = getCachedData(subjectId)
  if (!data) return []
  const q = query.trim().toLowerCase()
  if (!q) return []

  const found = []
  data.sections.forEach(sec => {
    sec.chapters.forEach(ch => {
      ch.topics.forEach(t => {
        t.subTopics.forEach(st => {
          st.knowledgePoints.forEach(item => {
            const haystack = [
              item.question, item.answer, item.explanation,
              ...(item.options || []).map(o => o.text),
              ...(item.headers || []),
              ...(item.rows || []).flat(),
              sec.title, ch.title, t.title,
            ].filter(Boolean).join(' ').toLowerCase()

            if (haystack.includes(q)) {
              found.push({ ...item, _section: sec.title, _chapter: ch.title, _topic: t.title })
            }
          })
        })
      })
    })
  })

  return found.slice(0, 100)
}

/** 获取题型统计 */
export function getTypeCounts(subjectId) {
  const data = getCachedData(subjectId)
  if (!data) return { all: 0, qa: 0, mc: 0, table: 0 }
  const c = { all: 0, qa: 0, mc: 0, table: 0 }
  data.sections.forEach(sec => {
    sec.chapters.forEach(ch => {
      ch.topics.forEach(t => {
        t.subTopics.forEach(st => {
          st.knowledgePoints.forEach(item => {
            c.all++
            if (item.type === 'qa') c.qa++
            else if (item.type === 'multiple_choice') c.mc++
            else if (item.type === 'table') c.table++
          })
        })
      })
    })
  })
  return c
}

// ===== 纯工具函数（无变化） =====

export function cleanQuestionDisplay(text) {
  if (!text) return ''
  let cleaned = text
  cleaned = cleaned.replace(/[（(]正确答案[：:]\s*[A-Ea-e][）)]/g, '')
  cleaned = cleaned.replace(/[（(]答案[：:]\s*[A-Ea-e][）)]/g, '')
  cleaned = cleaned.replace(/[（(]([^）)]*(?:所著|所述|所说|正确答案|答案)[^）)]*)[）)]/g, '')
  return cleaned.trim()
}

export function renderTextWithBlanks(text) {
  if (!text) return ''
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // 保留下划线填空标记，但不使用黄色高亮
  return escaped.replace(/（(.*?)）/g, '<u>（$1）</u>')
}

/** 清理粗体 Markdown 标记 ** */
export function cleanBold(text) {
  if (!text) return ''
  return text.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
}

export function truncate(str, n) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function highlight(text, q) {
  if (!text || !q) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escaped})`, 'gi')
  return text.replace(re, '<mark>$1</mark>')
}
