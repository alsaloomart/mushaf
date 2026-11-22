/* مطابقة التسميع (الإصدار 2): نص التعرف على الكلام مقابل نص الآية (Tanzil Simple Clean). دالة نقية تُختبر وحدها (tests/t_tmatch.js).
   مبنية لنصوص الجوال الحقيقية: كلمات ساقطة أو مدموجة أو مفصولة، مدود التجويد، حروف خاطئة، وأجزاء قصيرة.
   المحاذاة بالبرمجة الديناميكية (ترتيب الكلمات محفوظ)، والتشابه لكل كلمة بمسافة التحرير النسبية.
   لا تُعرض أي كلمة من هنا على الشاشة؛ الكشف يكون على صورة الصفحة نفسها. */
const TMM = (() => {
  const norm = t => String(t || '')
    .replace(/[0-9\u0660-\u0669\u06F0-\u06F9]+/g, ' ٭ ')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, 'ا')
    .replace(/\u0624/g, 'و').replace(/[\u0626\u0649\u06CC\u06D2]/g, 'ي').replace(/\u0629/g, 'ه').replace(/\u0621/g, '').replace(/\u06A9/g, 'ك').replace(/\u06C1/g, 'ه')
    .replace(/[^\u0621-\u064A\s٭]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = t => norm(t).split(' ').filter(Boolean);
  const squash = w => w.replace(/(.)\1+/g, '$1');                       // مدود التجويد «الرحماان» والحروف المكررة
  const strip = w => w.replace(/^(و|ف)?(ب|ل|ك)?(ال)?/, '').replace(/[اوي]$/, '');
  const lev = (a, b) => { if (a === b) return 0; let p = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; };
  const NUM = /^(و|ف)?(ال)?(واحد|احد|اثن|ثنت|ثلاث|اربع|خمس|ست|سبع|ثمان|تسع|عشر|مائ|ماي|مئ|الف|الاف|الفين|ميه)/;
  const SC = new Map();
  // تشابه كلمتين بين 0 و1
  function sim(w, e) {
    if (w === e) return 1;
    if (w === '٭') return NUM.test(e) ? 1 : 0;
    const key = w + '|' + e; let v = SC.get(key); if (v !== undefined) return v;
    const a = squash(w), b = squash(e);
    if (a === b) v = 1;
    else {
      const ca = squash(strip(w)), cb = squash(strip(e));
      if (ca && ca === cb) v = .95;
      else {
        const s1 = 1 - lev(a, b) / Math.max(a.length, b.length);
        const s2 = ca && cb ? (1 - lev(ca, cb) / Math.max(ca.length, cb.length)) * .97 : 0;
        v = Math.max(s1, s2);
      }
    }
    if (SC.size > 50000) SC.clear(); SC.set(key, v); return v;
  }
  const TH = e => e.length <= 2 ? .99 : e.length === 3 ? .66 : .6;   // أقل تشابه يُعدّ مطابقة، حسب طول كلمة الآية
  const ok = (w, e) => { const s = sim(w, e); return s >= TH(e) ? s : 0; };
  // الحروف المقطعة تُنطق بأسمائها: «ألف لام ميم»، «حا ميم»، «كاف ها يا عين صاد»...
  const LN = { 'ا': '(ال?ي?ف|ا)', 'ل': '(لا?م|ل)', 'م': '(مي?م|م)', 'ص': '(صا?د|صات|ص)', 'ر': '(را|ر)', 'ك': '(كا?ف|ك)', 'ه': '(ها|ه)', 'ي': '(يا|ي)', 'ع': '(عي?ن|ع)', 'ط': '(طا|ط)', 'س': '(سي?ن|س)', 'ح': '(حا|ح)', 'ق': '(قا?ف|ق)', 'ن': '(نو?ن|ن)' };
  const MUQ = new Map(['الم', 'المص', 'الر', 'المر', 'كهيعص', 'طه', 'طسم', 'طس', 'يس', 'ص', 'حم', 'عسق', 'ق', 'ن'].map(m => [m, new RegExp('^' + [...m].map(c => LN[c]).join('') + '$')]));
  // يستبدل أسماء الحروف المسموعة بالكلمة المقطعة، ويعيد خريطة إلى مواضع الكلمات الأصلية
  function muq(W, e) {
    const re = MUQ.get(e), V = [], map = [];
    for (let x = 0; x < W.length; x++) {
      let s = '', hit = 0;
      if (re) for (let k = 0; k < 6 && x + k < W.length; k++) { s += W[x + k]; if (re.test(squash(s)) || re.test(s)) { hit = k + 1; break; } }
      if (hit) { V.push(e); x += hit - 1; } else V.push(W[x]);
      map.push(x);
    }
    return { V, map };
  }
  // محاذاة W (مسموع) مع E (الآية) بالترتيب. تعيد لكل بادئة من W أفضل محاذاة؛ نختار أقصر بادئة تحقق شرط الكشف
  function align(W, E) {
    const m = W.length, n = E.length, N = n + 1;
    const S = new Float64Array((m + 1) * N), B = new Int8Array((m + 1) * N);   // B: 1 تخطي مسموع، 2 تخطي آية، 3 مطابقة، 4 دمج مسموعين، 5 مسموع يجمع كلمتين
    for (let j = 1; j <= n; j++) B[j] = 2;
    for (let i = 1; i <= m; i++) {
      B[i * N] = 1;
      for (let j = 1; j <= n; j++) {
        let best = S[(i - 1) * N + j], b = 1;
        if (S[i * N + j - 1] > best) { best = S[i * N + j - 1]; b = 2; }
        const s = ok(W[i - 1], E[j - 1]); if (s && S[(i - 1) * N + j - 1] + s > best) { best = S[(i - 1) * N + j - 1] + s; b = 3; }
        if (i >= 2 && E[j - 1].length >= 4) { const s4 = sim(W[i - 2] + W[i - 1], E[j - 1]); if (s4 >= .8 && S[(i - 2) * N + j - 1] + s4 > best) { best = S[(i - 2) * N + j - 1] + s4; b = 4; } }
        if (j >= 2 && W[i - 1].length >= 4) { const s5 = sim(W[i - 1], E[j - 2] + E[j - 1]); if (s5 >= .8 && S[(i - 1) * N + j - 2] + 2 * s5 > best) { best = S[(i - 1) * N + j - 2] + 2 * s5; b = 5; } }
        S[i * N + j] = best; B[i * N + j] = b;
      }
    }
    // يتتبع المحاذاة لبادئة طولها i: أي كلمات الآية طوبقت، وآخر كلمة مسموعة استُعملت
    const trace = i => { let j = n; const hitE = new Float64Array(n), at = new Int32Array(n).fill(-1); let last = -1;
      while (i > 0 && j > 0) { const b = B[i * N + j];
        if (b === 1) i--; else if (b === 2) j--;
        else if (b === 3) { hitE[j - 1] = sim(W[i - 1], E[j - 1]); at[j - 1] = i - 1; if (last < 0) last = i - 1; i--; j--; }
        else if (b === 4) { hitE[j - 1] = sim(W[i - 2] + W[i - 1], E[j - 1]); at[j - 1] = i - 1; if (last < 0) last = i - 1; i -= 2; j--; }
        else { const s = sim(W[i - 1], E[j - 2] + E[j - 1]); hitE[j - 1] = hitE[j - 2] = s; at[j - 1] = at[j - 2] = i - 1; if (last < 0) last = i - 1; i--; j -= 2; } }
      return { hitE, at, last }; };
    return { S, N, trace, m, n };
  }
  // عدد الكلمات المطلوبة (بالترتيب) من n كلمة
  const need = n => n <= 2 ? n : n === 3 ? 2 : Math.ceil(n * 0.65);
  function verdict(W, E) {
    const n = E.length; if (!n || !W.length) return { done: false, j: 0, used: 0, end: 0 };
    const A = align(W, E); let bestJ = 0;
    for (let i = 1; i <= A.m; i++) {
      if (A.S[i * A.N + n] <= A.S[(i - 1) * A.N + n]) continue;   // البادئة لم تُحسّن المحاذاة
      const t = A.trace(i); let cnt = 0; for (let j = 0; j < n; j++) if (t.hitE[j]) cnt++;
      if (cnt > bestJ) bestJ = cnt;
      const end = Math.max(t.hitE[n - 1], n >= 2 ? t.hitE[n - 2] : 0);   // آخر كلمة أو التي قبلها، بتشابه قوي
      if (cnt >= need(n) && end >= .75) {
        const endAt = Math.max(t.at[n - 1], n >= 2 ? t.at[n - 2] : -1);
        let used = endAt + 1;
        if (!t.hitE[n - 1] && used < W.length && sim(W[used], E[n - 1]) >= .75) used++;   // الكلمة الأخيرة جاءت بعد ما توقفت عنده المحاذاة: تُستهلك ولا تبقى للآية التالية
        return { done: true, j: cnt, used, end };
      }
    }
    return { done: false, j: bestJ, used: 0, end: 0 };
  }
  const BASM = words('بسم الله الرحمن الرحيم'), ISTI = words('أعوذ بالله من الشيطان الرجيم');
  // يحذف الاستعاذة (وقبل أول آية من السورة: البسملة) من بداية المسموع
  function lead(W, key) {
    let x = 0;
    const eat = P => { if (x >= W.length || sim(W[x], P[0]) < .75) return; let k = 0, y = x, hit = 0; while (y < W.length && k < P.length && y < x + P.length + 2) { if (sim(W[y], P[k]) >= .75) { hit++; k++; y++; } else if (k + 1 < P.length && sim(W[y], P[k + 1]) >= .75) { hit++; k += 2; y++; } else y++; } if (hit >= P.length - 1) x = y; };
    eat(ISTI);
    const [s, a] = String(key).split(':').map(Number);
    if (a === 1 && s !== 1 && s !== 9) eat(BASM);
    return x;
  }
  // القرار: W كلمات مسموعة (مطبّعة)، E كلمات الآية، opts.next كلمات الآية التالية في الصفحة (حماية الآيات المتشابهة المتجاورة)
  function judge(W, E, key, opts = {}) {
    const skip = lead(W, key), { V, map } = muq(skip ? W.slice(skip) : W, E[0]);
    const r = verdict(V, E);
    if (r.done && opts.next && opts.next.length && opts.next.join(' ') !== E.join(' ')) {
      const r2 = verdict(V, opts.next);
      // إن كان المسموع هو الآية التالية (المشابهة) بخاتمتها لا الحالية، لا نكشف الحالية
      if (r2.done && r2.end > r.end + .02 && r2.used <= r.used + 1) return { done: false, j: r.j, used: 0, end: 0, why: 'next' };
    }
    return { done: r.done, j: r.j, used: r.done ? skip + map[r.used - 1] + 1 : 0, end: r.end };
  }
  // كلمات الآية المتوقعة: نص Tanzil يضع البسملة في أول الآية الأولى من كل سورة (عدا الفاتحة والتوبة)، فتُحذف لأنها ليست من الآية
  function expect(text, key) {
    const E = words(text), [s, a] = String(key).split(':').map(Number);
    if (a === 1 && s !== 1 && s !== 9 && E.slice(0, 4).join(' ') === BASM.join(' ') && E.length > 4) return E.slice(4);
    return E;
  }
  return { norm, words, sim, need, judge, lead, expect, verdict };
})();
if (typeof module !== 'undefined') module.exports = TMM;
