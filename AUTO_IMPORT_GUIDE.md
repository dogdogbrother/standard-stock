# 自动导入配置说明

## 已完成的配置

### 1. 安装的依赖
- `unplugin-auto-import`: 自动导入 Vue、Vue Router、Pinia 等 API
- `unplugin-vue-components`: 自动导入 Vant UI 组件

### 2. 配置文件修改
- **vite.config.ts**: 添加了 AutoImport 和 Components 插件
- **tsconfig.app.json**: 包含了自动生成的类型文件
- **.gitignore**: 忽略自动生成的 `auto-imports.d.ts` 和 `components.d.ts`

## 使用方式

### Vue API 自动导入

**以前需要手动导入：**
```vue
<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'

const count = ref(0)
const router = useRouter()
</script>
```

**现在可以直接使用：**
```vue
<script setup lang="ts">
// 不需要任何导入！
const count = ref(0)
const router = useRouter()
</script>
```

### Vant 组件自动导入

**以前需要在 main.ts 中注册：**
```ts
import { Button, Dialog, Toast } from 'vant'
app.use(Button)
app.use(Dialog)
app.use(Toast)
```

**现在可以直接在模板中使用：**
```vue
<template>
  <van-button type="primary">按钮</van-button>
  <van-dialog v-model:show="show">对话框</van-dialog>
</template>
```

## 支持的 API

### Vue 3
- `ref`, `reactive`, `computed`, `readonly`
- `watch`, `watchEffect`
- `onMounted`, `onUnmounted`, `onBeforeMount`, `onBeforeUnmount`
- `onUpdated`, `onBeforeUpdate`
- `provide`, `inject`
- `nextTick`, `toRef`, `toRefs`, `unref`
- 等等...

### Vue Router
- `useRouter`, `useRoute`
- `onBeforeRouteLeave`, `onBeforeRouteUpdate`

### Pinia
- `defineStore`, `storeToRefs`, `acceptHMRUpdate`

## 注意事项

1. **类型提示**: 首次启动项目后，会在 `src/` 目录下自动生成 `auto-imports.d.ts` 和 `components.d.ts` 文件，提供完整的类型提示。

2. **编辑器支持**: 如果 IDE 提示找不到定义，重启 IDE 即可。

3. **构建**: 自动生成的类型文件已添加到 `.gitignore`，不会提交到 Git。

4. **兼容性**: 如果某些地方还是需要手动导入，依然可以手动导入，不会冲突。

## 迁移建议

可以逐步迁移，不需要一次性删除所有的 import：

1. 新写的组件直接使用自动导入
2. 旧组件有需要修改时再删除不必要的 import
3. 可以使用编辑器的"查找未使用的导入"功能批量清理

## 清理现有的导入

安装并运行后，项目中很多手动导入的代码就可以删除了。例如：

**src/views/watchlist/index.vue**
```diff
<script setup lang="ts">
- import { ref, onMounted } from 'vue'
- import { useRouter } from 'vue-router'
  import { useWatchlistStore, type StockDetail } from '@/stores/watchlist'
  import { usePositionStore } from '@/stores/position'
  import SearchBar from './components/SearchBar.vue'

  const router = useRouter()
  const watchlistStore = useWatchlistStore()
  // ...
</script>
```

需要时我可以帮你批量清理这些导入语句。

