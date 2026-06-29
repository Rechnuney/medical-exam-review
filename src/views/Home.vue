<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getExamData, getAllChapters } from '../utils/dataProcessor.js'

const route = useRoute()
const router = useRouter()
const subjectId = computed(() => route.params.subjectId)

const loading = ref(true)
const examData = ref(null)

onMounted(async () => {
  examData.value = await getExamData(subjectId.value)
  loading.value = false
})

const sections = computed(() => examData.value?.sections || [])

function goSection(sec) {
  const realIdx = sections.value.findIndex(s => s.id === sec.id)
  router.push({ name: 'section', params: { subjectId: subjectId.value, id: realIdx } })
}

const allChapters = computed(() => {
  if (!examData.value) return []
  return getAllChapters(subjectId.value).map(ch => {
    let count = 0
    examData.value.sections.forEach(sec => {
      sec.chapters.forEach(c => {
        if (c.title === ch.title) {
          c.topics.forEach(t => {
            t.subTopics.forEach(st => {
              count += st.knowledgePoints.length
            })
          })
        }
      })
    })
    return { ...ch, itemCount: count }
  })
})

function goChapter(ch) {
  router.push({ name: 'reviewChapter', params: { subjectId: subjectId.value, chapterName: ch.title } })
}
</script>

<template>
  <div v-if="loading" class="loading">加载中…</div>
  <div v-else>
    <h1 class="page-title">📚 复习资料</h1>
    <p style="color:var(--text-light);margin-bottom:24px">
      共 {{ examData.stats.totalItems }} 个知识点，覆盖 {{ examData.stats.totalChapters }} 个章节
    </p>

    <h2 style="font-size:17px;color:var(--text-h);margin-bottom:12px">📂 学科分类</h2>
    <div class="section-grid">
      <div v-for="sec in sections" :key="sec.id" class="card section-card" @click="goSection(sec)">
        <h3>{{ sec.title }}</h3>
        <div class="meta">
          {{ sec.chapters.length }} 章 · {{ sec.chapters.reduce((s, ch) => s + ch.topics.length, 0) }} 节
        </div>
      </div>
    </div>

    <h2 style="font-size:17px;color:var(--text-h);margin:28px 0 12px">📖 按章节复习</h2>
    <div class="chapter-grid">
      <div v-for="ch in allChapters" :key="ch.title" class="card chapter-card-item" @click="goChapter(ch)">
        <div class="chapter-card-title">{{ ch.title }}</div>
        <div class="chapter-card-meta">
          <span class="tag">{{ ch.sectionTitle }}</span>
          <span style="font-size:12px;color:var(--text-light)">{{ ch.itemCount }} 题</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading { text-align:center;padding:60px 0;color:var(--text-light);font-size:16px }
.chapter-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px }
.chapter-card-item { cursor:pointer;padding:14px 18px;transition:transform .15s }
.chapter-card-item:hover { transform:translateY(-2px) }
.chapter-card-title { font-size:15px;font-weight:600;color:var(--text-h);margin-bottom:6px }
.chapter-card-meta { display:flex;align-items:center;justify-content:space-between }
</style>
