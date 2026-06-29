<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getExamData, getAllChapters, getItemsByType, getTypeCounts, cleanQuestionDisplay, renderTextWithBlanks, truncate } from '../utils/dataProcessor.js'
import { addWrongQuestion } from '../utils/wrongBook.js'
import { hasApiKey, setApiKey, getApiKey, analyzeAnswer } from '../utils/llm.js'

const route = useRoute()
const router = useRouter()
const subjectId = computed(() => route.params.subjectId)
const autoAddWrong = ref(true)
const showApiKeyInput = ref(false)
const apiKeyInput = ref(getApiKey())
const apiKeySaved = ref(hasApiKey())

function saveApiKey() {
  setApiKey(apiKeyInput.value)
  apiKeySaved.value = hasApiKey()
  showApiKeyInput.value = false
}

const loading = ref(true)
const examData = ref(null)

onMounted(async () => {
  examData.value = await getExamData(subjectId.value)
  loading.value = false
})

// Mode
const mode = ref('type')
const dropdownOpen = ref(false)
function setMode(m) { mode.value = m; dropdownOpen.value = false; if (m === 'type') filter.value = 'all' }

// Type filter
const filter = ref('all')
const typeCounts = computed(() => examData.value ? getTypeCounts(subjectId.value) : { all: 0, qa: 0, mc: 0, table: 0 })
const typeItems = computed(() => getItemsByType(subjectId.value, filter.value === 'mc' ? 'multiple_choice' : filter.value))

// Chapter
const allChapters = computed(() => {
  if (!examData.value) return []
  const seen = new Set()
  const chapters = []
  examData.value.sections.forEach(sec => {
    sec.chapters.forEach(ch => {
      if (ch.title !== '未分类' && !seen.has(ch.title)) {
        seen.add(ch.title)
        let c = 0
        ch.topics.forEach(t => t.subTopics.forEach(st => { c += st.knowledgePoints.length }))
        if (c > 0) chapters.push({ title: ch.title, sectionTitle: sec.title, itemCount: c })
      }
    })
  })
  return chapters
})
function goChapterPractice(ch) {
  router.push({ name: 'practiceChapter', params: { subjectId: subjectId.value, chapterName: ch.title } })
}

// QA
const qaStates = ref({})
function getQAState(itemId) {
  if (!qaStates.value[itemId]) qaStates.value[itemId] = { userInput: '', submitted: false, isCorrect: null, aiLoading: false, aiResult: null }
  return qaStates.value[itemId]
}
function submitQA(item) {
  const state = getQAState(item.id)
  if (state.submitted) return
  state.submitted = true
  const ua = state.userInput.trim()
  const ca = (item.answer || '').trim()
  if (ca && ua !== '') {
    state.isCorrect = ca.includes(ua) || ua.includes(ca)
  } else {
    state.isCorrect = null
  }
  if (!state.isCorrect && autoAddWrong.value && item.answer) {
    addWrongQuestion(subjectId.value, {
      id: item.id, section: item._section, chapter: item._chapter, topic: item._topic,
      type: item.type, question: item.question, options: [],
      correctAnswer: item.answer || '', userAnswer: state.userInput,
    })
  }
}
async function analyzeWithAI(item) {
  const state = getQAState(item.id)
  state.aiLoading = true
  state.aiResult = null
  const result = await analyzeAnswer(
    cleanQuestionDisplay(item.question),
    item.answer || '暂无参考答案',
    state.userInput
  )
  state.aiLoading = false
  state.aiResult = result
}

// ── 判断单选/多选 ──
function isMultiChoice(item) {
  if (!item.answer) return false
  const answer = item.answer.trim()
  // 多字母如 AB / A,B / A,B,C → 多选
  if (/^[A-E]{2,}$/.test(answer)) return true
  if (answer.includes(',')) return true
  return false
}

// MC
const mcStates = ref({})
function getMCState(itemId) {
  if (!mcStates.value[itemId]) mcStates.value[itemId] = { selected: [], showAnswer: false }
  return mcStates.value[itemId]
}

