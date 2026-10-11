const grid = document.getElementById('grid');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const countLabel = document.getElementById('countLabel');
let filter = 'all';
let query = '';

const getDone = () => JSON.parse(localStorage.getItem('juz_done') || '[]');
const setDone = (a) => localStorage.setItem('juz_done', JSON.stringify(a));

function render(){
  const done = getDone();
  let list = SURAHS.filter(s=>{
    if(filter==='makki' && s.type!=='makki') return false;
    if(filter==='madani' && s.type!=='madani') return false;
    if(filter==='done' && !done.includes(s.n)) return false;
    if(query && !(s.name.includes(query) || String(s.n).includes(query))) return false;
    return true;
  });
  countLabel.textContent = `عرض ${list.length} سورة`;
  grid.innerHTML = list.map(s=>{
    const isDone = done.includes(s.n);
    return `<article class="s-card ${isDone?'done':''}" onclick="openSurah(${s.n})">
      <div class="s-num">${s.n}</div>
      <div class="s-top">
        <span class="s-name">سورة ${s.name}</span>
        <span class="tag ${s.type}">${s.type==='makki'?'مكية':'مدنية'}</span>
      </div>
      <div class="s-meta">السورة رقم ${s.n} • ${s.ayat} آية</div>
      <div class="s-maqsad"><b>المقصد:</b> ${s.maqsad}</div>
      <div class="s-actions">
        <button class="btn primary" onclick="event.stopPropagation();openSurah(${s.n})">📖 تدبّر وعمل</button>
        <button class="btn check ${isDone?'done':''}" onclick="event.stopPropagation();toggleDone(${s.n})">${isDone?'✓ تم':'○ لم تتم'}</button>
      </div>
    </article>`;
  }).join('');
  document.getElementById('statDone').textContent = done.length;
  const bar = document.getElementById('bar');
  bar.style.width = (done.length/37*100)+'%';
  document.getElementById('progressLabel').textContent = `أنجزت ${done.length} من 37 سورة (${Math.round(done.length/37*100)}%)`;
}

window.toggleDone = (n)=>{
  let d = getDone();
  d = d.includes(n) ? d.filter(x=>x!==n) : [...d,n];
  setDone(d); render();
};

window.openSurah = (n)=>{
  const s = SURAHS.find(x=>x.n===n);
  const kal = Object.entries(s.kalimat||{}).map(([k,v])=>`<span><b>${k}:</b> ${v}</span>`).join('');
  modalBody.innerHTML = `
    <div class="m-head">
      <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
      <h2>سورة ${s.name}</h2>
      <p>${s.type==='makki'?'مكية':'مدنية'} • ${s.ayat} آية • السورة رقم ${s.n} من المصحف</p>
      <div class="m-tags"><span>${s.maqsad}</span></div>
    </div>
    <div class="qtext">${s.aya}</div>
    <div class="verse"><h4>معاني الكلمات</h4><div class="kalimat">${kal}</div></div>
    <div class="verse"><h4>التفسير المختصر (منهج تدبر وعمل)</h4><p>${s.tafsir}</p></div>
    <div class="verse"><h4>وقفات تدبرية</h4><ul>${s.tadabbur.map(t=>`<li>${t}</li>`).join('')}</ul></div>
    <div class="verse work"><h4>العمل بالآيات ✅</h4><ul>${s.amal.map(t=>`<li>${t}</li>`).join('')}</ul></div>
    <div class="verse taw"><h4>التوجيهات 🧭</h4><ul>${s.tawjih.map(t=>`<li>${t}</li>`).join('')}</ul></div>
    <div class="m-foot">
      <button class="btn primary" onclick="toggleDone(${s.n});openSurah(${s.n})">✔ سجّل تدبرها وانتقل للتالية ⟵</button>
      <button class="btn" onclick="closeModal()">إغلاق</button>
    </div>`;
  modal.classList.remove('hidden');
  document.body.style.overflow='hidden';
};
window.closeModal = ()=>{ modal.classList.add('hidden'); document.body.style.overflow=''; render(); };
document.getElementById('closeBtn').onclick = closeModal;
modal.onclick = (e)=>{ if(e.target===modal) closeModal(); };

searchInput.oninput = (e)=>{ query = e.target.value.trim(); render(); };
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); filter=b.dataset.f; render();
});
document.getElementById('resetBtn').onclick = ()=>{ if(confirm('إعادة تتبع الإنجاز؟')){ setDone([]); render(); } };
document.getElementById('themeBtn').onclick = (e)=>{
  document.body.classList.toggle('dark');
  e.target.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
};
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });
render();
