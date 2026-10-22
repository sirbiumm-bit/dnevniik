import { getAuthorizedSupabase, sendJson } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const { supabase, token } = getAuthorizedSupabase(req);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return sendJson(res, 401, { error: 'Session expired. Please sign in again.' });
    const userId = authData.user.id;

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) return sendJson(res, 400, { error: error.message });
      return sendJson(res, 200, { tasks: data || [] });
    }

    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const dueDate = typeof body.due_date === 'string' ? body.due_date : '';
    if (!title || title.length > 120) return sendJson(res, 400, { error: 'Название обязательно (до 120 символов).' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))) return sendJson(res, 400, { error: 'Укажите корректный дедлайн.' });
    const priority = ['Низкий','Средний','Высокий'].includes(body.priority) ? body.priority : 'Средний';
    const level = ['Низкая','Средняя','Высокая'].includes(body.level) ? body.level : 'Средняя';
    const row = {
      user_id: userId,
      title,
      description: typeof body.description === 'string' ? body.description.slice(0, 5000) : '',
      due_date: dueDate,
      priority,
      level,
      done: Boolean(body.done)
    };
    const { data, error } = await supabase.from('tasks').insert(row).select('*').single();
    if (error) return sendJson(res, 400, { error: error.message });
    return sendJson(res, 201, { task: data });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || 'Internal server error' });
  }
}
