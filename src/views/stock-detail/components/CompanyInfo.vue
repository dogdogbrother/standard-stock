<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

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

interface HolderHistory {
  countYear: string // 年份
  holdNums: string // 股东人数
}

const props = defineProps<{
  stockCode: string
}>()

const loading = ref(false)
const companyInfo = ref<CompanyInfo | null>(null)
const showHolderChart = ref(false)
const holderHistory = ref<HolderHistory[]>([])
const chartLoading = ref(false)
const chartContainer = ref<HTMLDivElement>()
let chartInstance: echarts.ECharts | null = null

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

// 获取历年股东人数
const fetchHolderHistory = async () => {
  chartLoading.value = true
  try {
    const response = await fetch(`https://www.shidaotec.com/api/company/getHoldNumHis?stockCode=${props.stockCode}`)
    
    if (!response.ok) {
      throw new Error('获取历年股东人数失败')
    }
    
    const result = await response.json()
    holderHistory.value = result.data || []
  } catch (err) {
  } finally {
    chartLoading.value = false
  }
}

// 打开股东人数图表
const openHolderChart = async () => {
  showHolderChart.value = true
  await fetchHolderHistory()
  await nextTick()
  renderChart()
}

// 渲染图表
const renderChart = () => {
  if (!chartContainer.value || holderHistory.value.length === 0) return
  
  // 销毁旧图表
  if (chartInstance) {
    chartInstance.dispose()
  }
  
  // 创建新图表
  chartInstance = echarts.init(chartContainer.value)
  
  // 准备数据 - 如果数据超过7条，只取最近7条
  let dataToShow = holderHistory.value
  if (holderHistory.value.length > 7) {
    dataToShow = holderHistory.value.slice(-7)
  }
  
  const years = dataToShow.map(item => item.countYear)
  const holders = dataToShow.map(item => parseInt(item.holdNums))
  
  const option: EChartsOption = {
    grid: {
      left: '40px',
      right: '20px',
      top: '8%',
      bottom: '12%'
    },
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: {
        fontSize: 11,
        color: '#666'
      },
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        color: '#666',
        formatter: (value: number) => {
          if (value >= 10000) {
            return (value / 10000).toFixed(1) + '万'
          }
          return value.toString()
        }
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      }
    },
    series: [
      {
        type: 'bar',
        data: holders,
        itemStyle: {
          color: '#5470c6',
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 30
      }
    ],
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0]
        const value = data.value
        let displayValue = value.toString()
        if (value >= 10000) {
          displayValue = (value / 10000).toFixed(1) + '万'
        }
        return `${data.axisValue}<br/>${data.marker} 股东人数: ${displayValue}`
      }
    }
  }
  
  chartInstance.setOption(option)
}

// 关闭图表
const closeChart = () => {
  showHolderChart.value = false
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
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
        <div class="info-value highlight clickable" @click="openHolderChart">{{ companyInfo.holderNumber }}</div>
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
    
    <!-- 历年股东人数图表弹窗 -->
    <van-action-sheet 
      v-model:show="showHolderChart"
      title="历年股东人数"
      @close="closeChart"
    >
      <div class="chart-wrapper">
        <div v-if="chartLoading" class="chart-loading">
          <van-loading size="24px" />
          <span>加载中...</span>
        </div>
        <div v-else-if="holderHistory.length > 0" class="chart-content">
          <div ref="chartContainer" class="chart-container"></div>
        </div>
        <div v-else class="chart-empty">
          <p>暂无数据</p>
        </div>
      </div>
    </van-action-sheet>
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
  
  &.clickable {
    text-decoration: underline;
    cursor: pointer;
    
    &:active {
      opacity: 0.7;
    }
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

.chart-wrapper {
  height: 260px;
  padding: 16px;
}

.chart-loading,
.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: #6b7280;
}

.chart-content {
  height: 100%;
  width: 100%;
}

.chart-container {
  height: 100%;
  width: 100%;
}
</style>

