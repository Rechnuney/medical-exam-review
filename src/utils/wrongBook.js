/**
 * wrongBook.js — 错题本管理（按学科隔离）
 *
 * 每个学科的数据存储在独立 localStorage key: wrongQuestions:<subjectId>
 * 旧版全局 key "wrongQuestions" 在首次访问时自动迁移到 "wrongQuestions:tcm"
 */

const LEGACY_KEY = 'wrongQuestions'
let migrationDone = false

function storageKey(subjectId) {
  return `wrongQuestions:${subjectId}`
}

function migrateLegacy(subjectId) {
  if (migrationDone) return
  migrationDone = true
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) return
    const newKey = storageKey(subjectId)
    if (!localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, legacy)
    }
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* ignore */ }
}

export function getWrongQuestions(subjectId) {
  migrateLegacy(subjectId)
  try {
    const raw = localStorage.getItem(storageKey(subjectId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveWrongQuestions(subjectId, list) {
  localStorage.setItem(storageKey(subjectId), JSON.stringify(list))
}

export function addWrongQuestion(subjectId, item) {
  const list = getWrongQuestions(subjectId)
  const existing = list.find(w => w.id === item.id)
  if (existing) {
    existing.userAnswer = item.userAnswer
    existing.wrongAt = Date.now()
    existing.attempts = (existing.attempts || 0) + 1
  } else {
    list.push({ ...item, wrongAt: Date.now(), attempts: 1 })
  }
  saveWrongQuestions(subjectId, list)
}

export function removeWrongQuestion(subjectId, id) {
  const list = getWrongQuestions(subjectId).filter(w => w.id !== id)
  saveWrongQuestions(subjectId, list)
}

export function isInWrongBook(subjectId, id) {
  return getWrongQuestions(subjectId).some(w => w.id === id)
}

export function clearWrongBook(subjectId) {
  saveWrongQuestions(subjectId, [])
}

export function getWrongCount(subjectId) {
  return getWrongQuestions(subjectId).length
}
