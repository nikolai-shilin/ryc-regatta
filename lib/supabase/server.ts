import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase Auth for server components, route handlers and server actions. The session lives in cookies on this
// origin, so the game at /play shares it.
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // a server component cannot set cookies; proxy.ts refreshes the session instead
        }
      },
    },
  });
}

export type Account = { id: string; email: string; name: string; provider: string } | null;

// Who is signed in, if anyone. The ranking name is kept in the user's metadata (display_name).
export async function getAccount(): Promise<Account> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email || '',
    name: String(meta.display_name || ''),
    provider: String(u.app_metadata?.provider || 'email'),
  };
}

export const initials = (name: string, email: string) => {
  const w = (name || email).trim().split(/[\s.@]+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase() || '·';
};
