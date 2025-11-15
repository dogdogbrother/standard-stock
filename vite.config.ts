import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 自动导入 Vue 相关函数，如：ref, reactive, toRef 等
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia'
      ],
      dts: 'src/auto-imports.d.ts',
      eslintrc: {
        enabled: false, // 如果需要 ESLint 支持，设置为 true
      },
    }),
    // 自动导入组件
    Components({
      resolvers: [VantResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  css: {
    preprocessorOptions: {
      less: {
        // 自动导入变量文件，在所有组件中都可以直接使用变量
        additionalData: `@import "@/styles/variables.less";`,
        javascriptEnabled: true,
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
