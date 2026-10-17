/* =========================================================
   صفحة الاختبارات المنفصلة — تفسير جزء عم (تدبّر وعمل)
   تُبنى الأسئلة آليًا من surahs-data.js
   ========================================================= */
(function () {
  'use strict';

  /* surahs-data.js يعرّف const SURAHS (نطاق معجمي) — نقرأه بأمان */
  var DATA = (typeof SURAHS !== 'undefined' && SURAHS) ? SURAHS : (window.SURAHS || []);
  var $ = function (id) { return document.getElementById(id); };
  var ON = 'on';

  /* ---------------- أدوات مساعدة ---------------- */
  function shuffle(a) {
    var b = a.slice();
    for (var i = b.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }
  function uniq(a) {
    var seen = {}, out = [];
    for (var i = 0; i < a.length; i++) {
      if (!seen[a[i]]) { seen[a[i]] = 1; out.push(a[i]); }
    }
    return out;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mmss(sec) {
    if (sec < 0) sec = 0;
    return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
  }
  function b64url(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(s) {
    var t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    return decodeURIComponent(escape(atob(t)));
  }

  /* ---------------- أنواع الأسئلة ---------------- */
  var CAT = {
    maqsad:   { label: 'مقاصد السور',        lvl: 2, desc: 'ما المقصود من السورة؟' },
    kalimat:  { label: 'معاني الكلمات',       lvl: 2, desc: 'معنى لفظ غريب في السورة' },
    reverse:  { label: 'الكلمة من المعنى',    lvl: 3, desc: 'عكس: اختر الكلمة الصحيحة' },
    tadabbur: { label: 'الوقفات التدبرية',   lvl: 3, desc: 'أي وقفة تدبرية من السورة؟' },
    amal:     { label: 'العمل بالآيات',       lvl: 3, desc: 'عمل عملي مستفاد من السورة' },
    ayat:     { label: 'عدد الآيات',          lvl: 1, desc: 'كم عدد آيات السورة؟' },
    order:    { label: 'ترتيب السور',         lvl: 1, desc: 'رقم السورة في المصحف' },
    place:    { label: 'المكية والمدنية',     lvl: 1, desc: 'تصنيف السورة' },
    aya:      { label: 'الآية المفتاحية',     lvl: 1, desc: 'أي آية تفتتح السورة؟' }
  };
  var CAT_KEYS = Object.keys(CAT);

  /* خزّان المبدّلات لكل نوع (على مستوى كل السور) */
  var POOL = {};
  function buildPools() {
    POOL = {
      maqsad:   DATA.map(function (s) { return s.maqsad; }),
      kalimat:  [],
      reverse:  [],
      tadabbur: [],
      amal:     [],
      ayat:     [],
      order:    DATA.map(function (s) { return String(s.n); }),
      place:    ['مكية', 'مدنية'],
      aya:      DATA.map(function (s) { return s.aya; })
    };
    DATA.forEach(function (s) {
      Object.keys(s.kalimat || {}).forEach(function (k) {
        POOL.kalimat.push(s.kalimat[k]);
        POOL.reverse.push(k);
      });
      (s.tadabbur || []).forEach(function (t) { POOL.tadabbur.push(t); });
      (s.amal || []).forEach(function (a) { POOL.amal.push(a); });
      POOL.ayat.push(String(s.ayat) + ' آية');
    });
  }

  /* تركيب خيارات: الصحيحة + بدائل قريبة ثم بدائل عامة */
  function buildOpts(correct, near, far) {
    var out = [correct], seen = {}, i;
    seen[correct] = 1;
    var cand = shuffle(uniq(near.concat(far || [])));
    for (i = 0; i < cand.length && out.length < 4; i++) {
      if (!seen[cand[i]]) { seen[cand[i]] = 1; out.push(cand[i]); }
    }
    return shuffle(out);
  }

  /* ---------------- توليد سؤال واحد ---------------- */
  function makeQ(s, cat, pool) {
    var q = { cat: cat, catLabel: CAT[cat].label, lvl: CAT[cat].lvl, surah: s.n, surahName: s.name };
    var others = pool.filter(function (x) { return x.n !== s.n; });
    var keys = Object.keys(s.kalimat || {});

    if (cat === 'maqsad') {
      q.q = 'ما مقصد سورة ' + s.name + '؟';
      q.ans = s.maqsad;
      q.opts = buildOpts(s.maqsad,
        others.map(function (x) { return x.maqsad; }), POOL.maqsad);
      q.exp = 'مقصد سورة ' + s.name + ': ' + s.maqsad;
      return q;
    }

    if (cat === 'kalimat') {
      if (!keys.length) return null;
      var k = keys[Math.floor(Math.random() * keys.length)];
      q.q = 'في سورة ' + s.name + ': ما معنى «' + k + '»؟';
      q.ans = s.kalimat[k];
      q.opts = buildOpts(s.kalimat[k],
        others.reduce(function (acc, x) { return acc.concat(Object.values(x.kalimat || {})); }, []), POOL.kalimat);
      q.exp = '«' + k + '» في سورة ' + s.name + ' = ' + s.kalimat[k];
      return q;
    }

    if (cat === 'reverse') {
      if (!keys.length) return null;
      var k2 = keys[Math.floor(Math.random() * keys.length)];
      var meaning = s.kalimat[k2];
      q.q = 'في سورة ' + s.name + ': أي الكلمات الآتية تعني «' + meaning + '»؟';
      q.ans = k2;
      q.opts = buildOpts(k2,
        others.reduce(function (acc, x) { return acc.concat(Object.keys(x.kalimat || {})); }, []), POOL.reverse);
      q.exp = 'اللفظ «' + k2 + '» في سورة ' + s.name + ' يعني: ' + meaning;
      return q;
    }

    if (cat === 'tadabbur') {
      if (!(s.tadabbur || []).length) return null;
      var t = s.tadabbur[Math.floor(Math.random() * s.tadabbur.length)];
      q.q = 'أي وقفة تدبرية مستنبطة من سورة ' + s.name + '؟';
      q.ans = t;
      q.opts = buildOpts(t,
        others.reduce(function (acc, x) { return acc.concat(x.tadabbur || []); }, []), POOL.tadabbur);
      q.exp = 'راجع بطاقة سورة ' + s.name + ' — قسم الوقفات التدبرية.';
      return q;
    }

    if (cat === 'amal') {
      if (!(s.amal || []).length) return null;
      var a = s.amal[Math.floor(Math.random() * s.amal.length)];
      q.q = 'أي عمل عملي مستفاد من سورة ' + s.name + '؟';
      q.ans = a;
      q.opts = buildOpts(a,
        others.reduce(function (acc, x) { return acc.concat(x.amal || []); }, []), POOL.amal);
      q.exp = 'راجع بطاقة سورة ' + s.name + ' — قسم العمل بالآيات.';
      return q;
    }

    if (cat === 'ayat') {
      var same = others.filter(function (x) { return x.ayat !== s.ayat; })
        .map(function (x) { return String(x.ayat) + ' آية'; });
      q.q = 'كم عدد آيات سورة ' + s.name + '؟';
      q.ans = s.ayat + ' آية';
      q.opts = buildOpts(q.ans, same, POOL.ayat);
      q.exp = 'سورة ' + s.name + ' عدد آياتها ' + s.ayat + '.';
      return q;
    }

    if (cat === 'order') {
      q.q = 'ما رقم سورة ' + s.name + ' في المصحف؟';
      q.ans = String(s.n);
      q.opts = buildOpts(String(s.n),
        others.map(function (x) { return String(x.n); }), POOL.order);
      q.exp = 'السورة رقم ' + s.n + ' هي سورة ' + s.name + '.';
      return q;
    }

    if (cat === 'place') {
      var correct = s.type === 'makki' ? 'مكية' : 'مدنية';
      if (Math.random() < 0.5) {
        var guess = Math.random() < 0.5 ? 'مكية' : 'مدنية';
        q.q = 'سورة ' + s.name + ' سورة ' + guess + '؟';
        q.opts = ['صحيح', 'خطأ'];
        q.ans = guess === correct ? 'صحيح' : 'خطأ';
      } else {
        q.q = 'سورة ' + s.name + '…؟';
        q.opts = shuffle(['مكية', 'مدنية']);
        q.ans = correct;
      }
      q.exp = 'سورة ' + s.name + ' ' + correct + '، عدد آياتها ' + s.ayat + '.';
      return q;
    }

    if (cat === 'aya') {
      q.q = 'أي آية تفتتح بها سورة ' + s.name + '؟';
      q.ans = s.aya;
      q.opts = buildOpts(s.aya, others.map(function (x) { return x.aya; }), POOL.aya);
      q.exp = 'مفتتح سورة ' + s.name + ' هو مفتتحها في المصحف.';
      return q;
    }

    return null;
  }

  /* ---------------- إدارة الإعدادات ---------------- */
  var selSurahs = {};
  var bankCat = 'all';

  function selectedCats() {
    return CAT_KEYS.filter(function (k) { return $('c_' + k) && $('c_' + k).checked; });
  }

  function poolForScope() {
    var scope = $('qScope').value;
    if (scope === 'makki') return DATA.filter(function (s) { return s.type === 'makki'; });
    if (scope === 'madani') return DATA.filter(function (s) { return s.type === 'madani'; });
    if (scope === 'range') {
      var a = parseInt($('qFrom').value, 10), b = parseInt($('qTo').value, 10);
      if (isNaN(a) || isNaN(b)) return DATA;
      if (a > b) { var t = a; a = b; b = t; }
      return DATA.filter(function (s) { return s.n >= a && s.n <= b; });
    }
    if (scope === 'custom') {
      return DATA.filter(function (s) { return selSurahs[s.n]; });
    }
    return DATA;
  }

  function catsForLevel(cats, lvl) {
    var l = parseInt(lvl, 10);
    if (!l) return cats;
    if (l === 3) return cats.filter(function (c) { return CAT[c].lvl >= 2; });
    return cats.filter(function (c) { return CAT[c].lvl <= l; });
  }

  function generate(cfg) {
    var pool = poolForScope();
    var cats = catsForLevel(selectedCats(), cfg.level);
    if (!cats.length || !pool.length) return [];
    var all = [], i, j, q;
    for (i = 0; i < pool.length; i++) {
      for (j = 0; j < cats.length; j++) {
        q = makeQ(pool[i], cats[j], pool);
        if (q) all.push(q);
      }
    }
    all = shuffle(all);
    var target = Math.min(cfg.count, all.length);
    var out = all.slice(0, target);
    if (cfg.order === 'surah') {
      out.sort(function (a, b) { return a.surah - b.surah; });
    }
    return out;
  }

  function readCfg() {
    return {
      count: Math.max(1, Math.min(80, parseInt($('qCount').value, 10) || 15)),
      level: $('qLevel').value,
      scope: $('qScope').value,
      from: $('qFrom').value,
      to: $('qTo').value,
      surahs: DATA.filter(function (s) { return selSurahs[s.n]; }).map(function (s) { return s.n; }),
      cats: selectedCats(),
      time: parseInt($('qTime').value, 10) || 0,
      pass: parseInt($('qPass').value, 10) || 50,
      instant: $('qInstant').value === '1',
      order: $('qOrder').value
    };
  }

  function scopeLabel(cfg) {
    if (cfg.scope === 'makki') return 'السور المكية';
    if (cfg.scope === 'madani') return 'السور المدنية';
    if (cfg.scope === 'range') return 'السور من ' + cfg.from + ' إلى ' + cfg.to;
    if (cfg.scope === 'custom') return cfg.surahs.length + ' سورة مختارة';
    return 'كل السور (37)';
  }

  /* ---------------- تحديث الواجهة ---------------- */
  function updatePoolInfo() {
    var cfg = readCfg();
    var n = generate(cfg).length;
    $('poolInfo').textContent = n + ' سؤال';
    $('cfgWarn').hidden = n >= cfg.count;
    $('hsBank').textContent = DATA.length * CAT_KEYS.length;
  }

  function buildCatCheckboxes() {
    $('catList').innerHTML = CAT_KEYS.map(function (k) {
      return '<label class="ex-cat"><input type="checkbox" id="c_' + k + '" value="' + k + '" checked>' +
        '<span class="ex-cat-box">' + CAT[k].label + '</span></label>';
    }).join('');
    $('catListInfo').innerHTML = CAT_KEYS.map(function (k) {
      return '<li><b>' + CAT[k].label + '</b> <small>' + CAT[k].desc + '</small></li>';
    }).join('');
    $('catList').addEventListener('change', updatePoolInfo);
  }

  function buildSurahPickers() {
    var opts = DATA.map(function (s) {
      return '<option value="' + s.n + '">' + s.name + ' (' + s.n + ')</option>';
    }).join('');
    $('qFrom').innerHTML = opts;
    $('qTo').innerHTML = opts;
    $('qFrom').value = '78';
    $('qTo').value = '114';

    $('surahChips').innerHTML = DATA.map(function (s) {
      return '<button type="button" class="chip ex-surah" data-n="' + s.n + '">' + s.name + '</button>';
    }).join('');
    $('surahChips').addEventListener('click', function (e) {
      var b = e.target.closest('.ex-surah');
      if (!b) return;
      var n = b.dataset.n;
      selSurahs[n] = !selSurahs[n];
      b.classList.toggle(ON, !!selSurahs[n]);
      countSel();
      updatePoolInfo();
    });
    countSel();
  }

  function countSel() {
    var c = DATA.filter(function (s) { return selSurahs[s.n]; }).length;
    $('surahCount').textContent = c + ' سورة';
  }

  function syncScopeBoxes() {
    $('rangeBox').hidden = $('qScope').value !== 'range';
    $('surahBox').hidden = $('qScope').value !== 'custom';
    updatePoolInfo();
  }

  /* ---------------- حالة الاختبار ---------------- */
  var st = {
    cfg: null, qs: [], ans: [], revealed: [], flags: {},
    idx: 0, remaining: 0, timer: null, started: 0, elapsed: 0, done: false
  };

  function startExam(cfg, sourceScope) {
    if (sourceScope && sourceScope.n) {
      /* بدء اختبار من بطاقة بنك الأسئلة: يفرض نطاق سورة واحدة */
      selSurahs = {};
      selSurahs[sourceScope.n] = true;
      DATA.forEach(function (s) {
        var b = document.querySelector('.ex-surah[data-n="' + s.n + '"]');
        if (b) b.classList.toggle(ON, !!selSurahs[s.n]);
      });
      countSel();
      $('qScope').value = 'custom';
      syncScopeBoxes();
      cfg = readCfg();
      cfg.count = Math.min(cfg.count, DATA.length * CAT_KEYS.length);
    }
    st.cfg = cfg;
    st.qs = generate(cfg);
    if (!st.qs.length) { alert('لا توجد أسئلة مطابقة لهذا الإعداد. وسّع النطاق أو أنواع الأسئلة.'); return; }
    st.ans = new Array(st.qs.length).fill('');
    st.revealed = new Array(st.qs.length).fill(false);
    st.flags = {};
    st.idx = 0;
    st.done = false;
    st.started = Date.now();
    st.elapsed = 0;
    st.remaining = cfg.time * 60;
    $('setup').hidden = true;
    $('result').hidden = true;
    $('exam').hidden = false;
    window.scrollTo(0, 0);
    renderPalette();
    renderQ();
    if (cfg.time > 0) startTimer(); else tickElapsed();
  }

  function startTimer() {
    clearInterval(st.timer);
    st.timer = setInterval(function () {
      st.remaining--;
      paintTimer();
      if (st.remaining <= 0) {
        clearInterval(st.timer);
        finish('time');
      }
    }, 1000);
    paintTimer();
  }

  function tickElapsed() {
    clearInterval(st.timer);
    st.elapsed = Math.floor((Date.now() - st.started) / 1000);
    paintTimer();
    st.timer = setInterval(function () {
      st.elapsed = Math.floor((Date.now() - st.started) / 1000);
      paintTimer();
    }, 1000);
  }

  function paintTimer() {
    var t = $('exTimer');
    if (st.cfg.time > 0) {
      t.textContent = '⏱ ' + mmss(st.remaining);
      t.classList.toggle('ex-warn-t', st.remaining <= 60);
      t.classList.toggle('ex-crit', st.remaining <= 10);
    } else {
      t.textContent = '⏱ ' + mmss(st.elapsed);
    }
  }

  function scoreNow() {
    var s = 0;
    for (var i = 0; i < st.qs.length; i++) {
      if (st.ans[i] && st.ans[i] === st.qs[i].ans) s++;
    }
    return s;
  }

  function renderQ() {
    var q = st.qs[st.idx];
    if (!q) return;
    $('exNum').textContent = 'السؤال ' + (st.idx + 1) + ' / ' + st.qs.length;
    $('exCat').textContent = q.catLabel;
    $('exQCat').textContent = 'سورة ' + q.surahName + ' — ' + q.catLabel;
    $('exScore').textContent = 'النقاط: ' + scoreNow();
    $('exProg').style.width = ((st.idx + 1) / st.qs.length * 100) + '%';
    $('exQText').textContent = q.q;

    var opts = $('exOpts');
    opts.innerHTML = '';
    q.opts.forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'q-opt';
      b.innerHTML = '<span class="ex-key">' + (i + 1) + '</span>' + esc(o);
      if (st.ans[st.idx] === o) b.classList.add('chosen');
      if (st.revealed[st.idx]) {
        b.disabled = true;
        if (o === q.ans) b.classList.add('correct');
        else if (o === st.ans[st.idx]) b.classList.add('wrong');
      }
      b.onclick = function () { choose(st.idx, o, b); };
      opts.appendChild(b);
    });

    var feed = $('exFeed');
    if (st.revealed[st.idx]) {
      var ok = st.ans[st.idx] === q.ans;
      feed.textContent = (ok ? '✔ إجابة صحيحة. ' : '✘ إجابة غير صحيحة. الصحيحة: ' + q.ans + '. ') + q.exp;
      feed.className = 'q-feed ' + (ok ? 'ok' : 'no');
    } else {
      feed.textContent = '';
      feed.className = 'q-feed';
    }

    $('exPrev').disabled = st.idx === 0;
    $('exNext').textContent = st.idx === st.qs.length - 1 ? 'آخر سؤال ⟵' : 'التالي ⟵';
    $('exFlag').classList.toggle('ex-flagged', !!st.flags[st.idx]);
    renderPalette();
  }

  function choose(i, opt, btn) {
    if (st.revealed[i] && st.cfg.instant) return;
    st.ans[i] = opt;
    if (st.cfg.instant) { st.revealed[i] = true; }
    renderQ();
    if (!st.cfg.instant) renderPalette();
  }

  function renderPalette() {
    var pal = $('exPalette');
    pal.innerHTML = st.qs.map(function (q, i) {
      var cls = 'pal';
      if (st.ans[i]) cls += ' done';
      if (st.flags[i]) cls += ' flag';
      if (i === st.idx) cls += ' cur';
      return '<button type="button" class="' + cls + '" data-i="' + i + '">' + (i + 1) + '</button>';
    }).join('');
    if (st.done) {
      st.qs.forEach(function (q, i) {
        if (st.ans[i] && st.ans[i] === q.ans) {
          var el = pal.querySelector('[data-i="' + i + '"]');
          if (el) el.classList.add('good');
        } else if (st.ans[i]) {
          var el2 = pal.querySelector('[data-i="' + i + '"]');
          if (el2) el2.classList.add('bad');
        }
      });
    }
  }

  /* ---------------- النتيجة ---------------- */
  function history() {
    try { return JSON.parse(localStorage.getItem('juz_exam_history') || '[]'); } catch (e) { return []; }
  }
  function saveHistory(h) {
    try { localStorage.setItem('juz_exam_history', JSON.stringify(h.slice(0, 25))); } catch (e) {}
    renderStats();
  }

  function renderStats() {
    var h = history();
    if (!h.length) {
      $('stBest').textContent = '—';
      $('stAvg').textContent = '—';
      $('stRuns').textContent = '0';
      $('histList').innerHTML = '<li class="ex-empty">لا توجد محاولات بعد — ابدأ اختبارك الأول.</li>';
      return;
    }
    var best = 0, sum = 0;
    h.forEach(function (x) { if (x.pct > best) best = x.pct; sum += x.pct; });
    $('stBest').textContent = best + '%';
    $('stAvg').textContent = Math.round(sum / h.length) + '%';
    $('stRuns').textContent = h.length;
    $('histList').innerHTML = h.slice(0, 6).map(function (x) {
      var d = new Date(x.t);
      return '<li><span class="ex-h-date">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span>' +
        '<span class="ex-h-score">' + x.pct + '%</span>' +
        '<span class="ex-h-meta">' + x.score + '/' + x.total + ' • ' + scopeLabelShort(x.cfg) + '</span></li>';
    }).join('');
  }

  function scopeLabelShort(cfg) {
    if (!cfg) return '';
    if (cfg.scope === 'all') return 'كل السور';
    if (cfg.scope === 'makki') return 'مكية';
    if (cfg.scope === 'madani') return 'مدنية';
    if (cfg.scope === 'range') return cfg.from + '–' + cfg.to;
    return (cfg.surahs || []).length + ' سورة';
  }

  function finish(reason) {
    if (st.done) return;
    st.done = true;
    clearInterval(st.timer);
    st.elapsed = Math.floor((Date.now() - st.started) / 1000);

    var total = st.qs.length, score = 0, unanswered = 0, groups = {}, rows = [];
    st.qs.forEach(function (q, i) {
      var chosen = st.ans[i];
      var ok = !!chosen && chosen === q.ans;
      if (ok) score++;
      if (!chosen) unanswered++;
      if (!groups[q.cat]) groups[q.cat] = { label: q.catLabel, ok: 0, all: 0 };
      groups[q.cat].all++;
      if (ok) groups[q.cat].ok++;
      rows.push({
        i: i, cat: q.cat, catLabel: q.catLabel, surah: q.surahName,
        q: q.q, mine: chosen, ans: q.ans, exp: q.exp, ok: ok
      });
    });
    var pct = Math.round(score / total * 100);
    var pass = pct >= st.cfg.pass;
    var timeUsed = st.cfg.time > 0 ? st.cfg.time * 60 - Math.max(0, st.remaining) : st.elapsed;

    $('exam').hidden = true;
    $('result').hidden = false;
    window.scrollTo(0, 0);

    /* الحلقة والنسبة */
    $('resRing').textContent = score + '/' + total;
    $('resRing').style.setProperty('--p', pct + '%');
    $('resRing').classList.toggle('ex-pass', pass);
    $('resRing').classList.toggle('ex-fail', !pass);

    var msg = pct >= 90 ? 'ممتاز، تدبّر راسخ 🌟'
      : pct >= 70 ? 'أحسنت، واصل التقدم 💪'
      : pct >= 50 ? 'جيد، راجع البطاقات وكرر 📖'
      : 'تحتاج مراجعة هادئة؛ أعد قراءة السور ثم أعد الاختبار 🤲';
    if (reason === 'time') msg = 'انتهى الوقت — ' + msg;
    $('resMsg').textContent = msg;
    $('resLine').textContent = 'نسبتك ' + pct + '% • درجة النجاح ' + st.cfg.pass + '% • ' +
      (reason === 'time' ? 'سُلّم تلقائيًا لانتهاء الوقت' : 'الوقت ' + mmss(timeUsed));
    $('resBadge').textContent = pass ? '✔ ناجح' : '✘ لم تجتز الدرجة';
    $('resBadge').className = 'ex-badge ' + (pass ? 'ex-b-pass' : 'ex-b-fail');

    /* تحليل حسب النوع */
    $('resBreakdown').innerHTML = Object.keys(groups).map(function (k) {
      var g = groups[k], p = Math.round(g.ok / g.all * 100);
      return '<div class="ex-brow">' +
        '<span class="ex-bname">' + g.label + '</span>' +
        '<span class="ex-bnum">' + g.ok + '/' + g.all + '</span>' +
        '<span class="ex-bbar"><i style="width:' + p + '%"></i></span>' +
        '<span class="ex-bpct">' + p + '%</span></div>';
    }).join('');

    /* ملخص */
    $('resSummary').innerHTML = [
      ['عدد الأسئلة', total],
      ['الصحيحة', score],
      ['الخاطئة', total - score - unanswered],
      ['بلا إجابة', unanswered],
      ['نطاق السور', scopeLabel(st.cfg)],
      ['أنواع الأسئلة', st.cfg.cats.length],
      ['المدة المحددة', st.cfg.time ? st.cfg.time + ' دقيقة' : 'بدون مؤقّت'],
      ['الوقت المستغرق', mmss(timeUsed)],
      ['درجة النجاح', st.cfg.pass + '%']
    ].map(function (r) { return '<li><span>' + r[0] + '</span><b>' + r[1] + '</b></li>'; }).join('');

    /* المراجعة */
    renderReview('all');

    /* السجل */
    var h = history();
    h.unshift({ t: Date.now(), score: score, total: total, pct: pct, cfg: st.cfg });
    saveHistory(h);
  }

  function renderReview(mode) {
    var rows = [];
    st.qs.forEach(function (q, i) {
      var chosen = st.ans[i];
      var ok = !!chosen && chosen === q.ans;
      if (mode === 'wrong' && (ok || !chosen)) return;
      if (mode === 'none' && chosen) return;
      rows.push('<div class="rev ' + (ok ? 'ok' : 'no') + '">' +
        '<b>' + (i + 1) + '. ' + esc(q.q) + '</b>' +
        '<span class="rev-cat">' + q.catLabel + ' — سورة ' + q.surahName + '</span>' +
        '<br>إجابتك: <b>' + (chosen ? esc(chosen) : 'لم تُجب') + '</b> ' + (ok ? '✔' : '✘') +
        '<br>الصحيحة: <b>' + esc(q.ans) + '</b>' +
        '<br><small>' + esc(q.exp) + '</small></div>');
    });
    $('resReview').innerHTML = rows.length ? rows.join('')
      : '<div class="ex-empty">لا يوجد في هذا التصنيف.</div>';
  }

  /* ---------------- بنك الأسئلة ---------------- */
  function renderBank() {
    $('bankFilter').innerHTML = '<button type="button" class="chip ' + (bankCat === 'all' ? 'on' : '') +
      '" data-bc="all">الكل</button>' +
      CAT_KEYS.map(function (k) {
        return '<button type="button" class="chip ' + (bankCat === k ? 'on' : '') +
          '" data-bc="' + k + '">' + CAT[k].label + '</button>';
      }).join('');

    $('bankGrid').innerHTML = DATA.filter(function (s) {
      if (bankCat === 'all') return true;
      if (bankCat === 'kalimat' || bankCat === 'reverse') return Object.keys(s.kalimat || {}).length > 0;
      return true;
    }).map(function (s) {
      var counts = CAT_KEYS.map(function (k) {
        return makeQ(s, k, DATA) ? '<span class="ex-btag">' + CAT[k].label + '</span>' : '';
      }).join('');
      return '<div class="ex-bcard"><span class="ex-bnum2">' + s.n + '</span>' +
        '<b>سورة ' + s.name + '</b>' +
        '<span class="tag ' + s.type + '">' + (s.type === 'makki' ? 'مكية' : 'مدنية') + '</span>' +
        '<small>' + s.ayat + ' آية</small>' +
        '<div class="ex-btags">' + counts + '</div>' +
        '<button type="button" class="btn ex-btn ex-preview" data-n="' + s.n + '">👁 معاينة الأسئلة</button>' +
        '</div>';
    }).join('');
  }

  function openBank(n) {
    var s = DATA.filter(function (x) { return x.n === n; })[0];
    if (!s) return;
    var qs = [];
    CAT_KEYS.forEach(function (k) {
      if (bankCat !== 'all' && k !== bankCat) return;
      var q = makeQ(s, k, DATA);
      if (q) qs.push(q);
    });
    qs = shuffle(qs).slice(0, 10);
    $('bankTitle').textContent = 'أسئلة سورة ' + s.name + ' (' + s.ayat + ' آية)';
    $('bankBody').innerHTML = qs.length ? qs.map(function (q, i) {
      return '<div class="ex-pq"><b>' + (i + 1) + '. ' + esc(q.q) + '</b>' +
        '<span class="rev-cat">' + q.catLabel + '</span>' +
        '<ul class="ex-popts">' + q.opts.map(function (o) {
          return '<li class="' + (o === q.ans ? 'good' : '') + '">' + esc(o) + '</li>';
        }).join('') + '</ul>' +
        '<small class="ex-pexp">' + esc(q.exp) + '</small></div>';
    }).join('') : '<div class="ex-empty">لا أسئلة متاحة.</div>';
    $('bankStart').dataset.n = n;
    $('bankModal').hidden = false;
  }

  /* ---------------- رابط الإعداد ---------------- */
  function cfgLink() {
    var c = readCfg();
    var json = JSON.stringify({ c: c.count, l: c.level, s: c.scope, f: c.from, t: c.to, u: c.surahs, k: c.cats, m: c.time, p: c.pass, i: c.instant ? 1 : 0, o: c.order });
    var b64 = b64url(json);
    return location.origin + location.pathname + '#cfg=' + b64;
  }

  function applyHash() {
    var m = /#cfg=([^&]+)/.exec(location.hash || '');
    if (!m) return false;
    try {
      var o = JSON.parse(unb64url(m[1]));
      $('qCount').value = o.c || 15;
      $('qLevel').value = o.l || 0;
      $('qScope').value = o.s || 'all';
      if (o.f) $('qFrom').value = o.f;
      if (o.t) $('qTo').value = o.t;
      $('qTime').value = o.m || 0;
      $('qPass').value = o.p || 50;
      $('qInstant').value = o.i ? '1' : '0';
      $('qOrder').value = o.o || 'shuffle';
      if (o.u && o.u.length) {
        selSurahs = {};
        o.u.forEach(function (n) { selSurahs[n] = true; });
        DATA.forEach(function (s) {
          var b = document.querySelector('.ex-surah[data-n="' + s.n + '"]');
          if (b) b.classList.toggle(ON, !!selSurahs[s.n]);
        });
        countSel();
      }
      CAT_KEYS.forEach(function (k) { if ($('c_' + k)) $('c_' + k).checked = (o.k || []).indexOf(k) > -1; });
      syncScopeBoxes();
      return true;
    } catch (e) { return false; }
  }

  function copyLink() {
    var url = cfgLink();
    var done = function () { alert('تم نسخ رابط الاختبار:\n' + url); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt('انسخ الرابط:', url); });
    } else {
      window.prompt('انسخ الرابط:', url);
    }
  }

  /* ---------------- المظهر ---------------- */
  function measureTopbar() {
    var tb = document.querySelector('.topbar');
    if (tb) document.documentElement.style.setProperty('--topbar-h', tb.offsetHeight + 'px');
  }

  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    var b = $('themeBtn');
    if (b) b.textContent = dark ? '☀️' : '🌙';
    try { localStorage.setItem('juz_theme', dark ? 'dark' : 'light'); } catch (e) {}
  }

  /* ---------------- الربط ---------------- */
  function init() {
    buildPools();
    buildCatCheckboxes();
    buildSurahPickers();

    $('themeBtn').onclick = function () { applyTheme(!document.body.classList.contains('dark')); };
    try {
      if (localStorage.getItem('juz_theme') === 'dark') applyTheme(true);
    } catch (e) {}

    $('qScope').onchange = syncScopeBoxes;
    ['qCount', 'qLevel', 'qTime', 'qPass', 'qInstant', 'qOrder', 'qFrom', 'qTo'].forEach(function (id) {
      $(id).addEventListener('change', updatePoolInfo);
      $(id).addEventListener('input', updatePoolInfo);
    });
    document.querySelectorAll('.ex-quick .chip').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.ex-quick .chip').forEach(function (x) { x.classList.remove(ON); });
        b.classList.add(ON);
        $('qCount').value = b.dataset.q;
        updatePoolInfo();
      };
    });
    document.querySelectorAll('[data-sel]').forEach(function (b) {
      b.onclick = function () {
        var mode = b.dataset.sel;
        DATA.forEach(function (s) {
          var on = mode === 'all' ? true
            : mode === 'none' ? false
            : (s.type === 'makki' && mode === 'makki') || (s.type === 'madani' && mode === 'madani');
          selSurahs[s.n] = on;
          var el = document.querySelector('.ex-surah[data-n="' + s.n + '"]');
          if (el) el.classList.toggle(ON, on);
        });
        countSel();
        updatePoolInfo();
      };
    });

    $('setupForm').onsubmit = function (e) {
      e.preventDefault();
      startExam(readCfg(), null);
    };

    $('exPrev').onclick = function () { if (st.idx > 0) { st.idx--; renderQ(); } };
    $('exNext').onclick = function () { if (st.idx < st.qs.length - 1) { st.idx++; renderQ(); } };
    $('exFlag').onclick = function () { st.flags[st.idx] = !st.flags[st.idx]; renderQ(); };
    $('exQuit').onclick = function () {
      var left = st.qs.length - st.ans.filter(Boolean).length;
      if (left > 0 && !confirm('يوجد ' + left + ' سؤالاً بلا إجابة. هل تريد التسليم الآن؟')) return;
      finish('manual');
    };
    $('exPalette').onclick = function (e) {
      var b = e.target.closest('.pal');
      if (b) { st.idx = parseInt(b.dataset.i, 10); renderQ(); }
    };

    $('againBtn').onclick = function () { startExam(st.cfg, null); };
    $('newBtn').onclick = function () {
      clearInterval(st.timer);
      $('result').hidden = true;
      $('setup').hidden = false;
      window.scrollTo(0, 0);
      updatePoolInfo();
    };
    $('printBtn').onclick = function () { window.print(); };
    $('linkBtn').onclick = copyLink;
    $('linkBtn2').onclick = copyLink;
    $('resetCfg').onclick = function () {
      $('qCount').value = 15;
      $('qLevel').value = '0';
      $('qScope').value = 'all';
      $('qTime').value = '5';
      $('qPass').value = '50';
      $('qInstant').value = '1';
      $('qOrder').value = 'shuffle';
      CAT_KEYS.forEach(function (k) { if ($('c_' + k)) $('c_' + k).checked = true; });
      selSurahs = {};
      DATA.forEach(function (s) {
        var el = document.querySelector('.ex-surah[data-n="' + s.n + '"]');
        if (el) el.classList.remove(ON);
      });
      countSel();
      syncScopeBoxes();
    };

    document.querySelectorAll('[data-rev]').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('[data-rev]').forEach(function (x) { x.classList.remove(ON); });
        b.classList.add(ON);
        renderReview(b.dataset.rev);
      };
    });

    $('clearHist').onclick = function () {
      if (!confirm('مسح سجل المحاولات؟')) return;
      try { localStorage.removeItem('juz_exam_history'); } catch (e) {}
      renderStats();
    };

    $('bankFilter').addEventListener('click', function (e) {
      var b = e.target.closest('[data-bc]');
      if (!b) return;
      bankCat = b.dataset.bc;
      renderBank();
    });
    $('bankGrid').addEventListener('click', function (e) {
      var b = e.target.closest('.ex-preview');
      if (b) openBank(parseInt(b.dataset.n, 10));
    });
    $('bankClose').onclick = function () { $('bankModal').hidden = true; };
    $('bankClose2').onclick = function () { $('bankModal').hidden = true; };
    $('bankModal').onclick = function (e) { if (e.target === $('bankModal')) $('bankModal').hidden = true; };
    $('bankStart').onclick = function () {
      var n = parseInt($('bankStart').dataset.n, 10);
      $('bankModal').hidden = true;
      startExam(readCfg(), { n: n });
    };

    document.addEventListener('keydown', function (e) {
      if ($('exam').hidden || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (st.idx < st.qs.length - 1) { st.idx++; renderQ(); }
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        if (st.idx > 0) { st.idx--; renderQ(); }
      } else if (/^[1-4]$/.test(e.key)) {
        var b = $('exOpts').children[parseInt(e.key, 10) - 1];
        if (b && !b.disabled) b.click();
      }
    });

    var linked = applyHash();
    measureTopbar();
    window.addEventListener('resize', measureTopbar);
    renderStats();
    renderBank();
    updatePoolInfo();
    if (linked) {
      $('setup').scrollIntoView({ behavior: 'smooth' });
      alert('تم تحميل إعدادات الاختبار من الرابط — اضغط «ابدأ الاختبار».');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();