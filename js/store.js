/* طبقة بيانات المستخدم — الخطة، المحفوظ، المراجعة، آخر صفحة (محليًا على الجهاز فقط) */
const ST = (() => {
  const KEY = 'mushaf.v1';
  const def = () => ({ lastPage: 1, reciter: 6, theme: 'system', repeat: { count: 3, mode: 'range' }, plan: null, mem: {}, rev: {} });
  let d;
  try { d = Object.assign(def(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { d = def(); }
  const save = () => localStorage.setItem(KEY, JSON.stringify(d));
  const DAY = 864e5;
  const INTERVALS = [1, 2, 4, 7, 15, 30, 60];
  const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t.getTime(); };
  return {
    get: () => d, save,
    setLastPage(p) { d.lastPage = p; save(); },
    setReciter(id) { d.reciter = id; save(); },
    setTheme(t) { d.theme = t; save(); },
    set(k, v) { d[k] = v; save(); },
    setRepeat(r) { d.repeat = r; save(); },
    setPlan(pl) { d.plan = pl; save(); },
    isMem: k => !!d.mem[k],
    markMem(keys) { const t = Date.now(); keys.forEach(k => { d.mem[k] = t; if (!d.rev[k]) d.rev[k] = { lvl: 0, due: today0() + DAY }; }); save(); },
    unMem(keys) { keys.forEach(k => delete d.mem[k]); save(); },
    addReview(keys) { keys.forEach(k => { d.rev[k] = { lvl: 0, due: today0() }; }); save(); },
    grade(k, good) {
      const r = d.rev[k] || { lvl: 0 };
      r.lvl = good ? Math.min(r.lvl + 1, INTERVALS.length - 1) : 0;
      r.due = today0() + INTERVALS[r.lvl] * DAY; r.last = Date.now();
      d.rev[k] = r; save();
    },
    removeReview(k) { delete d.rev[k]; save(); },
    due() { const t = today0() + DAY - 1; return Object.entries(d.rev).filter(([, r]) => r.due <= t).map(([k, r]) => ({ k, ...r })); },
    INTERVALS
  };
})();
