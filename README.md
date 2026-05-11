# OROsubmit

Minimal ORO link submission app with Supabase storage.

## Local Run

```bash
npm install
npm run dev
```

## Supabase Setup

1. Create a Supabase project.
2. Open Supabase Dashboard > SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. Go to Project Settings > API.
5. Copy the Project URL into `VITE_SUPABASE_URL`.
6. Copy the anon public key into `VITE_SUPABASE_ANON_KEY`.

The default admin password is `oro`.

## Admin YouTube Queue

Use `Play all on YouTube` to open submitted YouTube links as one ordered watch list. Non-YouTube links are skipped.

## Change Admin Password

Run this in Supabase SQL Editor, replacing `your-new-password`:

```sql
update public.oro_settings
set admin_password_hash = extensions.crypt('your-new-password', extensions.gen_salt('bf'))
where id = true;
```

## Vercel Env Vars

Add these in Vercel Project Settings > Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
