<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToSearch = () => {
  router.push('/search')
}
</script>

<template>
  <div class="watchlist-page">
    <van-search
      class="watchlist-search"
      readonly
      placeholder="请输入股票代码 / 名称"
      shape="round"
      @click="goToSearch"
    />
    <div class="placeholder-card">
      <van-icon name="star" class="icon" />
      <h2>自选列表</h2>
      <p>敬请期待，这里将展示您关注的股票。</p>
    </div>
  </div>
</template>

<style scoped lang="less">
.watchlist-page {
  min-height: calc(100vh - 50px);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: @spacing-xl;
  background-color: #ffffff;
}

.watchlist-search {
  width: 100%;
  display: block;
  cursor: pointer;
}

.placeholder-card {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  text-align: center;
  padding: @spacing-xl;
  border-radius: @border-radius-lg;
  background-color: #ffffff;
  box-shadow: 0 12px 32px rgba(31, 45, 61, 0.08);

  .icon {
    font-size: 48px;
    color: @primary-color;
    margin-bottom: @spacing-md;
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: @spacing-sm;
  }

  p {
    color: @text-color-secondary;
  }
}
</style>
