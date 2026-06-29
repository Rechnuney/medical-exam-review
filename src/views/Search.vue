<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getExamData, searchItems, cleanQuestionDisplay, truncate, highlight } from '../utils/dataProcessor.js'

const route = useRoute()
const subjectId = computed(() => route.params.subjectId)

const loading = ref(true)
const examData = ref(null)
const query = ref('')
const results = ref([])

onMounted(async () => {
  examData.value = await getExamData(subjectId.value)
  loading.value = false
})

function doSearch() {
  results.value = searchItems(subjectId.value, query.value)
}
</script>

<template>
  <div>
    <h1 class="page-title">🔎 搜索知识点</h1>

    <div style="display:flex;gap:8px;margin-bottom:20px">
      <input
        v-model="query"
        class="search-input"
        placeholder="输入关键词搜索…"
        @input="doSearch"
        @keydown.enter="doSearch"
        autofocus
        :disabled="loading"
      />
    </div>

    <p style="font-size:13px;color:var(--text-light);margin-bottom:16px" v-if="results.length">
      找到 {{ results.length }} 条结果
    </p>

    <div class="search-results">
      <div v-for="item in results" :key="item.id" class="card">
        <div style="font-size:11px;color:var(--text-light);margin-bottom:4px">
          {{ item._section }} › {{ item._chapter }} › {{ item._topic }}
          <span class="tag" style="margin-left:6px">{{ item.type === 'multiple_choice' ? '选择' : item.type === 'qa' ? '问答' : item.type }}</span>
        </div>

        <img v-for="(img, ii) in item.images" :key="'i'+ii" :src="img" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0" />

        <template v-if="item.type === 'qa'">
          <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="highlight(cleanQuestionDisplay(item.question), query)"></span></div>
          <div class="qa-a" v-if="item.answer" v-html="highlight(truncate(item.answer, 300), query)"></div>
          <div class="qa-exp" v-if="item.explanation" v-html="highlight(truncate(item.explanation, 200), query)"></div>
        </template>

        <template v-else-if="item.type === 'multiple_choice'">
          <div class="qa-q"><span class="item-num">{{ item.num }}.</span><span v-html="highlight(cleanQuestionDisplay(item.question), query)"></span></div>
          <ul class="opt-list" v-if="item.options && item.options.length">
            <li v-for="opt in item.options.slice(0, 5)" :key="opt.label" :class="{ 'opt-correct-li': opt.label === item.answer }">
              <strong>{{ opt.label }}.</strong>
              <span v-html="highlight(opt.text, query)"></span>
              <span v-if="opt.label === item.answer" style="color:#52c41a;margin-left:6px;font-size:12px">✅ 答案</span>
            </li>
          </ul>
          <div class="qa-a" v-if="item.answer" style="margin-top:6px">正确答案：{{ item.answer }}</div>
          <div class="qa-exp" v-if="item.explanation" v-html="highlight(truncate(item.explanation, 200), query)"></div>
        </template>

        <div v-else-if="item.type === 'table'" style="overflow-x:auto;margin:12px 0">
          <table class="data-table">
            <thead><tr><th v-for="(h, hi) in item.headers" :key="hi">{{ h }}</th></tr></thead>
            <tbody><tr v-for="(row, ri) in item.rows" :key="ri"><td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="query && results.length === 0" class="empty">
      <div class="icon">🔍</div>
      <p>没有找到与 "{{ query }}" 相关的内容</p>
    </div>

    <div v-if="!query" class="empty">
      <div class="icon">💡</div>
      <p>输入关键词开始搜索</p>
    </div>
  </div>
</template>

<style scoped>
.opt-correct-li { background:#f6ffed;border-radius:4px;padding:4px 8px;margin:2px -8px }
</style>
