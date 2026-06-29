import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const SubjectSelect = () => import('./views/SubjectSelect.vue')
const Home = () => import('./views/Home.vue')
const Section = () => import('./views/Section.vue')
const Browse = () => import('./views/Browse.vue')
const Search = () => import('./views/Search.vue')
const ReviewChapter = () => import('./views/ReviewChapter.vue')
const PracticeChapter = () => import('./views/PracticeChapter.vue')
const WrongQuestions = () => import('./views/WrongQuestions.vue')

const routes = [
  { path: '/', name: 'subjectSelect', component: SubjectSelect, meta: { title: '选择学科' } },
  { path: '/:subjectId', name: 'home', component: Home, meta: { title: '复习' } },
  { path: '/:subjectId/section/:id', name: 'section', component: Section, meta: { title: '章节' } },
  { path: '/:subjectId/browse', name: 'browse', component: Browse, meta: { title: '刷题' } },
  { path: '/:subjectId/search', name: 'search', component: Search, meta: { title: '搜索' } },
  { path: '/:subjectId/review/:chapterName', name: 'reviewChapter', component: ReviewChapter, meta: { title: '章节复习' } },
  { path: '/:subjectId/practice/:chapterName', name: 'practiceChapter', component: PracticeChapter, meta: { title: '章节刷题' } },
  { path: '/:subjectId/wrong-questions', name: 'wrongQuestions', component: WrongQuestions, meta: { title: '错题本' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 } },
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 医学复习` : '医学复习资料'
})

const app = createApp(App)
app.use(router)
app.mount('#app')
