<script setup lang="ts">
import { ref } from 'vue'
import MoneySection from './components/MoneySection.vue'
import PositionSection from './components/PositionSection.vue'

const moneyRef = ref<any>(null)
const positionRef = ref<any>(null)
</script>

<template>
  <div class="profile-page">
    <h2>我的</h2>
    
    <MoneySection ref="moneyRef" />
    
    <PositionSection ref="positionRef" />
  </div>
</template>

<style scoped lang="less">
.profile-page {
  padding: 16px;
  background-color: #ffffff;
  min-height: 100vh;
}

h2 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 20px;
}
</style>

