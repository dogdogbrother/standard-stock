<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToSearch = () => {
  router.push('/search')
}
</script>

<template>
  <van-search
    class="search-bar"
    readonly
    placeholder="请输入股票代码 / 名称"
    shape="round"
    @click="goToSearch"
  />
</template>

<style scoped lang="less">
.search-bar {
  width: 100%;
  display: block;
  cursor: pointer;
  flex-shrink: 0;
  // iOS PWA 适配：为顶部状态栏预留空间
  padding-top: env(safe-area-inset-top);
}
</style>

