import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // 处理 CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  try {
    const url = new URL(req.url)
    const secids = url.searchParams.get('secids')
    const fields = url.searchParams.get('fields') || 'f2,f3,f12,f14'

    if (!secids) {
      return new Response(
        JSON.stringify({ error: 'secids parameter is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // 调用东方财富接口
    const apiUrl = `https://push2delay.eastmoney.com/api/qt/ulist.np/get?secids=${encodeURIComponent(secids)}&fields=${encodeURIComponent(fields)}`
    
    const response = await fetch(apiUrl)
    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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
