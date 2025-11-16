<script setup lang="ts">
import { ref } from 'vue'
import MoneySection from './components/MoneySection.vue'
import PositionSection from './components/PositionSection.vue'

const moneyRef = ref<any>(null)
const positionRef = ref<any>(null)
const refreshing = ref(false)

// 下拉刷新
const onRefresh = async () => {
  refreshing.value = true
  try {
    // 同时刷新资金信息和持股信息
    await Promise.all([
      moneyRef.value?.refresh(),
      positionRef.value?.refresh()
    ])
  } catch (err) {
  } finally {
    refreshing.value = false
  }
}

// 持股变化后刷新资金信息
const handlePositionChanged = () => {
  moneyRef.value?.refresh()
}
</script>

<template>
  <div class="profile-page">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <MoneySection ref="moneyRef" :refreshing="refreshing" />
      
      <PositionSection 
        ref="positionRef" 
        :refreshing="refreshing"
        @position-changed="handlePositionChanged"
      />
    </van-pull-refresh>
  </div>
</template>

<style scoped lang="less">
.profile-page {
  padding: 16px;
  background-color: #ffffff;
  min-height: 100%;
  // iOS PWA 适配：为顶部状态栏预留空间
  padding-top: max(16px, calc(16px + env(safe-area-inset-top)));
}
</style>

