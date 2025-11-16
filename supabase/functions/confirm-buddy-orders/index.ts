import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BuddyOrder {
  id: number
  buddyId: number
  money: number
  heldUnitStatus: number
  created_at: string
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

    // 1. 获取昨天日期（北京时间）
    // 凌晨 00:01 执行，处理前一个工作日的待确认订单
    const now = new Date()
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    // 减去一天，获取昨天的日期
    const yesterday = new Date(beijingTime.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
    const yesterdayEnd = new Date(yesterdayStart.getTime() + 24 * 60 * 60 * 1000)

    // 2. 查找昨天 heldUnitStatus = 0 的 buddyOrder 记录
    const { data: pendingOrders, error: fetchError } = await supabase
      .from('buddyOrder')
      .select('*')
      .eq('heldUnitStatus', 0)
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', yesterdayEnd.toISOString())

    if (fetchError) {
      throw new Error(`获取待确认订单失败: ${fetchError.message}`)
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: '没有待确认的订单', confirmedCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. 获取 money 表的最新数据，用于计算份额价格
    const { data: moneyData, error: moneyError } = await supabase
      .from('money')
      .select('money, usedMoney')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (moneyError) {
      throw new Error(`获取 money 数据失败: ${moneyError.message}`)
    }

    // 4. 计算份额价格 = (money + usedMoney) / 100000
    const totalValue = (moneyData.money + (moneyData.usedMoney || 0)) / 100 // 转换为元
    const unitPrice = totalValue / 100000

    // 5. 获取 unit 表数据
    const { data: unitData, error: unitError } = await supabase
      .from('unit')
      .select('id, total, held')
      .single()

    if (unitError) {
      throw new Error(`获取 unit 数据失败: ${unitError.message}`)
    }

    // 6. 处理每个待确认订单
    let currentHeld = unitData.held || 0
    const results: any[] = []

    for (const order of pendingOrders as BuddyOrder[]) {
      try {
        // 6.1 计算应分配的份额（单位：元转换为分后计算）
        const buddyMoneyInYuan = order.money / 100
        const calculatedHeldUnit = parseFloat((buddyMoneyInYuan / unitPrice).toFixed(4))

        // 6.2 检查份额是否充足
        const newHeld = parseFloat((currentHeld + calculatedHeldUnit).toFixed(4))
        let newStatus = 1 // 默认已确认
        let heldUnit = calculatedHeldUnit

        if (newHeld > unitData.total) {
          // 份额不足
          newStatus = 2
          heldUnit = 0
        } else {
          // 份额充足，累加到 currentHeld
          currentHeld = newHeld
        }

        // 6.3 更新 buddy 表的 heldUnit
        const { error: buddyUpdateError } = await supabase
          .from('buddy')
          .update({ heldUnit: heldUnit })
          .eq('id', order.buddyId)

        if (buddyUpdateError) {
          throw new Error(`更新 buddy ${order.buddyId} 失败: ${buddyUpdateError.message}`)
        }

        // 6.4 更新 buddyOrder 的状态
        const { error: orderUpdateError } = await supabase
          .from('buddyOrder')
          .update({ heldUnitStatus: newStatus })
          .eq('id', order.id)

        if (orderUpdateError) {
          throw new Error(`更新 buddyOrder ${order.id} 失败: ${orderUpdateError.message}`)
        }

        results.push({
          orderId: order.id,
          buddyId: order.buddyId,
          calculatedHeldUnit,
          heldUnit,
          status: newStatus === 1 ? 'confirmed' : 'insufficient',
          newStatus
        })

      } catch (err) {
        results.push({
          orderId: order.id,
          buddyId: order.buddyId,
          error: err.message,
          status: 'error'
        })
      }
    }

    // 7. 更新 unit 表的 held 值
    const { error: unitUpdateError } = await supabase
      .from('unit')
      .update({ held: currentHeld })
      .eq('id', unitData.id)

    if (unitUpdateError) {
      throw new Error(`更新 unit 表失败: ${unitUpdateError.message}`)
    }

    const confirmedCount = results.filter(r => r.status === 'confirmed').length
    const insufficientCount = results.filter(r => r.status === 'insufficient').length
    const errorCount = results.filter(r => r.status === 'error').length

    return new Response(
      JSON.stringify({
        success: true,
        message: '订单确认完成',
        totalOrders: pendingOrders.length,
        confirmedCount,
        insufficientCount,
        errorCount,
        unitPrice,
        oldHeld: unitData.held,
        newHeld: currentHeld,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
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

