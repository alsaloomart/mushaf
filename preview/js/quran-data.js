/* طبقة بيانات المصحف — Mushaf data layer
 * الصفحات: صور صفحات «مصحف المدينة النبوية» الرسمية من مجمع الملك فهد (النسخة الرقمية 1441هـ، رواية حفص)
 *   محوّلة من ملفات المجمع الأصلية (AI/PDF) إلى WebP بلا فقد، بلا قص ولا تعديل — pages/NNN.webp
 * مواضع الآيات على الصفحة: data/ayah-map.json (مضلعات quran-ws/quran-svg، CC BY 4.0، مطابقة لملفات المجمع نفسها)
 * بيانات السور والأجزاء والأحزاب: data/meta.json (Tanzil quran-data، CC BY 3.0)
 * لا يوجد أي نص قرآني مكتوب في التطبيق؛ النص هو صورة الصفحة الرسمية فقط.
 */
const QD = (() => {
  const TOTAL_PAGES = 604;
  const pageImg = p => `../pages/${String(p).padStart(3, '0')}.webp`;
  /* قص عرض فقط: مساحة النص داخل إطار المجمع (بالنقاط، نفس إحداثيات الصفحة). الصورة نفسها كاملة وما تتغير. */
  function crop(p) {
    if (p === 1) return [92, 118, 197, 254];
    if (p === 2) return [93.3, 118, 197, 254];
    return p % 2 ? [40.9, 68.4, 254.1, 409.8] : [87.3, 68.4, 254.1, 409.8];
  }
  let loadP;
  let CROP, LINES, PAGES, META, keyPage = new Map(), keyIdx = new Map(), keys = [];
  function load() {
    return loadP ||= Promise.all([
      fetch('data/ayah-map.json').then(r => r.json()),
      fetch('data/meta.json').then(r => r.json()),
      fetch('data/crop.json').then(r => r.json()),
      fetch('data/lines.json').then(r => r.json())
    ]).then(([pg, mt, cr, ln]) => {
      PAGES = pg; META = mt; CROP = cr; LINES = ln;
      pg.forEach(P => P.a.forEach(a => { keyPage.set(a.k, P.p); keyIdx.set(a.k, keys.length); keys.push(a.k); }));
      if (keys.length !== 6236 || pg.length !== 604 || mt.sura.length !== 114) throw new Error('data counts');
      return true;
    });
  }
  const parse = k => k.split(':').map(Number);
  // رقم الربع (1..240) لأي آية
  function rubOf(k) {
    const i = keyIdx.get(k), q = META.hizbQuarter;
    let lo = 0, hi = q.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; const qi = keyIdx.get(q[m][0] + ':' + q[m][1]); if (qi <= i) lo = m; else hi = m - 1; }
    return lo + 1;
  }
  function juzOf(k) {
    const i = keyIdx.get(k); let j = 1;
    META.juz.forEach((x, n) => { if (keyIdx.get(x[0] + ':' + x[1]) <= i) j = n + 1; });
    return j;
  }
  async function chapters() {
    await load();
    return META.sura.map((s, i) => ({ id: i + 1, name_arabic: s.name, verses_count: s.n, revelation_place: s.type === 'Meccan' ? 'makkah' : 'madinah', pages: [keyPage.get((i + 1) + ':1')] }));
  }
  const cache = new Map();
  async function page(p) {
    await load();
    p = Math.max(1, Math.min(TOTAL_PAGES, p | 0));
    if (cache.has(p)) return cache.get(p);
    const P = PAGES[p - 1];
    const ayat = P.a.map(a => { const [s, n] = parse(a.k); return { k: a.k, s, a: n, d: a.d, lines: a.l }; });
    const first = ayat[0].k, rub = rubOf(first);
    const res = { p, w: P.w, h: P.h, img: pageImg(p), timg: `../lines/${String(p).padStart(3, '0')}.webp`, crop: CROP[p], lines: LINES[p] || null, ayat, juz: juzOf(first), hizb: Math.ceil(rub / 4), rub, surahs: [...new Set(ayat.map(a => a.s))] };
    cache.set(p, res);
    return res;
  }
  async function pageOf(k) { await load(); const p = keyPage.get(k); if (!p) throw new Error('no page for ' + k); return p; }
  async function nextKey(k, step = 1) { await load(); const i = keyIdx.get(k) + step; return keys[i] || null; }
  async function keyIndex(k) { await load(); return keyIdx.get(k) + 1; }
  async function juzStarts() { await load(); return META.juz.map((x, n) => ({ n: n + 1, k: x[0] + ':' + x[1] })); }
  return { TOTAL_PAGES, load, chapters, page, pageOf, nextKey, keyIndex, juzStarts, pageImg, rubOf, crop };
})();
