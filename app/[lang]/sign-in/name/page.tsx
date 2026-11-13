import { redirect } from 'next/navigation';
import { getLang, titled, type LangParams } from '@/lib/i18n';
import { supabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/next-path';
import { AuthShell } from '@/components/auth-shell';
import { NameForm } from '@/components/sign-in-forms';

export const generateMetadata = titled('Your name on the ranking', 'Твоё имя в рейтинге', { index: false });

// "Anna Petrova" from Google becomes "Anna P."
const short = (full: string) => {
  const w = full.trim().split(/\s+/).filter(Boolean);
  return w.length ? `${w[0]}${w[1] ? ` ${[...w[1]][0]}.` : ''}` : '';
};

export default async function Name({ params, searchParams }: LangParams & { searchParams: Promise<{ next?: string }> }) {
  const [lang, sp, supabase] = await Promise.all([getLang(params), searchParams, supabaseServer()]);
  const next = safeNext(sp.next);
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const meta = data.user.user_metadata || {};
  const suggested = String(meta.display_name || short(String(meta.full_name || meta.name || '')));
  return (
    <AuthShell lang={lang}>
      <NameForm lang={lang} next={next} suggested={suggested} />
    </AuthShell>
  );
}
