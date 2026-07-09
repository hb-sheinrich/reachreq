import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'Home', component: () => import('@/views/HomeView.vue') },
    { path: '/login', name: 'Login', component: () => import('@/views/LoginView.vue') },
    { path: '/auth/callback', name: 'Callback', component: () => import('@/views/CallbackView.vue') },
    { path: '/requirements', name: 'Requirements', component: () => import('@/views/RequirementsView.vue') },
    { path: '/requirements/:id', name: 'RequirementDetail', component: () => import('@/views/RequirementDetailView.vue') },
    { path: '/glossary', name: 'Glossary', component: () => import('@/views/GlossaryView.vue') },
    { path: '/glossary/:id', name: 'GlossaryDetail', component: () => import('@/views/GlossaryDetailView.vue') },
    { path: '/modules', name: 'Modules', component: () => import('@/views/ModulesView.vue') },
  ],
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.name !== 'Login' && to.name !== 'Callback' && !auth.isAuthenticated) {
    next({ name: 'Login' })
  } else {
    next()
  }
})

export default router