// 单选题：点击即选（恢复原模式）
function selectSingle(item, label) {
  const state = getMCState(item.id)
  if (state.showAnswer) return
  state.selected = [label]
  state.showAnswer = true
  if (!item.answer) return
  const correctAnswers = (item.answer || '').split(',').map(function(a) { return a.trim(); })
  const isCorrect = correctAnswers.includes(label)
  if (!isCorrect && autoAddWrong.value) {
    addWrongQuestion(subjectId.value, {
      id: item.id, section: item._section, chapter: item._chapter, topic: item._topic,
      type: item.type, question: item.question, options: item.options || [],
      correctAnswer: item.answer || '', userAnswer: label,
    })
  }
}

// 多选题：复选框 + 确认按钮
function toggleMulti(item, label) {
  const state = getMCState(item.id)
  if (state.showAnswer) return
  const next = state.selected.filter(function(s) { return s !== label })
  if (next.length === state.selected.length) next.push(label)
  mcStates.value[item.id] = { selected: next, showAnswer: false }
}
function confirmMulti(item) {
  const state = getMCState(item.id)
  if (state.selected.length === 0) return
  mcStates.value[item.id] = { selected: state.selected.slice(), showAnswer: true }
  if (!item.answer) return
  const correctAnswers = (item.answer || '').split(',').map(function(a) { return a.trim(); })
  const isCorrect = state.selected.length === correctAnswers.length &&
    state.selected.every(function(s) { return correctAnswers.includes(s); })
  if (!isCorrect && autoAddWrong.value) {
    addWrongQuestion(subjectId.value, {
      id: item.id, section: item._section, chapter: item._chapter, topic: item._topic,
      type: item.type, question: item.question, options: item.options || [],
      correctAnswer: item.answer || '', userAnswer: state.selected.join(','),
    })
  }
}

function getMCOptClass(itemId, label, correctAnswer, multi) {
  const state = getMCState(itemId)
  if (!state.showAnswer) {
    if (state.selected.includes(label)) return 'mc-opt-selected'
    return 'mc-opt-clickable'
  }
  if (!correctAnswer) {
    if (state.selected.includes(label)) return 'mc-opt-selected'
    return 'mc-opt-dimmed'
  }
  const answers = correctAnswer.split(',').map(function(a) { return a.trim(); })
  if (answers.includes(label)) return 'mc-opt-correct'
  if (state.selected.includes(label)) return 'mc-opt-wrong'
  return 'mc-opt-dimmed'
}
function getMCFeedback(itemId, item) {
  const state = getMCState(itemId)
  if (!state.showAnswer || !item.answer) return null
  const correctAnswers = (item.answer || '').split(',').map(function(a) { return a.trim(); })
  const userSelected = state.selected.slice().sort()
  const isCorrect = userSelected.length === correctAnswers.length &&
    userSelected.every(function(s) { return correctAnswers.includes(s); })
  return { isCorrect, correctAnswers }
}
function getOptText(options, label) {
  const opt = options?.find(o => o.label === label)
  return opt ? `${opt.label}. ${opt.text}` : label
}

// Table
const tableRevealed = ref({})
function isCellHidden(itemId, ri, ci) {
  if (ci === 0) return false
  const state = tableRevealed.value[itemId]
  if (!state) return true
  if (state.showAll) return false
  return !state.cells.has(`${ri}-${ci}`)
}
function toggleCell(itemId, ri, ci) {
  if (!tableRevealed.value[itemId]) tableRevealed.value[itemId] = { cells: new Set(), showAll: false }
  const key = `${ri}-${ci}`
  const st = tableRevealed.value[itemId]
  if (st.cells.has(key)) st.cells.delete(key)
  else st.cells.add(key)
  tableRevealed.value = { ...tableRevealed.value }
}
function revealAll(itemId) {
  if (!tableRevealed.value[itemId]) tableRevealed.value[itemId] = { cells: new Set(), showAll: true }
  else tableRevealed.value[itemId].showAll = true
  tableRevealed.value = { ...tableRevealed.value }
}
function hideAll(itemId) {
  tableRevealed.value[itemId] = { cells: new Set(), showAll: false }
  tableRevealed.value = { ...tableRevealed.value }
}
</script>

