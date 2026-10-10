import { getRelay, overLimit } from '@/lib/upkeep/relay'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (overLimit(ip)) return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  try {
    return await getRelay().fetch(request)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'relay error' }, { status: 500 })
  }
}
