// @ts-nocheck
// Supabase Edge Function - 股票搜索代理
// Deploy: supabase functions deploy stock-search
// Note: 此文件运行在 Deno 环境中，TypeScript 配置已排除

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TENCENT_API = 'https://proxy.finance.qq.com/ifzqgtimg/appstock/smartbox/search/get'

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
    const query = url.searchParams.get('q')

    if (!query) {
      return new Response(
        JSON.stringify({ error: '缺少查询参数 q' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 请求腾讯接口
    const tencentUrl = `${TENCENT_API}?q=${encodeURIComponent(query)}`
    const response = await fetch(tencentUrl)

    if (!response.ok) {
      throw new Error(`腾讯接口返回错误: ${response.status}`)
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