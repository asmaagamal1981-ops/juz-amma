// بنك أسئلة تلقائي من محتوى surahs-data.js
(function(){
const $ = (id)=>document.getElementById(id);
const setup=$('quizSetup'), card=$('quizCard'), result=$('quizResult');
if(!setup) return;
const shuffle=(a)=>[...a].sort(()=>Math.random()-.5);
const pick=(a,n)=>shuffle(a).slice(0,n);
const otherMaqsad=(ex,n)=>pick(SURAHS.filter(s=>s.n!==ex).map(s=>s.maqsad),n);
const otherNames=(ex,n)=>pick(SURAHS.filter(s=>s.n!==ex).map(s=>'سورة '+s.name),n);

function buildQuestions(count, mode){
  const qs=[];
  const pool = shuffle(SURAHS);
  let i=0;
  const types = mode==='mix' ? ['maqasad','kalimat','tadabbur','amal','info','type'] :
                mode==='maqasad' ? ['maqasad'] :
                mode==='kalimat' ? ['kalimat'] :
                mode==='tadabbur' ? ['tadabbur','amal'] : ['info','type'];
  while(qs.length<count){
    const s = pool[i % pool.length]; i++;
    const t = types[qs.length % types.length];
    if(t==='maqasad'){
      qs.push({cat:'مقصد السورة', q:`ما مقصد سورة ${s.name}؟`,
        opts:shuffle([s.maqsad, ...otherMaqsad(s.n,3)]), ans:s.maqsad,
        exp:`مقصد سورة ${s.name}: ${s.maqsad}`});
    }else if(t==='kalimat'){
      const keys=Object.keys(s.kalimat||{});
      if(!keys.length) continue;
      const k=keys[Math.floor(Math.random()*keys.length)];
      const others=shuffle(SURAHS.filter(x=>x.n!==s.n).flatMap(x=>Object.values(x.kalimat||{}))).slice(0,3);
      qs.push({cat:'معاني الكلمات', q:`في سورة ${s.name}: ما معنى «${k}»؟`,
        opts:shuffle([s.kalimat[k],...others]), ans:s.kalimat[k], exp:`«${k}» = ${s.kalimat[k]}`});
    }else if(t==='tadabbur'){
      const correct=s.tadabbur[Math.floor(Math.random()*s.tadabbur.length)];
      const distract=pick(SURAHS.filter(x=>x.n!==s.n).flatMap(x=>x.tadabbur),3);
      qs.push({cat:'وقفة تدبرية', q:`أي وقفة تدبرية مستنبطة من سورة ${s.name}؟`,
        opts:shuffle([correct,...distract]), ans:correct, exp:`راجع بطاقة سورة ${s.name} قسم الوقفات التدبرية.`});
    }else if(t==='amal'){
      const correct=s.amal[Math.floor(Math.random()*s.amal.length)];
      const distract=pick(SURAHS.filter(x=>x.n!==s.n).flatMap(x=>x.amal),3);
      qs.push({cat:'العمل بالآيات', q:`عملٌ صحيح مستفاد من سورة ${s.name}:`,
        opts:shuffle([correct,...distract]), ans:correct, exp:`راجع قسم العمل بالآيات في سورة ${s.name}.`});
    }else if(t==='type'){
      const correct=s.type==='makki'?'مكية':'مدنية';
      const isTrueQ = Math.random()<.5;
      if(isTrueQ){
        const guess = Math.random()<.5 ? 'مكية':'مدنية';
        qs.push({cat:'مكية أم مدنية', q:`سورة ${s.name} سورة ${guess}؟`, opts:['صحيح','خطأ'],
          ans:(guess===correct?'صحيح':'خطأ'), exp:`سورة ${s.name} ${correct} (${s.ayat} آية).`});
      }else{
        qs.push({cat:'مكية أم مدنية', q:`سورة ${s.name}...؟`, opts:shuffle(['مكية','مدنية']),
          ans:correct, exp:`سورة ${s.name} ${correct}.`});
      }
    }else{ // info
      const sub=Math.random();
      if(sub<.4){
        const others=pick(SURAHS.filter(x=>x.n!==s.n && x.ayat!==s.ayat).map(x=>String(x.ayat)+' آية'),3);
        qs.push({cat:'عدد الآيات', q:`كم عدد آيات سورة ${s.name}؟`,
          opts:shuffle([s.ayat+' آية',...others]), ans:s.ayat+' آية', exp:`سورة ${s.name}: ${s.ayat} آية.`});
      }else if(sub<.7){
        const others=otherNames(s.n,3);
        qs.push({cat:'ترتيب السور', q:`ما السورة رقم ${s.n} في المصحف؟`,
          opts:shuffle(['سورة '+s.name,...others]), ans:'سورة '+s.name, exp:`السورة رقم ${s.n} هي سورة ${s.name}.`});
      }else{
        qs.push({cat:'الآية المفتاحية', q:`أي آية من سورة ${s.name}؟`,
          opts:shuffle([s.aya, ...pick(SURAHS.filter(x=>x.n!==s.n).map(x=>x.aya),3)]), ans:s.aya, exp:`احفظ مفتتح سورة ${s.name}.`});
      }
    }
  }
  return qs;
}

let questions=[], idx=0, score=0, answers=[];
function showBest(){
  const b=JSON.parse(localStorage.getItem('juz_quiz_best')||'null');
  $('bestScore').textContent = b ? `🏆 أفضل نتيجة لك: ${b.score}/${b.total}` : 'لم تخض أي اختبار بعد — ابدأ الآن ✦';
}
showBest();

$('startQuiz').onclick=()=>{
  questions=buildQuestions(parseInt($('qCount').value), $('qMode').value);
  idx=0; score=0; answers=[];
  setup.classList.add('hidden'); result.classList.add('hidden'); card.classList.remove('hidden');
  showQ();
  document.getElementById('quiz').scrollIntoView({behavior:'smooth'});
};
function showQ(){
  const q=questions[idx];
  $('qNum').textContent=`السؤال ${idx+1} / ${questions.length}`;
  $('qCat').textContent=q.cat;
  $('qScore').textContent=`النقاط: ${score}`;
  $('qBar').style.width=(idx/questions.length*100)+'%';
  $('qText').textContent=q.q;
  $('qFeed').textContent=''; $('qFeed').className='q-feed';
  $('nextQ').disabled=true;
  $('qOpts').innerHTML='';
  q.opts.forEach(op=>{
    const b=document.createElement('button');
    b.className='q-opt'; b.textContent=op;
    b.onclick=()=>answer(b,op);
    $('qOpts').appendChild(b);
  });
}
function answer(btn,op){
  const q=questions[idx];
  const ok = op===q.ans;
  if(ok) score++;
  answers.push({q:q.q, mine:op, ans:q.ans, ok, exp:q.exp});
  [...$('qOpts').children].forEach(b=>{
    b.disabled=true;
    if(b.textContent===q.ans) b.classList.add('correct');
    else if(b===btn && !ok) b.classList.add('wrong');
  });
  const f=$('qFeed');
  f.textContent=(ok?'✔ أحسنت! ':'✘ إجابة غير صحيحة. ')+q.exp;
  f.className='q-feed '+(ok?'ok':'no');
  $('qScore').textContent=`النقاط: ${score}`;
  $('qBar').style.width=((idx+1)/questions.length*100)+'%';
  $('nextQ').disabled=false;
  $('nextQ').textContent = idx===questions.length-1 ? 'عرض النتيجة ✓' : 'التالي ⟵';
}
$('nextQ').onclick=()=>{
  if(idx<questions.length-1){ idx++; showQ(); }
  else finish();
};
$('quitQ').onclick=finish;
function finish(){
  card.classList.add('hidden'); result.classList.remove('hidden');
  const pct=Math.round(score/questions.length*100);
  const msg = pct>=90?'ممتاز! تدبر راسخ 🌟':pct>=70?'أحسنت! واصل التقدم 💪':pct>=50?'جيد، راجع السور وأعد المحاولة 📖':'لا بأس! راجع البطاقات ثم أعد الاختبار 🤲';
  const prev=JSON.parse(localStorage.getItem('juz_quiz_best')||'null');
  if(!prev || score>prev.score) localStorage.setItem('juz_quiz_best', JSON.stringify({score,total:questions.length}));
  showBest();
  result.innerHTML=`<div class="res-circle">${score}/${questions.length}</div>
    <h3>${msg}</h3><p>نسبتك: ${pct}%</p>
    <div class="res-btns"><button class="btn-gold" onclick="location.reload()">🔄 اختبار جديد</button>
    <button class="btn" id="reviewBtn">مراجعة الإجابات</button></div>
    <div id="review" class="review hidden">${answers.map((a,i)=>`<div class="rev ${a.ok?'ok':'no'}"><b>${i+1}. ${a.q}</b><br>إجابتك: ${a.mine} ${a.ok?'✔':'✘'}<br>الصحيح: ${a.ans}<br><small>${a.exp}</small></div>`).join('')}</div>`;
  $('reviewBtn').onclick=()=>$('review').classList.toggle('hidden');
  result.scrollIntoView({behavior:'smooth'});
}
})();
