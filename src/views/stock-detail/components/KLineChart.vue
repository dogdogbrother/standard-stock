<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

interface Props {
  stockCode: string
  invt: string
}

const props = defineProps<Props>()

const chartRef = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const activeType = ref<'1' | '101' | '102' | '103'>('101') // 默认日线
let chartInstance: echarts.ECharts | null = null

// 将 invt 转换为东方财富的市场代码
const convertInvtToMarket = (invt: string): string => {
  return invt === 'sz' ? '0' : '1' // sz -> 0, sh -> 1
}

// 格式化日期
const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

// 计算开始时间
const calculateBeginDate = (klt: string): string => {
  const now = new Date()
  
  if (klt === '1') {
    // 分线：今日
    return formatDate(now)
  } else if (klt === '101') {
    // 日线：60日前
    const date = new Date(now)
    date.setDate(date.getDate() - 60)
    return formatDate(date)
  } else if (klt === '102') {
    // 周线：60周前（约420天）
    const date = new Date(now)
    date.setDate(date.getDate() - 420)
    return formatDate(date)
  } else if (klt === '103') {
    // 月线：60月前
    const date = new Date(now)
    date.setMonth(date.getMonth() - 60)
    return formatDate(date)
  }
  
  return formatDate(now)
}

// 获取 K线数据
const fetchKLineData = async (klt: string) => {
  loading.value = true
  try {
    const secid = `${convertInvtToMarket(props.invt)}.${props.stockCode}`
    const fields1 = 'f1,f2,f3,f4,f5,f6'
    const fields2 = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61'
    const fqt = '0' // 不复权
    const beg = calculateBeginDate(klt)
    const end = formatDate(new Date())
    
    const params = new URLSearchParams({
      secid,
      fields1,
      fields2,
      klt,
      fqt,
      beg,
      end
    })
    
    const apiUrl = import.meta.env.VITE_KLINE_API || 'https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-kline'
    const url = `${apiUrl}?${params.toString()}`
    
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error('获取K线数据失败')
    }
    
    const result = await response.json()
    
    if (result.data && result.data.klines && result.data.klines.length > 0) {
      renderChart(result.data.klines)
    }
  } catch (err) {
    console.error('获取K线数据失败:', err)
  } finally {
    loading.value = false
  }
}

// 渲染图表
const renderChart = (klines: string[]) => {
  if (!chartRef.value) return
  
  // 解析 K线数据
  const dates: string[] = []
  const prices: number[] = []
  
  klines.forEach((line) => {
    const parts = line.split(',')
    // f51: 日期, f52: 开盘, f53: 收盘, f54: 最高, f55: 最低
    const date = parts[0]
    const closePrice = parseFloat(parts[2]) // 收盘价（单位：元）
    
    dates.push(date)
    prices.push(closePrice)
  })
  
  // 初始化或更新图表
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }
  
  const option: echarts.EChartsOption = {
    grid: {
      left: '10',
      right: '10',
      top: '20',
      bottom: '30',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: {
        fontSize: 10,
        formatter: (value: string) => {
          // 格式化日期显示
          if (value.length === 8) {
            const month = value.substring(4, 6)
            const day = value.substring(6, 8)
            return `${month}/${day}`
          }
          return value
        },
        interval: Math.floor(dates.length / 5) // 控制显示的标签数量
      },
      axisLine: {
        lineStyle: {
          color: '#e0e0e0'
        }
      }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: {
        fontSize: 10,
        formatter: (value: number) => value.toFixed(2)
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      },
      axisLine: {
        show: false
      }
    },
    series: [
      {
        type: 'line',
        data: prices,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: '#1890ff',
          width: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: 'rgba(24, 144, 255, 0.3)'
              },
              {
                offset: 1,
                color: 'rgba(24, 144, 255, 0.05)'
              }
            ]
          }
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0]
        const dateStr = data.axisValue
        const price = data.value.toFixed(3)
        
        // 格式化日期
        let formattedDate = dateStr
        if (dateStr.length === 8) {
          const year = dateStr.substring(0, 4)
          const month = dateStr.substring(4, 6)
          const day = dateStr.substring(6, 8)
          formattedDate = `${year}-${month}-${day}`
        }
        
        return `${formattedDate}<br/>价格: ${price}`
      }
    }
  }
  
  chartInstance.setOption(option)
}

// 切换 K线类型
const switchType = (type: '1' | '101' | '102' | '103') => {
  // 隐藏tooltip
  if (chartInstance) {
    chartInstance.dispatchAction({
      type: 'hideTip'
    })
  }
  
  activeType.value = type
  fetchKLineData(type)
}

// 监听窗口大小变化
const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize()
  }
}

onMounted(async () => {
  await nextTick()
  await fetchKLineData(activeType.value)
  window.addEventListener('resize', handleResize)
})

// 监听 props 变化
watch(() => [props.stockCode, props.invt], () => {
  fetchKLineData(activeType.value)
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
  <div class="kline-chart">
    <div class="chart-header">
      <div class="type-tabs">
        <button 
          class="type-tab"
          :class="{ active: activeType === '1' }"
          @click="switchType('1')"
        >
          分时
        </button>
        <button 
          class="type-tab"
          :class="{ active: activeType === '101' }"
          @click="switchType('101')"
        >
          日线
        </button>
        <button 
          class="type-tab"
          :class="{ active: activeType === '102' }"
          @click="switchType('102')"
        >
          周线
        </button>
        <button 
          class="type-tab"
          :class="{ active: activeType === '103' }"
          @click="switchType('103')"
        >
          月线
        </button>
      </div>
    </div>
    
    <div class="chart-wrapper">
      <div ref="chartRef" class="chart-container"></div>
      
      <div v-if="loading" class="loading-wrapper">
        <van-loading size="24px" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.kline-chart {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.chart-header {
  margin-bottom: 12px;
}

.type-tabs {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.type-tab {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  background-color: #ffffff;
  color: #666666;
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:active {
    transform: scale(0.95);
  }
  
  &.active {
    background-color: #1890ff;
    color: #ffffff;
    border-color: #1890ff;
  }
}

.chart-wrapper {
  width: 100%;
  height: 250px;
  position: relative;
}

.loading-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 10;
}

.chart-container {
  width: 100%;
  height: 100%;
}
</style>


