<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getSubjectMeta } from './utils/subjectRegistry.js'

const route = useRoute()

const subjectId = computed(() => route.params.subjectId || null)
const subjectMeta = computed(() => subjectId.value ? getSubjectMeta(subjectId.value) : null)
const isSubjectPage = computed(() => !!subjectId.value && route.name !== 'subjectSelect')
</script>

<template>
  <div class="app-shell">
    <nav class="nav">
      <div class="nav-inner">
        <router-link :to="isSubjectPage ? { name: 'home', params: { subjectId } } : '/'" class="brand">
          {{ subjectMeta ? `${subjectMeta.icon} ${subjectMeta.name}` : '📚 医学复习' }}
        </router-link>
        <div class="nav-links" v-if="isSubjectPage">
          <router-link :to="'/'">切换学科</router-link>
          <router-link :to="{ name: 'home', params: { subjectId } }">复习</router-link>
          <router-link :to="{ name: 'browse', params: { subjectId } }">刷题</router-link>
          <router-link :to="{ name: 'search', params: { subjectId } }">搜索</router-link>
          <router-link :to="{ name: 'wrongQuestions', params: { subjectId } }">错题本</router-link>
        </div>
      </div>
    </nav>
    <main class="main">
      <router-view />
    </main>
    <footer class="footer">
      <span v-if="subjectMeta">{{ subjectMeta.name }} · 期末复习资料</span>
      <span v-else>医学期末复习资料</span>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
