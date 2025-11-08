import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
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
