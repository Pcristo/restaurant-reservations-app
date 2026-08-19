import { jsonResponse } from '../lib/response';

export async function onRequestGet(context: any) {
  return jsonResponse({
    status: 'ok',
    environment: 'cloudflare-pages',
    timestamp: new Date().toISOString()
  });
}
