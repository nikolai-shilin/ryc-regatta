import Link from 'next/link';
import Image from 'next/image';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { ruPlural } from '@/lib/lang';
import { jsonLd, langUrl, longDate, SITE, OG_IMAGE, AUTHOR, AUTHOR_LD, RYC_LD } from '@/lib/seo';
import { guide } from '@/lib/guides';
import { rulebook, ruleCount, RULEBOOK_DATE, RULEBOOK_SOURCE, type RuleEntry } from '@/lib/rulebook';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot, Trail, type Crumb } from '@/components/site-chrome';
import { Toc } from '@/components/toc';
import { READING_VIEWPORT } from '@/lib/no-zoom';
import '@/styles/reading.css';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('The Racing Rules of Sailing, rule by rule', 'Правила парусных гонок: все правила по порядку', 'El Reglamento de Regatas a Vela, regla a regla', 'Die Wettfahrtregeln Segeln, Regel für Regel', 'Yelken Yarış Kuralları, kural kural', {
  path: '/rulebook', card: '/og/page/rulebook',
  description: [
    'Every rule of the Racing Rules of Sailing 2025–2028 in plain words: definitions, right of way, mark-room, starts, penalties, protests, appendices and race signals.',
    'Все правила парусных гонок 2025–2028 простыми словами: определения, право дороги, место у знака, старт, наказания, протесты, приложения и гоночные сигналы.', 'Cada regla del Reglamento de Regatas a Vela 2025–2028 en palabras llanas: definiciones, derecho de paso, espacio en baliza, salidas, penalizaciones, protestas, apéndices y señales de regata.', 'Jede Regel der Wettfahrtregeln Segeln 2025–2028 in einfachen Worten: Definitionen, Wegerecht, Bahnmarkenraum, Starts, Strafen, Proteste, Anhänge und Wettfahrtsignale.', 'Yelken Yarış Kuralları 2025–2028’in her kuralı sade sözlerle: tanımlar, geçiş hakkı, şamandıra alanı, startlar, cezalar, protestolar, ekler ve yarış işaretleri.'],
});

