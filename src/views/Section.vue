<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getExamData, cleanQuestionDisplay, renderTextWithBlanks } from '../utils/dataProcessor.js'

const route = useRoute()
const router = useRouter()
const subjectId = computed(() => route.params.subjectId)

const loading = ref(true)
const examData = ref(null)

onMounted(async () => {
  examData.value = await getExamData(subjectId.value)
  loading.value = false
})

const section = computed(() => {
  if (!examData.value) return null
  const idx = parseInt(route.params.id)
  return examData.value.sections[idx] || null
})
</script>

<template>
  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="section">
    <button class="btn" @click="router.push({ name: 'home', params: { subjectId } })" style="margin-bottom:16px">← 返回复习</button>
    <h1 class="page-title">{{ section.title }}</h1>

    <div class="chapter-list">
      <div v-for="chapter in section.chapters" :key="chapter.id" class="card chapter-item">
        <h4>{{ chapter.title }}</h4>
        <div v-for="topic in chapter.topics" :key="topic.id" style="margin-top:12px">
          <h5 style="margin:0 0 8px;font-size:14px;color:var(--accent)">
            {{ topic.title !== '未分类' ? '📖 ' + topic.title : '' }}
          </h5>
          <div v-for="st in topic.subTopics" :key="st.id">
            <template v-for="item in st.knowledgePoints" :key="item.id">
              <!-- Images -->
              <img v-for="(img, ii) in item.images" :key="'img'+ii" :src="img" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0" />

              <div v-if="item.type === 'qa'" class="qa-block">
                <div class="qa-y" v-if="item.years && item.years.length">📅 {{ item.years.join('、') }}</div>
                <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>
                <div class="qa-a" v-if="item.answer">{{ item.answer }}</div>
                <div class="qa-exp" v-if="item.explanation" v-html="renderTextWithBlanks(item.explanation)"></div>
              </div>

              <div v-else-if="item.type === 'multiple_choice'" class="qa-block">
                <div class="qa-y" v-if="item.years && item.years.length">📅 {{ item.years.join('、') }}</div>
                <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="renderTextWithBlanks(cleanQuestionDisplay(item.question))"></span></div>
                <ul class="opt-list" v-if="item.options && item.options.length">
                  <li v-for="opt in item.options" :key="opt.label" :class="{ 'opt-correct-li': opt.label === item.answer }">
                    <strong>{{ opt.label }}.</strong> {{ opt.text }}
                    <span v-if="opt.label === item.answer" style="color:#52c41a;margin-left:6px;font-size:12px">✅ 答案</span>
                  </li>
                </ul>
                <div class="qa-a" v-if="item.answer" style="margin-top:6px">正确答案：{{ item.answer }}</div>
                <div class="qa-exp" v-if="item.explanation" v-html="renderTextWithBlanks(item.explanation)"></div>
              </div>

              <div v-else-if="item.type === 'table'" style="overflow-x:auto;margin:12px 0">
                <table class="data-table">
                  <thead><tr><th v-for="h in item.headers" :key="h">{{ h }}</th></tr></thead>
                  <tbody><tr v-for="(row, ri) in item.rows" :key="ri"><td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td></tr></tbody>
                </table>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="empty">
    <div class="icon">📭</div>
    <p>章节未找到</p>
  </div>
</template>

<style scoped>
.loading { text-align:center;padding:60px 0;color:var(--text-light);font-size:16px }
.opt-correct-li { background:#f6ffed;border-radius:4px;padding:4px 8px;margin:2px -8px }
</style>
