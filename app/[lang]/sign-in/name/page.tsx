import { redirect } from 'next/navigation';
import { getLang, titled, type LangParams } from '@/lib/i18n';
import { supabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/next-path';
import { noEmoji } from '@/lib/name';
import { getRating, todayUtc } from '@/lib/rating';
import { AuthShell } from '@/components/auth-shell';
import { NameForm } from '@/components/sign-in-forms';

export const generateMetadata = titled('Your name on the ranking', 'Твоё имя в рейтинге', 'Tu nombre en la clasificación', 'Dein Name in der Rangliste', 'Sıralamadaki adın', 'Ton nom au classement', 'Il tuo nome in classifica', { index: false });

// "Anna Petrova" from Google becomes "Anna P."
const short = (full: string) => {
  const w = full.trim().split(/\s+/).filter(Boolean);
  return w.length ? `${w[0]}${w[1] ? ` ${[...w[1]][0]}.` : ''}` : '';
};

export default async function Name({ params, searchParams }: LangParams & { searchParams: Promise<{ next?: string }> }) {
  // today's ranked times, for where a time sailed on this device today would go (asked while the account is)
  const day = todayUtc();
  const [lang, sp, supabase, rating] = await Promise.all([getLang(params), searchParams, supabaseServer(), getRating(day)]);
  const next = safeNext(sp.next);
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const meta = data.user.user_metadata || {};
  const fromGoogle = !meta.display_name && !!(meta.full_name || meta.name);
  const suggested = noEmoji(String(meta.display_name || '')) || short(noEmoji(String(meta.full_name || meta.name || '')));
  return (
    <AuthShell lang={lang}>
      <NameForm lang={lang} next={next} suggested={suggested} fromGoogle={fromGoogle && !!suggested} day={day} times={rating && rating.d === day ? rating.rows.map((r) => r.s) : null} />
    </AuthShell>
  );
}
