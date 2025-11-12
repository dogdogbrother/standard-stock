import { createRouter, createWebHistory } from 'vue-router'

const LOGIN_COOKIE_KEY = 'login'
const LOGIN_COOKIE_VALUE = '19910415'
const WHITE_LIST = ['/', '/login']

const Home = () => import('../views/Home.vue')
const Login = () => import('../views/Login.vue')
const AppLayout = () => import('../views/AppLayout.vue')
const Watchlist = () => import('../views/Watchlist.vue')
const Buddy = () => import('../views/buddy/index.vue')
const Profile = () => import('../views/profile/index.vue')
const Search = () => import('../views/Search.vue')
const StockDetail = () => import('../views/StockDetail.vue')

const parseCookies = () => {
  if (typeof document === 'undefined') {
    return {}
  }

  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .reduce<Record<string, string>>((acc, item) => {
      const separatorIndex = item.indexOf('=')
      if (separatorIndex === -1) {
        return acc
      }

      const key = item.slice(0, separatorIndex).trim()
      const value = item.slice(separatorIndex + 1)

      if (key) {
        acc[key] = decodeURIComponent(value)
      }

      return acc
    }, {})
}

const hasLoginCookie = () => {
  const cookies = parseCookies()
  return cookies[LOGIN_COOKIE_KEY] === LOGIN_COOKIE_VALUE
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home,
    },
    {
      path: '/login',
      name: 'Login',
      component: Login,
    },
    {
      path: '/app',
      component: AppLayout,
      children: [
        {
          path: '',
          redirect: '/app/watchlist',
        },
        {
          path: 'watchlist',
          name: 'Watchlist',
          component: Watchlist,
        },
        {
          path: 'buddy',
          name: 'Buddy',
          component: Buddy,
        },
        {
          path: 'profile',
          name: 'Profile',
          component: Profile,
        },
      ],
    },
    {
      path: '/search',
      name: 'Search',
      component: Search,
    },
    {
      path: '/stock/:invt/:stock',
      name: 'StockDetail',
      component: StockDetail,
    },
  ],
})

router.beforeEach((to) => {
  const loggedIn = hasLoginCookie()

  if (loggedIn && to.path === '/login') {
    return { path: '/app' }
  }

  // 检查是否在白名单中
  const isInWhiteList = WHITE_LIST.includes(to.path) || to.path.startsWith('/stock/')

  if (!loggedIn && !isInWhiteList) {
    return { path: '/login' }
  }

  return true
})

