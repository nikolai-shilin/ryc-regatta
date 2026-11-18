// Draws the country flags a boat can fly on her main (the boat page's Flag, lib/flags.ts) as public/flags/<code>.svg.
// Every flag is drawn 3:2 (900 × 600), as sails and regatta graphics show them all the same shape; the emblems are the
// flag's own, simplified to what reads on a sail across the water. Run: node scripts/flags.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { SHAHADA } from './flags-shahada.mjs';

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
// a heraldic shield's outline: flat across the top, its sides curving in to a point at the foot
const shield = (x, y, w, h) => `M${x},${y}h${w}v${f(h * 0.6)}q0,${f(h * 0.28)} ${f(-w / 2)},${f(h * 0.4)}q${f(-w / 2)},${f(-h * 0.12)} ${f(-w / 2)},${f(-h * 0.4)}z`;
// a bird's wing: n feathers fanned from the shoulder (cx, cy), from angle a0 to a1 (degrees clockwise from up, s = -1 for the
// wing on the other side), l0 to l1 long
const feathers = (cx, cy, s, n, a0, a1, l0, l1, w, c, edge) => Array.from({ length: n }, (_, i) => {
  const t = n > 1 ? i / (n - 1) : 0, a = a0 + (a1 - a0) * t, l = l0 + (l1 - l0) * t;
  return `<path transform="translate(${cx} ${cy}) rotate(${f(s * a)})" fill="${c}" stroke="${edge}" stroke-width="2.5" d="M0,0C${w},${f(-l * 0.3)} ${w},${f(-l * 0.8)} 0,${f(-l)}C${-w},${f(-l * 0.8)} ${-w},${f(-l * 0.3)} 0,0Z"/>`;
}).join('');

