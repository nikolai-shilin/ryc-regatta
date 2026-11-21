import type { Metadata } from 'next';
import { getT, type LangParams } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { parseCode } from '@/lib/code';
import { BackLink } from '@/components/back-link';
import { SceneBrand } from '@/components/scene-brand';
import { IconPlay } from '@/components/ui';
import { venueOf } from '@/lib/venues';
import { yachtOf } from '@/lib/yachts';
import { InviteJoin } from '@/components/invite-info';
import { duelFrom } from '@/lib/duel-share';

// The page a 1-on-1 race's link opens: /match/K7M2QZ?v=cowes&b=jpk1050. A tap on Join (the tap lets the game start its sound)
// opens the game at the race, in the host's venue and on the boat he picked. Never indexed.

// the share card names the race's code, venue and boat, and lays the course she'll sail (app/og/page/[key], match)
export async function generateMetadata({ params, searchParams }: LangParams & { params: Promise<{ lang: string; code: string }>; searchParams: Promise<{ v?: string | string[]; b?: string | string[]; w?: string | string[]; l?: string | string[]; m?: string | string[] }> }): Promise<Metadata> {
  const [{ lang, t }, { code: raw }, sp] = await Promise.all([getT(params), params, searchParams]);
  const one = (x?: string | string[]) => { const s = Array.isArray(x) ? x[0] : x; return s && /^[a-z0-9_-]{1,32}$/i.test(s) ? s : ''; };
  const code = parseCode(raw), v = one(sp.v), b = one(sp.b);
  // a result shared from a 1-on-1 (lib/duel-share.ts): its card says who won, by how much, and calls to race the winner
  const duel = duelFrom((k) => { const x = sp[k as 'w' | 'l' | 'm']; return Array.isArray(x) ? x[0] : x; });
  if (duel) {
    const by = duel.m != null ? ` ${t(`by ${duel.m.toFixed(1)} s`, `на ${duel.m.toFixed(1)} с`, `por ${duel.m.toFixed(1)} s`, `um ${duel.m.toFixed(1)} s`, `${duel.m.toFixed(1)} sn farkla`, `de ${duel.m.toFixed(1)} s`, `di ${duel.m.toFixed(1)} s`, `por ${duel.m.toFixed(1)} s`)}` : '';
    const dcard = `/og/page/duel?${new URLSearchParams({ ...(v && { v }), ...(b && { b }), w: duel.w, l: duel.l, ...(duel.m != null && { m: duel.m.toFixed(1) }) })}`;
    return pageMeta(lang, { title: t(`${duel.w} beat ${duel.l}${by}: race the winner`, `${duel.w} обогнал(а) ${duel.l}${by}: сразись с победителем`, `${duel.w} ganó a ${duel.l}${by}: reta al ganador`, `${duel.w} schlug ${duel.l}${by}: fordere den Sieger`, `${duel.w}, ${duel.l} karşısında${by} kazandı: kazananla yarış`, `${duel.w} a battu ${duel.l}${by} : défie le vainqueur`, `${duel.w} ha battuto ${duel.l}${by}: sfida il vincitore`, `${duel.w} venceu ${duel.l}${by}: desafie o vencedor`),
      description: t('A 1-on-1 sailing race in your browser: open the link and race.', 'Гонка 1 на 1 под парусом в браузере: открой ссылку и гоняйся.', 'Una regata 1 contra 1 en tu navegador: abre el enlace y regatea.', 'Eine 1-gegen-1-Segelregatta im Browser: Link öffnen und segeln.', 'Tarayıcında bire bir yelken yarışı: bağlantıyı aç ve yarış.', 'Un duel de voile dans ton navigateur : ouvre le lien et régate.', 'Una regata a vela 1 contro 1 nel browser: apri il link e regata.', 'Um duelo de vela no seu navegador: abra o link e corra.'), index: false, card: dcard });
  }
  const card = `/og/page/match?${new URLSearchParams({ ...(code && { c: code }), ...(v && { v }), ...(b && { b }) })}`;
  return pageMeta(lang, { title: t('Race me: a 1-on-1 race', 'Сыграем: гонка 1 на 1', 'Rétame: una regata 1 contra 1', 'Segle gegen mich: eine 1-gegen-1-Regatta', 'Bana karşı yarış: bire bir yarış', 'Défie-moi : un duel en 1 contre 1', 'Sfidami: un duello 1 contro 1', 'Me desafie: um duelo 1 contra 1'), description: t('You and a friend, one on one: join the race.', 'Вы и друг, один на один: войдите в гонку.', 'Tú y un amigo, uno contra uno: únete a la regata.', 'Du und ein Freund, eins gegen eins: nimm an der Regatta teil.', 'Sen ve bir arkadaşın, bire bir: yarışa katıl.', 'Toi et un ami, en tête-à-tête : rejoins la régate.', 'Tu e un amico, uno contro uno: entra in regata.', 'Você e um amigo, um contra um: entre na regata.'), index: false, card });
}

