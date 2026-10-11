import { ensureSponsorFunded, getRelay, overLimit } from '@/lib/upkeep/relay'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (overLimit(ip)) return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  // A sponsored transfer request is a few hundred bytes. Refuse anything large before the relay reads it.
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > 64_000) return Response.json({ error: 'That request is too large.' }, { status: 413 })
  try {
    void ensureSponsorFunded()
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


