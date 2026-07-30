// 库存盘点 App — Cloudflare Worker（tianapi 代理）
// 保护 API Key 不暴露给前端

// 允许跨域的前端域名
const ALLOWED_ORIGINS = [
  'http://localhost:*',
  'https://*.pages.dev',
  'https://*.workers.dev',
];

function corsHeaders(origin) {
  const allowOrigin = origin && ALLOWED_ORIGINS.some(o => {
    if (o.endsWith(':*')) {
      const prefix = o.slice(0, -2);
      return origin.startsWith(prefix);
    }
    if (o.includes('*')) {
      const re = new RegExp('^' + o.replace(/\*/g, '[^:]+') + '$');
      return re.test(origin);
    }
    return origin === o;
  }) ? origin : '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';
    const cors = corsHeaders(origin);

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // 健康检查
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '1.0' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 条码查询 API: /barcode/{条码数字}
    if (url.pathname.startsWith('/barcode/') && request.method === 'GET') {
      const barcode = url.pathname.replace('/barcode/', '').trim();
      
      if (!barcode || !/^\d{8,13}$/.test(barcode)) {
        return new Response(JSON.stringify({ 
          code: 400, msg: '无效条码格式，请输入8-13位数字' 
        }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // 尝试从 KV 缓存读取
      if (env.BARCODE_CACHE) {
        try {
          const cached = await env.BARCODE_CACHE.get(`barcode:${barcode}`, { type: 'json' });
          if (cached) {
            return new Response(JSON.stringify({ ...cached, _cache: 'kv' }), {
              headers: { ...cors, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
            });
          }
        } catch (e) {
          // KV 不可用时继续查 API
        }
      }

      // 调用 tianapi
      const apiKey = env.TIANAPI_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ 
          code: 500, msg: '服务器配置错误：缺少 API Key' 
        }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const apiUrl = `https://apis.tianapi.com/barcode/index?key=${apiKey}&barcode=${barcode}`;
      
      try {
        const apiResp = await fetch(apiUrl, {
          headers: { 'User-Agent': 'InventoryApp/1.0' },
        });
        const data = await apiResp.json();

        // 缓存结果到 KV（包括空结果，避免重复查）
        if (env.BARCODE_CACHE) {
          ctx.waitUntil(
            env.BARCODE_CACHE.put(
              `barcode:${barcode}`, 
              JSON.stringify(data),
              { expirationTtl: 31536000 } // 1年
            ).catch(() => {})
          );
        }

        return new Response(JSON.stringify({ ...data, _cache: 'miss' }), {
          headers: { ...cors, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ 
          code: 500, msg: `查询失败: ${e.message}` 
        }), {
          status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    // 未匹配路由
    return new Response(JSON.stringify({ code: 404, msg: 'Not Found' }), {
      status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
