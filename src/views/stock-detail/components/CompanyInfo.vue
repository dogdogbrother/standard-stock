<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface ThemeIndex {
  indexName: string
}

interface CompanyInfo {
  industryName: string // 所属行业
  thsIndexList: ThemeIndex[] // 主题概念
  mainBusiness: string // 主营构成
  actName: string // 实际控制人
  shareHolder: string // 公司股东
  holderNumber: string // 股东人数
  top10FlowHolderRatio: string // 十大流通股东占比
}

const props = defineProps<{
  stockCode: string
}>()

const loading = ref(false)
const companyInfo = ref<CompanyInfo | null>(null)

// 获取公司信息
const fetchCompanyInfo = async () => {
  loading.value = true
  try {
    const response = await fetch(`https://www.shidaotec.com/api/company/getCompanyBasic?stockCode=${props.stockCode}`)
    
    if (!response.ok) {
      throw new Error('获取公司信息失败')
    }
    
    const result = await response.json()
    // 接口返回的数据在 data 字段下
    companyInfo.value = result.data
  } catch (err) {
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchCompanyInfo()
})
</script>

<template>
  <div class="company-info">
    <div v-if="loading" class="loading">
      <van-loading size="24px" />
      <span>加载中...</span>
    </div>
    
    <div v-else-if="companyInfo" class="info-content">
      <!-- 所属行业 -->
      <div v-if="companyInfo.industryName" class="info-item">
        <div class="info-label">所属行业</div>
        <div class="info-value">{{ companyInfo.industryName }}</div>
      </div>
      
      <!-- 主题概念 -->
      <div v-if="companyInfo.thsIndexList && companyInfo.thsIndexList.length > 0" class="info-item">
        <div class="info-label">主题概念</div>
        <div class="info-value">
          <div class="tag-list">
            <span 
              v-for="(item, index) in companyInfo.thsIndexList" 
              :key="index"
              class="tag"
            >
              {{ item.indexName }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- 主营构成 -->
      <div v-if="companyInfo.mainBusiness" class="info-item">
        <div class="info-label">主营构成</div>
        <div class="info-value">{{ companyInfo.mainBusiness }}</div>
      </div>
      
      <!-- 实际控制人 -->
      <div v-if="companyInfo.actName" class="info-item">
        <div class="info-label">实际控制人</div>
        <div class="info-value">{{ companyInfo.actName }}</div>
      </div>
      
      <!-- 十大流通股东占比 -->
      <div v-if="companyInfo.top10FlowHolderRatio" class="info-item">
        <div class="info-label">十大流通股东占比</div>
        <div class="info-value highlight">{{ companyInfo.top10FlowHolderRatio }}%</div>
      </div>
      
      <!-- 股东人数 -->
      <div v-if="companyInfo.holderNumber" class="info-item">
        <div class="info-label">股东人数</div>
        <div class="info-value highlight">{{ companyInfo.holderNumber }}</div>
      </div>
      
      <!-- 公司股东 -->
      <div v-if="companyInfo.shareHolder" class="info-item">
        <div class="info-label">公司股东</div>
        <div class="info-value">{{ companyInfo.shareHolder }}</div>
      </div>
    </div>
    
    <div v-else class="empty">
      <p>暂无公司信息</p>
    </div>
  </div>
</template>

<style scoped lang="less">
.company-info {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #6b7280;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.info-value {
  font-size: 13px;
  color: #111827;
  line-height: 1.5;
  
  &.highlight {
    color: #1989fa;
    font-weight: 600;
    font-size: 15px;
  }
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  display: inline-block;
  padding: 3px 10px;
  background-color: #f0f9ff;
  color: #1989fa;
  border-radius: 3px;
  font-size: 12px;
  border: 1px solid #bae7ff;
}
</style>

