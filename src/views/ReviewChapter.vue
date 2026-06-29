<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getExamData, getAllChapters, getChapterItems, cleanQuestionDisplay, renderTextWithBlanks } from '../utils/dataProcessor.js'

const route = useRoute()
const router = useRouter()
const subjectId = computed(() => route.params.subjectId)
const currentChapter = computed(() => route.params.chapterName)

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
  if (!loading.value) {
    items.value = getChapterItems(subjectId.value, name)
  }
})

const allChapters = computed(() => {
  if (!examData.value) return []
  return getAllChapters(subjectId.value)
})

function selectChapter(name) {
  sidebarOpen.value = false
  router.replace({ name: 'reviewChapter', params: { subjectId: subjectId.value, chapterName: name } })
}
</script>

<template>
  <div class="sidebar-trigger" @click="sidebarOpen = !sidebarOpen">☰</div>
  <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false"></div>

  <div class="sidebar" :class="{ open: sidebarOpen }">
    <h3 style="margin:0 0 16px;font-size:16px">📚 章节列表</h3>
    <div v-for="ch in allChapters" :key="ch.title"
         class="sidebar-item" :class="{ active: ch.title === currentChapter }"
         @click="selectChapter(ch.title)">
      <div class="sidebar-item-title">{{ ch.title }}</div>
      <div style="font-size:11px;color:var(--text-light)">{{ ch.sectionTitle }}</div>
    </div>
  </div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else>
    <button class="btn" @click="router.push({ name: 'home', params: { subjectId } })" style="margin-bottom:16px">← 返回复习</button>
    <h1 class="page-title">{{ currentChapter }}</h1>
    <p style="color:var(--text-light);margin-bottom:20px">共 {{ items.length }} 题</p>

    <div v-for="item in items" :key="item.id" class="card">
      <div style="font-size:11px;color:var(--text-light);margin-bottom:4px">
        {{ item._section }} › {{ item._topic }}
        <span class="tag" style="margin-left:6px">{{ item.type === 'multiple_choice' ? '选择' : item.type === 'qa' ? '问答' : item.type }}</span>
        <span v-if="item.years && item.years.length" style="margin-left:6px">📅 {{ item.years.join('、') }}</span>
      </div>

      <img v-for="(img, ii) in item.images" :key="'i'+ii" :src="img" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0" />

      <template v-if="item.type === 'qa'">
        <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>
        <div class="qa-a" v-if="item.answer">{{ item.answer }}</div>
        <div class="qa-exp" v-if="item.explanation" v-html="renderTextWithBlanks(item.explanation)"></div>
      </template>

      <template v-else-if="item.type === 'multiple_choice'">
        <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>
        <ul class="opt-list" v-if="item.options && item.options.length">
          <li v-for="opt in item.options" :key="opt.label" :class="{ 'opt-correct-li': opt.label === item.answer }">
            <strong>{{ opt.label }}.</strong> {{ opt.text }}
            <span v-if="opt.label === item.answer" style="color:#52c41a;margin-left:6px;font-size:12px">✅ 答案</span>
          </li>
        </ul>
        <div class="qa-a" v-if="item.answer" style="margin-top:6px">正确答案：{{ item.answer }}</div>
        <div class="qa-exp" v-if="item.explanation" v-html="renderTextWithBlanks(item.explanation)"></div>
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
.sidebar-trigger { position:fixed;left:0;top:50%;transform:translateY(-50%);background:var(--accent);color:#fff;padding:12px 8px;border-radius:0 8px 8px 0;cursor:pointer;z-index:300;font-size:18px }
.sidebar { position:fixed;left:-280px;top:0;bottom:0;width:260px;background:var(--card-bg);border-right:1px solid var(--border);padding:20px;overflow-y:auto;z-index:400;transition:left .25s }
.sidebar.open { left:0 }
.overlay { position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:350 }
.sidebar-item { padding:10px 12px;border-radius:6px;cursor:pointer;margin-bottom:4px }
.sidebar-item:hover,.sidebar-item.active { background:var(--accent-bg);color:var(--accent) }
.sidebar-item-title { font-size:14px;font-weight:500 }
.opt-correct-li { background:#f6ffed;border-radius:4px;padding:4px 8px;margin:2px -8px }
</style>
