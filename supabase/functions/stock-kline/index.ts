import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // 处理 CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const url = new URL(req.url)
    const secid = url.searchParams.get('secid')
    const fields1 = url.searchParams.get('fields1') || 'f1,f2,f3,f4,f5,f6'
    const fields2 = url.searchParams.get('fields2') || 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61'
    const klt = url.searchParams.get('klt') || '101'
    const fqt = url.searchParams.get('fqt') || '0'
    const beg = url.searchParams.get('beg') || '0'
    const end = url.searchParams.get('end') || '20500101'

    if (!secid) {
      return new Response(
        JSON.stringify({ error: 'secid parameter is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // 调用东方财富 K线接口
    const apiUrl = `http://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&fields1=${encodeURIComponent(fields1)}&fields2=${encodeURIComponent(fields2)}&klt=${encodeURIComponent(klt)}&fqt=${encodeURIComponent(fqt)}&beg=${encodeURIComponent(beg)}&end=${encodeURIComponent(end)}`
    
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