<template>
  <div v-if="loading" class="loading">加载中…</div>
  <div v-else>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <h1 class="page-title" style="margin:0">📝 刷题</h1>
      <div class="dropdown" @mouseenter="dropdownOpen = true" @mouseleave="dropdownOpen = false">
        <button class="btn dropdown-toggle">
          {{ mode === 'type' ? '按题型刷题' : '按章节刷题' }}
          <span style="font-size:10px">▼</span>
        </button>
        <div class="dropdown-menu" v-show="dropdownOpen">
          <div class="dropdown-item" :class="{ active: mode === 'type' }" @click="setMode('type')">按题型刷题</div>
          <div class="dropdown-item" :class="{ active: mode === 'chapter' }" @click="setMode('chapter')">按章节刷题</div>
        </div>
      </div>
      <label class="auto-wrong-label">
        <input type="checkbox" v-model="autoAddWrong" /> 错题自动加入错题本
      </label>
      <button class="btn" style="font-size:12px" @click="showApiKeyInput = !showApiKeyInput" :title="apiKeySaved ? 'AI 分析已就绪' : '设置 API Key'">
        {{ apiKeySaved ? '🤖 AI 已就绪' : '🔑 AI 分析' }}
      </button>
      <div v-if="showApiKeyInput" style="display:flex;gap:6px;align-items:center">
        <input v-model="apiKeyInput" type="password" placeholder="Anthropic API Key" style="width:200px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px" />
        <button class="btn" style="font-size:11px;padding:4px 10px" @click="saveApiKey">保存</button>
      </div>
    </div>

    <!-- Type mode -->
    <template v-if="mode === 'type'">
      <p style="color:var(--text-light);margin-bottom:16px;font-size:14px">共 {{ typeCounts.all }} 个知识点</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
        <button class="btn" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部 ({{ typeCounts.all }})</button>
        <button class="btn" :class="{ active: filter === 'qa' }" @click="filter = 'qa'">问答 ({{ typeCounts.qa }})</button>
        <button class="btn" :class="{ active: filter === 'mc' }" @click="filter = 'mc'">选择 ({{ typeCounts.mc }})</button>
        <button class="btn" :class="{ active: filter === 'table' }" @click="filter = 'table'">表格 ({{ typeCounts.table }})</button>
      </div>

      <div class="search-results">
        <div v-for="item in typeItems" :key="item.id" class="card">
          <div style="font-size:11px;color:var(--text-light);margin-bottom:4px">
            {{ item._section }} › {{ item._chapter }} › {{ item._topic }}
            <span class="tag" style="margin-left:6px">{{ item.type === 'multiple_choice' ? '选择' : item.type === 'qa' ? '问答' : '表格' }}</span>
            <span v-if="item.years && item.years.length" style="margin-left:6px">📅 {{ item.years.join('、') }}</span>
          </div>

          <img v-for="(img, ii) in item.images" :key="'i'+ii" :src="img" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0" />

          <template v-if="item.type === 'qa'">
            <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>
            <div v-if="!getQAState(item.id).submitted" class="qa-practice-area">
              <textarea v-model="getQAState(item.id).userInput" class="qa-textarea" placeholder="输入答案…" rows="3" @keydown.enter.prevent="submitQA(item)"></textarea>
              <button class="btn" @click="submitQA(item)" :disabled="!getQAState(item.id).userInput.trim()">提交</button>
            </div>
            <div v-else class="qa-result">
              <div v-if="getQAState(item.id).isCorrect === true" class="fb-correct">🎉 回答正确！</div>
              <div v-else-if="getQAState(item.id).isCorrect === false" class="fb-wrong">😞 与参考答案有差异</div>
              <div v-else class="fb-info">📝 已提交（无标准答案比对）</div>
              <div class="qa-a" v-if="item.answer">✅ 参考答案：{{ item.answer }}</div>
              <div v-if="getQAState(item.id).userInput" style="font-size:13px;color:var(--text-light)">你的答案：{{ getQAState(item.id).userInput }}</div>
              <div class="qa-exp" v-if="item.explanation" v-html="renderTextWithBlanks(item.explanation)"></div>
              <!-- AI 分析 -->
              <div style="margin-top:12px" v-if="!apiKeySaved">
                <button class="btn" style="font-size:12px" @click="showApiKeyInput = !showApiKeyInput">🔑 设置 API Key 以启用 AI 分析</button>
                <div v-if="showApiKeyInput" style="margin-top:8px;display:flex;gap:8px">
                  <input v-model="apiKeyInput" type="password" placeholder="输入 Anthropic API Key" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px" />
                  <button class="btn" style="font-size:12px" @click="saveApiKey">保存</button>
                </div>
              </div>
              <div v-else-if="getQAState(item.id).userInput">
                <button class="btn" style="font-size:12px;margin-top:8px" @click="analyzeWithAI(item)" :disabled="getQAState(item.id).aiLoading">
                  {{ getQAState(item.id).aiLoading ? '🤖 AI 分析中…' : '🤖 AI 分析我的答案' }}
                </button>
                <div v-if="getQAState(item.id).aiResult" class="qa-exp" style="margin-top:8px;white-space:pre-wrap">
                  <div v-if="getQAState(item.id).aiResult.error" style="color:#ff4d4f">{{ getQAState(item.id).aiResult.error }}</div>
                  <div v-else>
                    <div style="font-weight:700;margin-bottom:4px">🤖 AI 评分：{{ getQAState(item.id).aiResult.score }} 分</div>
                    <div>{{ getQAState(item.id).aiResult.analysis }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="item.type === 'multiple_choice'">
            <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>

            <!-- 单选模式 -->
            <template v-if="!isMultiChoice(item)">
              <ul class="mc-list" v-if="item.options">
                <li v-for="opt in item.options" :key="opt.label"
                    :class="getMCOptClass(item.id, opt.label, item.answer)"
                    @click="selectSingle(item, opt.label)">
                  <span class="mc-label">{{ opt.label }}</span>
                  <span class="mc-text">{{ opt.text }}</span>
                </li>
              </ul>
              <div v-if="getMCState(item.id).showAnswer" style="margin-top:8px;font-weight:600">
                <span v-if="!item.answer" style="color:var(--jade)">📖 未标注标准答案</span>
                <span v-else-if="getMCState(item.id).selected[0] === item.answer" class="fb-correct">🎉 正确！</span>
                <span v-else class="fb-wrong">😞 正确答案：{{ getOptText(item.options, item.answer) }}</span>
              </div>
            </template>

            <!-- 多选模式 -->
            <template v-else>
              <ul class="mc-list" v-if="item.options">
                <li v-for="opt in item.options" :key="opt.label"
                    :class="getMCOptClass(item.id, opt.label, item.answer)"
                    @click="toggleMulti(item, opt.label)">
                  <span class="mc-check">{{ getMCState(item.id).selected.includes(opt.label) ? '☑' : '☐' }}</span>
                  <span class="mc-text">{{ opt.label }}. {{ opt.text }}</span>
                </li>
              </ul>
              <button class="btn" v-if="!getMCState(item.id).showAnswer"
                      @click="confirmMulti(item)"
                      :disabled="getMCState(item.id).selected.length === 0"
                      style="margin-top:8px">
                确认选择
              </button>
              <div v-if="getMCState(item.id).showAnswer" style="margin-top:8px;font-weight:600">
                <template v-if="getMCFeedback(item.id, item)">
                  <span v-if="getMCFeedback(item.id, item).isCorrect" class="fb-correct">🎉 正确！</span>
                  <span v-else class="fb-wrong">
                    😞 错误！正确答案：
                    <template v-for="(a, ai) in getMCFeedback(item.id, item).correctAnswers" :key="a">
                      <template v-if="ai > 0">, </template>
                      {{ getOptText(item.options, a) }}
                    </template>
                    （你选了：
                    <template v-for="(s, si) in getMCState(item.id).selected" :key="s">
                      <template v-if="si > 0">, </template>
                      {{ s }}
                    </template>）
                  </span>
                </template>
                <span v-else style="color:var(--jade)">📖 已提交（无标准答案比对）</span>
              </div>
            </template>

            <div class="qa-exp" v-if="item.explanation && getMCState(item.id).showAnswer" v-html="renderTextWithBlanks(item.explanation)"></div>
          </template>

          <template v-else-if="item.type === 'table'">
            <button class="btn" style="font-size:12px;margin-bottom:6px" @click="revealAll(item.id)">👁 一键显示</button>
            <button class="btn" style="font-size:12px;margin-bottom:6px;margin-left:6px" @click="hideAll(item.id)">🙈 一键隐藏</button>
            <table class="data-table">
              <thead><tr><th v-for="(h, hi) in item.headers" :key="hi">{{ h }}</th></tr></thead>
              <tbody>
                <tr v-for="(row, ri) in item.rows" :key="ri">
                  <td v-for="(cell, ci) in row" :key="ci" :class="{ 'cell-hidden': isCellHidden(item.id, ri, ci) }" @click="toggleCell(item.id, ri, ci)">
                    <template v-if="isCellHidden(item.id, ri, ci)"><span class="cell-placeholder">···</span></template>
                    <template v-else>{{ cell }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>
      </div>

      <div v-if="typeItems.length === 0" class="empty"><p>没有匹配的知识点</p></div>
    </template>

    <!-- Chapter mode -->
    <template v-if="mode === 'chapter'">
      <p style="color:var(--text-light);margin-bottom:16px;font-size:14px">共 {{ allChapters.length }} 个章节</p>
      <div class="chapter-grid">
        <div v-for="ch in allChapters" :key="ch.title" class="card chapter-card-item" @click="goChapterPractice(ch)">
          <div class="chapter-card-title">{{ ch.title }}</div>
          <div class="chapter-card-meta">
            <span class="tag">{{ ch.sectionTitle }}</span>
            <span style="font-size:12px;color:var(--text-light)">{{ ch.itemCount }} 题</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.loading { text-align:center;padding:60px 0;color:var(--text-light);font-size:16px }
.dropdown { position:relative;display:inline-block }
.dropdown-toggle { cursor:pointer }
.dropdown-menu { position:absolute;top:100%;left:0;margin-top:4px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.1);z-index:200;min-width:160px;overflow:hidden }
.dropdown-item { padding:10px 18px;font-size:14px;cursor:pointer;color:var(--text) }
.dropdown-item:hover { background:var(--accent-bg);color:var(--accent) }
.dropdown-item.active { background:var(--accent-bg);color:var(--accent);font-weight:600 }
.auto-wrong-label { display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-light);cursor:pointer;user-select:none }
.auto-wrong-label input { accent-color:var(--accent);width:16px;height:16px }
.qa-practice-area { margin:12px 0 }
.qa-textarea { width:100%;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-size:15px;font-family:inherit;resize:vertical;outline:none;background:var(--card-bg);color:var(--text-h) }
.qa-textarea:focus { border-color:var(--accent) }
.qa-result { margin-top:12px }
.fb-correct { color:#52c41a;font-weight:700;font-size:16px }
.fb-wrong { color:#ff4d4f;font-weight:700;font-size:16px }
.fb-info { color:var(--accent);font-weight:600;font-size:16px }
.mc-list { list-style:none;padding:0;margin:8px 0 }
.mc-list li { display:flex;align-items:center;gap:8px;padding:10px 14px;margin:4px 0;border-radius:8px;border:1.5px solid var(--border);font-size:15px;transition:all .15s }
.mc-opt-clickable { cursor:pointer }
.mc-opt-clickable:hover { border-color:var(--accent);background:var(--accent-bg) }
.mc-opt-correct { border-color:#52c41a!important;background:#f6ffed!important }
.mc-opt-wrong { border-color:#ff4d4f!important;background:#fff2f0!important }
.mc-opt-selected { border-color:var(--accent)!important;background:var(--accent-bg)!important }
.mc-opt-dimmed { opacity:.5 }
.mc-label { width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--accent-bg);color:var(--accent);font-weight:700;font-size:13px;flex-shrink:0 }
.mc-text { flex:1 }
.mc-badge { font-size:12px;flex-shrink:0 }
.chapter-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px }
.chapter-card-item { cursor:pointer;padding:14px 18px;transition:transform .15s }
.chapter-card-item:hover { transform:translateY(-2px) }
.chapter-card-title { font-size:15px;font-weight:600;color:var(--text-h);margin-bottom:6px }
.chapter-card-meta { display:flex;align-items:center;justify-content:space-between }
</style>
