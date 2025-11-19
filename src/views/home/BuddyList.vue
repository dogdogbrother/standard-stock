<script setup lang="ts">
import { formatNumber } from '@/utils/format'

interface Buddy {
  id: number
  name: string
  avatar?: string
  money: number  // 投入本金（单位：分）
  heldUnit?: number
  heldUnitStatus?: number
  created_at: string
}

interface Props {
  buddyList: Buddy[]
  buddyLoading: boolean
  refreshing: boolean
  allDataLoaded: boolean
  totalAssets: number
}

const props = defineProps<Props>()

// 计算伙伴持有金额（返回元）
const getBuddyAsset = (buddy: Buddy): number => {
  if (!buddy.heldUnit) return 0
  // 份额单价（元/份额）= 总资产 / 100000
  const unitPriceInYuan = props.totalAssets / 100000
  // 持有金额（元）= 持有份额 × 份额单价
  return buddy.heldUnit * unitPriceInYuan
}

// 计算伙伴持有盈亏值（返回元）
const getBuddyProfitValue = (buddy: Buddy): number => {
  const holdingAmount = getBuddyAsset(buddy)
  const buddyMoneyInYuan = buddy.money / 100
  // 盈亏 = 持有金额 - 投入本金
  return holdingAmount - buddyMoneyInYuan
}

// 计算伙伴持有盈亏率（返回百分比）
const getBuddyProfitRate = (buddy: Buddy): number => {
  if (!buddy.money || buddy.money === 0) return 0
  const profitValue = getBuddyProfitValue(buddy)
  const buddyMoneyInYuan = buddy.money / 100
  return (profitValue / buddyMoneyInYuan) * 100
}
</script>

<template>
  <div v-if="buddyList.length > 0 && (!buddyLoading || refreshing)" class="buddy-section">
    <div class="buddy-list">
      <div 
        v-for="buddy in buddyList" 
        :key="buddy.id" 
        class="buddy-item"
      >
        <div class="buddy-avatar">
          <img v-if="buddy.avatar" :src="buddy.avatar" alt="头像" />
          <van-icon v-else name="user-o" />
        </div>
        <div class="buddy-info">
          <div class="buddy-name">{{ buddy.name }}</div>
           <div class="buddy-asset-row">
             <div class="buddy-asset">
               持有金额:
               <span v-if="allDataLoaded">
                 ¥{{ formatNumber(getBuddyAsset(buddy), 2) }}
                 <span 
                  class="buddy-profit-value"
                  :class="{
                    'profit-up': getBuddyProfitValue(buddy) > 0,
                    'profit-down': getBuddyProfitValue(buddy) < 0
                  }"
                >
                  {{ getBuddyProfitValue(buddy) >= 0 ? '+' : '' }}¥{{ formatNumber(getBuddyProfitValue(buddy), 2) }}({{ getBuddyProfitValue(buddy) >= 0 ? '+' : '' }}{{ getBuddyProfitRate(buddy).toFixed(2) }}%)
                </span>
               </span>
               <span v-else class="loading-text">计算中...</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.buddy-section {
  padding-top: 16px;
}

.buddy-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0 16px;
}

.buddy-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
  
  &:active {
    transform: scale(0.98);
  }
}

.buddy-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-right: 12px;
  flex-shrink: 0;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .van-icon {
    font-size: 24px;
    color: #9ca3af;
  }
}

.buddy-info {
  flex: 1;
  min-width: 0;
}

.buddy-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buddy-asset-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.buddy-asset {
  font-size: 14px;
  color: #6b7280;
  
  .loading-text {
    color: #9ca3af;
  }
}

.buddy-profit-value {
  font-weight: 500;
  margin-left: 5px;
  &.profit-up {
    color: #ef4444; // 盈利显示红色
  }
  
  &.profit-down {
    color: #10b981; // 亏损显示绿色
  }
}
</style>

