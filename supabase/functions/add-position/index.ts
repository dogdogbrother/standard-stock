import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AddPositionRequest {
  stock: string
  invt: string
  name: string
  cost: number      // 单位：元
  quantity: number
}

serve(async (req) => {
  // 处理 CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // 创建 Supabase 客户端（使用 service role key 绕过 RLS）
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 解析请求参数
    const { stock, invt, name, cost, quantity } = await req.json() as AddPositionRequest

    // 1. 参数校验
    if (!stock || !invt || !name) {
      return new Response(
        JSON.stringify({ error: '股票代码、市场类型和名称不能为空' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    if (!cost || isNaN(cost) || cost <= 0) {
      return new Response(
        JSON.stringify({ error: '请输入有效的买入价' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return new Response(
        JSON.stringify({ error: '请输入有效的持股数量' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    if (quantity % 100 !== 0) {
      return new Response(
        JSON.stringify({ error: '持股数量必须是100的倍数' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // 2. 数据转换
    const costInCents = Math.round(cost * 1000) / 10 // 元转分（保留1位小数）
    const totalAmount = cost * quantity
    const totalAmountInCents = Math.round(totalAmount * 100) // 元转分（整数）

    // 3. 检查是否重复（已存在该股票）
    const { data: existing, error: queryError } = await supabase
      .from('position')
      .select('id, cost, quantity, name')
      .eq('stock', stock)
      .maybeSingle()

    if (queryError) {
      console.error('查询持仓失败:', queryError)
      throw new Error('查询持仓失败')
    }

    // 4. 处理重复股票（加仓）
    if (existing) {
      const oldCost = existing.cost / 100 // 分转元
      const oldQuantity = existing.quantity
      
      // 计算新的平均成本
      const totalCost = (oldCost * oldQuantity) + totalAmount
      const totalQuantity = oldQuantity + quantity
      const avgCost = totalCost / totalQuantity
      const avgCostInCents = Math.round(avgCost * 1000) / 10 // 保留1位小数

      // 更新 position 表
      const { error: updateError } = await supabase
        .from('position')
        .update({
          cost: avgCostInCents,
          quantity: totalQuantity,
          name: name || existing.name, // 更新名称（如果有）
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('更新持仓失败:', updateError)
        throw new Error('更新持仓失败')
      }

      // 插入 track 记录（加仓）
      const { error: trackError } = await supabase
        .from('track')
        .insert({
          stock: stock,
          invt: invt,
          name: name,
          money: totalAmountInCents,
          price: costInCents,
          num: quantity,
          track_type: 'increase'
        })

      if (trackError) {
        console.error('插入操作记录失败:', trackError)
        throw new Error('插入操作记录失败')
      }

      // 更新资金（扣减）- 获取最新的一条记录
      const { data: moneyData, error: moneyQueryError } = await supabase
        .from('money')
        .select('id, money')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (moneyQueryError) {
        console.error('查询资金失败:', moneyQueryError)
        throw new Error('查询资金失败')
      }

      const { error: moneyUpdateError } = await supabase
        .from('money')
        .update({ 
          money: moneyData.money - totalAmountInCents,
          updated_at: new Date().toISOString()
        })
        .eq('id', moneyData.id)

      if (moneyUpdateError) {
        console.error('更新资金失败:', moneyUpdateError)
        throw new Error('更新资金失败')
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '加仓成功',
          isUpdate: true,
          avgCost: Math.round(avgCost * 100) / 100, // 返回2位小数的成本价
          totalQuantity: totalQuantity
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // 5. 处理新增股票
    const { error: insertError } = await supabase
      .from('position')
      .insert({
        stock: stock,
        invt: invt,
        name: name,
        cost: costInCents,
        quantity: quantity
      })

    if (insertError) {
      console.error('插入持仓失败:', insertError)
      throw new Error('插入持仓失败')
    }

    // 插入 track 记录（加仓）
    const { error: trackError } = await supabase
      .from('track')
      .insert({
        stock: stock,
        invt: invt,
        name: name,
        money: totalAmountInCents,
        price: costInCents,
        num: quantity,
        track_type: 'increase'
      })

    if (trackError) {
      console.error('插入操作记录失败:', trackError)
      throw new Error('插入操作记录失败')
    }

    // 更新资金（扣减）- 获取最新的一条记录
    const { data: moneyData, error: moneyQueryError } = await supabase
      .from('money')
      .select('id, money')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (moneyQueryError) {
      console.error('查询资金失败:', moneyQueryError)
      throw new Error('查询资金失败')
    }

    const { error: moneyUpdateError } = await supabase
      .from('money')
      .update({ 
        money: moneyData.money - totalAmountInCents,
        updated_at: new Date().toISOString()
      })
      .eq('id', moneyData.id)

    if (moneyUpdateError) {
      console.error('更新资金失败:', moneyUpdateError)
      throw new Error('更新资金失败')
    }

    // 添加到 watchlist（如果不存在）
    const { data: watchExists, error: watchQueryError } = await supabase
      .from('watchlist')
      .select('id')
      .eq('stock', stock)
      .maybeSingle()

    if (watchQueryError) {
      console.error('查询自选股失败:', watchQueryError)
      // 不抛出错误，自选股失败不影响主流程
    }

    if (!watchExists) {
      const { error: watchInsertError } = await supabase
        .from('watchlist')
        .insert({ 
          stock: stock, 
          invt: invt,
          price: costInCents // 关注时的价格
        })

      if (watchInsertError) {
        console.error('插入自选股失败:', watchInsertError)
        // 不抛出错误，自选股失败不影响主流程
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '录入成功',
        isUpdate: false
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error) {
    console.error('Edge Function 错误:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || '服务器错误',
        success: false
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})

