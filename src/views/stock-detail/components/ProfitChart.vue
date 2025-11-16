<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

interface QuarterData {
  quarter: string
  quarterValue: string
  quarterYoy: string
}

interface ProfitData {
  profitDedt: string
  yoy: string
  yoyIndustry: string
  year: string
  quarterList: QuarterData[]
}

const props = defineProps<{
  stockCode: string
}>()

const chartRef = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const profitData = ref<ProfitData[]>([])
let chartInstance: echarts.ECharts | null = null

// 获取扣非净利润数据
const fetchProfitData = async () => {
  loading.value = true
  try {
    const response = await fetch(`https://www.shidaotec.com/api/company/getKeyIndexOverview?stockCode=${props.stockCode}`)
    
    if (!response.ok) {
      throw new Error('获取扣非净利润数据失败')
    }
    
    const result = await response.json()
    
    if (result.data?.profitDedtHis && Array.isArray(result.data.profitDedtHis) && result.data.profitDedtHis.length > 0) {
      profitData.value = result.data.profitDedtHis
    }
  } catch (err) {
  } finally {
    loading.value = false
  }
}

// 渲染图表
const renderChart = () => {
  if (!chartRef.value) {
    return
  }
  
  if (profitData.value.length === 0) {
    return
  }
  
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }
  
  const years = profitData.value.map(item => item.year)
  const q1Data = profitData.value.map(item => parseFloat(item.quarterList[0]?.quarterValue || '0'))
  const q2Data = profitData.value.map(item => parseFloat(item.quarterList[1]?.quarterValue || '0'))
  const q3Data = profitData.value.map(item => parseFloat(item.quarterList[2]?.quarterValue || '0'))
  const q4Data = profitData.value.map(item => parseFloat(item.quarterList[3]?.quarterValue || '0'))
  const yoyData = profitData.value.map(item => parseFloat(item.yoy || '0'))
  const yoyIndustryData = profitData.value.map(item => parseFloat(item.yoyIndustry || '0'))
  
  const option = {
    grid: {
      left: '40px',
      right: '40px',
      top: '15%',
      bottom: '12%'
    },
    legend: {
      data: ['同比增长', '行业平均'],
      top: '3%',
      textStyle: {
        fontSize: 10
      }
    },
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: {
        fontSize: 10,
        color: '#666'
      },
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      }
    },
    yAxis: [
      {
        type: 'value',
        position: 'left',
        axisLabel: {
          formatter: '{value} 亿',
          fontSize: 9,
          color: '#666'
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0'
          }
        }
      },
      {
        type: 'value',
        position: 'right',
        axisLabel: {
          formatter: '{value} %',
          fontSize: 9,
          color: '#666'
        },
        splitLine: {
          show: false
        }
      }
    ],
    series: [
      {
        name: 'Q1',
        type: 'bar',
        stack: 'total',
        data: q1Data,
        itemStyle: {
          color: '#5470c6',
          borderRadius: [0, 0, 0, 0]
        },
        barMaxWidth: 35
      },
      {
        name: 'Q2',
        type: 'bar',
        stack: 'total',
        data: q2Data,
        itemStyle: {
          color: '#91cc75',
          borderRadius: [0, 0, 0, 0]
        },
        barMaxWidth: 35
      },
      {
        name: 'Q3',
        type: 'bar',
        stack: 'total',
        data: q3Data,
        itemStyle: {
          color: '#fac858',
          borderRadius: [0, 0, 0, 0]
        },
        barMaxWidth: 35
      },
      {
        name: 'Q4',
        type: 'bar',
        stack: 'total',
        data: q4Data,
        itemStyle: {
          color: '#ee6666',
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 35
      },
      {
        name: '同比增长',
        type: 'line',
        yAxisIndex: 1,
        data: yoyData,
        itemStyle: {
          color: '#5470c6'
        },
        lineStyle: {
          width: 2,
          color: '#5470c6'
        },
        symbol: 'circle',
        symbolSize: 5
      },
      {
        name: '行业平均',
        type: 'line',
        yAxisIndex: 1,
        data: yoyIndustryData,
        itemStyle: {
          color: '#91cc75'
        },
        lineStyle: {
          width: 2,
          color: '#91cc75',
          type: 'dashed'
        },
        symbol: 'circle',
        symbolSize: 5
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: (params: any) => {
        let result = `${params[0].axisValue}<br/>`
        params.forEach((item: any) => {
          if (item.seriesName === 'Q1' || item.seriesName === 'Q2' || item.seriesName === 'Q3' || item.seriesName === 'Q4') {
            result += `${item.marker} ${item.seriesName}: ${item.value}亿<br/>`
          } else {
            result += `${item.marker} ${item.seriesName}: ${item.value}%<br/>`
          }
        })
        return result
      }
    }
  }
  
  chartInstance.setOption(option)
}

// 监听数据变化，当数据加载完成且 DOM 渲染后再绘制图表
watch([profitData, chartRef], ([data, ref]) => {
  if (data.length > 0 && ref) {
    setTimeout(() => {
      renderChart()
    }, 100)
  }
}, { immediate: false })

// 监听窗口大小变化
const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize()
  }
}

onMounted(async () => {
  await fetchProfitData()
  window.addEventListener('resize', handleResize)
})

// 组件卸载时清理
const cleanup = () => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  window.removeEventListener('resize', handleResize)
}

defineExpose({
  cleanup
})
</script>

<template>
  <div class="profit-chart">
    <h4 class="chart-title">扣非净利润及增速</h4>
    
    <div v-if="loading" class="loading">
      <van-loading size="20px" />
    </div>
    
    <div v-else-if="profitData.length > 0" class="chart-wrapper">
      <div ref="chartRef" class="chart-container"></div>
    </div>
    
    <div v-else class="empty">
      <p>暂无扣非净利润数据</p>
    </div>
  </div>
</template>

<style scoped lang="less">
.profit-chart {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
}

.loading,
.empty {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
  color: #6b7280;
  font-size: 13px;
}

.chart-wrapper {
  width: 100%;
  min-height: 220px;
}

.chart-container {
  width: 100%;
  height: 220px;
}
</style>

