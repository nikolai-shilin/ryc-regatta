// Draws the country flags a boat can fly on her main (the boat page's Flag, lib/flags.ts) as public/flags/<code>.svg.
// Every flag is drawn 3:2 (900 × 600), as sails and regatta graphics show them all the same shape; the emblems are the
// flag's own, simplified to what reads on a sail across the water. Run: node scripts/flags.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const W = 900, H = 600;
const rect = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const hz = (...cs) => cs.map((c, i) => rect(0, (H / cs.length) * i, W, H / cs.length + 0.5, c)).join(''); // horizontal bands
const vt = (...cs) => cs.map((c, i) => rect((W / cs.length) * i, 0, W / cs.length + 0.5, H, c)).join(''); // vertical bands
const f = (n) => +n.toFixed(2);
// an n-pointed star centred on (cx, cy), outer radius r, inner ri, one point aimed at angle a (radians, 0 = up)
function star(cx, cy, r, c, n = 5, ri = r * 0.382, a = 0, extra = '') {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? ri : r, t = a + (i * Math.PI) / n;
    p.push(`${f(cx + rr * Math.sin(t))},${f(cy - rr * Math.cos(t))}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${c}"${extra}/>`;
}
// a Nordic cross: the upright from x0 to x1, the bar from y0 to y1
const nordic = (bg, c, x0, x1, y0, y1) => rect(0, 0, W, H, bg) + rect(x0, 0, x1 - x0, H, c) + rect(0, y0, W, y1 - y0, c);
// the Union Jack, filling (x, y, w, h)
const unionJack = (x, y, w, h) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 60 30" preserveAspectRatio="none">
<clipPath id="uj-s"><path d="M0,0v30h60v-30z"/></clipPath><clipPath id="uj-t"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath>
<g clip-path="url(#uj-s)"><path d="M0,0v30h60v-30z" fill="#012169"/><path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/>
<path d="M0,0L60,30M60,0L0,30" clip-path="url(#uj-t)" stroke="#C8102E" stroke-width="4"/><path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/>
<path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></g></svg>`;
// a crescent and star (Turkey, Azerbaijan): the outer disc, the disc cut out of it, then the star
const crescent = (cx, cy, r, cut, dx, c, bg) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/><circle cx="${cx + dx}" cy="${cy}" r="${cut}" fill="${bg}"/>`;
// the Georgian flag's small Bolnisi crosses: four arms flaring out to their ends
const bolnisi = (cx, cy, r, c) => {
  const w = r * 0.1, e = r * 0.34, k = r * 0.5;
  return `<path transform="translate(${cx} ${cy})" fill="${c}" d="M${-e},${-r}H${e}Q${w},${-k} ${w},${-w}Q${k},${-w} ${r},${-e}V${e}Q${k},${w} ${w},${w}Q${w},${k} ${e},${r}H${-e}Q${-w},${k} ${-w},${w}Q${-k},${w} ${-r},${e}V${-e}Q${-k},${-w} ${-w},${-w}Q${-w},${-k} ${-e},${-r}Z"/>`;
};
// the Canadian maple leaf, its tip at (cx, top), h tall: eleven points, drawn as one half and its mirror
const LEAF = [[0, 0], [0.1, 0.18], [0.18, 0.14], [0.15, 0.44], [0.27, 0.32], [0.31, 0.38], [0.46, 0.34], [0.4, 0.52], [0.47, 0.56],
  [0.26, 0.73], [0.28, 0.81], [0.04, 0.78], [0.045, 1]];
const mapleLeaf = (cx, top, h, c) => {
  const pts = [...LEAF, ...LEAF.slice(1).reverse().map(([x, y]) => [-x, y])];
  return `<polygon fill="${c}" points="${pts.map(([x, y]) => `${f(cx + x * h)},${f(top + y * h)}`).join(' ')}"/>`;
};
const sun = (cx, cy, r, rays, c, face = '') => {
  let s = '';
  for (let i = 0; i < rays; i++) {
    const t = (i * 2 * Math.PI) / rays, d = Math.PI / rays * 0.55, R = r * 1.75, q = r * 1.08;
    s += `<polygon fill="${c}" points="${f(cx + q * Math.sin(t - d))},${f(cy - q * Math.cos(t - d))} ${f(cx + R * Math.sin(t))},${f(cy - R * Math.cos(t))} ${f(cx + q * Math.sin(t + d))},${f(cy - q * Math.cos(t + d))}"/>`;
  }
  return s + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>` + face;
};

const FLAGS = {
  // Georgia: the Five Cross flag, a red St George's cross with a Bolnisi cross in each quarter
  ge: () => rect(0, 0, W, H, '#fff') + rect(390, 0, 120, H, '#ff0000') + rect(0, 240, W, 120, '#ff0000')
    + [[195, 120], [705, 120], [195, 480], [705, 480]].map(([x, y]) => bolnisi(x, y, 66, '#ff0000')).join(''),
  ru: () => hz('#ffffff', '#0039a6', '#d52b1e'),
  ua: () => hz('#0057b7', '#ffd700'),
  kz: () => rect(0, 0, W, H, '#00afca') + rect(42, 0, 8, H, '#fec50c')
    + Array.from({ length: 12 }, (_, i) => `<path fill="#fec50c" d="M66,${25 + i * 48}l22,12l-22,12l-10,-12z"/>`).join('')
    + sun(470, 240, 78, 32, '#fec50c')
    + `<path fill="#fec50c" d="M260,390Q360,330 470,372Q580,330 680,390Q600,372 540,400Q500,388 470,420Q440,388 400,400Q340,372 260,390Z"/>`,
  am: () => hz('#d90012', '#0033a0', '#f2a800'),
  az: () => hz('#00b5e2', '#ef3340', '#509e2f') + crescent(420, 300, 90, 75, 22, '#fff', '#ef3340') + star(522, 300, 40, '#fff', 8, 18, Math.PI / 8),
  tr: () => rect(0, 0, W, H, '#e30a17') + crescent(300, 300, 150, 120, 37.5, '#fff', '#e30a17') + star(465, 300, 75, '#fff', 5, 29, -Math.PI / 2),
  gr: () => Array.from({ length: 9 }, (_, i) => rect(0, (H / 9) * i, W, H / 9 + 0.5, i % 2 ? '#fff' : '#0d5eaf')).join('')
    + rect(0, 0, 333.3, 333.3, '#0d5eaf') + rect(133.3, 0, 66.7, 333.3, '#fff') + rect(0, 133.3, 333.3, 66.7, '#fff'),
  hr: () => hz('#ff0000', '#ffffff', '#171796')
    + `<g transform="translate(390 170)"><path d="M0,0h120v150q0,70 -60,90q-60,-20 -60,-90z" fill="#fff"/><clipPath id="hr-s"><path d="M0,0h120v150q0,70 -60,90q-60,-20 -60,-90z"/></clipPath><g clip-path="url(#hr-s)">`
    + Array.from({ length: 25 }, (_, i) => (i % 2 ? '' : rect((i % 5) * 24, Math.floor(i / 5) * 48, 24, 48, '#ff0000'))).join('')
    + `</g><path d="M0,0h120v150q0,70 -60,90q-60,-20 -60,-90z" fill="none" stroke="#ff0000" stroke-width="4"/></g>`
    + [0, 1, 2, 3, 4].map((i) => `<path fill="#0093dd" stroke="#fff" stroke-width="2" d="M${390 + i * 24},165l2,-28q10,-${8 + (i === 2 ? 6 : i % 2 ? 2 : 0)} 20,0l2,28z"/>`).join(''),
  it: () => vt('#009246', '#ffffff', '#ce2b37'),
  fr: () => vt('#0055a4', '#ffffff', '#ef4135'),
  es: () => rect(0, 0, W, H, '#aa151b') + rect(0, 150, W, 300, '#f1bf00'),
  pt: () => rect(0, 0, W, H, '#ff0000') + rect(0, 0, 360, H, '#006600')
    + `<circle cx="360" cy="300" r="118" fill="none" stroke="#ffe900" stroke-width="22"/>`
    + `<path d="M310,230h100v100q0,45 -50,55q-50,-10 -50,-55z" fill="#ff0000"/><path d="M328,248h64v78q0,30 -32,38q-32,-8 -32,-38z" fill="#fff"/>`
    + [[360, 268], [342, 296], [378, 296], [360, 296], [360, 324]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#003399"/>`).join(''),
  de: () => hz('#000000', '#dd0000', '#ffce00'),
  nl: () => hz('#ae1c28', '#ffffff', '#21468b'),
  be: () => vt('#000000', '#fdda24', '#ef3340'),
  gb: () => unionJack(0, 0, W, H),
  ie: () => vt('#169b62', '#ffffff', '#ff883e'),
  se: () => nordic('#006aa7', '#fecc00', 281, 394, 240, 360),
  no: () => nordic('#ba0c2f', '#ffffff', 245, 409, 225, 375) + rect(286, 0, 82, H, '#00205b') + rect(0, 262.5, W, 75, '#00205b'),
  dk: () => nordic('#c8102e', '#ffffff', 292, 389, 257, 343),
  fi: () => nordic('#ffffff', '#002f6c', 250, 400, 218, 382),
  ee: () => hz('#0072ce', '#000000', '#ffffff'),
  lv: () => rect(0, 0, W, H, '#9e3039') + rect(0, 240, W, 120, '#ffffff'),
  lt: () => hz('#fdb913', '#006a44', '#c1272d'),
  pl: () => hz('#ffffff', '#dc143c'),
  cz: () => hz('#ffffff', '#d7141a') + `<polygon points="0,0 450,300 0,600" fill="#11457e"/>`,
  at: () => hz('#c8102e', '#ffffff', '#c8102e'),
  ch: () => rect(0, 0, W, H, '#da291c') + rect(394, 112, 112, 376, '#fff') + rect(262, 244, 376, 112, '#fff'),
  hu: () => hz('#ce2939', '#ffffff', '#477050'),
  ro: () => vt('#002b7f', '#fcd116', '#ce1126'),
  bg: () => hz('#ffffff', '#00966e', '#d62612'),
  us: () => Array.from({ length: 13 }, (_, i) => rect(0, (H / 13) * i, W, H / 13 + 0.5, i % 2 ? '#fff' : '#b31942')).join('')
    + rect(0, 0, 360, (H / 13) * 7, '#0a3161')
    + Array.from({ length: 99 }, (_, k) => { const i = k % 11, j = Math.floor(k / 11); return (i + j) % 2 ? '' : star(30 + i * 30, 26 + j * 29.5, 12.5, '#fff'); }).join(''),
  ca: () => rect(0, 0, W, H, '#fff') + rect(0, 0, 225, H, '#d52b1e') + rect(675, 0, 225, H, '#d52b1e')
    + mapleLeaf(450, 70, 440, '#d52b1e'),
  br: () => rect(0, 0, W, H, '#009b3a') + `<polygon points="450,60 840,300 450,540 60,300" fill="#fedf00"/><circle cx="450" cy="300" r="150" fill="#002776"/>`
    + `<clipPath id="br-g"><circle cx="450" cy="300" r="150"/></clipPath><path clip-path="url(#br-g)" d="M290,270Q450,240 610,330" fill="none" stroke="#fff" stroke-width="24"/>`
    + [[400, 350], [450, 380], [500, 355], [470, 410], [420, 405], [530, 395], [380, 385]].map(([x, y]) => star(x, y, 9, '#fff')).join(''),
  ar: () => hz('#74acdf', '#ffffff', '#74acdf') + sun(450, 300, 46, 32, '#f6b40e'),
  au: () => rect(0, 0, W, H, '#012169') + unionJack(0, 0, 450, 300) + star(225, 450, 96, '#fff', 7, 41)
    + [[675, 500, 54], [562, 262, 54], [675, 100, 54], [775, 222, 54]].map(([x, y, r]) => star(x, y, r, '#fff', 7, r * 0.43)).join('') + star(720, 325, 32, '#fff'),
  nz: () => rect(0, 0, W, H, '#012169') + unionJack(0, 0, 450, 300)
    + [[675, 480, 46], [585, 285, 40], [757, 250, 36], [675, 120, 40]].map(([x, y, r]) => star(x, y, r + 9, '#fff') + star(x, y, r, '#c8102e')).join(''),
  jp: () => rect(0, 0, W, H, '#fff') + `<circle cx="450" cy="300" r="180" fill="#bc002d"/>`,
  cn: () => rect(0, 0, W, H, '#ee1c25') + star(150, 150, 90, '#ffff00')
    + [[300, 60], [360, 120], [360, 210], [300, 270]].map(([x, y]) => star(x, y, 30, '#ffff00', 5, 11.5, Math.atan2(150 - x, -(150 - y)))).join(''),
  in: () => hz('#ff9933', '#ffffff', '#138808') + `<circle cx="450" cy="300" r="85" fill="none" stroke="#000080" stroke-width="10"/><circle cx="450" cy="300" r="15" fill="#000080"/>`
    + Array.from({ length: 24 }, (_, i) => { const t = (i * Math.PI) / 12; return `<line x1="450" y1="300" x2="${f(450 + 82 * Math.sin(t))}" y2="${f(300 - 82 * Math.cos(t))}" stroke="#000080" stroke-width="4"/>`; }).join(''),
  ae: () => hz('#00732f', '#ffffff', '#000000') + rect(0, 0, 225, H, '#ff0000'),
  il: () => rect(0, 0, W, H, '#fff') + rect(0, 56, W, 94, '#0038b8') + rect(0, 450, W, 94, '#0038b8')
    + [0, Math.PI].map((a) => `<polygon fill="none" stroke="#0038b8" stroke-width="20" points="${[0, 1, 2].map((i) => { const t = a + (i * 2 * Math.PI) / 3; return `${f(450 + 105 * Math.sin(t))},${f(300 - 105 * Math.cos(t))}`; }).join(' ')}"/>`).join(''),
  th: () => rect(0, 0, W, H, '#a51931') + rect(0, 100, W, 400, '#f4f5f8') + rect(0, 200, W, 200, '#2d2a4a'),
  sc: () => `<polygon points="0,600 0,0 300,0" fill="#003f87"/><polygon points="0,600 300,0 600,0" fill="#fcd856"/><polygon points="0,600 600,0 900,0 900,200" fill="#d62828"/>`
    + `<polygon points="0,600 900,200 900,400" fill="#ffffff"/><polygon points="0,600 900,400 900,600" fill="#007a3d"/>`,
  za: () => rect(0, 0, W, H, '#fff') + `<polygon points="0,0 900,0 900,200 375,200" fill="#e03c31"/><polygon points="0,600 900,600 900,400 375,400" fill="#001489"/>`
    + `<polygon points="0,0 90,0 330,240 900,240 900,360 330,360 90,600 0,600 0,520 280,300 0,80" fill="#007749"/>`
    + `<polygon points="0,80 280,300 0,520 0,440 180,300 0,160" fill="#ffb81c"/><polygon points="0,160 180,300 0,440" fill="#000"/>`,
};

const out = new URL('../public/flags/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [code, draw] of Object.entries(FLAGS)) {
  writeFileSync(new URL(`${code}.svg`, out), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${draw()}</svg>\n`);
}
console.log(`${Object.keys(FLAGS).length} flags in public/flags`);
