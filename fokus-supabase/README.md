# Фокус — дневник задач (Vercel + Supabase)

Полноценный starter-проект: React/Vite интерфейс, Vercel Serverless API и Supabase PostgreSQL. Пользователи регистрируются по email и паролю; задачи привязаны к `auth.users.id`, а политики Row Level Security не позволяют читать или изменять чужие задачи.

## 1. Создать проект Supabase

1. Открой https://supabase.com/dashboard и создай проект.
2. Задай сильный пароль базы данных и сохрани его в менеджере паролей. Для этого приложения пароль БД в Vercel не нужен.
3. Дождись статуса готовности проекта.
4. В Supabase открой **SQL Editor → New query**, скопируй весь файл `supabase/schema.sql`, вставь и нажми **Run**. В результате должна появиться таблица `public.tasks` и политики RLS.
5. Открой **Project Settings → API** (в некоторых версиях: **Project Settings → API Keys**). Скопируй:
   - **Project URL**, вида `https://abcdefgh.supabase.co`;
   - **anon/public key** или **publishable key**. Если интерфейс показывает только новый publishable key, его можно использовать вместо anon key.
6. Не копируй `service_role` или `secret` key в клиентские переменные. Проект использует публичный ключ вместе с пользовательским JWT и RLS, без service-role ключа.

## 2. Загрузить проект в GitHub

1. Распакуй ZIP.
2. Загрузи содержимое папки в корень репозитория GitHub. В корне должны находиться `package.json`, `index.html`, `vercel.json`, папки `src`, `api`, `supabase`.
3. Не загружай `.env` с секретами. В репозитории есть только шаблон `.env.example`.

## 3. Импортировать в Vercel

1. Открой https://vercel.com/new и импортируй GitHub-репозиторий.
2. Framework Preset: **Vite** (или **Other**, если Vite не распознан).
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Install Command: `npm install`.

## 4. Обязательные Environment Variables в Vercel

В Vercel открой **Project → Settings → Environment Variables**. Добавь все четыре переменные с одинаковыми значениями URL и публичного ключа. Выбери Production (и Preview/Development, если нужно тестировать в этих средах).

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL из Supabase |
| `VITE_SUPABASE_ANON_KEY` | anon/public или publishable key из Supabase |
| `SUPABASE_URL` | тот же Project URL |
| `SUPABASE_ANON_KEY` | тот же anon/public или publishable key |

Сохрани переменные и выполни **Deployments → ⋯ → Redeploy** (либо создай новый commit). Переменные `VITE_*` используются браузером; `SUPABASE_*` — Vercel API functions. После изменения переменных обязателен новый deployment.

## 5. Настроить URL авторизации Supabase

В Supabase открой **Authentication → URL Configuration**:

- **Site URL**: URL основного Vercel deployment, например `https://focus-diary.vercel.app`.
- **Redirect URLs**: добавь `https://focus-diary.vercel.app/**`. Если используешь отдельные preview deployment, добавь нужные preview URL отдельно.

В **Authentication → Providers → Email** оставь Email provider включённым. Если подтверждение email включено, пользователь должен перейти по письму подтверждения. Для быстрого локального теста можно отключить Confirm email, но для реального публичного сайта лучше оставить подтверждение включённым.

## 6. Проверить работу

1. Открой production URL Vercel.
2. Создай аккаунт с email и паролем (минимум 6 символов).
3. Если требуется подтверждение — открой письмо и подтверди email, затем войди.
4. Создай задачу, обнови страницу: задача должна остаться.
5. Открой сайт в другом браузере и войди в тот же аккаунт: задача должна появиться. Создай второй аккаунт: он не должен видеть задачи первого аккаунта.
6. В Supabase открой **Table Editor → tasks** и проверь строки. У каждой строки должен быть свой `user_id`.

## API

Все API routes требуют `Authorization: Bearer <Supabase access token>`:

- `GET /api/tasks` — получить личные задачи текущего пользователя;
- `POST /api/tasks` — создать задачу (`title`, `description`, `due_date`, `priority`, `level`, `done`);
- `PATCH /api/tasks/:id` — обновить разрешённые поля;
- `DELETE /api/tasks/:id` — удалить личную задачу.

API проверяет пользовательскую сессию; запросы к таблице выполняются с пользовательским JWT, а не service-role ключом. RLS — дополнительная обязательная защита на уровне БД. Не отключай RLS и не создавай широкие policies.

## Частые ошибки

- **`Missing SUPABASE_URL...`**: проверь, что обе переменные `SUPABASE_URL` и `SUPABASE_ANON_KEY` созданы в нужной среде Vercel, затем redeploy.
- **`Failed to fetch` / API 500**: проверь URL/ключи, deployment logs и что API routes попали в корень `api/`.
- **`relation public.tasks does not exist`**: повторно выполни `supabase/schema.sql` в SQL Editor правильного проекта.
- **Не получается зарегистрироваться**: проверь Authentication → Providers → Email и подтверждение почты.
- **401 при работе с задачами**: выйди и войди снова; убедись, что `SUPABASE_URL` и `VITE_SUPABASE_URL` принадлежат одному проекту.
- **403 / permission denied**: убедись, что SQL-скрипт выполнился полностью, RLS включён, а политики созданы.

## Что входит / не входит

Входит: email/password signup/login, личные задачи в PostgreSQL, API CRUD, поиск и фильтры, drag-and-drop по сложности, отметка выполнения, адаптивный интерфейс.

Не входит: email-рассылки о дедлайнах, push notifications с сервером, OAuth, восстановление пароля из интерфейса и совместные задачи. Эти функции требуют отдельной настройки.
