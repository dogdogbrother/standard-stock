<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'
import { supabase } from '@/lib/supabase'

interface DividendData {
  year: string
  cashDivr: string // 分红率
  cashDivPr: string // 支付率
}

const props = defineProps<{
  stockCode: string
}>()

const chartRef = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const dividendData = ref<DividendData[]>([])
let chartInstance: echarts.ECharts | null = null

// 保存去年的股息率到数据库
const saveDividendToDatabase = async (data: DividendData[]) => {
  try {
    // 获取去年的年份（不包含今年）
    const currentYear = new Date().getFullYear()
    const lastYear = (currentYear - 1).toString()
    
    // 找到去年的数据
    const lastYearData = data.find(item => item.year === lastYear)
    
    if (!lastYearData) {
      console.log('没有找到去年的分红数据')
      return
    }
    
    console.log('找到去年的分红数据:', lastYearData)
    
    // 检查数据库中是否已存在该股票的记录
    const { data: existingData, error: selectError } = await supabase
      .from('dividend')
      .select('*')
      .eq('stock', props.stockCode)
      .single()
    
    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 表示没有找到记录
      console.error('查询 dividend 表失败:', selectError)
      return
    }
    
    if (!existingData) {
      // 没有记录，插入新数据
      console.log('插入新的 dividend 记录')
      const { error: insertError } = await supabase
        .from('dividend')
        .insert({
          stock: props.stockCode,
          num: parseFloat(lastYearData.cashDivr),
          year: lastYear
        })
      
      if (insertError) {
        console.error('插入 dividend 记录失败:', insertError)
      } else {
        console.log('成功插入 dividend 记录')
      }
    } else if (existingData.year !== lastYear) {
      // 有记录但年份不对，更新数据
      console.log('更新 dividend 记录，从', existingData.year, '到', lastYear)
      const { error: updateError } = await supabase
        .from('dividend')
        .update({
          num: parseFloat(lastYearData.cashDivr),
          year: lastYear
        })
        .eq('stock', props.stockCode)
      
      if (updateError) {
        console.error('更新 dividend 记录失败:', updateError)
      } else {
        console.log('成功更新 dividend 记录')
      }
    } else {
      console.log('dividend 记录已存在且年份正确，无需操作')
    }
  } catch (err) {
    console.error('保存 dividend 数据失败:', err)
  }
}

// 获取历年分红数据
const fetchDividendData = async () => {
  loading.value = true
  try {
    const response = await fetch(`https://www.shidaotec.com/api/company/getKeyIndexOverview?stockCode=${props.stockCode}`)
    
    if (!response.ok) {
      throw new Error('获取分红数据失败')
    }
    
    const result = await response.json()
    console.log('完整返回数据:', result)
    console.log('result.data:', result.data)
    console.log('result.data.dividendHis:', result.data?.dividendHis)
    
    // dividendHis 在 data 字段下
    if (result.data?.dividendHis && Array.isArray(result.data.dividendHis) && result.data.dividendHis.length > 0) {
      dividendData.value = result.data.dividendHis
      console.log('最终分红数据:', dividendData.value)
      
      // 保存去年的股息率到数据库
      await saveDividendToDatabase(result.data.dividendHis)
      
      // 不在这里调用 renderChart，等 watch 监听到数据变化后渲染
    } else {
      console.log('没有分红数据')
    }
  } catch (err) {
    console.error('获取分红数据失败:', err)
  } finally {
    loading.value = false
  }
}

// 渲染图表
const renderChart = () => {
  console.log('========== 开始渲染图表 ==========')
  console.log('chartRef.value:', chartRef.value)
  console.log('dividendData.value.length:', dividendData.value.length)
  console.log('dividendData.value:', dividendData.value)
  
  if (!chartRef.value) {
    console.error('chartRef.value 为 null，DOM 元素未挂载')
    return
  }
  
  if (dividendData.value.length === 0) {
    console.error('dividendData 为空数组')
    return
  }
  
  if (!chartInstance) {
    console.log('初始化 ECharts 实例...')
    chartInstance = echarts.init(chartRef.value)
    console.log('ECharts 实例初始化成功:', chartInstance)
  }
  
  const years = dividendData.value.map(item => item.year)
  const cashDivr = dividendData.value.map(item => parseFloat(item.cashDivr || '0'))
  const cashDivPr = dividendData.value.map(item => parseFloat(item.cashDivPr || '0'))
  
  console.log('年份:', years)
  console.log('分红率:', cashDivr)
  console.log('支付率:', cashDivPr)
  
  const option = {
    grid: {
      left: '40px',
      right: '40px',
      top: '15%',
      bottom: '12%'
    },
    legend: {
      data: ['历年分红率', '股利支付率'],
      top: '3%',
      textStyle: {
        fontSize: 11
      }
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
    yAxis: [
      {
        type: 'value',
        position: 'left',
        axisLabel: {
          formatter: '{value} %',
          fontSize: 10,
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
          fontSize: 10,
          color: '#666'
        },
        splitLine: {
          show: false
        }
      }
    ],
    series: [
      {
        name: '历年分红率',
        type: 'bar',
        data: cashDivr,
        itemStyle: {
          color: '#5470c6',
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 30
      },
      {
        name: '股利支付率',
        type: 'line',
        yAxisIndex: 1,
        data: cashDivPr,
        itemStyle: {
          color: '#91cc75'
        },
        lineStyle: {
          width: 2,
          color: '#91cc75'
        },
        symbol: 'circle',
        symbolSize: 6
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
          result += `${item.marker} ${item.seriesName}: ${item.value}%<br/>`
        })
        return result
      }
    }
  }
  
  console.log('设置图表配置:', option)
  chartInstance.setOption(option)
  console.log('图表渲染完成')
}

// 监听窗口大小变化
const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize()
  }
}

// 监听数据变化，当数据加载完成且 DOM 渲染后再绘制图表
watch([dividendData, chartRef], ([data, ref]) => {
  console.log('watch 触发:', { dataLength: data.length, hasRef: !!ref })
  
  if (data.length > 0 && ref) {
    console.log('数据和 ref 都有了，使用 setTimeout 延迟渲染')
    // 使用 setTimeout 确保在下一帧渲染
    setTimeout(() => {
      console.log('setTimeout 执行，准备渲染图表')
      renderChart()
    }, 100)
  }
}, { immediate: false })

onMounted(async () => {
  await fetchDividendData()
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
  <div class="dividend-chart">
    <h4 class="chart-title">历年分红率</h4>
    
    <div v-if="loading" class="loading">
      <van-loading size="20px" />
    </div>
    
    <div v-else-if="dividendData.length > 0" class="chart-wrapper">
      <div ref="chartRef" class="chart-container"></div>
    </div>
    
    <div v-else class="empty">
      <p>暂无分红数据</p>
    </div>
  </div>
</template>

<style scoped lang="less">
.dividend-chart {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 10px 0;
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

