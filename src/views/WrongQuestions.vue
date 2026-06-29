<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getWrongQuestions, removeWrongQuestion, addWrongQuestion, clearWrongBook } from '../utils/wrongBook.js'
import { cleanQuestionDisplay, renderTextWithBlanks } from '../utils/dataProcessor.js'

const route = useRoute()
const subjectId = computed(() => route.params.subjectId)

const list = ref([])
const practiceMode = ref(false)
const autoAddWrong = ref(true)

function refreshList() {
  list.value = getWrongQuestions(subjectId.value)
}
onMounted(refreshList)

function remove(id) {
  removeWrongQuestion(subjectId.value, id)
  refreshList()
}
function clearAll() {
  if (confirm('确定要清空该科目的所有错题吗？')) {
    clearWrongBook(subjectId.value)
    refreshList()
  }
}

// Practice state
const qaStates = ref({})
function getQAState(id) {
  if (!qaStates.value[id]) qaStates.value[id] = { userInput: '', submitted: false, isCorrect: null }
  return qaStates.value[id]
}
function submitQA(item) {
  const state = getQAState(item.id)
  if (state.submitted) return
  state.submitted = true
  const ua = state.userInput.trim()
  state.isCorrect = ua !== '' && ua === (item.correctAnswer || '').trim()
  if (!state.isCorrect && autoAddWrong.value) {
    addWrongQuestion(subjectId.value, {
      id: item.id, section: item.section, chapter: item.chapter, topic: item.topic,
      type: item.type, question: item.question, options: item.options || [],
      correctAnswer: item.correctAnswer || '', userAnswer: state.userInput,
    })
  }
}

// ── 判断单选/多选 ──
function isMultiChoice(item) {
  if (!item.correctAnswer) return false
  const answer = item.correctAnswer.trim()
  if (/^[A-E]{2,}$/.test(answer)) return true
  if (answer.includes(',')) return true
  return false
}

const mcStates = ref({})
function getMCState(id) {
  if (!mcStates.value[id]) mcStates.value[id] = { selected: [], showAnswer: false }
  return mcStates.value[id]
}

// 单选题
function selectSingle(item, label) {
  const state = getMCState(item.id)
  if (state.showAnswer) return
  state.selected = [label]
  state.showAnswer = true
  if (!item.correctAnswer) return
  const correctAnswers = (item.correctAnswer || '').split(',').map(function(a) { return a.trim(); })
  const isCorrect = correctAnswers.includes(label)
  if (!isCorrect && autoAddWrong.value) {
    addWrongQuestion(subjectId.value, {
      id: item.id, section: item.section, chapter: item.chapter, topic: item.topic,
      type: item.type, question: item.question, options: item.options || [],
      correctAnswer: item.correctAnswer || '', userAnswer: label,
    })
  }
}

// 多选题
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
  if (!item.correctAnswer) return
  const correctAnswers = (item.correctAnswer || '').split(',').map(function(a) { return a.trim(); })
  const isCorrect = state.selected.length === correctAnswers.length &&
    state.selected.every(function(s) { return correctAnswers.includes(s); })
  if (!isCorrect && autoAddWrong.value) {
    addWrongQuestion(subjectId.value, {
      id: item.id, section: item.section, chapter: item.chapter, topic: item.topic,
      type: item.type, question: item.question, options: item.options || [],
      correctAnswer: item.correctAnswer || '', userAnswer: state.selected.join(','),
    })
  }
}