// L1 · The rule book, a page of its own in the menu and the footer, laid out as a guide (learn/[slug]/page.tsx): the title and the intro over the rules guide's picture,
// the contents beside the text on a wide screen, then every rule of the Racing Rules of Sailing in the book's order, each
// linkable (#rule-18-2). The number down the side is the Part's own, so the parts that aren't numbered in the book have
// none. It says first that it is a summary, and where the official text is; at the foot, the game and three ways on.
export default async function Rulebook({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const parts = rulebook(t);
  const n = ruleCount(parts);
  const img = guide('rules', t, lang).img!;
  const url = SITE + langUrl('/rulebook', lang);
  const title = t('The racing rules, rule by rule', 'Правила гонок, правило за правилом', 'Las reglas de regatas, regla a regla', 'Die Wettfahrtregeln, Regel für Regel', 'Yarış kuralları, kural kural');
  const crumbs: Crumb[] = [[t('Racing rules', 'Правила гонок', 'Reglas de regatas', 'Wettfahrtregeln', 'Yarış kuralları'), '/rulebook']];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, inLanguage: lang, url, mainEntityOfPage: url, image: SITE + (img.src || OG_IMAGE.url),
    datePublished: RULEBOOK_DATE, dateModified: RULEBOOK_DATE, author: AUTHOR_LD, publisher: RYC_LD, about: ['Racing Rules of Sailing', 'Sailboat racing'],
  };
  const cards: [string, string, string][] = [
    [t('Further reading', 'Подробнее', 'Más lecturas', 'Weiterlesen', 'Daha fazla oku'), guide('rules', t, lang).short, '/learn/rules'],
    [t('Glossary', 'Словарь', 'Glosario', 'Glossar', 'Sözlük'), t('Sailing racing glossary', 'Словарь парусных гонок', 'Glosario de regatas a vela', 'Segelregatta-Glossar', 'Yelken yarışı sözlüğü'), '/learn/glossary'],
    [t('All the guides', 'Все пособия', 'Todas las guías', 'Alle Anleitungen', 'Tüm rehberler'), t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri'), '/learn'],
  ];
  const rule = (x: RuleEntry, Heading: 'h3' | 'h4') => (
    <div key={x.id} id={x.id} className="rb-rule">
      <Heading>{x.no && <b>{x.no}</b>}{x.title}</Heading>
      <p>{x.text}</p>
      {x.see && <Link className="gd-see" href={x.see}>{t('Read the guide', 'Читать пособие', 'Lee la guía', 'Die Anleitung lesen', 'Rehberi oku')}<IconArrow s={12} /></Link>}
    </div>
  );
  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="rulebook" />
      <header className="gd-hero">
        <Image className="gd-hero-bg" src={img.src} width={img.width} height={img.height} sizes="100vw" fetchPriority="high" loading="eager" alt={img.alt} />
        <div className="hm-page hm-ph">
          <Trail t={t} crumbs={crumbs} />
          <span className="kicker">{t(`Racing Rules of Sailing · ${n} rules`, `Правила парусных гонок · ${n} ${ruPlural(n, ['правило', 'правила', 'правил'])}`, `Reglamento de Regatas a Vela · ${n} reglas`, `Wettfahrtregeln Segeln · ${n} Regeln`, `Yelken Yarış Kuralları · ${n} kural`)}</span>
          <h1 className="hm-ph-h">{title}</h1>
          <p className="hm-text">{t('The Racing Rules of Sailing 2025–2028 in plain words, with the definitions, the appendices and the race signals. Look one up, or read a part from the top.', 'Правила парусных гонок 2025–2028 простыми словами, с определениями, приложениями и гоночными сигналами. Найдите нужное правило или прочитайте часть с начала.', 'El Reglamento de Regatas a Vela 2025–2028 en palabras llanas, con las definiciones, los apéndices y las señales de regata. Busca una regla o lee una parte desde el principio.', 'Die Wettfahrtregeln Segeln 2025–2028 in einfachen Worten, mit den Definitionen, den Anhängen und den Wettfahrtsignalen. Schlag eine nach, oder lies einen Teil von vorn.', 'Yelken Yarış Kuralları 2025–2028 sade sözlerle, tanımlar, ekler ve yarış işaretleriyle. Birini ara ya da bir bölümü baştan oku.')}</p>
          <p className="gd-by">{t('By ', '', 'Por ', 'Von ', 'Yazan: ')}<span>{t(...AUTHOR.name)}</span>, {AUTHOR.org} · {t('Published ', 'Опубликовано ', 'Publicado ', 'Veröffentlicht ', 'Yayımlandı: ')}<time dateTime={RULEBOOK_DATE}>{longDate(RULEBOOK_DATE, lang)}</time></p>
          <nav className="hm-ph-nav rd-chips" aria-label={t('Contents', 'Содержание', 'Contenido', 'Inhalt', 'İçindekiler')}>
            {parts.map((p) => <a key={p.id} className="hm-chip" href={`#${p.id}`}>{p.chip}</a>)}
          </nav>
        </div>
      </header>

      <div className="hm-page rd-layout">
        <Toc items={parts.map((p) => [p.id, p.title])} label={t('Contents', 'Содержание', 'Contenido', 'Inhalt', 'İçindekiler')} />
        <div className="rd-main">
          <article className="gd">
            <div className="gd-sec">
              <div className="gd-tip">
                <b className="lbl">{t('A summary', 'Краткое изложение', 'Un resumen', 'Eine Zusammenfassung', 'Bir özet')}</b>
                <p>{t('These are our own short versions, not the official text, and a race’s notice of race and sailing instructions can change many rules. At a real event, go by ', 'Это наш короткий пересказ, а не официальный текст, и положение о соревновании и гоночная инструкция могут менять многие правила. На настоящих гонках руководствуйтесь ', 'Estas son versiones cortas propias, no el texto oficial, y el anuncio de regata y las instrucciones de regata de una prueba pueden cambiar muchas reglas. En un evento real, guíate por ', 'Das sind unsere eigenen Kurzfassungen, nicht der offizielle Text, und die Ausschreibung und die Segelanweisungen einer Regatta können viele Regeln ändern. Bei einer echten Veranstaltung gilt ', 'Bunlar kendi kısa sürümlerimizdir, resmî metin değil; bir yarışın yarış ilanı ve yarış talimatları birçok kuralı değiştirebilir. Gerçek bir etkinlikte şuna göre hareket et: ')}<a href={RULEBOOK_SOURCE} rel="noopener">{t('World Sailing’s rule book', 'книгой правил World Sailing', 'el reglamento de World Sailing', 'das Regelwerk von World Sailing', 'World Sailing kural kitabı')}</a>.</p>
              </div>
            </div>
            {parts.map((p) => (
              <section key={p.id} id={p.id} className="gd-sec" data-n={p.id.startsWith('part-') ? p.id.slice(5).padStart(2, '0') : undefined} aria-labelledby={`${p.id}-t`}>
                <h2 id={`${p.id}-t`}>{p.title}</h2>
                <p>{p.intro}</p>
                <div className="rb-rules">
                  {p.sections.map((s, i) => (
                    <div key={s.id || i} id={s.id} className="rb-sec">
                      {s.title && <h3>{s.title}</h3>}
                      {s.intro && <p>{s.intro}</p>}
                      {s.entries.map((x) => rule(x, s.title ? 'h4' : 'h3'))}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </article>

          <section className="gd-try" aria-labelledby="gd-try">
            <div className="gd-try-t">
              <span className="gd-try-k">{t('Now try it', 'Теперь попробуй', 'Pruébalo ahora', 'Jetzt ausprobieren', 'Şimdi dene')}</span>
              <h2 className="hm-h2" id="gd-try">{t('On the water, in your browser', 'На воде, прямо в браузере', 'En el agua, en tu navegador', 'Auf dem Wasser, in deinem Browser', 'Suda, tarayıcında')}</h2>
              <p>{t('The computer boats race by these rules, and so do you. Up and down is free, on a phone or a computer, with nothing to install.', 'Компьютерные лодки гоняются по этим правилам, и ты вместе с ними. Up and down бесплатна, на телефоне или компьютере, ничего не нужно устанавливать.', 'Los barcos del ordenador compiten según estas reglas, y tú también. Up and down es gratis, en el móvil o en el ordenador, sin instalar nada.', 'Die Computerboote segeln nach diesen Regeln, und du auch. Up and down ist kostenlos, auf dem Handy oder am Computer, ohne etwas zu installieren.', 'Bilgisayar tekneleri bu kurallara göre yarışır, sen de öyle. Up and down ücretsizdir, telefonda ya da bilgisayarda, hiçbir şey kurmadan.')}</p>
            </div>
            <Link className="gd-try-go" href="/race">{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı')}<IconArrow /></Link>
          </section>

          <section className="gd-more" aria-labelledby="gd-more">
            <h2 className="lbl-ink" id="gd-more">{t('Read more', 'Читать дальше', 'Leer más', 'Mehr lesen', 'Devamını oku')}</h2>
            <div className="gd-next">
              {cards.map(([k, label, href]) => <Link key={href} className="gd-next-card" href={href}><span className="lbl">{k}</span><span className="card-title">{label}</span><IconArrow s={16} /></Link>)}
            </div>
          </section>
        </div>
      </div>

      <SiteFoot lang={lang} t={t} back="/rulebook" />
    </div>
  );
}
