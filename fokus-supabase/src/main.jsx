import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('YOUR_PROJECT_REF') && !supabaseAnonKey.includes('YOUR_SUPABASE'));
const supabase = supabaseReady ? createClient(supabaseUrl, supabaseAnonKey) : null;
const levels = ['Низкая', 'Средняя', 'Высокая'];
const priorities = ['Низкий', 'Средний', 'Высокий'];
const dateAfter = (days = 1) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const blank = () => ({ title: '', description: '', due_date: dateAfter(1), priority: 'Средний', level: 'Средняя', done: false });
const fromDb = (t) => ({ id: t.id, title: t.title, description: t.description || '', due: t.due_date, priority: t.priority, level: t.level, done: Boolean(t.done) });
const toDb = (t) => ({ title: t.title, description: t.description || '', due_date: t.due, priority: t.priority, level: t.level, done: Boolean(t.done) });

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [filter, setFilter] = useState('Все');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank());
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [settings, setSettings] = useState(false);
  const [drag, setDrag] = useState(null);
  const [busyIds, setBusyIds] = useState([]);

  const flash = useCallback((message, isError = false) => { setToast(message); setToastError(isError); window.setTimeout(() => setToast(''), 3000); }, []);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const api = useCallback(async (url, options = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Сессия закончилась. Войди в аккаунт снова.');
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Ошибка запроса (${response.status})`);
    return payload;
  }, []);

  const loadTasks = useCallback(async () => {
    if (!session) { setTasks([]); return; }
    setLoadingTasks(true);
    try { const payload = await api('/api/tasks'); setTasks((payload.tasks || []).map(fromDb)); }
    catch (error) { flash(error.message, true); }
    finally { setLoadingTasks(false); }
  }, [session, api, flash]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function submitAuth(e) {
    e.preventDefault(); setAuthBusy(true); setAuthMessage('');
    try {
      if (!supabase) throw new Error('Сначала настрой VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Vercel.');
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setAuthMessage('Аккаунт создан. Проверь почту и подтверди адрес, затем войди.');
        else setAuthMessage('Аккаунт создан. Загружаем задачи…');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error) { setAuthMessage(error.message || 'Не удалось выполнить вход.'); }
    finally { setAuthBusy(false); }
  }

  function openNew(level = 'Средняя') { setEdit(null); setForm({ ...blank(), level }); setModal(true); }
  function openEdit(task) { setEdit(task.id); setForm({ ...task }); setModal(true); }
  async function saveTask(e) {
    e.preventDefault();
    const payload = toDb({ ...form, title: form.title.trim() });
    try {
      if (edit) {
        const result = await api(`/api/tasks/${edit}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setTasks(old => old.map(t => t.id === edit ? fromDb(result.task) : t)); flash('Задача обновлена');
      } else {
        const result = await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
        setTasks(old => [fromDb(result.task), ...old]); flash('Задача добавлена');
      }
      setModal(false);
    } catch (error) { flash(error.message, true); }
  }
  async function updateTask(id, patch, successMessage = 'Изменения сохранены') {
    setBusyIds(old => [...old, id]);
    try { const result = await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); setTasks(old => old.map(t => t.id === id ? fromDb(result.task) : t)); if (successMessage) flash(successMessage); }
    catch (error) { flash(error.message, true); }
    finally { setBusyIds(old => old.filter(x => x !== id)); }
  }
  async function removeTask(id) {
    if (!window.confirm('Удалить эту задачу?')) return;
    try { await api(`/api/tasks/${id}`, { method: 'DELETE' }); setTasks(old => old.filter(t => t.id !== id)); flash('Задача удалена'); }
    catch (error) { flash(error.message, true); }
  }
  async function signOut() { await supabase.auth.signOut(); setTasks([]); }

  const visible = useMemo(() => tasks.filter(t => {
    const filterOk = filter === 'Все' || (filter === 'Просроченные' && t.due < dateAfter(0) && !t.done) || (filter === 'Выполненные' && t.done) || filter === t.priority;
    return filterOk && `${t.title} ${t.description}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'));
  }), [tasks, filter, query]);

  if (!supabaseReady) return <div className="auth-page"><div className="auth-card"><div className="brand auth-brand"><div className="logo">✓</div><div><b>Фокус</b><small>ДНЕВНИК ЗАДАЧ</small></div></div><h1>Нужно подключить Supabase</h1><p>В Vercel → Settings → Environment Variables добавь <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_ANON_KEY</code> из настроек Supabase. Затем выполни Redeploy.</p><p>Подробные шаги находятся в файле <code>README.md</code> внутри проекта.</p></div></div>;
  if (authLoading) return <div className="auth-page"><div className="auth-card">Загружаем Фокус…</div></div>;

  if (!session) return <div className="auth-page"><form className="auth-card" onSubmit={submitAuth}>
    <div className="brand auth-brand"><div className="logo">✓</div><div><b>Фокус</b><small>ДНЕВНИК ЗАДАЧ</small></div></div>
    <h1>{authMode === 'login' ? 'С возвращением!' : 'Создать аккаунт'}</h1><p className="auth-sub">{authMode === 'login' ? 'Войди, чтобы открыть свой личный список задач.' : 'Твои задачи будут доступны только после входа в твой аккаунт.'}</p>
    <label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label>
    <label>Пароль<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Минимум 6 символов" /></label>
    {authMessage && <div className="auth-message">{authMessage}</div>}
    <button className="primary auth-submit" disabled={authBusy}>{authBusy ? 'Подожди…' : authMode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
    <p className="auth-switch">{authMode === 'login' ? 'Впервые здесь?' : 'Уже есть аккаунт?'} <button type="button" className="link-button" onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setAuthMessage('')}}>{authMode === 'login' ? 'Создать аккаунт' : 'Войти'}</button></p>
  </form></div>;

  return <><header><div className="brand"><div className="logo">✓</div><div><b>Фокус</b><small>ДНЕВНИК ЗАДАЧ</small></div></div><div className="head-actions"><span className="user-email">{session.user.email}</span><button className="ghost" onClick={()=>setSettings(!settings)}>⚙ Настройки</button><button className="primary" onClick={()=>openNew()}>＋ Новая задача</button></div></header>
  <main><section className="welcome"><div><p className="eyebrow">{new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</p><h1>Двигайся к цели,<br/><span>шаг за шагом.</span></h1><p className="sub">Твой день — твои правила. Держи важное под контролем.</p></div><div className="progress"><div className="progress-ring"><strong>{tasks.filter(t=>t.done).length}</strong><small>из {tasks.length}</small></div><span>задач выполнено</span></div></section>
  {settings&&<section className="settings panel"><div><b>Аккаунт</b><p>{session.user.email}. Задачи синхронизируются с базой данных.</p></div><button className="ghost" onClick={loadTasks}>↻ Обновить задачи</button><button className="ghost" onClick={signOut}>Выйти</button></section>}
  <section className="stats"><div className="stat panel"><span className="stat-icon purple">▦</span><div><small>Всего задач</small><b>{tasks.length}</b></div></div><div className="stat panel"><span className="stat-icon green">✓</span><div><small>Выполнено</small><b>{tasks.filter(t=>t.done).length}</b></div></div><div className="stat panel"><span className="stat-icon orange">◷</span><div><small>На сегодня</small><b>{tasks.filter(t=>t.due===dateAfter(0)&&!t.done).length}</b></div></div><div className="stat panel"><span className="stat-icon red">!</span><div><small>Просрочено</small><b>{tasks.filter(t=>t.due<dateAfter(0)&&!t.done).length}</b></div></div></section>
  <section className="toolbar"><div><h2>Мои задачи <span>{visible.length}</span></h2><p>{loadingTasks?'Загружаем задачи из базы…':'Твои личные задачи · синхронизация через API'}</p></div><div className="tools"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="⌕  Поиск задач..."/><select value={filter} onChange={e=>setFilter(e.target.value)}>{['Все','Просроченные','Выполненные',...priorities].map(x=><option key={x}>{x}</option>)}</select></div></section>
  <section className="board">{levels.map((level,i)=><div className={'column c'+i} key={level} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag)updateTask(drag,{level},'Сложность изменена');setDrag(null)}}><div className="col-head"><div className="level-dot"></div><b>{level} сложность</b><span>{visible.filter(t=>t.level===level).length}</span></div><div className="cards">{visible.filter(t=>t.level===level).map(t=><article className={'task '+(t.done?'is-done':'')} key={t.id} draggable onDragStart={()=>setDrag(t.id)} onDragEnd={()=>setDrag(null)}><div className="task-top"><span className={'priority p'+t.priority}>{t.priority} приоритет</span><button className="more" title="Редактировать" onClick={()=>openEdit(t)}>···</button></div><h3>{t.title}</h3>{t.description&&<p className="desc">{t.description}</p>}<div className="task-meta"><span className={t.due<dateAfter(0)&&!t.done?'late':''}>◷ {new Date(t.due+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</span><button disabled={busyIds.includes(t.id)} className={'check '+(t.done?'checked':'')} onClick={()=>updateTask(t.id,{done:!t.done},t.done?'Задача возвращена в работу':'Задача выполнена')}>{t.done?'✓ Выполнено':'○ Завершить'}</button></div><div className="task-bottom"><select aria-label="Изменить сложность" value={t.level} disabled={busyIds.includes(t.id)} onChange={e=>updateTask(t.id,{level:e.target.value},'Сложность изменена')}>{levels.map(l=><option key={l}>{l}</option>)}</select><button className="delete" onClick={()=>removeTask(t.id)}>Удалить</button></div></article>)}</div><button className="add-card" onClick={()=>openNew(level)}>＋ Добавить задачу</button></div>)}</section>
  <footer><span>© 2026 Фокус · Дневник задач</span><span>Личный аккаунт · данные в Supabase PostgreSQL</span></footer></main>
  {modal&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="modal" onSubmit={saveTask}><div className="modal-head"><div><p className="eyebrow">{edit?'РЕДАКТИРОВАНИЕ':'НОВАЯ ЗАДАЧА'}</p><h2>{edit?'Изменить задачу':'Создать задачу'}</h2></div><button type="button" className="close" onClick={()=>setModal(false)}>×</button></div><label>Название задачи *<input autoFocus required maxLength="120" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Например, подготовить презентацию"/></label><label>Описание<textarea rows="3" maxLength="5000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Что нужно сделать?"/></label><div className="form-row"><label>Дедлайн<input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})} required/></label><label>Приоритет<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{priorities.map(x=><option key={x}>{x}</option>)}</select></label></div><label>Уровень сложности<select value={form.level} onChange={e=>setForm({...form,level:e.target.value})}>{levels.map(x=><option key={x}>{x}</option>)}</select></label><div className="modal-actions"><button type="button" className="ghost" onClick={()=>setModal(false)}>Отмена</button><button className="primary">{edit?'Сохранить':'Создать задачу'}</button></div></form></div>}
  {toast&&<div className={'toast '+(toastError?'toast-error':'')}>{toastError?'⚠':'✓'} &nbsp;{toast}</div>}</>;
}

createRoot(document.getElementById('root')).render(<App />);
