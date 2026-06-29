<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getExamData, getAllChapters, getChapterItems, cleanQuestionDisplay, renderTextWithBlanks } from '../utils/dataProcessor.js'
import { addWrongQuestion } from '../utils/wrongBook.js'

const route = useRoute()
const router = useRouter()
const subjectId = computed(() => route.params.subjectId)
const currentChapter = computed(() => route.params.chapterName)
const autoAddWrong = ref(true)

const loading = ref(true)
const examData = ref(null)
const items = ref([])
const sidebarOpen = ref(false)

onMounted(async () => {
  examData.value = await getExamData(subjectId.value)
  items.value = getChapterItems(subjectId.value, currentChapter.value)
  loading.value = false
})

watch(currentChapter, (name) => {
  if (!loading.value) items.value = getChapterItems(subjectId.value, name)
})

const allChapters = computed(() => examData.value ? getAllChapters(subjectId.value) : [])

function selectChapter(name) {
  sidebarOpen.value = false
  router.replace({ name: 'practiceChapter', params: { subjectId: subjectId.value, chapterName: name } })
}

// QA
const qaStates = ref({})
function getQAState(itemId) {
  if (!qaStates.value[itemId]) qaStates.value[itemId] = { userInput: '', submitted: false, isCorrect: null }
  return qaStates.value[itemId]
}
function submitQA(item) {
  const state = getQAState(item.id)
  if (state.submitted) return
  state.submitted = true
  const userAnswer = state.userInput.trim()
  const correct = (item.answer || '').trim()
  state.isCorrect = userAnswer !== '' && userAnswer === correct
  if (!state.isCorrect && autoAddWrong.value && item.answer) {
    addWrongQuestion(subjectId.value, {
      id: item.id, section: item._section, chapter: item._chapter, topic: item._topic,
      type: item.type, question: item.question, options: [],
      correctAnswer: item.answer || '', userAnswer: state.userInput,
    })
  }
}

