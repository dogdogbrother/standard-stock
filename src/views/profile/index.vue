<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MoneySection from './components/MoneySection.vue'
import PositionSection from './components/PositionSection.vue'
import { useMoneyStore } from '@/stores/money'
import { usePositionStore } from '@/stores/position'

const moneyRef = ref<any>(null)
const positionRef = ref<any>(null)
const refreshing = ref(false)
const allDataLoaded = ref(false) // 所有数据加载完成标识

const moneyStore = useMoneyStore()
const positionStore = usePositionStore()

// 初始化加载（同时加载 money 和 position）
const initializeData = async () => {
  try {
    await Promise.all([
      moneyStore.fetchMoney(),
      positionStore.fetchPositions(true) // silent = true，不显示 store 的 loading
    ])
  } catch (err) {
    console.error('初始化数据失败:', err)
  } finally {
    allDataLoaded.value = true
  }
}

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

onMounted(async () => {
  // 只在缓存为空时才初始化
  if (!moneyStore.moneyData || positionStore.positionList.length === 0) {
    await initializeData()
  }
})
</script>

<template>
  <div class="profile-page">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <MoneySection 
        ref="moneyRef" 
        :refreshing="refreshing"
        :all-data-loaded="allDataLoaded"
      />
      
      <PositionSection 
        ref="positionRef" 
        :refreshing="refreshing"
        :all-data-loaded="allDataLoaded"
        @position-changed="handlePositionChanged"
      />
    </van-pull-refresh>
  </div>
</template>

<style scoped lang="less">
.profile-page {
  padding-bottom: 65px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
  // iOS PWA 适配：为顶部状态栏预留空间
  padding-top: env(safe-area-inset-top);
}

:deep(.van-pull-refresh) {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  min-height: 0;
}

:deep(.van-pull-refresh__track) {
  padding: 16px;
  padding-bottom: 20px;
}
</style>

