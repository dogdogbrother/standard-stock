<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { supabase } from '@/lib/supabase'

interface Props {
  stockCode: string
  invt: string
}

interface TrackRecord {
  id: number
  stock: string
  invt: string
  name: string
  money: number
  price: number
  num: number
  track_type: 'increase' | 'reduce' | 'clear'
  created_at: string
}

const props = defineProps<Props>()

const trackRecords = ref<TrackRecord[]>([])

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

// 获取股票操作记录
const fetchTrackRecords = async () => {
  try {
    const { data, error } = await supabase
      .from('track')
      .select('*')
      .eq('stock', props.stockCode)
      .eq('invt', props.invt)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('获取操作记录失败:', error)
      return
    }
    
    trackRecords.value = data || []
    console.log('获取到的操作记录:', trackRecords.value)
  } catch (err) {
    console.error('获取操作记录失败:', err)
  }
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
  const klineData: number[][] = [] // [开盘, 收盘, 最低, 最高]
  const closePrices: number[] = [] // 用于计算MA均线或分时折线
  
  klines.forEach((line) => {
    const parts = line.split(',')
    // f51: 日期, f52: 开盘, f53: 收盘, f54: 最高, f55: 最低
    const date = parts[0] || ''
    const openPrice = parseFloat(parts[1] || '0')
    const closePrice = parseFloat(parts[2] || '0')
    const highPrice = parseFloat(parts[3] || '0')
    const lowPrice = parseFloat(parts[4] || '0')
    
    dates.push(date)
    klineData.push([openPrice, closePrice, lowPrice, highPrice])
    closePrices.push(closePrice)
  })
  
  // 计算昨收价（用于分时图基准线）
  // 对于分时图，昨收价 = 第一个数据点的开盘价
  const yesterdayClose = klines.length > 0 ? parseFloat(klines[0]?.split(',')[1] || '0') : 0
  
  console.log('K线日期范围:', dates.length > 0 ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '无数据')
  console.log('K线日期示例（前5个）:', dates.slice(0, 5))
  console.log('K线日期示例（后5个）:', dates.slice(-5))
  
  // 判断卖出操作后持仓是否为0（用于判断是否显示为清仓）
  const isClearPosition = (record: TrackRecord) => {
    // 只有卖出操作才可能清仓
    if (record.track_type !== 'reduce') return false
    
    // 按时间正序计算累计持仓（从最早到当前操作）
    const sortedTracks = [...trackRecords.value].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    
    let quantity = 0
    for (const t of sortedTracks) {
      if (t.id === record.id) {
        // 计算到当前操作后的持仓
        if (t.track_type === 'increase') {
          quantity += t.num
        } else if (t.track_type === 'reduce' || t.track_type === 'clear') {
          quantity -= t.num
        }
        break
      }
      
      // 累计之前的操作
      if (t.track_type === 'increase') {
        quantity += t.num
      } else if (t.track_type === 'reduce' || t.track_type === 'clear') {
        quantity -= t.num
      }
    }
    
    // 如果卖出后持仓为0，则显示为清仓
    return quantity === 0
  }
  
  // 处理操作记录标记点（分时图不显示）
  const markPointData: any[] = []
  if (activeType.value !== '1') {
    trackRecords.value.forEach((record) => {
      const recordDate = new Date(record.created_at)
      // 格式化为 YYYY-MM-DD 格式以匹配K线数据
      const year = recordDate.getFullYear()
      const month = String(recordDate.getMonth() + 1).padStart(2, '0')
      const day = String(recordDate.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
      // 查找该日期在K线数据中的位置
      let dateIndex = dates.indexOf(dateStr)
      console.log(`记录日期: ${dateStr}, K线索引: ${dateIndex}, 原始时间: ${record.created_at}`)
      
      // 如果找不到精确日期，找最接近的下一个交易日
      if (dateIndex === -1) {
        dateIndex = dates.findIndex(d => d >= dateStr)
        if (dateIndex !== -1) {
          console.log(`未找到精确日期，使用最接近的交易日: ${dates[dateIndex]}`)
        }
      }
      
      if (dateIndex !== -1) {
        // 使用当天K线的收盘价作为标记点位置
        const dayKlineData = klineData[dateIndex]
        const markPrice = dayKlineData ? dayKlineData[1] : record.price / 100 // [开盘, 收盘, 最低, 最高]，使用收盘价
        
        // 判断是否应该显示为清仓
        const shouldShowAsClear = isClearPosition(record)
        const displayType = record.track_type === 'increase' 
          ? 'increase' 
          : (record.track_type === 'clear' || shouldShowAsClear) 
            ? 'clear' 
            : 'reduce'
        
        const getTypeName = (type: string) => {
          if (type === 'increase') return '加仓'
          if (type === 'clear') return '清仓'
          return '减仓'
        }
        
        const getTypeValue = (type: string) => {
          if (type === 'increase') return '买'
          if (type === 'clear') return '清'
          return '卖'
        }
        
        const getTypeColor = (type: string) => {
          if (type === 'increase') return '#52c41a'
          if (type === 'clear') return '#ff9800' // 橙色
          return '#ff4d4f'
        }
        
        markPointData.push({
          name: getTypeName(displayType),
          coord: [dateIndex, markPrice],
          value: getTypeValue(displayType),
          symbol: 'pin',
          symbolSize: 30,
          itemStyle: {
            color: getTypeColor(displayType)
          },
          label: {
            show: true,
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 'bold'
          },
          trackRecord: record // 保存完整记录供tooltip使用
        })
      }
    })
    console.log('标记点数据:', markPointData)
  }
  
  // 初始化或更新图表
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }
  
  const option: echarts.EChartsOption = {
    grid: {
      left: '0',
      right: '0',
      top: '10',
      bottom: '0',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: activeType.value !== '1', // 分时图不留边距，K线图需要留边距
      axisLabel: {
        fontSize: 10,
        formatter: (value: string) => {
          // 分时图：只显示时间部分（YYYY-MM-DD HH:mm -> HH:mm）
          if (activeType.value === '1' && value.includes(' ')) {
            return value.split(' ')[1] || value
          }
          // 日线/周线/月线：格式化日期显示
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
      scale: activeType.value === '1' ? false : true,
      // 分时图：以昨收价为中心，只显示3条线
      splitNumber: activeType.value === '1' ? 2 : 5,
      interval: activeType.value === '1' ? (() => {
        const dataMin = Math.min(...closePrices)
        const dataMax = Math.max(...closePrices)
        const maxDiff = Math.max(Math.abs(yesterdayClose - dataMin), Math.abs(dataMax - yesterdayClose))
        return maxDiff
      })() : undefined,
      min: activeType.value === '1' ? (() => {
        const dataMin = Math.min(...closePrices)
        const dataMax = Math.max(...closePrices)
        const maxDiff = Math.max(Math.abs(yesterdayClose - dataMin), Math.abs(dataMax - yesterdayClose))
        return yesterdayClose - maxDiff
      })() : undefined,
      max: activeType.value === '1' ? (() => {
        const dataMin = Math.min(...closePrices)
        const dataMax = Math.max(...closePrices)
        const maxDiff = Math.max(Math.abs(yesterdayClose - dataMin), Math.abs(dataMax - yesterdayClose))
        return yesterdayClose + maxDiff
      })() : undefined,
      axisLabel: {
        fontSize: 10,
        formatter: (value: number) => {
          // 如果是整数，不显示小数位；否则最多显示2位小数
          return value % 1 === 0 ? value.toString() : value.toFixed(2)
        }
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
    series: activeType.value === '1' 
      ? [
          // 分时图：折线图
      {
        type: 'line',
            data: closePrices,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: '#1890ff',
              width: 1.5
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
                    color: 'rgba(24, 144, 255, 0.15)'
              },
              {
                offset: 1,
                    color: 'rgba(24, 144, 255, 0.02)'
              }
            ]
          }
        },
            markLine: {
              silent: true,
              symbol: 'none',
              label: {
                show: false
              },
              lineStyle: {
                color: '#999',
                type: 'dashed',
                width: 1
              },
              data: [
                {
                  yAxis: yesterdayClose,
                  label: {
                    show: true,
                    position: 'end',
                    formatter: () => yesterdayClose % 1 === 0 ? yesterdayClose.toString() : yesterdayClose.toFixed(2),
                    color: '#999',
                    fontSize: 10
                  }
                }
              ]
            }
          }
        ]
      : [
          // 日线/周线/月线：蜡烛图
          {
            type: 'candlestick',
            data: klineData,
            itemStyle: {
              color: '#ef5350', // 涨（阳线）- 红色
              color0: '#26a69a', // 跌（阴线）- 绿色
              borderColor: '#ef5350', // 涨的边框
              borderColor0: '#26a69a' // 跌的边框
            },
        markPoint: {
          data: markPointData
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: (params: any) => {
        const data = params[0]
        const dateStr = data.axisValue
        
        // 格式化价格：去掉不必要的小数位
        const formatPrice = (price: number) => {
          if (price % 1 === 0) return price.toString()
          const fixed = price.toFixed(3)
          return fixed.replace(/\.?0+$/, '') // 去掉末尾的0和小数点
        }
        
        // 格式化日期
        let formattedDate = dateStr
        // 分时图：只显示时间部分（YYYY-MM-DD HH:mm -> HH:mm）
        if (activeType.value === '1' && dateStr.includes(' ')) {
          formattedDate = dateStr.split(' ')[1]
        }
        // 日线/周线：不显示年份（YYYY-MM-DD -> MM-DD）
        else if ((activeType.value === '101' || activeType.value === '102') && dateStr.includes('-')) {
          const parts = dateStr.split('-')
          if (parts.length === 3) {
            formattedDate = `${parts[1]}-${parts[2]}`
          }
        }
        
        let tooltipContent = `<strong>${formattedDate}</strong><br/>`
        
        // 分时图：显示价格和涨跌
        if (activeType.value === '1') {
          const price = data.value
          const changeAmount = price - yesterdayClose
          const changePercent = ((changeAmount / yesterdayClose) * 100).toFixed(2)
          const changeColor = changeAmount >= 0 ? '#ff4d4f' : '#26a69a'
          
          tooltipContent += `价格: ${formatPrice(price)}<br/>`
          tooltipContent += `<span style="color: ${changeColor}">涨跌: ${changeAmount >= 0 ? '+' : ''}${formatPrice(changeAmount)} (${changeAmount >= 0 ? '+' : ''}${changePercent}%)</span>`
        }
        // K线图：显示开高低收
        else {
          const klineValue = data.value // [开盘, 收盘, 最低, 最高]
          tooltipContent += `开盘: ${formatPrice(klineValue[0])}<br/>`
          tooltipContent += `收盘: ${formatPrice(klineValue[1])}<br/>`
          tooltipContent += `最低: ${formatPrice(klineValue[2])}<br/>`
          tooltipContent += `最高: ${formatPrice(klineValue[3])}`
        }
        
        // 检查是否有操作记录（仅K线图显示）
        if (activeType.value !== '1') {
          const trackRecord = trackRecords.value.find((record) => {
            const recordDate = new Date(record.created_at)
            // 格式化为 YYYY-MM-DD 格式以匹配K线数据
            const year = recordDate.getFullYear()
            const month = String(recordDate.getMonth() + 1).padStart(2, '0')
            const day = String(recordDate.getDate()).padStart(2, '0')
            const recordDateStr = `${year}-${month}-${day}`
            return recordDateStr === dateStr
          })
          
          if (trackRecord) {
            // 判断是否应该显示为清仓
            const shouldShowAsClear = trackRecord.track_type === 'reduce' && (() => {
              const sortedTracks = [...trackRecords.value].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
              let quantity = 0
              for (const t of sortedTracks) {
                if (t.id === trackRecord.id) {
                  if (t.track_type === 'increase') {
                    quantity += t.num
                  } else if (t.track_type === 'reduce' || t.track_type === 'clear') {
                    quantity -= t.num
                  }
                  break
                }
                if (t.track_type === 'increase') {
                  quantity += t.num
                } else if (t.track_type === 'reduce' || t.track_type === 'clear') {
                  quantity -= t.num
                }
              }
              return quantity === 0
            })()
            
            const displayType = trackRecord.track_type === 'increase' 
              ? 'increase' 
              : (trackRecord.track_type === 'clear' || shouldShowAsClear) 
                ? 'clear' 
                : 'reduce'
            
            const getOperationType = (type: string) => {
              if (type === 'increase') return '加仓'
              if (type === 'clear') return '清仓'
              return '减仓'
            }
            
            const getOperationColor = (type: string) => {
              if (type === 'increase') return '#52c41a'
              if (type === 'clear') return '#ff9800'
              return '#ff4d4f'
            }
            
            const operationType = getOperationType(displayType)
            const operationColor = getOperationColor(displayType)
            const amount = (trackRecord.money / 100).toFixed(2)
            const opPrice = formatPrice(trackRecord.price / 100)
            
            tooltipContent += `<br/><br/><span style="color: ${operationColor}; font-weight: bold;">【${operationType}】</span>`
            tooltipContent += `<br/>操作价格: ${opPrice}`
            tooltipContent += `<br/>操作数量: ${trackRecord.num}股`
            tooltipContent += `<br/>操作金额: ¥${amount}`
          }
        }
        
        return tooltipContent
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
  await fetchTrackRecords()
  await fetchKLineData(activeType.value)
  window.addEventListener('resize', handleResize)
})

// 监听 props 变化
watch(() => [props.stockCode, props.invt], async () => {
  await fetchTrackRecords()
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


