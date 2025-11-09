<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const invt = ref(route.params.invt as string)
const stockCode = ref(route.params.stock as string)

const goBack = () => {
  router.back()
}

onMounted(() => {
  console.log('市场类型:', invt.value)
  console.log('股票代码:', stockCode.value)
})
</script>

<template>
  <div class="stock-detail-page">
    <div class="header">
      <button class="back-button" type="button" @click="goBack">
        <van-icon name="arrow-left" />
      </button>
      <h1 class="title">股票详情</h1>
    </div>

    <div class="content">
      <p>市场类型: {{ invt }}</p>
      <p>股票代码: {{ stockCode }}</p>
    </div>
  </div>
</template>

<style scoped lang="less">
.stock-detail-page {
  min-height: 100vh;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: #ffffff;
  border-bottom: 1px solid #f0f0f0;
}

.back-button {
  border: none;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  color: #111827;
  width: 24px;
  height: 24px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.content {
  flex: 1;
  padding: 16px;
}
</style>

