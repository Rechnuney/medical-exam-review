/**
 * subjectRegistry.js — 学科注册中心
 *
 * 定义所有可用学科及其元数据，提供按需懒加载机制。
 * 每个学科的数据 JSON 会被 Vite 自动 code-split 为独立 chunk。
 */

// ===== 学科定义 =====
// 每个学科定义懒加载器（thunk），仅在用户选择该学科时才加载对应 JSON

const SUBJECT_DEFS = [
  {
    id: 'tcm',
    name: '中医学',
    subtitle: '中医内科 & 针灸学',
    icon: '🌿',
    file: 'exam.json',
  },
  {
    id: 'ent',
    name: '耳鼻喉科学',
    subtitle: '耳科学 · 鼻科学 · 咽喉科学',
    icon: '👂',
    file: 'ent.json',
  },
  {
    id: 'rehab',
    name: '康复医学',
    subtitle: '康复概论 · 康复评定 · 康复治疗',
    icon: '🏃',
    file: 'rehab.json',
  },
  {
    id: 'stomatology',
    name: '口腔医学',
    subtitle: '口腔颌面部解剖 · 口腔疾病',
    icon: '🦷',
    file: 'stomatology.json',
  },
  {
    id: 'dermatology',
    name: '皮肤性病学',
    subtitle: '皮肤结构 · 皮肤病 · 性传播疾病',
    icon: '🔬',
    file: 'dermatology.json',
  },
  {
    id: 'ophthalmology',
    name: '眼科学',
    subtitle: '解剖生理 · 眼科疾病',
    icon: '👁️',
    file: 'ophthalmology.json',
  },
]

// ===== 加载 & 缓存 =====

/** 已加载的原始数据缓存 */
const rawCache = new Map()

/** 获取学科元数据列表（不含 loader，可安全序列化） */
export function getSubjects() {
  return SUBJECT_DEFS.map(({ id, name, subtitle, icon }) => ({ id, name, subtitle, icon }))
}

/** 获取单个学科的元数据 */
export function getSubjectMeta(subjectId) {
  return SUBJECT_DEFS.find(s => s.id === subjectId) || null
}

/**
 * 异步加载指定学科的原始 JSON 数据（含缓存）。
 * 仅在首次访问时触发网络/磁盘加载，后续调用直接返回缓存。
 */
export async function loadSubjectData(subjectId) {
  if (rawCache.has(subjectId)) return rawCache.get(subjectId)

  const def = SUBJECT_DEFS.find(s => s.id === subjectId)
  if (!def) throw new Error(`未知学科: ${subjectId}`)

  // 使用显式 import 路径以消除 Vite 警告
  const importMap = {
    'exam.json': () => import('../data/exam.json'),
    'ent.json': () => import('../data/ent.json'),
    'rehab.json': () => import('../data/rehab.json'),
    'stomatology.json': () => import('../data/stomatology.json'),
    'dermatology.json': () => import('../data/dermatology.json'),
    'ophthalmology.json': () => import('../data/ophthalmology.json'),
  }
  const loader = importMap[def.file]
  if (!loader) throw new Error(`未找到数据文件: ${def.file}`)
  const mod = await loader()
  const rawData = mod.default || mod
  rawCache.set(subjectId, rawData)
  return rawData
}

/** 同步获取已缓存的原始数据（未加载时返回 null） */
export function getCachedRawData(subjectId) {
  return rawCache.get(subjectId) || null
}
