import { createClient } from '@supabase/supabase-js';

export function getAuthorizedSupabase(req) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    const error = new Error('Server is missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
    error.status = 500;
    throw error;
  }
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Missing bearer access token. Please sign in again.');
    error.status = 401;
    throw error;
  }
  const token = match[1];
  // Pass the user's JWT through to PostgREST. RLS remains enabled and is the
  // final authorization layer; no service-role key is used by this app.
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  return { supabase, token };
}

export function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}