const FLAGS = {
  // Georgia: the Five Cross flag, a red St George's cross with a Bolnisi cross in each quarter
  ge: () => rect(0, 0, W, H, '#fff') + rect(390, 0, 120, H, '#ff0000') + rect(0, 240, W, 120, '#ff0000')
    + [[195, 120], [705, 120], [195, 480], [705, 480]].map(([x, y]) => bolnisi(x, y, 66, '#ff0000')).join(''),
  ru: () => hz('#ffffff', '#0039a6', '#d52b1e'),
  ua: () => hz('#0057b7', '#ffd700'),
  // Belarus: red over green, the white hoist band with its red ornament (simplified to a column of rhombi)
  by: () => rect(0, 0, W, 400, '#c8313e') + rect(0, 400, W, 200, '#4aa657') + rect(0, 0, 100, H, '#fff')
    + Array.from({ length: 6 }, (_, i) => {
      const y = 50 + i * 100;
      return `<polygon fill="#c8313e" points="50,${y - 46} 90,${y} 50,${y + 46} 10,${y}"/><polygon fill="#fff" points="50,${y - 28} 72,${y} 50,${y + 28} 28,${y}"/>`
        + `<rect fill="#c8313e" x="42" y="${y - 8}" width="16" height="16"/><rect fill="#c8313e" x="46" y="${y + 44}" width="8" height="12"/>`;
    }).join(''),

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

  // Antigua and Barbuda: the V of black, blue and white with the rising sun, on red
  ag: () => rect(0, 0, W, H, '#ce1126') + `<clipPath id="ag-v"><polygon points="0,0 900,0 450,600"/></clipPath><g clip-path="url(#ag-v)">`
    + rect(0, 0, W, 250, '#000') + sun(450, 250, 62, 16, '#fcd116') + rect(0, 250, W, 100, '#0072c6') + rect(0, 350, W, 250, '#fff') + `</g>`,
  // Bosnia and Herzegovina: the yellow triangle and the line of stars along it, on blue
  ba: () => rect(0, 0, W, H, '#002395') + `<polygon points="240,0 840,0 840,600" fill="#fecb00"/>`
    + Array.from({ length: 9 }, (_, k) => { const t = -53 + 75 * k; return star(187 + t, 53 + t, 34, '#fff'); }).join(''),
  // Bermuda: the red ensign, the arms (the red lion holding the Sea Venture's shield) simplified
  bm: () => rect(0, 0, W, H, '#c8102e') + unionJack(0, 0, 450, 300)
    + `<path d="M600,250h150v130q0,70 -75,100q-75,-30 -75,-100z" fill="#fff" stroke="#fff" stroke-width="10"/>`
    + `<path d="M600,400q75,40 150,0v-20q0,70 -75,100q-75,-30 -75,-100z" fill="#2f8f3a"/>`
    + `<path d="M640,400q-10,-60 15,-95q-8,-25 12,-35q25,-5 30,20q20,15 18,45q20,20 10,65z" fill="#c8102e"/>`
    + `<path d="M660,330h45v40q0,25 -22,35q-23,-10 -23,-35z" fill="#7fb2e5" stroke="#fcd116" stroke-width="4"/>`,
  // Chile: the white star in the blue square, white over red
  cl: () => rect(0, 0, W, 300, '#fff') + rect(0, 300, W, 300, '#d52b1e') + rect(0, 0, 300, 300, '#0039a6') + star(150, 150, 60, '#fff'),
  co: () => rect(0, 0, W, 300, '#fcd116') + rect(0, 300, W, 150, '#003893') + rect(0, 450, W, 150, '#ce1126'),
  cu: () => Array.from({ length: 5 }, (_, i) => rect(0, (H / 5) * i, W, H / 5 + 0.5, i % 2 ? '#fff' : '#002a8f')).join('')
    + `<polygon points="0,0 519.6,300 0,600" fill="#cf142b"/>` + star(173, 300, 70, '#fff'),
  // Cyprus: the copper island over two olive branches, on white
  cy: () => rect(0, 0, W, H, '#fff')
    + `<polygon fill="#d57800" points="250,262 290,232 340,226 382,202 430,196 480,206 520,192 580,176 650,142 705,112 662,162 612,202 582,228 560,252 520,272 480,300 430,320 380,326 330,316 290,302 258,286"/>`
    + [1, -1].map((s) => `<path d="M${450 - s * 12},440 Q${450 - s * 90},440 ${450 - s * 170},380" fill="none" stroke="#4e5b31" stroke-width="7"/>`
      + [0.2, 0.4, 0.6, 0.8].map((u) => { const x = 450 - s * (12 + 158 * u), y = 440 - 60 * u * u; return `<ellipse cx="${f(x)}" cy="${f(y - 16)}" rx="9" ry="20" fill="#4e5b31" transform="rotate(${-s * 30} ${f(x)} ${f(y - 16)})"/><ellipse cx="${f(x)}" cy="${f(y + 14)}" rx="9" ry="20" fill="#4e5b31" transform="rotate(${s * 40} ${f(x)} ${f(y + 14)})"/>`; }).join('')).join(''),
  id: () => hz('#ff0000', '#ffffff'),
  // Iceland: the red Nordic cross edged in white, on blue
  is: () => nordic('#02529c', '#ffffff', 252, 396, 233, 367) + rect(288, 0, 72, H, '#dc1e35') + rect(0, 267, W, 66, '#dc1e35'),
  // Kyrgyzstan: the sun of forty rays with the tunduk, the yurt's crown, on red
  kg: () => rect(0, 0, W, H, '#e8112d') + sun(450, 300, 100, 40, '#ffef00')
    + `<clipPath id="kg-t"><circle cx="450" cy="300" r="62"/></clipPath><circle cx="450" cy="300" r="62" fill="none" stroke="#e8112d" stroke-width="12"/><g clip-path="url(#kg-t)" fill="none" stroke="#e8112d" stroke-width="9">`
    + [-1, 0, 1].map((k) => `<path d="M${450 + k * 22},230Q${450 + k * 48},300 ${450 + k * 22},370"/><path d="M380,${300 + k * 22}Q450,${300 + k * 40} 520,${300 + k * 22}"/>`).join('') + `</g>`,
  // South Korea: the taegeuk and the four trigrams, drawn on the flag's own 72 × 48 grid
  kr: () => {
    const tri = (bars, s) => bars.map((solid, i) => { const y = s * (19 + 3 * i); return `<path d="M-6,${y}${solid ? 'H6' : 'H-0.5M0.5,' + y + 'H6'}" stroke="#000" stroke-width="2"/>`; }).join('');
    return `<svg viewBox="-36 -24 72 48" width="${W}" height="${H}"><rect x="-36" y="-24" width="72" height="48" fill="#fff"/>`
      + `<g transform="rotate(-56.3099)"><circle r="12" fill="#cd2e3a"/><path fill="#0047a0" d="M0,-12A6,6 0 0,0 0,0A6,6 0 0,1 0,12A12,12 0 0,1 0,-12z"/>${tri([1, 1, 1], -1)}${tri([0, 0, 0], 1)}</g>`
      + `<g transform="rotate(56.3099)">${tri([0, 1, 0], -1)}${tri([1, 0, 1], 1)}</g></svg>`;
  },
  lu: () => hz('#ed2939', '#ffffff', '#00a1de'),
  // Morocco: the green interlaced pentagram, on red
  ma: () => rect(0, 0, W, H, '#c1272d')
    + `<polygon fill="none" stroke="#006233" stroke-width="20" points="${[0, 2, 4, 1, 3].map((i) => { const t = (i * 2 * Math.PI) / 5; return `${f(450 + 160 * Math.sin(t))},${f(310 - 160 * Math.cos(t))}`; }).join(' ')}"/>`,
  mc: () => hz('#ce1126', '#ffffff'),
  // Moldova: blue, yellow and red, with the eagle holding the shield of the aurochs head, simplified
  md: () => vt('#0046ae', '#ffd200', '#cc092f')
    + `<path fill="#b07e3c" d="M450,175q-22,0 -24,24l-74,-44q-34,52 -22,126q16,62 70,92l50,22l50,-22q54,-30 70,-92q12,-74 -22,-126l-74,44q-2,-24 -24,-24z"/>`
    + `<path fill="#e8b23c" d="M440,186l-16,10l18,4z"/>`
    + `<clipPath id="md-s"><path d="M405,250h90v70q0,42 -45,58q-45,-16 -45,-58z"/></clipPath><g clip-path="url(#md-s)">` + rect(400, 245, 100, 70, '#cc092f') + rect(400, 315, 100, 70, '#0046ae') + `</g>`
    + `<path d="M405,250h90v70q0,42 -45,58q-45,-16 -45,-58z" fill="none" stroke="#6b4a1f" stroke-width="4"/>`
    + `<path fill="#ffd200" d="M428,268q-8,-14 4,-22q-2,14 10,20q8,-6 16,0q12,-6 10,-20q12,8 4,22q-4,10 -10,14v28q0,14 -12,18q-12,-4 -12,-18v-28q-6,-4 -10,-14z"/>`
    + star(450, 252, 9, '#ffd200'),
  // North Macedonia: the yellow sun and its eight rays to the edges, on red
  mk: () => rect(0, 0, W, H, '#d20000')
    + [[390, 0, 510, 0], [900, 245, 900, 355], [390, 600, 510, 600], [0, 245, 0, 355], [0, 0, 110, 0, 0, 70], [900, 0, 790, 0, 900, 70], [900, 600, 790, 600, 900, 530], [0, 600, 110, 600, 0, 530]]
      .map((p) => p.length === 4 ? `<polygon fill="#ffe600" points="450,300 ${p[0]},${p[1]} ${p[2]},${p[3]}"/>` : `<polygon fill="#ffe600" points="450,300 ${p[2]},${p[3]} ${p[0]},${p[1]} ${p[4]},${p[5]}"/>`).join('')
    + `<circle cx="450" cy="300" r="90" fill="#d20000"/><circle cx="450" cy="300" r="74" fill="#ffe600"/>`,
  // Malta: the George Cross, edged in red, in the white hoist
  mt: () => vt('#ffffff', '#cf142b') + bolnisi(110, 110, 66, '#cf142b') + bolnisi(110, 110, 58, '#a9a9a9'),
  // Mexico: green, white and red, with the eagle on the cactus inside the oak and laurel, simplified
  mx: () => vt('#006847', '#ffffff', '#ce1126') + `<g transform="translate(450 330) scale(1.5) translate(-450 -330)">`
    + `<path d="M380,320Q395,390 450,398Q505,390 520,320" fill="none" stroke="#006847" stroke-width="12"/><path d="M430,398h40v8h-40z" fill="#ce1126"/>`
    + `<path fill="#4f8a3c" d="M430,372q-6,-28 10,-38q-2,-16 10,-18q12,2 10,18q16,10 10,38z"/>`
    + `<path fill="#8c5a2b" d="M402,250q20,-6 30,14l14,-30q12,-12 26,-4q10,8 2,18q22,-6 40,8q-26,4 -30,30q8,20 -4,44q-14,18 -36,14q-24,-4 -30,-30q-4,-24 10,-34q-20,-10 -22,-30z"/>`
    + `<path d="M430,340q20,8 46,-8" fill="none" stroke="#5a8f3c" stroke-width="5"/></g>`,
  // Malaysia: fourteen stripes, the yellow crescent and fourteen-pointed star on blue
  my: () => Array.from({ length: 14 }, (_, i) => rect(0, (H / 14) * i, W, H / 14 + 0.5, i % 2 ? '#fff' : '#cc0001')).join('')
    + rect(0, 0, 450, (H / 14) * 8, '#010066') + crescent(165, 171.4, 112, 96, 30, '#fc0', '#010066') + star(318, 171.4, 88, '#fc0', 14, 38),
  pe: () => vt('#d91023', '#ffffff', '#d91023'),
  // the Philippines: the white triangle with the sun and three stars, blue over red
  ph: () => hz('#0038a8', '#ce1126') + `<polygon points="0,0 519.6,300 0,600" fill="#fff"/>` + sun(173, 300, 46, 8, '#fcd116')
    + [[52, 62], [52, 538], [440, 300]].map(([x, y]) => star(x, y, 28, '#fcd116', 5, 11, Math.atan2(x - 173, -(y - 300)))).join(''),
  // Qatar: the white serrated band at the hoist, on maroon
  qa: () => rect(0, 0, W, H, '#8a1538')
    + `<polygon fill="#fff" points="0,0 250,0 ${Array.from({ length: 9 }, (_, i) => `330,${f((i + 0.5) * H / 9)} 250,${f((i + 1) * H / 9)}`).join(' ')} 0,600"/>`,
  // Serbia: the national flag, the tricolour without the arms
  rs: () => hz('#c6363c', '#0c4076', '#ffffff'),
  // Singapore: the white crescent and five stars on red, over white
  sg: () => hz('#ef3340', '#ffffff') + crescent(160, 150, 95, 80, 30, '#fff', '#ef3340')
    + Array.from({ length: 5 }, (_, i) => { const t = (i * 2 * Math.PI) / 5; return star(f(255 + 50 * Math.sin(t)), f(150 - 50 * Math.cos(t)), 21, '#fff'); }).join(''),
  // Slovenia: the shield of Triglav and its three stars over the white, blue and red
  si: () => hz('#ffffff', '#005da4', '#ed1c24')
    + `<clipPath id="si-s"><path d="M150,110h120v110q0,50 -60,75q-60,-25 -60,-75z"/></clipPath>`
    + `<path d="M150,110h120v110q0,50 -60,75q-60,-25 -60,-75z" fill="#005da4"/><g clip-path="url(#si-s)"><polygon fill="#fff" points="150,240 182,200 194,212 210,168 226,212 238,200 270,240 270,300 150,300"/>`
    + [244, 258].map((y) => `<path d="M150,${y}q10,-8 20,0t20,0t20,0t20,0t20,0t20,0" fill="none" stroke="#005da4" stroke-width="5"/>`).join('') + `</g>`
    + `<path d="M150,110h120v110q0,50 -60,75q-60,-25 -60,-75z" fill="none" stroke="#ed1c24" stroke-width="8"/>`
    + [[186, 132], [234, 132], [210, 150]].map(([x, y]) => star(x, y, 10, '#ffdd00', 6, 5)).join(''),
  // Slovakia: the white double cross on the blue hills, in a red shield edged white
  sk: () => hz('#ffffff', '#0b4ea2', '#ee1c25')
    + `<clipPath id="sk-s"><path d="M150,120h200v200q0,100 -100,140q-100,-40 -100,-140z"/></clipPath>`
    + `<path d="M150,120h200v200q0,100 -100,140q-100,-40 -100,-140z" fill="#ee1c25" stroke="#fff" stroke-width="14"/>`
    + `<g clip-path="url(#sk-s)"><circle cx="250" cy="430" r="62" fill="#0b4ea2"/><circle cx="178" cy="458" r="56" fill="#0b4ea2"/><circle cx="322" cy="458" r="56" fill="#0b4ea2"/></g>`
    + rect(238, 165, 24, 215, '#fff') + rect(208, 200, 84, 22, '#fff') + rect(188, 262, 124, 24, '#fff'),
  // Tunisia: the red crescent and star in the white disc, on red
  tn: () => rect(0, 0, W, H, '#e70013') + `<circle cx="450" cy="300" r="150" fill="#fff"/>`
    + crescent(450, 300, 112, 90, 28, '#e70013', '#fff') + star(478, 300, 60, '#e70013', 5, 23, -Math.PI / 2),
  // Uruguay: nine stripes and the Sun of May in the white canton
  uy: () => Array.from({ length: 9 }, (_, i) => rect(0, (H / 9) * i, W, H / 9 + 0.5, i % 2 ? '#0038a8' : '#fff')).join('')
    + rect(0, 0, 333.3, 333.3, '#fff') + sun(166.7, 166.7, 46, 16, '#fcd116'),
  // Uzbekistan: blue, white and green edged in red, the crescent and twelve stars
  uz: () => rect(0, 0, W, 192, '#0099b5') + rect(0, 192, W, 12, '#ce1126') + rect(0, 204, W, 192, '#fff') + rect(0, 396, W, 12, '#ce1126') + rect(0, 408, W, 192, '#1eb53a')
    + crescent(120, 96, 64, 56, 20, '#fff', '#0099b5')
    + [[40, [300, 340, 380]], [96, [260, 300, 340, 380]], [152, [220, 260, 300, 340, 380]]].map(([y, xs]) => xs.map((x) => star(x, y, 14, '#fff')).join('')).join(''),
  vn: () => rect(0, 0, W, H, '#da251d') + star(450, 300, 180, '#ffff00'),

  // Hong Kong: the white bauhinia of five petals, a red star and stamen on each, on red
  hk: () => rect(0, 0, W, H, '#e5262b') + Array.from({ length: 5 }, (_, i) => `<g transform="translate(450 300) rotate(${i * 72 + 8})">`
    + `<path fill="#fff" d="M0,0C-6,-38 -58,-66 -56,-124C-54,-168 -10,-192 28,-180C60,-170 72,-130 54,-102C36,-76 6,-48 0,0Z"/>`
    + `<path fill="none" stroke="#e5262b" stroke-width="5" d="M0,-16Q-6,-58 2,-96"/>` + star(4, -128, 22, '#e5262b') + `</g>`).join(''),
  // Puerto Rico: five stripes and the white star in the blue triangle
  pr: () => Array.from({ length: 5 }, (_, i) => rect(0, (H / 5) * i, W, H / 5 + 0.5, i % 2 ? '#fff' : '#ed0000')).join('')
    + `<polygon points="0,0 519.6,300 0,600" fill="#0050f0"/>` + star(173, 300, 100, '#fff'),
  // the US Virgin Islands: the golden eagle with the olive branch and three arrows, between the letters V and I, on white
  vi: () => rect(0, 0, W, H, '#fff') + `<polygon fill="#2a6ebb" points="38,205 74,205 96,312 118,205 154,205 112,372 80,372"/>` + rect(776, 205, 38, 167, '#2a6ebb')
    + feathers(450, 385, 1, 5, 155, 205, 130, 130, 20, '#f4c430', '#a67c00')
    + feathers(505, 250, 1, 9, 48, 132, 285, 120, 22, '#f4c430', '#a67c00') + feathers(395, 250, -1, 9, 48, 132, 285, 120, 22, '#f4c430', '#a67c00')
    + `<ellipse cx="450" cy="300" rx="62" ry="108" fill="#f4c430" stroke="#a67c00" stroke-width="3"/><path fill="#f4c430" stroke="#a67c00" stroke-width="3" d="M424,212Q414,170 428,146Q450,120 474,148Q480,180 476,212z"/><path fill="#a67c00" d="M428,142l-36,16l40,10z"/><circle cx="444" cy="148" r="5" fill="#000"/>`
    + `<path fill="none" stroke="#2f8f3a" stroke-width="8" d="M395,395Q340,425 285,430"/>` + [[355, 405], [322, 418], [292, 426]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="18" ry="8" fill="#2f8f3a" transform="rotate(-35 ${x} ${y})"/>`).join('')
    + [-16, 0, 16].map((d) => `<path fill="none" stroke="#2a6ebb" stroke-width="7" d="M505,395L${605 + d},${445 - d}"/><polygon fill="#2a6ebb" points="${605 + d},${433 - d} ${627 + d},${455 - d} ${598 + d},${457 - d}"/>`).join('')
    + `<clipPath id="vi-s"><path d="${shield(395, 215, 110, 160)}"/></clipPath><g clip-path="url(#vi-s)">` + rect(395, 215, 110, 170, '#fff') + [0, 2, 4, 6].map((i) => rect(f(395 + i * 15.7), 215, 15.7, 170, '#b31942')).join('') + rect(395, 215, 110, 50, '#0a3161') + `</g><path d="${shield(395, 215, 110, 160)}" fill="none" stroke="#a67c00" stroke-width="3"/>`,
  // the British Virgin Islands: the blue ensign, the arms (St Ursula and the eleven lamps) on a green shield
  vg: () => rect(0, 0, W, H, '#012169') + unionJack(0, 0, 450, 300) + `<g transform="translate(675 305) scale(1.12) translate(-675 -305)">`
    + `<path d="${shield(585, 165, 180, 280)}" fill="#006a4e" stroke="#fcd116" stroke-width="9"/>`
    + `<path fill="#fff" d="M675,250q-16,0 -18,18l-20,130h76l-20,-130q-2,-18 -18,-18z"/><circle cx="675" cy="232" r="16" fill="#e8b98f"/><path fill="none" stroke="#fff" stroke-width="10" d="M660,275q-24,18 -30,8"/>`
    + [[616, 205], [616, 250], [616, 295], [616, 340], [640, 392], [734, 205], [734, 250], [734, 295], [734, 340], [710, 392], [675, 425]]
      .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="7" fill="#fcd116"/><path fill="#fff" d="M${x},${y - 6}q-6,-9 0,-19q6,10 0,19z"/>`).join('') + `</g>`,
  // the Bahamas: aquamarine, gold and aquamarine, the black triangle at the hoist
  bs: () => hz('#00778b', '#ffc72c', '#00778b') + `<polygon points="0,0 519.6,300 0,600" fill="#000"/>`,
  // Barbados: the broken trident in black on the gold, between the blue
  bb: () => vt('#00267f', '#ffc726', '#00267f') + `<g transform="translate(450 300) scale(0.8 0.92) translate(-450 -300)">` + [`M450,122L490,202L466,192V338Q532,334 546,226L520,222L584,150L612,240L588,232Q574,386 466,390V478H450Z`]
    .map((d) => `<path fill="#000" d="${d}"/><path fill="#000" transform="translate(900 0) scale(-1 1)" d="${d}"/>`).join('') + `</g>`,
  // Trinidad and Tobago: the black band edged in white, down across the red
  tt: () => rect(0, 0, W, H, '#da1a35') + `<polygon fill="#fff" points="15,0 285,0 885,600 615,600"/><polygon fill="#000" points="55,0 245,0 845,600 655,600"/>`,
  // the Dominican Republic: the white cross, the quarters blue and red, the arms (simplified) at its centre
  do: () => rect(0, 0, W, H, '#fff') + rect(0, 0, 395, 245, '#002d62') + rect(505, 0, 395, 245, '#ce1126') + rect(0, 355, 395, 245, '#ce1126') + rect(505, 355, 395, 245, '#002d62')
    + `<g transform="translate(450 300) scale(1.35) translate(-450 -300)"><path fill="none" stroke="#2f8f3a" stroke-width="6" d="M422,262Q398,306 438,342M478,262Q502,306 462,342"/>`
    + `<clipPath id="do-s"><path d="${shield(424, 266, 52, 64)}"/></clipPath><g clip-path="url(#do-s)">` + rect(424, 266, 26, 32, '#002d62') + rect(450, 266, 26, 32, '#ce1126') + rect(424, 298, 26, 40, '#ce1126') + rect(450, 298, 26, 40, '#002d62') + rect(445, 266, 10, 72, '#fff') + rect(424, 293, 52, 10, '#fff') + `</g></g>`,
  // Venezuela: the civil flag, yellow, blue and red with the arc of eight white stars
  ve: () => hz('#ffcc00', '#00247d', '#cf142b') + Array.from({ length: 8 }, (_, i) => { const a = ((-63 + i * 18) * Math.PI) / 180; return star(f(450 + 185 * Math.sin(a)), f(450 - 185 * Math.cos(a)), 25, '#fff', 5, 9.6, a); }).join(''),
  // Ecuador: yellow, blue and red, the condor over the oval of Chimborazo and the sun between the flags
  ec: () => rect(0, 0, W, 300, '#ffdd00') + rect(0, 300, W, 150, '#034ea2') + rect(0, 450, W, 150, '#ed1c24') + `<g transform="translate(450 300) scale(0.85) translate(-450 -300)">`
    + [1, -1].map((s) => [['#ffdd00', 150, 118], ['#034ea2', 128, 96], ['#ed1c24', 106, 78]].map(([c, o, i]) => `<polygon fill="${c}" stroke="#5c4a00" stroke-width="2" points="${450 - s * 58},198 ${450 - s * o},226 ${450 - s * i},414 ${450 - s * 50},398"/>`).join('')).join('')
    + `<clipPath id="ec-o"><ellipse cx="450" cy="308" rx="72" ry="94"/></clipPath><g clip-path="url(#ec-o)">` + rect(370, 210, 160, 200, '#9bd6f2') + `<circle cx="450" cy="248" r="20" fill="#fcd116"/><polygon fill="#e9edf0" points="372,352 438,270 470,306 530,352"/>` + rect(370, 348, 160, 60, '#2f8f3a') + rect(370, 372, 160, 40, '#1f6fb2') + `</g><ellipse cx="450" cy="308" rx="72" ry="94" fill="none" stroke="#c9a227" stroke-width="9"/>`
    + feathers(462, 196, 1, 6, 40, 112, 118, 72, 12, '#1c1c1c', '#555') + feathers(438, 196, -1, 6, 40, 112, 118, 72, 12, '#1c1c1c', '#555') + `<ellipse cx="450" cy="190" rx="20" ry="30" fill="#1c1c1c"/><circle cx="446" cy="156" r="13" fill="#1c1c1c"/><path fill="#c9a227" d="M436,152l-16,8l18,4z"/></g>`,
  // Panama: the white quarters with their blue and red stars, the red and blue quarters
  pa: () => rect(0, 0, W, H, '#fff') + rect(450, 0, 450, 300, '#da121a') + rect(0, 300, 450, 300, '#072357') + star(225, 150, 82, '#072357') + star(675, 450, 82, '#da121a'),
  // Oman: white, red and green, the red hoist with the khanjar over its crossed swords in white
  om: () => rect(0, 0, W, H, '#db161b') + rect(300, 0, 600, 200, '#fff') + rect(300, 400, 600, 200, '#008000') + `<g transform="translate(38 8)">`
    + `<path fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" d="M52,52Q78,150 174,168M172,52Q146,150 50,168"/>` + rect(70, 86, 84, 11, '#fff')
    + `<path fill="#fff" d="M96,36h32l-8,20h-16zM103,60h18l4,64q-2,34 -30,44q14,-20 10,-44z"/></g>`,
  // Saudi Arabia: the Shahada over the sword, in white on green (the text is exact, see flags-shahada.mjs)
  sa: () => { const k = +(560 / Math.max(...SHAHADA.map((r) => r[0]))).toFixed(4); return rect(0, 0, W, H, '#005430')
    + SHAHADA.map(([w, h, d], i) => `<path fill="#fff" transform="translate(${f(450 - (w * k) / 2)} ${f(115 + i * 135 + (110 - h * k) / 2)}) scale(${k})" d="${d}"/>`).join('')
    + `<path fill="#fff" d="M232,452Q250,440 290,440H610V462H290Q256,464 232,452ZM610,428H622V474H610ZM622,442H672Q686,442 686,451Q686,460 672,460H622Z"/>`; },
  // Bahrain: the white hoist and its five points, on red
  bh: () => rect(0, 0, W, H, '#da291c')
    + `<polygon fill="#fff" points="0,0 225,0 ${Array.from({ length: 5 }, (_, i) => `345,${f((i + 0.5) * H / 5)} 225,${f((i + 1) * H / 5)}`).join(' ')} 0,600"/>`,
  // Kuwait: green, white and red, the black trapezium at the hoist
  kw: () => hz('#007a3d', '#ffffff', '#ce1126') + `<polygon points="0,0 225,200 225,400 0,600" fill="#000"/>`,
  // Egypt: red, white and black, the gold eagle of Saladin with its striped shield
  eg: () => hz('#ce1126', '#ffffff', '#000000')
    + feathers(450, 340, 1, 5, 165, 195, 44, 44, 9, '#c09300', '#7a5e00') + feathers(480, 240, 1, 6, 155, 188, 148, 128, 10, '#c09300', '#7a5e00') + feathers(420, 240, -1, 6, 155, 188, 148, 128, 10, '#c09300', '#7a5e00')
    + `<path fill="#c09300" d="M432,246Q428,222 438,212Q456,204 464,220Q470,232 468,246z"/><path fill="#7a5e00" d="M440,210l-18,10l20,5z"/>`
    + `<clipPath id="eg-s"><path d="${shield(419, 244, 62, 92)}"/></clipPath><g clip-path="url(#eg-s)">` + rect(419, 244, 20.7, 100, '#ce1126') + rect(439.7, 244, 20.7, 100, '#fff') + rect(460.4, 244, 20.7, 100, '#000') + `</g><path d="${shield(419, 244, 62, 92)}" fill="none" stroke="#7a5e00" stroke-width="4"/>` + rect(404, 378, 92, 12, '#c09300'),
  // Chinese Taipei: the plum blossom of the flag it sails under, its sun of twelve rays at the heart (drawn without the Olympic rings)
  tw: () => rect(0, 0, W, H, '#fff')
    + [[150, '#000095'], [140, '#fff'], [128, '#fe0000'], [110, '#fff']].map(([r, c]) => Array.from({ length: 5 }, (_, i) => { const a = (i * 2 * Math.PI) / 5; return `<circle cx="${f(450 + 108 * Math.sin(a))}" cy="${f(300 - 108 * Math.cos(a))}" r="${f(r * 0.72)}" fill="${c}"/>`; }).join('') + `<circle cx="450" cy="300" r="${f(r * 0.8)}" fill="${c}"/>`).join('')
    + `<circle cx="450" cy="300" r="72" fill="#000095"/>` + star(450, 300, 62, '#fff', 12, 36) + `<circle cx="450" cy="300" r="34" fill="#000095"/><circle cx="450" cy="300" r="29" fill="#fff"/>`,
  // Sri Lanka: the gold-edged green and saffron stripes, the gold lion with its sword and the four bo leaves on maroon
  lk: () => rect(0, 0, W, H, '#ffb700') + rect(26, 26, 100, 548, '#005f56') + rect(126, 26, 100, 548, '#ff7f00') + rect(252, 26, 622, 548, '#8d153a')
    + [[288, 62, 45], [838, 62, 135], [838, 538, 225], [288, 538, 315]].map(([x, y, a]) => `<path transform="translate(${x} ${y}) rotate(${a})" fill="#ffb700" d="M0,-30C20,-16 26,6 0,32C-26,6 -20,-16 0,-30Z"/>`).join('')
    + `<g transform="translate(565 305) scale(1.12) translate(-565 -305)">` + rect(388, 150, 14, 192, '#ffb700') + rect(370, 338, 50, 11, '#ffb700') + rect(388, 349, 14, 28, '#ffb700')
    + `<path fill="#ffb700" d="M425,205Q440,170 480,165Q505,150 540,175Q570,205 565,250Q620,235 665,255Q700,270 705,320Q725,300 722,265Q715,235 745,225Q775,235 762,255Q745,262 752,290Q755,345 715,368L718,440L740,452V468H680V445L672,385Q630,400 585,395L570,445L592,455V470H530L532,445L520,372Q500,345 505,322Q450,322 408,356L396,338Q440,300 500,296L465,290Q430,280 432,255L415,245Z"/>`
    + [[498, 158], [526, 168], [548, 190], [560, 220], [556, 252], [752, 226]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20" fill="#ffb700"/><path fill="none" stroke="#8d153a" stroke-width="4" d="M${x - 9},${y + 3}q9,-14 18,0"/>`).join('')
    + `<circle cx="452" cy="204" r="6" fill="#8d153a"/><path fill="none" stroke="#8d153a" stroke-width="5" d="M430,244Q450,250 462,238M500,190Q522,220 510,262M528,196Q546,226 534,272"/></g>`,
  // Fiji: the light blue ensign, the shield of the cross, the lion, the cane, palm, dove and bananas
  fj: () => rect(0, 0, W, H, '#68bfe5') + unionJack(0, 0, 450, 300) + `<clipPath id="fj-s"><path d="${shield(585, 150, 180, 300)}"/></clipPath><g clip-path="url(#fj-s)">`
    + rect(585, 150, 180, 310, '#fff') + rect(585, 150, 180, 72, '#ce1126') + rect(663, 222, 24, 240, '#ce1126') + rect(585, 322, 180, 24, '#ce1126')
    + `<path fill="#fcd116" d="M622,202q4,-22 22,-24q6,-14 22,-8q14,6 10,20q24,-8 48,4q10,8 6,24h-14q-2,-8 -8,-10q-26,6 -44,2l-2,8h-14l2,-14q-14,-2 -28,-2z"/>`
    + [606, 624, 642].map((x) => `<path fill="none" stroke="#2f8f3a" stroke-width="7" d="M${x},314V236"/>`).join('')
    + `<path fill="none" stroke="#8c5a2b" stroke-width="7" d="M726,314Q720,280 726,252"/><path fill="none" stroke="#2f8f3a" stroke-width="6" d="M726,250Q702,236 696,258M726,250Q750,236 756,258M726,250Q712,226 698,232M726,250Q740,226 754,232"/>`
    + `<path fill="#fff" stroke="#6b7a86" stroke-width="3" d="M600,392q16,-22 38,-14q10,-8 18,0q-6,4 -8,10q-6,22 -30,20q-8,8 -18,8q6,-10 0,-24z"/>`
    + [0, 1, 2].map((i) => `<path fill="#fcd116" stroke="#a67c00" stroke-width="2" d="M${704 + i * 12},358q-12,34 6,58q10,-4 6,-10q-8,-22 0,-48z"/>`).join('') + `</g><path d="${shield(585, 150, 180, 300)}" fill="none" stroke="#fff" stroke-width="5"/>`,
  mu: () => hz('#ea2839', '#1a206d', '#ffd500', '#00a551'),
  // Kenya: black, red and green edged in white, the Maasai shield over its two crossed spears
  ke: () => hz('#000000', '#bb0000', '#006600') + rect(0, 186, W, 28, '#fff') + rect(0, 386, W, 28, '#fff')
    + [1, -1].map((s) => `<path fill="none" stroke="#fff" stroke-width="10" d="M${450 - s * 170},${510}L${450 + s * 150},${112}"/><path fill="#fff" d="M${450 + s * 150},${112}m-16,4l${s * 26},-56l6,66z"/>`).join('')
    + `<g transform="translate(450 300) scale(0.78 1) translate(-450 -300)"><path fill="#bb0000" stroke="#fff" stroke-width="4" d="M450,104Q548,200 548,300Q548,400 450,496Q352,400 352,300Q352,200 450,104Z"/>`
    + [1, -1].map((s) => `<path fill="#000" d="M${450 + s * 96},214Q${450 + s * 118},300 ${450 + s * 96},386Q${450 + s * 58},300 ${450 + s * 96},214Z"/>`).join('')
    + `<ellipse cx="450" cy="300" rx="26" ry="62" fill="#fff"/><ellipse cx="450" cy="300" rx="12" ry="34" fill="#bb0000"/>` + [[450, 188], [450, 412]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="16" ry="30" fill="#fff"/>`).join('') + `</g>`,
  // Montenegro: the gold-bordered red, the crowned double eagle with its sceptre, orb and the lion's shield
  me: () => rect(0, 0, W, H, '#d3ae3b') + rect(30, 30, 840, 540, '#c40308')
    + feathers(450, 395, 1, 5, 160, 200, 110, 110, 17, '#d3ae3b', '#7a5e12') + feathers(494, 245, 1, 7, 48, 150, 130, 165, 17, '#d3ae3b', '#7a5e12') + feathers(406, 245, -1, 7, 48, 150, 130, 165, 17, '#d3ae3b', '#7a5e12')
    + `<ellipse cx="450" cy="312" rx="56" ry="96" fill="#d3ae3b"/>` + [1, -1].map((s) => `<path fill="#d3ae3b" d="M${450 + s * 8},250Q${450 + s * 44},214 ${450 + s * 40},176Q${450 + s * 60},160 ${450 + s * 72},182l${s * 24},8l${-s * 24},10Q${450 + s * 72},236 ${450 + s * 44},262z"/>`).join('')
    + `<path fill="#d3ae3b" stroke="#7a5e12" stroke-width="3" d="M412,146l-8,-44l26,22l20,-34l20,34l26,-22l-8,44z"/>` + rect(362, 372, 9, 100, '#d3ae3b') + `<circle cx="366" cy="360" r="13" fill="#d3ae3b"/><circle cx="534" cy="440" r="22" fill="#1f5fa8" stroke="#d3ae3b" stroke-width="6"/>`
    + `<clipPath id="me-s"><path d="${shield(404, 256, 92, 116)}"/></clipPath><g clip-path="url(#me-s)">` + rect(404, 256, 92, 130, '#1f5fa8') + rect(404, 336, 92, 50, '#2f8f3a') + `<path fill="#d3ae3b" d="M418,332v-24q0,-20 16,-22q4,-14 18,-10q10,4 8,16q16,-2 24,10v30h-10v-18q-14,8 -30,4v14z"/></g>` + `<path d="${shield(404, 256, 92, 116)}" fill="none" stroke="#7a5e12" stroke-width="4"/>`,
  // Tajikistan: red, white and green, the gold crown under its arc of seven stars
  tj: () => rect(0, 0, W, 171.4, '#cc0000') + rect(0, 171.4, W, 257.2, '#fff') + rect(0, 428.6, W, 171.4, '#006600')
    + `<path fill="#f8c300" d="M405,372L396,322L424,346L450,306L476,346L504,322L495,372Z"/>` + rect(405, 378, 90, 11, '#f8c300')
    + Array.from({ length: 7 }, (_, i) => { const a = ((-90 + i * 30) * Math.PI) / 180; return star(f(450 + 112 * Math.sin(a)), f(350 - 112 * Math.cos(a)), 16, '#f8c300', 5, 6.1, a); }).join(''),
  // Turkmenistan: the carpet band of five guls over the olive branches, the crescent and five stars, on green
  tm: () => rect(0, 0, W, H, '#00843d') + rect(90, 0, 180, H, '#c8102e')
    + [58, 158, 258, 358, 458].map((y) => { const o = (rx, ry, c) => `<polygon fill="${c}" points="${[[-1, -0.45], [-0.45, -1], [0.45, -1], [1, -0.45], [1, 0.45], [0.45, 1], [-0.45, 1], [-1, 0.45]].map(([a, b]) => `${f(180 + a * rx)},${f(y + b * ry)}`).join(' ')}"/>`;
      return o(82, 46, '#fff') + o(70, 37, '#c8102e') + o(52, 27, '#f2a900') + rect(128, y - 2, 104, 4, '#000') + rect(178, y - 27, 4, 54, '#000') + o(18, 10, '#00843d'); }).join('')
    + [1, -1].map((s) => `<path fill="none" stroke="#fff" stroke-width="5" d="M180,588Q${180 + s * 66},572 ${180 + s * 62},520"/>` + [[36, 572], [52, 554], [60, 534]].map(([x, y]) => `<ellipse cx="${180 + s * x}" cy="${y}" rx="6" ry="13" fill="#fff" transform="rotate(${s * 30} ${180 + s * x} ${y})"/>`).join('')).join('')
    + crescent(452, 118, 78, 66, -22, '#fff', '#00843d') + [[392, 75], [345, 90], [370, 120], [345, 150], [392, 165]].map(([x, y]) => star(x, y, 20, '#fff')).join(''),
};

const out = new URL('../public/flags/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [code, draw] of Object.entries(FLAGS)) {
  writeFileSync(new URL(`${code}.svg`, out), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${draw()}</svg>\n`);
}
console.log(`${Object.keys(FLAGS).length} flags in public/flags`);
