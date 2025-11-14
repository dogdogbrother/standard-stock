import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// 全局样式
import './styles/index.less'
import 'vant/lib/index.css'

import { Button, Form, Field, Toast, Icon, Tabbar, TabbarItem, Search, Loading, PullRefresh, Dialog, ActionSheet } from 'vant'
import { router } from './router'

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
