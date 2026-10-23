import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];

function filteredHeaders(input: Headers) {
  const headers = new Headers(input);
  const connectionHeaders = (headers.get('connection') || '').split(',').map(value => value.trim()).filter(Boolean);
  for (const name of [...hopHeaders, ...connectionHeaders, 'host', 'content-length']) headers.delete(name);
  return headers;
}

async function proxy(request: NextRequest) {
  try {
    const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vela-virtual-cozy';
    const upstream = process.env.API_UPSTREAM || (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true'
      ? `http://127.0.0.1:5001/${project}/southamerica-east1/api`
      : `https://southamerica-east1-${project}.cloudfunctions.net/api`);
    const target = new URL(upstream);
    // /api is the Function name in the upstream URL AND part of its router path.
    target.pathname = target.pathname.replace(/\/$/, '') + request.nextUrl.pathname;
    target.search = request.nextUrl.search;
    const headers = filteredHeaders(request.headers);
    const caller = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
    headers.delete('x-forwarded-for');
    if (caller) headers.set('x-forwarded-for', caller);
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    });
    const responseHeaders = filteredHeaders(response.headers);
    // fetch decodes compressed responses before exposing the body.
    responseHeaders.delete('content-encoding');
    responseHeaders.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: 'API indisponível. Tente novamente.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD, proxy as OPTIONS };
