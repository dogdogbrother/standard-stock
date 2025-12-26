import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// 全局样式
import './styles/index.less'
import 'vant/lib/index.css'

import { Button, Form, Field, Toast, Icon, Tabbar, TabbarItem, Search, Loading, PullRefresh, Dialog, ActionSheet } from 'vant'
import { router } from './router'

// 移动端调试工具 vConsole（仅开发环境 + 移动设备启用）
if (import.meta.env.DEV) {
  // 检测是否为移动设备
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
  if (isMobile) {
    import('vconsole').then(module => {
      const VConsole = module.default
      new VConsole({
        theme: 'dark', // 主题：dark 或 light
        defaultPlugins: ['system', 'network', 'element', 'storage'], // 启用的插件
        maxLogNumber: 1000 // 最大日志数量
      })
      console.log('📱 vConsole 已启用（移动端调试模式）')
    })
  }
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(Button)
app.use(Form)
app.use(Field)
app.use(Toast)
app.use(Icon)
app.use(Tabbar)
app.use(TabbarItem)
app.use(Search)
app.use(Loading)
app.use(PullRefresh)
app.use(Dialog)
app.use(ActionSheet)
app.use(router)

app.mount('#app')
