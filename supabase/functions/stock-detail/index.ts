// @ts-nocheck
// Supabase Edge Function - 股票详情代理
// Deploy: supabase functions deploy stock-detail
// Note: 此文件运行在 Deno 环境中，TypeScript 配置已排除

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const EASTMONEY_API = 'https://push2delay.eastmoney.com/api/qt/ulist.np/get'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 获取查询参数
    const url = new URL(req.url)
    const secids = url.searchParams.get('secids')
    const fields = url.searchParams.get('fields')

    if (!secids) {
      return new Response(
        JSON.stringify({ error: '缺少查询参数 secids' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 请求东方财富接口
    const eastmoneyUrl = `${EASTMONEY_API}?secids=${encodeURIComponent(secids)}&fields=${encodeURIComponent(fields || 'f1,f2,f3,f4,f12,f13,f14')}`
    console.log('请求 URL:', eastmoneyUrl)
    
    const response = await fetch(eastmoneyUrl)

    if (!response.ok) {
      throw new Error(`东方财富接口返回错误: ${response.status}`)
    }

    const data = await response.json()

    // 返回数据
    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('股票详情错误:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '请求失败' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

