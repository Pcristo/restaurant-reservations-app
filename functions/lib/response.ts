// Standard JSON response helper for Cloudflare Functions and local compatibility
export function jsonResponse(data: any, init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status || 200;
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...(init.headers || {})
  });

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

export function errorResponse(message: string, status = 400, extra: Record<string, any> = {}) {
  return jsonResponse({
    success: false,
    error: message,
    ...extra
  }, { status });
}
