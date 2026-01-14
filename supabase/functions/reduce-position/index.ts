import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ReducePositionRequest {
  positionId: number
  stock: string
  invt: string
  name: string
  sellPrice: number       // 卖出价（元）
  reduceQuantity: number  // 减仓数量
  currentQuantity: number // 当前持股数量
  currentCost: number     // 当前成本价（元）
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
    const { 
      positionId, 
      stock, 
      invt, 
      name, 
      sellPrice, 
      reduceQuantity,
      currentQuantity,
      currentCost
    } = await req.json() as ReducePositionRequest

    // 1. 参数校验
    if (!positionId || !stock || !invt || !name) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数', success: false }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    if (!sellPrice || isNaN(sellPrice) || sellPrice <= 0) {
      return new Response(
        JSON.stringify({ error: '请输入有效的卖出价', success: false }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    if (!reduceQuantity || isNaN(reduceQuantity) || reduceQuantity <= 0) {
      return new Response(
        JSON.stringify({ error: '请输入有效的减仓数量', success: false }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    if (reduceQuantity % 100 !== 0) {
      return new Response(
        JSON.stringify({ error: '减仓数量必须是100的倍数', success: false }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    if (reduceQuantity > currentQuantity) {
      return new Response(
        JSON.stringify({ error: '减仓数量不能超过当前持股数量', success: false }),
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
    const sellPriceInCents = Math.round(sellPrice * 1000) / 10 // 元转分（保留1位小数）
    const sellAmount = sellPrice * reduceQuantity
    const sellAmountInCents = Math.round(sellAmount * 100) // 元转分（整数）

    // 3. 更新 position 表
    const newQuantity = currentQuantity - reduceQuantity
    
    if (newQuantity === 0) {
      // 清仓：删除持仓记录
      const { error: deleteError } = await supabase
        .from('position')
        .delete()
        .eq('id', positionId)

      if (deleteError) {
        console.error('删除持仓失败:', deleteError)
        throw new Error('删除持仓失败')
      }
    } else {
      // 部分减仓：更新数量（成本价不变）
      const { error: updateError } = await supabase
        .from('position')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', positionId)

      if (updateError) {
        console.error('更新持仓失败:', updateError)
        throw new Error('更新持仓失败')
      }
    }

    // 4. 插入 track 记录（减仓）
    const { error: trackError } = await supabase
      .from('track')
      .insert({
        stock: stock,
        invt: invt,
        name: name,
        money: sellAmountInCents,
        price: sellPriceInCents,
        num: reduceQuantity,
        track_type: 'reduce'
      })

    if (trackError) {
      console.error('插入操作记录失败:', trackError)
      throw new Error('插入操作记录失败')
    }

    // 5. 更新资金（增加卖出金额）
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
        money: moneyData.money + sellAmountInCents,
        updated_at: new Date().toISOString()
      })
      .eq('id', moneyData.id)

    if (moneyUpdateError) {
      console.error('更新资金失败:', moneyUpdateError)
      throw new Error('更新资金失败')
    }

    // 返回成功
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: newQuantity === 0 ? '清仓成功' : '减仓成功',
        newQuantity: newQuantity,
        sellAmount: Math.round(sellAmount * 100) / 100
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