export default async function MatchPage({ params, searchParams }: LangParams & { params: Promise<{ lang: string; code: string }>; searchParams: Promise<{ v?: string | string[]; b?: string | string[] }> }) {
  const [{ lang, t }, { code: raw }, sp] = await Promise.all([getT(params), params, searchParams]);
  const code = parseCode(raw);
  // a link whose code was cut short or mistyped: what's wrong with it and the ways on, rather than the bare 404
  if (!code) return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate', 'Torna al centro regate', 'Voltar à central de regatas')} />
            <SceneBrand lang={lang} />
          </div>
          <span className="bt-kick bt-kick-w">{t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1', 'Duelo 1 contra 1')}</span>
          <h1 className="bt-h">{t('This invite link doesn’t work', 'Эта ссылка-приглашение не работает', 'Este enlace de invitación no funciona', 'Dieser Einladungslink funktioniert nicht', 'Bu davet bağlantısı çalışmıyor', 'Ce lien d’invitation ne fonctionne pas', 'Questo link d’invito non funziona', 'Este link de convite não funciona')}</h1>
          <p className="bt-p">{t('Its race code is missing or mistyped: a code is six letters and numbers. Ask your friend to send the link again, or set up a race of your own.',
            'В ней нет кода гонки или он с опечаткой: код — это шесть букв и цифр. Попроси друга прислать ссылку ещё раз или создай свою гонку.', 'Le falta el código de la regata o tiene una errata: un código son seis letras y números. Pide a tu amigo que te mande el enlace otra vez, o prepara tu propia regata.', 'Der Regattacode fehlt oder ist falsch getippt: Ein Code besteht aus sechs Buchstaben und Ziffern. Bitte deinen Freund, den Link noch einmal zu schicken, oder richte selbst eine Regatta ein.', 'Yarış kodu eksik ya da yanlış yazılmış: kod altı harf ve rakamdır. Arkadaşından bağlantıyı yeniden göndermesini iste ya da kendi yarışını kur.', 'Son code de régate manque ou est mal saisi : un code fait six lettres et chiffres. Demande à ton ami de renvoyer le lien, ou prépare ta propre régate.', 'Il codice della regata manca o è scritto male: un codice è fatto di sei lettere e cifre. Chiedi al tuo amico di rimandarti il link, o organizza una regata tua.', 'O código da regata está faltando ou foi digitado errado: um código tem seis letras e números. Peça ao seu amigo para mandar o link de novo, ou monte a sua própria regata.')}</p>
          <a className="bt-go" href="/match/new"><IconPlay /><span>{t('Set up a 1-on-1 race', 'Настроить гонку 1 на 1', 'Prepara una regata 1 contra 1', '1-gegen-1-Regatta einrichten', 'Bire bir yarış kur', 'Préparer un duel 1 contre 1', 'Organizza un duello 1 contro 1', 'Montar um duelo 1 contra 1')}</span></a>
          <a className="bt-show" href="/race">{t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık', 'Courir la régate du jour', 'Corri la regata del giorno', 'Velejar a regata do dia')}</a>
        </div>
      </div>
    </div>
  );
  // the host's venue and boat, as ids in the address (the game's own reload settles a mismatch)
  const one = (x?: string | string[]) => { const s = Array.isArray(x) ? x[0] : x; return s && /^[a-z0-9_-]{1,32}$/i.test(s) ? s : ''; };
  const v = one(sp.v), b = one(sp.b);
  // where and in what the host sails, named when the address has a venue and a yacht the game knows
  const venue = v && venueOf(v).id === v ? venueOf(v) : null, yacht = b && yachtOf(b).id === b ? yachtOf(b) : null;
  const href = `/play?match=${code}${v ? `&venue=${v}` : ''}${b ? `&boat=${b}` : ''}`;
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate', 'Torna al centro regate', 'Voltar à central de regatas')} />
            <SceneBrand lang={lang} />
          </div>
          <span className="bt-kick bt-kick-w">{t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1', 'Duelo 1 contra 1')}</span>
          <h1 className="bt-h" id="match-title">{t('Race me', 'Сыграем', 'Rétame', 'Segle gegen mich', 'Bana karşı yarış', 'Défie-moi', 'Sfidami', 'Me desafie')}</h1>
          <p className="bt-p">{t('You and a friend, one on one.', 'Вы и друг, один на один.', 'Tú y un amigo, uno contra uno.', 'Du und ein Freund, eins gegen eins.', 'Sen ve bir arkadaşın, bire bir.', 'Toi et un ami, en tête-à-tête.', 'Tu e un amico, uno contro uno.', 'Você e um amigo, um contra um.')}</p>
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Code', 'Код', 'Código', 'Code', 'Kod', 'Code', 'Codice', 'Código')}</span><b>{code}</b></div>
            {venue && <div><span className="bt-sk">{t('Venue', 'Акватория', 'Sede', 'Revier', 'Yarış alanı', 'Plan d’eau', 'Campo di regata', 'Raia')}</span><b>{t(...venue.name)}</b></div>}
            {yacht && <div><span className="bt-sk">{t('Yacht', 'Яхта', 'Yate', 'Yacht', 'Yat', 'Yacht', 'Yacht', 'Veleiro')}</span><b>{t(...yacht.name)}</b></div>}
          </div>
          <InviteJoin code={code} href={href} lang={lang} />{/* who is asking, how long, and "Race Alex" (read in the browser) */}
        </div>
      </div>
    </div>
  );
}
