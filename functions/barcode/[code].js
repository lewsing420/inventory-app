// 库存盘点 App — Cloudflare Pages Function（天行API代理）
// 保护 API Key，不暴露给前端

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const barcode = params.code;
  
  // 验证条码格式（8-13位数字）
  if (!barcode || !/^\d{8,13}$/.test(barcode)) {
    return new Response(JSON.stringify({ 
      code: 400, msg: '无效条码格式，请输入8-13位数字' 
    }), {
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 获取 API Key
  const apiKey = env.TIANAPI_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ 
      code: 500, msg: '服务未配置 API Key' 
    }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 调用天行数据接口
  const apiUrl = `https://apis.tianapi.com/barcode/index?key=${apiKey}&barcode=${barcode}`;
  
  try {
    const apiResp = await fetch(apiUrl, {
      headers: { 'User-Agent': 'InventoryApp/1.0' },
    });
    const data = await apiResp.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ 
      code: 500, msg: `查询失败: ${e.message}` 
    }), {
      status: 502, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
