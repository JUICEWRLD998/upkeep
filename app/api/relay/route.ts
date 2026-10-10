import { getRelay, overLimit } from '@/lib/upkeep/relay'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (overLimit(ip)) return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  try {
    const debug = !!process.env.DEBUG_RELAY
    const body = debug ? await request.clone().text() : ''
    const res = await getRelay().fetch(request)
    if (debug) {
      console.log('RELAY REQ', body.slice(0, 1500))
      console.log('RELAY RES', (await res.clone().text()).slice(0, 1500))
    }
    return res
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'relay error' }, { status: 500 })
  }
}
