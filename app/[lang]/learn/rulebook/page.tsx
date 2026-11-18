import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { ruPlural } from '@/lib/lang';
import { jsonLd, langUrl, SITE, OG_IMAGE, AUTHOR_LD, RYC_LD } from '@/lib/seo';
import { rulebook, entriesOf, ruleCount, RULEBOOK_DATE, RULEBOOK_SOURCE, type RuleEntry } from '@/lib/rulebook';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot, Trail, type Crumb } from '@/components/site-chrome';
import { READING_VIEWPORT } from '@/lib/no-zoom';
import '@/styles/reading.css';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('The Racing Rules of Sailing, rule by rule', 'Правила парусных гонок: все правила по порядку', {
  path: '/learn/rulebook', card: '/og/page/rulebook',
  description: [
    'Every rule of the Racing Rules of Sailing 2025–2028 in plain words: definitions, right of way, mark-room, starts, penalties, protests, appendices and race signals.',
    'Все правила парусных гонок 2025–2028 простыми словами: определения, право дороги, место у знака, старт, наказания, протесты, приложения и гоночные сигналы.'],
});

// L2 · The rule book: every rule of the Racing Rules of Sailing in the book's order, a card each as in the glossary, the
// parts as chips with their counts at the top, each rule linkable (#rule-18-2), its card leading on to the guide that
// goes further where there is one. It says at the top that it is a summary, and where the official text is.
export default async function Rulebook({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const parts = rulebook(t);
  const n = ruleCount(parts);
  const url = SITE + langUrl('/learn/rulebook', lang);
  const title = t('The racing rules, rule by rule', 'Правила гонок, правило за правилом');
  const crumbs: Crumb[] = [[t('Learn to race', 'Учись гоняться'), '/learn'], [t('Rule book', 'Все правила'), '/learn/rulebook']];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, inLanguage: lang, url, mainEntityOfPage: url, image: SITE + OG_IMAGE.url,
    datePublished: RULEBOOK_DATE, dateModified: RULEBOOK_DATE, author: AUTHOR_LD, publisher: RYC_LD, about: ['Racing Rules of Sailing', 'Sailboat racing'],
  };
  const card = (x: RuleEntry) => (
    <div key={x.id} id={x.id} className="gd-term">
      <dt>{x.no && <b className="rb-no">{x.no}</b>}<span>{x.title}</span></dt>
      <dd>{x.text}</dd>
      {x.see && <dd className="gd-see-d"><Link className="gd-see" href={x.see}>{t('Read the guide', 'Читать пособие')}<IconArrow s={12} /></Link></dd>}
    </div>
  );
  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="learn" crumbs={crumbs} />
      <header className="hm-page hm-ph">
        <Trail t={t} crumbs={crumbs} />
        <span className="kicker">{t('Learn to race · rule book', 'Учись гоняться · все правила')}</span>
        <h1 className="hm-ph-h">{title}</h1>
        <p className="hm-text">{t(`All ${n} rules of the Racing Rules of Sailing 2025–2028 in plain words, with the definitions, the appendices and the race signals. Look one up, or read a part from the top.`, `Все ${n} ${ruPlural(n, ['правило', 'правила', 'правил'])} парусных гонок 2025–2028 простыми словами, а ещё определения, приложения и гоночные сигналы. Найдите нужное или прочитайте часть с начала.`)}</p>
        <nav className="hm-ph-nav" aria-label={t('Parts of the rules', 'Части правил')}>
          {parts.map((p) => {
            const c = entriesOf(p).length;
            return <a key={p.id} className="hm-chip" href={`#${p.id}`} aria-label={`${p.title}: ${c}`}>{p.chip}<span className="td">{c}</span></a>;
          })}
        </nav>
        <p className="rb-note">
          <b className="lbl">{t('A summary', 'Краткое изложение')}</b>
          <span>{t('These are our own short versions, not the official text, and a race’s notice of race and sailing instructions can change many rules. At a real event, go by ', 'Это наш короткий пересказ, а не официальный текст, и положение о соревновании и гоночная инструкция могут менять многие правила. На настоящих гонках руководствуйтесь ')}<a href={RULEBOOK_SOURCE} rel="noopener">{t('World Sailing’s rule book', 'книгой правил World Sailing')}</a>.</span>
        </p>
      </header>
      <div className="hm-page gd gd-groups">
        {parts.map((p) => (
          <section key={p.id} id={p.id} className="gd-group" aria-labelledby={`${p.id}-t`}>
            <h2 id={`${p.id}-t`}>{p.title}<span className="lbl" aria-hidden="true">{entriesOf(p).length}</span></h2>
            <p className="rb-intro">{p.intro}</p>
            {p.sections.map((s, i) => (
              <div key={s.id || i} id={s.id} className="rb-sec">
                {s.title && <h3>{s.title}</h3>}
                {s.intro && <p className="rb-intro">{s.intro}</p>}
                <dl className="gd-terms">{s.entries.map(card)}</dl>
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="hm-page">
        <section className="rd-cta" aria-labelledby="rb-race">
          <div className="rd-cta-t">
            <span className="lbl">{t('The rules, on the water', 'Правила — на воде')}</span>
            <b id="rb-race">{t('The computer boats race by them. So do you', 'Компьютерные лодки гоняются по ним. И вы тоже')}</b>
          </div>
          <Link className="pill pill-primary" href="/race"><span className="btn-t">{t('Today’s race', 'Гонка дня')}</span><IconArrow /></Link>
        </section>
      </div>
      <SiteFoot lang={lang} t={t} back="/learn/rulebook" />
    </div>
  );
}