function getMCOptClass(id, label, correct) {
  const state = getMCState(id)
  if (!state.showAnswer) {
    if (state.selected.includes(label)) return 'mc-opt-selected'
    return 'mc-opt-clickable'
  }
  if (!correct) {
    if (state.selected.includes(label)) return 'mc-opt-selected'
    return 'mc-opt-dimmed'
  }
  const answers = (correct || '').split(',').map(function(a) { return a.trim(); })
  if (answers.includes(label)) return 'mc-opt-correct'
  if (state.selected.includes(label)) return 'mc-opt-wrong'
  return 'mc-opt-dimmed'
}
function getMCFeedback(id, item) {
  const state = getMCState(id)
  if (!state.showAnswer || !item.correctAnswer) return null
  const correctAnswers = (item.correctAnswer || '').split(',').map(function(a) { return a.trim(); })
  const userSelected = state.selected.slice().sort()
  const isCorrect = userSelected.length === correctAnswers.length &&
    userSelected.every(function(s) { return correctAnswers.includes(s); })
  return { isCorrect, correctAnswers }
}
function getOptText(opts, label) {
  const o = opts?.find(x => x.label === label)
  return o ? `${o.label}. ${o.text}` : label
}
function isCorrectOpt(label, correctAnswer) {
  if (!correctAnswer) return false
  return correctAnswer.split(',').map(function(a) { return a.trim(); }).includes(label)
}
</script>

<template>
  <div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <h1 class="page-title" style="margin:0">📝 错题本</h1>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn" :class="{ active: !practiceMode }" @click="practiceMode = false">复习模式</button>
        <button class="btn" :class="{ active: practiceMode }" @click="practiceMode = true">练习模式</button>
        <button class="btn btn-danger" @click="clearAll" v-if="list.length">清空</button>
      </div>
    </div>

    <p style="color:var(--text-light);margin-bottom:16px" v-if="list.length">共 {{ list.length }} 道错题</p>

    <label v-if="practiceMode" class="auto-wrong-label" style="margin-bottom:16px;display:inline-flex">
      <input type="checkbox" v-model="autoAddWrong" /> 错题自动加入错题本
    </label>

    <div class="search-results">
      <div v-for="item in list" :key="item.id" class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:11px;color:var(--text-light)">
            {{ item.section }} › {{ item.chapter }} › {{ item.topic }}
            <span class="tag" style="margin-left:6px">{{ item.type === 'multiple_choice' ? '选择' : '问答' }}</span>
            <span style="margin-left:6px">答错 {{ item.attempts || 1 }} 次</span>
          </div>
          <button class="btn btn-sm" @click="remove(item.id)" title="已掌握">✅ 已掌握</button>
        </div>

        <!-- Review Mode -->
        <template v-if="!practiceMode">
          <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>
          <template v-if="item.type === 'qa'">
            <div class="qa-a">✅ 正确答案：{{ item.correctAnswer }}</div>
            <div style="font-size:13px;color:#ff4d4f;margin-top:4px">❌ 你的答案：{{ item.userAnswer }}</div>
          </template>
          <template v-else-if="item.type === 'multiple_choice'">
            <ul class="mc-list" v-if="item.options && item.options.length">
              <li v-for="opt in item.options" :key="opt.label"
                  :class="{
                    'opt-correct-li': isCorrectOpt(opt.label, item.correctAnswer),
                    'opt-wrong-li': opt.label === item.userAnswer && !isCorrectOpt(opt.label, item.correctAnswer)
                  }">
                <span class="mc-label">{{ opt.label }}</span>
                <span class="mc-text">{{ opt.text }}</span>
                <span v-if="isCorrectOpt(opt.label, item.correctAnswer)" style="color:#52c41a;margin-left:6px;font-size:12px">✅</span>
                <span v-if="opt.label === item.userAnswer && !isCorrectOpt(opt.label, item.correctAnswer)" style="color:#ff4d4f;margin-left:6px;font-size:12px">❌ 你的选择</span>
              </li>
            </ul>
          </template>
        </template>

        <!-- Practice Mode -->
        <template v-else>
          <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>

          <!-- 单选 -->
          <template v-if="item.type === 'multiple_choice' && !isMultiChoice(item)">
            <ul class="mc-list" v-if="item.options">
              <li v-for="opt in item.options" :key="opt.label"
                  :class="getMCOptClass(item.id, opt.label, item.correctAnswer)"
                  @click="selectSingle(item, opt.label)">
                <span class="mc-label">{{ opt.label }}</span>
                <span class="mc-text">{{ opt.text }}</span>
              </li>
            </ul>
            <div v-if="getMCState(item.id).showAnswer" style="margin-top:8px;font-weight:600">
              <span v-if="!item.correctAnswer" style="color:var(--jade)">📖 未标注标准答案</span>
              <span v-else-if="getMCState(item.id).selected[0] === item.correctAnswer" class="fb-correct">🎉 正确！</span>
              <span v-else class="fb-wrong">😞 正确答案：{{ getOptText(item.options, item.correctAnswer) }}</span>
            </div>
          </template>

          <!-- 多选 -->
          <template v-else-if="item.type === 'multiple_choice' && isMultiChoice(item)">
            <ul class="mc-list" v-if="item.options">
              <li v-for="opt in item.options" :key="opt.label"
                  :class="getMCOptClass(item.id, opt.label, item.correctAnswer)"
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
                  😞 正确答案：
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
            </div>
          </template>

          <template v-if="item.type === 'qa'">
            <div v-if="!getQAState(item.id).submitted" class="qa-practice-area">
              <textarea v-model="getQAState(item.id).userInput" class="qa-textarea" placeholder="在此输入你的答案…" rows="3" @keydown.enter.prevent="submitQA(item)"></textarea>
              <button class="btn" @click="submitQA(item)">提交答案</button>
            </div>
            <div v-else class="qa-result">
              <div v-if="getQAState(item.id).isCorrect" class="fb-correct">🎉 回答正确！</div>
              <div v-else class="fb-wrong">😞 回答错误，正确答案：{{ item.correctAnswer }}</div>
            </div>
          </template>
        </template>
      </div>
    </div>

    <div v-if="list.length === 0" class="empty">
      <div class="icon">🎉</div>
      <p>错题本为空，继续保持！</p>
    </div>
  </div>
