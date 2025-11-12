import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Position {
  id: number
  stock: string
  invt: 'sh' | 'sz'
  quantity: number
}

// 将 invt 转换为东方财富的市场代码
const convertInvtToMarket = (invt: string): string => {
  return invt === 'sz' ? '0' : '1' // sz -> 0, sh -> 1
}

serve(async (req) => {
  // 处理 CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 创建 Supabase 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('开始更新 usedMoney...')

    // 1. 获取所有持仓数据
    const { data: positions, error: fetchError } = await supabase
      .from('position')
      .select('id, stock, invt, quantity')

    if (fetchError) {
      throw new Error(`获取持仓失败: ${fetchError.message}`)
    }

    if (!positions || positions.length === 0) {
      console.log('没有持仓数据')
      return new Response(
        JSON.stringify({ success: true, usedMoney: 0, message: '没有持仓数据' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`获取到 ${positions.length} 条持仓数据`)

    // 2. 构建 secids 参数
    const secids = positions
      .map((pos: Position) => `${convertInvtToMarket(pos.invt)}.${pos.stock}`)
      .join(',')

    console.log('secids:', secids)

    // 3. 调用东方财富 API 获取股票详情
    const params = new URLSearchParams({
      secids: secids,
      fields: 'f2,f12' // f2=最新价, f12=股票代码
    })

    const apiUrl = `https://push2.eastmoney.com/api/qt/ulist.np/get?${params.toString()}`
    console.log('API URL:', apiUrl)

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`股票详情 API 请求失败: ${response.statusText}`)
    }

    const apiResult = await response.json()
    console.log('API 返回数据:', JSON.stringify(apiResult))

    if (!apiResult.data?.diff) {
      throw new Error('API 返回数据格式错误')
    }

    // 4. 创建股票代码到最新价的映射
    const stockPriceMap = new Map<string, number>()
    apiResult.data.diff.forEach((item: any) => {
      const stockCode = item.f12
      const currentPrice = item.f2 / 100 // 分转元
      stockPriceMap.set(stockCode, currentPrice)
    })

    console.log('股票价格映射:', Object.fromEntries(stockPriceMap))

    // 5. 计算总市值（usedMoney）
    let totalUsedMoney = 0
    const details: any[] = []

    positions.forEach((pos: Position) => {
      const currentPrice = stockPriceMap.get(pos.stock)
      if (currentPrice !== undefined) {
        const marketValue = currentPrice * pos.quantity
        totalUsedMoney += marketValue
        details.push({
          stock: pos.stock,
          quantity: pos.quantity,
          currentPrice,
          marketValue: marketValue.toFixed(2)
        })
      } else {
        console.warn(`未获取到股票 ${pos.stock} 的最新价`)
      }
    })

    console.log('总市值（元）:', totalUsedMoney)
    console.log('详细信息:', details)

    // 6. 转换为分
    const totalUsedMoneyInCents = Math.round(totalUsedMoney * 100)

    // 7. 获取今天日期（北京时间）
    const now = new Date()
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const todayStart = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    console.log('今天日期范围:', { 
      start: todayStart.toISOString(), 
      end: todayEnd.toISOString() 
    })

    // 8. 检查今天是否已有记录
    const { data: todayMoney, error: fetchTodayError } = await supabase
      .from('money')
      .select('*')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchTodayError && fetchTodayError.code !== 'PGRST116') {
      throw new Error(`查询今日 money 记录失败: ${fetchTodayError.message}`)
    }

    let result
    if (todayMoney && todayMoney.length > 0) {
      // 9a. 今天已有记录，更新 usedMoney
      console.log('今天已有记录，更新 usedMoney')
      const { error: updateError } = await supabase
        .from('money')
        .update({ usedMoney: totalUsedMoneyInCents })
        .eq('id', todayMoney[0].id)

      if (updateError) {
        throw new Error(`更新 usedMoney 失败: ${updateError.message}`)
      }

      result = { action: 'updated', id: todayMoney[0].id }
    } else {
      // 9b. 今天没有记录，获取最新记录的 money 值，创建新记录
      console.log('今天没有记录，创建新记录')
      
      const { data: latestMoney, error: fetchLatestError } = await supabase
        .from('money')
        .select('money')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (fetchLatestError) {
        throw new Error(`获取最新 money 记录失败: ${fetchLatestError.message}`)
      }

      const { data: newMoney, error: insertError } = await supabase
        .from('money')
        .insert({
          money: latestMoney.money,
          usedMoney: totalUsedMoneyInCents
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`创建 money 记录失败: ${insertError.message}`)
      }

      result = { action: 'created', id: newMoney.id }
    }

    console.log('usedMoney 操作成功:', result)

    return new Response(
      JSON.stringify({
        success: true,
        action: result.action,
        recordId: result.id,
        usedMoney: totalUsedMoney,
        usedMoneyInCents: totalUsedMoneyInCents,
        positionCount: positions.length,
        details
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('错误:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})