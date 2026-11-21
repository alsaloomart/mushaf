/* مطابقة التسميع: نص التعرف على الكلام مقابل نص الآية (Tanzil Simple Clean). دالة نقية تُختبر وحدها (tests/t_tmatch.mjs).
   لا تُعرض أي كلمة من هنا على الشاشة؛ الكشف يكون على صورة الصفحة نفسها. */
const TMM = (() => {
  const norm = t => String(t || '')
    .replace(/[0-9\u0660-\u0669\u06F0-\u06F9]+/g, ' ٭ ')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, 'ا')
    .replace(/\u0624/g, 'و').replace(/[\u0626\u0649\u06CC]/g, 'ي').replace(/\u0629/g, 'ه').replace(/\u0621/g, '').replace(/\u06A9/g, 'ك')
    .replace(/[^\u0621-\u064A\s٭]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = t => norm(t).split(' ').filter(Boolean);
  // مسافة تحرير محدودة
  const levN = (a, b, k) => { if (a === b) return true; if (Math.abs(a.length - b.length) > k) return false; let prev = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const cur = [i]; let mn = i; for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < mn) mn = cur[j]; } if (mn > k) return false; prev = cur; } return prev[b.length] <= k; };
  const strip = w => w.replace(/^(و|ف)?(ب|ل|ك)?(ال)?/, '').replace(/ا$/, '');
  const tol = e => e.length >= 7 ? 2 : e.length >= 4 ? 1 : 0;
  const NUM = /^(و|ف)?(ال)?(واحد|احد|اثن|ثنت|ثلاث|اربع|خمس|ست|سبع|ثمان|تسع|عشر|مائ|ماي|مئ|الف|الاف|الفين|ميه)/;
  function wsim(w, e, fin) {
    if (w === e) return true;
    if (w === '٭') return NUM.test(e);
    const sw = strip(w), se = strip(e); if (sw && sw === se) return true;
    const k = fin ? Math.min(1, tol(e)) : tol(e); return k > 0 && (levN(w, e, k) || (se.length >= 3 && levN(sw, se, Math.min(k, tol(se) || 1))));
  }
  // الحروف المقطعة تُنطق بأسمائها: «ألف لام ميم»، «حا ميم»، «كاف ها يا عين صاد»...
  const LN = { 'ا': '(ال?ي?ف|ا)', 'ل': '(لا?م|ل)', 'م': '(مي?م|م)', 'ص': '(صا?د|صات|ص)', 'ر': '(را|ر)', 'ك': '(كا?ف|ك)', 'ه': '(ها|ه)', 'ي': '(يا|ي)', 'ع': '(عي?ن|ع)', 'ط': '(طا|ط)', 'س': '(سي?ن|س)', 'ح': '(حا|ح)', 'ق': '(قا?ف|ق)', 'ن': '(نو?ن|ن)' };
  const MUQ = new Map(['الم', 'المص', 'الر', 'المر', 'كهيعص', 'طه', 'طسم', 'طس', 'يس', 'ص', 'حم', 'عسق', 'ق', 'ن'].map(m => [m, new RegExp('^' + [...m].map(c => LN[c]).join('') + '$')]));
  const muq = (W, x, e) => { const re = MUQ.get(e); let s = ''; for (let k = 0; k < 6 && x + k < W.length; k++) { s += W[x + k]; if (re.test(s)) return k + 1; } return 0; };
  // يطابق كلمات مسموعة W (بدءًا من 0) بكلمات الآية E بدءًا من j0، بالترتيب.
  // يتجاهل الكلمات الزائدة، ويتسامح مع سقوط حتى كلمتين، ومع دمج كلمتين في واحدة أو فصل كلمة إلى اثنتين.
  function match(W, E, j0 = 0) {
    let j = j0, last = -1, first = -1, hits = 0;
    let endHit = false;
    const hit = (x, jj, c = 1) => { if (first < 0) first = x; last = x; j = jj; hits += c; if (jj === E.length) endHit = true; };
    for (let x = 0; x < W.length && j < E.length; x++) {
      const w = W[x];
      if (j === 0 && MUQ.has(E[0])) { const k = muq(W, x, E[0]); if (k) { hit(x + k - 1, 1); x += k - 1; continue; } }
      if (w === '٭' && NUM.test(E[j] || '')) { let jj = j; while (jj < E.length && NUM.test(E[jj])) jj++; hit(x, jj, jj - j); continue; }
      // بالترتيب: الكلمة نفسها، ثم دمج كلمتين مسموعتين، ثم كلمة مسموعة تجمع كلمتين، ثم تجاوز كلمة أو كلمتين ساقطتين
      let ok = false;
      for (let s = 0; s <= 2 && j + s < E.length && !ok; s++) {
        const e = E[j + s];
        if (wsim(w, e, j + s === E.length - 1)) { hit(x, j + s + 1); ok = true; }
        else if (s <= 1 && x + 1 < W.length && e.length >= 4 && wsim(w + W[x + 1], e, j + s === E.length - 1)) { hit(x + 1, j + s + 1); x++; ok = true; }
        else if (s === 0 && j + 1 < E.length && w.length >= 4 && wsim(w, e + E[j + 1])) { hit(x, j + 2); ok = true; }
      }
    }
    return { j, last, first, hits, endHit };
  }
  const need = n => n <= 3 ? n : n <= 6 ? n - 1 : Math.ceil(n * 0.8);
  const BASM = words('بسم الله الرحمن الرحيم'), ISTI = words('أعوذ بالله من الشيطان الرجيم');
  // يحذف الاستعاذة (وقبل أول آية من السورة: البسملة) من بداية المسموع، ويعيد عدد الكلمات المحذوفة
  function lead(W, key) {
    let x = 0;
    const eat = P => { if (x >= W.length || !wsim(W[x], P[0])) return; const m = match(W.slice(x, x + P.length + 2), P); if (m.hits >= P.length - 1 && m.first === 0) x += m.last + 1; };
    eat(ISTI);
    const [s, a] = String(key).split(':').map(Number);
    if (a === 1 && s !== 1 && s !== 9) eat(BASM);
    return x;
  }
  // قرار واحد: هل كُشفت الآية؟ W كلمات مسموعة (مطبّعة)، E كلمات الآية، jBase تقدّم محفوظ من جلسة سابقة
  function judge(W, E, key, jBase = 0) {
    const skip = jBase ? 0 : lead(W, key), V = skip ? W.slice(skip) : W;
    const m0 = match(V, E, 0); let m = m0;
    if (jBase) { const m2 = match(V, E, jBase); if (m2.j > m.j) m = m2; }
    const n = E.length, h = m.hits + (m === m0 ? 0 : jBase);
    // آخر كلمة في الآية يجب أن تُسمع (تفرّق بين الآيات المتشابهة التي تختلف في خواتيمها)
    const done = m.j === n && m.endHit && h >= (n <= 3 ? n : Math.ceil(n * 0.7)) && (n > 3 || m.last - m.first <= n + 2);
    return { done, j: m.j, used: done ? skip + m.last + 1 : 0 };
  }
  // كلمات الآية المتوقعة: نص Tanzil يضع البسملة في أول الآية الأولى من كل سورة (عدا الفاتحة والتوبة)، فتُحذف لأنها ليست من الآية
  function expect(text, key) {
    const E = words(text), [s, a] = String(key).split(':').map(Number);
    if (a === 1 && s !== 1 && s !== 9 && E.slice(0, 4).join(' ') === BASM.join(' ') && E.length > 4) return E.slice(4);
    return E;
  }
  return { norm, words, wsim, match, need, judge, lead, expect };
})();
if (typeof module !== 'undefined') module.exports = TMM;