</template>

<style scoped>
.auto-wrong-label { display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-light);cursor:pointer;user-select:none }
.auto-wrong-label input { accent-color:var(--accent);width:16px;height:16px }
.btn-sm { padding:4px 10px;font-size:12px }
.btn-danger { color:#ff4d4f;border-color:#ff4d4f }
.opt-correct-li { background:#f6ffed;border-radius:4px;padding:4px 8px;margin:2px -8px }
.opt-wrong-li { background:#fff2f0;border-radius:4px;padding:4px 8px;margin:2px -8px }
.mc-list { list-style:none;padding:0;margin:8px 0 }
.mc-list li { display:flex;align-items:center;gap:8px;padding:10px 14px;margin:4px 0;border-radius:8px;border:1.5px solid var(--border);font-size:15px;transition:all .15s }
.mc-opt-clickable { cursor:pointer }
.mc-opt-clickable:hover { border-color:var(--accent);background:var(--accent-bg) }
.mc-opt-correct { border-color:#52c41a!important;background:#f6ffed!important }
.mc-opt-wrong { border-color:#ff4d4f!important;background:#fff2f0!important }
.mc-opt-dimmed { opacity:.5 }
.mc-label { width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--accent-bg);color:var(--accent);font-weight:700;font-size:13px;flex-shrink:0 }
.mc-text { flex:1 }
.mc-badge { font-size:12px;flex-shrink:0 }
.qa-practice-area { margin:12px 0 }
.qa-textarea { width:100%;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-size:15px;font-family:inherit;resize:vertical;outline:none;background:var(--card-bg);color:var(--text-h) }
.qa-textarea:focus { border-color:var(--accent) }
.qa-result { margin-top:12px }
.fb-correct { color:#52c41a;font-weight:700;font-size:16px }
.fb-wrong { color:#ff4d4f;font-weight:700;font-size:16px }
</style>
