<script setup>
import { useRouter } from 'vue-router'
import { getSubjects } from '../utils/subjectRegistry.js'

const router = useRouter()
const subjects = getSubjects()

function selectSubject(id) {
  router.push({ name: 'home', params: { subjectId: id } })
}
</script>

<template>
  <div>
    <h1 class="page-title">📚 选择复习学科</h1>
    <p style="color:var(--text-light);margin-bottom:28px">
      请选择你要复习的学科，每个学科的复习资料独立管理
    </p>
    <div class="section-grid">
      <div
        v-for="s in subjects"
        :key="s.id"
        class="card section-card"
        @click="selectSubject(s.id)"
      >
        <div class="subject-icon">{{ s.icon }}</div>
        <h3>{{ s.name }}</h3>
        <div class="meta">{{ s.subtitle }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subject-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
</style>
