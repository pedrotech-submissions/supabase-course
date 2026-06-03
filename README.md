# supabase-course

A hands-on project built while following the
[PedroTech Supabase Crash Course](https://www.youtube.com/watch?v=kyphLGnSz6Q).

Built with **React + TypeScript + Vite** — intentionally deviating from
the tutorial's plain JavaScript to practice TypeScript in a real project.

**Preview on Vercel:** https://supabase-course-9p3b0vtai-top-submissions.vercel.app/

---

## Table of Contents

- [supabase-course](#supabase-course)
  - [Table of Contents](#table-of-contents)
  - [1. Project Setup](#1-project-setup)
  - [2. Tables](#2-tables)
    - [`users`](#users)
    - [`tasks`](#tasks)
  - [3. Row Level Security (RLS)](#3-row-level-security-rls)
    - [`tasks` policies](#tasks-policies)
    - [`tasks-images` storage bucket policies](#tasks-images-storage-bucket-policies)
  - [4. React Integration \& CRUD](#4-react-integration--crud)
  - [5. Authentication](#5-authentication)
  - [6. Realtime Subscriptions](#6-realtime-subscriptions)
  - [7. File Storage](#7-file-storage)
  - [8. Environment Variables](#8-environment-variables)
  - [9. Running Locally](#9-running-locally)

---

## 1. Project Setup

- Create a Supabase account at [supabase.com](https://supabase.com)
- Create an **organization** and a **project**
- Choose the region closest to your users
- Copy the **Project URL** and **anon key** from Project Settings → API

---

## 2. Tables

Two tables are used in this project:

### `users`

| Column       | Type          | Notes                       |
| ------------ | ------------- | --------------------------- |
| `id`         | `uuid`        | Primary key, auto-generated |
| `created_at` | `timestamptz` | Auto-generated              |
| `email`      | `text`        | Not null, unique            |
| `age`        | `int8`        | Default: `20`               |
| `name`       | `text`        | Not null                    |

### `tasks`

| Column        | Type          | Notes                              |
| ------------- | ------------- | ---------------------------------- |
| `id`          | `uuid`        | Primary key, auto-generated        |
| `created_at`  | `timestamptz` | Auto-generated                     |
| `title`       | `text`        | Not null                           |
| `description` | `text`        | Not null                           |
| `email`       | `text`        | Auth user's email, not null        |
| `image_url`   | `text`        | Nullable — set when image uploaded |

---

## 3. Row Level Security (RLS)

RLS is **enabled** on both tables. Every table requires explicit policies
or all operations are blocked by default.

### `tasks` policies

| Policy                          | Command  | Role            | Condition              |
| ------------------------------- | -------- | --------------- | ---------------------- |
| Enable read for all             | `SELECT` | `public`        | `true`                 |
| Enable insert for authenticated | `INSERT` | `authenticated` | `true`                 |
| Enable update by owner          | `UPDATE` | `authenticated` | `email = auth.email()` |
| Enable delete by owner          | `DELETE` | `authenticated` | `email = auth.email()` |

### `tasks-images` storage bucket policies

| Policy                      | Command  | Role            | Condition                    |
| --------------------------- | -------- | --------------- | ---------------------------- |
| Allow authenticated uploads | `INSERT` | `authenticated` | `bucket_id = 'tasks-images'` |

> **Note:** The Supabase UI policy wizard defaults to a
> `foldername = 'private'` check on storage INSERT policies. This was
> removed so uploads land in the bucket root, matching the upload path
> used in code (`${file.name}-${Date.now()}`).

---

## 4. React Integration & CRUD

The Supabase client is initialised once in `src/supabase-client.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

CRUD operations live in `src/components/task-manager.tsx`:

| Operation | Supabase call                                                                 |
| --------- | ----------------------------------------------------------------------------- |
| Create    | `supabase.from("tasks").insert({...}).select().single()`                      |
| Read      | `supabase.from("tasks").select("*").order("created_at", { ascending: true })` |
| Update    | `supabase.from("tasks").update({ description }).eq("id", id)`                 |
| Delete    | `supabase.from("tasks").delete().eq("id", id)`                                |

---

## 5. Authentication

Email/password auth is handled in `src/components/auth.tsx`.

| Action            | Supabase call                                               |
| ----------------- | ----------------------------------------------------------- |
| Sign up           | `supabase.auth.signUp({ email, password })`                 |
| Sign in           | `supabase.auth.signInWithPassword({ email, password })`     |
| Sign out          | `supabase.auth.signOut()`                                   |
| Get session       | `supabase.auth.getSession()`                                |
| Listen to changes | `supabase.auth.onAuthStateChange((_event, session) => ...)` |

Session state is managed in `App.tsx`. `TaskManager` renders only when
a valid session exists; `Auth` is shown otherwise. The session is passed
as a prop to `TaskManager` so the authenticated user's email can be
attached to new tasks on insert.

---

## 6. Realtime Subscriptions

Realtime is enabled on the `tasks` table (Table Editor → Edit table →
Enable Realtime).

A channel subscription in `task-manager.tsx` listens for `INSERT`
events and appends new tasks to local state without a full refetch:

```ts
const channel = supabase.channel("tasks-channel");

channel
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "tasks" },
    (payload) => {
      const newTask = payload.new as Task;
      setTasks((prev) => [...prev, newTask]);
    },
  )
  .subscribe();

return () => {
  supabase.removeChannel(channel);
};
```

---

## 7. File Storage

Images are uploaded to the `tasks-images` public bucket and the
resulting public URL is stored in `tasks.image_url`.

Upload flow in `task-manager.tsx`:

1. User selects a file via `<input type="file" accept="image/*" />`
2. On submit, `uploadImage(file)` runs before the task insert
3. File uploads to `tasks-images` at path `${file.name}-${Date.now()}`
4. `getPublicUrl(filePath)` returns the publicly accessible URL
5. URL is stored alongside the task row in `image_url`

---

## 8. Environment Variables

Create a `.env` file in the project root (never commit this):

```dotenv
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

A `.env.example` is included in the repo as a reference template.

---

## 9. Running Locally

```bash
npm install
npm run dev
```
