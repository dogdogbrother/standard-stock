import { createApp } from 'vue'
import App from './App.vue'

// 全局样式
import './styles/index.less'
import 'vant/lib/index.css'

import { Button, Form, Field, Toast, Icon, Tabbar, TabbarItem } from 'vant'
import { router } from './router'

const app = createApp(App)

app.use(Button)
app.use(Form)
app.use(Field)
app.use(Toast)
app.use(Icon)
app.use(Tabbar)
app.use(TabbarItem)
app.use(router)

app.mount('#app')