// MC
const mcStates = ref({})
function getMCState(itemId) {
  if (!mcStates.value[itemId]) mcStates.value[itemId] = { selected: [], showAnswer: false }
  return mcStates.value[itemId]
}
function toggleOption(item, label) {
  const state = getMCState(item.id)
  if (state.showAnswer) return
  const idx = state.selected.indexOf(label)
  if (idx >= 0) state.selected.splice(idx, 1)
  else state.selected.push(label)
}
function confirmMC(item) {
  const state = getMCState(item.id)
  if (state.selected.length === 0) return
  state.showAnswer = true
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
function getMCOptClass(itemId, label, correctAnswer) {
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
</script>

<template>
  <div class="sidebar-trigger" @click="sidebarOpen = !sidebarOpen">☰</div>
  <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false"></div>
  <div class="sidebar" :class="{ open: sidebarOpen }">
    <h3 style="margin:0 0 16px;font-size:16px">📚 章节列表</h3>
    <div v-for="ch in allChapters" :key="ch.title" class="sidebar-item" :class="{ active: ch.title === currentChapter }" @click="selectChapter(ch.title)">
      <div class="sidebar-item-title">{{ ch.title }}</div>
      <div style="font-size:11px;color:var(--text-light)">{{ ch.sectionTitle }}</div>
    </div>
  </div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn" @click="router.push({ name: 'browse', params: { subjectId } })">← 返回刷题</button>
      <label class="auto-wrong-label">
        <input type="checkbox" v-model="autoAddWrong" /> 错题自动加入错题本
      </label>
    </div>
    <h1 class="page-title">📝 {{ currentChapter }}</h1>
    <p style="color:var(--text-light);margin-bottom:20px">共 {{ items.length }} 题</p>

    <div v-for="item in items" :key="item.id" class="card">
      <div style="font-size:11px;color:var(--text-light);margin-bottom:4px">
        {{ item._section }} › {{ item._topic }}
        <span class="tag" style="margin-left:6px">{{ item.type === 'multiple_choice' ? '选择' : '问答' }}</span>
        <span v-if="item.years && item.years.length" style="margin-left:6px">📅 {{ item.years.join('、') }}</span>
      </div>

      <img v-for="(img, ii) in item.images" :key="'i'+ii" :src="img" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0" />

      <template v-if="item.type === 'qa'">
        <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>
        <div v-if="!getQAState(item.id).submitted" class="qa-practice-area">
          <textarea v-model="getQAState(item.id).userInput" class="qa-textarea" placeholder="在此输入你的答案…" rows="3" @keydown.enter.prevent="submitQA(item)"></textarea>
          <button class="btn" @click="submitQA(item)" :disabled="!getQAState(item.id).userInput.trim()">提交答案</button>
        </div>
        <div v-else class="qa-result">
          <div v-if="getQAState(item.id).isCorrect" class="fb-correct">🎉 回答正确！</div>
          <div v-else class="fb-wrong">😞 回答错误</div>
          <div class="qa-a" v-if="item.answer">✅ 正确答案：{{ item.answer }}</div>
          <div v-if="getQAState(item.id).userInput" style="font-size:13px;color:var(--text-light)">你的答案：{{ getQAState(item.id).userInput }}</div>
          <div class="qa-exp" v-if="item.explanation" v-html="renderTextWithBlanks(item.explanation)"></div>
        </div>
      </template>

      <template v-else-if="item.type === 'multiple_choice'">
        <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>
        <ul class="mc-list" v-if="item.options">
          <li v-for="opt in item.options" :key="opt.label"
              :class="getMCOptClass(item.id, opt.label, item.answer)"
              @click="toggleOption(item, opt.label)">
            <span class="mc-check">{{ getMCState(item.id).selected.includes(opt.label) ? '☑' : '☐' }}</span>
            <span class="mc-text">{{ opt.label }}. {{ opt.text }}</span>
          </li>
        </ul>
        <button class="btn" v-if="!getMCState(item.id).showAnswer"
                @click="confirmMC(item)"
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
        <div class="qa-exp" v-if="item.explanation && getMCState(item.id).showAnswer" v-html="renderTextWithBlanks(item.explanation)"></div>
      </template>

      <div v-else-if="item.type === 'table'" style="overflow-x:auto;margin:12px 0">
        <table class="data-table">
          <thead><tr><th v-for="h in item.headers" :key="h">{{ h }}</th></tr></thead>
          <tbody><tr v-for="(row, ri) in item.rows" :key="ri"><td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td></tr></tbody>
        </table>
      </div>
    </div>

    <div v-if="items.length === 0" class="empty"><p>该章节暂无题目</p></div>
  </div>
</template>

<style scoped>
.loading { text-align:center;padding:60px 0;color:var(--text-light);font-size:16px }
.auto-wrong-label { display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-light);cursor:pointer;user-select:none }
.auto-wrong-label input { accent-color:var(--accent);width:16px;height:16px }
.sidebar-trigger { position:fixed;left:0;top:50%;transform:translateY(-50%);background:var(--accent);color:#fff;padding:12px 8px;border-radius:0 8px 8px 0;cursor:pointer;z-index:300;font-size:18px }
.sidebar { position:fixed;left:-280px;top:0;bottom:0;width:260px;background:var(--card-bg);border-right:1px solid var(--border);padding:20px;overflow-y:auto;z-index:400;transition:left .25s }
.sidebar.open { left:0 }
.overlay { position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:350 }
.sidebar-item { padding:10px 12px;border-radius:6px;cursor:pointer;margin-bottom:4px }
.sidebar-item:hover,.sidebar-item.active { background:var(--accent-bg);color:var(--accent) }
.sidebar-item-title { font-size:14px;font-weight:500 }
.qa-practice-area { margin:12px 0 }
.qa-textarea { width:100%;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-size:15px;font-family:inherit;resize:vertical;outline:none;background:var(--card-bg);color:var(--text-h) }
.qa-textarea:focus { border-color:var(--accent) }
.qa-result { margin-top:12px }
.fb-correct { color:#52c41a;font-weight:700;font-size:16px }
.fb-wrong { color:#ff4d4f;font-weight:700;font-size:16px }
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
</style>
