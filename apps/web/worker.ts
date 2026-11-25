interface Binding { fetch(request: Request): Promise<Response> }
interface Env { ASSETS: Binding; API: Binding }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/v1' && !url.pathname.startsWith('/v1/')) return env.ASSETS.fetch(request)
    if (url.pathname.startsWith('/v1/webhooks/') || url.pathname === '/v1/webhooks') return new Response('Not found', {status:404})
    if (!['GET','HEAD','OPTIONS'].includes(request.method) && request.headers.get('origin') !== url.origin) return new Response('Forbidden', {status:403})
    const headers = new Headers(request.headers)
    headers.delete('cf-access-client-id')
    headers.delete('cf-access-client-secret')
    const target = new URL(url.pathname + url.search, 'https://api.orb.migos.club')
    const response = await env.API.fetch(new Request(target, {method:request.method,headers,body:request.body,redirect:'manual'}))
    const resultHeaders = new Headers(response.headers)
    resultHeaders.set('cache-control','no-store')
    return new Response(response.body,{status:response.status,headers:resultHeaders})
  },
}
