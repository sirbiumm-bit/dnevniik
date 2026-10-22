import { getAuthorizedSupabase, sendJson } from '../_supabase.js';

export default async function handler(req, res) {
  if (!['PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'PATCH, DELETE');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const { supabase, token } = getAuthorizedSupabase(req);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return sendJson(res, 401, { error: 'Session expired. Please sign in again.' });
    const userId = authData.user.id;
    const id = req.query?.id;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return sendJson(res, 400, { error: 'Invalid task id.' });

    if (req.method === 'DELETE') {
      const { data, error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle();
      if (error) return sendJson(res, 400, { error: error.message });
      if (!data) return sendJson(res, 404, { error: 'Task not found.' });
      return sendJson(res, 200, { deleted: true, id });
    }

    const body = req.body || {};
    const patch = {};
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) return sendJson(res, 400, { error: 'Название обязательно (до 120 символов).' });
      patch.title = body.title.trim();
    }
    if (body.description !== undefined) patch.description = typeof body.description === 'string' ? body.description.slice(0, 5000) : '';
    if (body.due_date !== undefined) {
      if (typeof body.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date) || Number.isNaN(Date.parse(`${body.due_date}T00:00:00Z`))) return sendJson(res, 400, { error: 'Укажите корректный дедлайн.' });
      patch.due_date = body.due_date;
    }
    if (body.priority !== undefined) {
      if (!['Низкий','Средний','Высокий'].includes(body.priority)) return sendJson(res, 400, { error: 'Некорректный приоритет.' });
      patch.priority = body.priority;
    }
    if (body.level !== undefined) {
      if (!['Низкая','Средняя','Высокая'].includes(body.level)) return sendJson(res, 400, { error: 'Некорректная сложность.' });
      patch.level = body.level;
    }
    if (body.done !== undefined) patch.done = Boolean(body.done);
    if (!Object.keys(patch).length) return sendJson(res, 400, { error: 'Нет полей для изменения.' });
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).eq('user_id', userId).select('*').maybeSingle();
    if (error) return sendJson(res, 400, { error: error.message });
    if (!data) return sendJson(res, 404, { error: 'Task not found.' });
    return sendJson(res, 200, { task: data });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || 'Internal server error' });
  }
}
