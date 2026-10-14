(() => {
  'use strict';
  const STORAGE_KEY = 'tellySharpLut_v1';
  const HEADER = ['telly_cost','telly_second_team','sharp_1','sharp_x','sharp_2'];
  const $ = (id) => document.getElementById(id);
  const entryGrid = $('entryGrid');
  let lut = loadStoredLut();

  function loadStoredLut() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(validLutRow) : [];
    } catch (_) { return []; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lut)); $('saveStatus').textContent = 'Saved on this device'; }
    catch (_) { $('saveStatus').textContent = 'Could not save'; }
    updateCount();
  }
  function validLutRow(row) {
    return Array.isArray(row) && row.length >= 5 && row.slice(0,5).every((v,i) => Number.isFinite(Number(v)) && (i < 2 ? Number.isInteger(Number(v)) : Number(v) > 0));
  }
  function showNotice(message, error=false) {
    const node = $('notice'); node.textContent = message; node.hidden = false; node.classList.toggle('error', error);
  }
  function clearNotice() { $('notice').hidden = true; $('notice').classList.remove('error'); }
  function updateCount() { $('lutCount').textContent = String(lut.length); }
  function makeField(label, name, type='number', step='any') {
    const wrapper = document.createElement('div'); wrapper.className = 'field';
    const id = `${name}`;
    const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label;
    const input = document.createElement('input'); input.id = id; input.name = name; input.type = type; input.step = step; input.autocomplete = 'off'; input.inputMode = 'decimal';
    input.placeholder = label.includes('Telly') ? 'Cost' : 'Odds';
    wrapper.append(lab,input); return wrapper;
  }
  for (let i=0;i<4;i++) {
    const card = document.createElement('div'); card.className = 'entry-card';
    const head = document.createElement('div'); head.className = 'entry-card-head';
    const title = document.createElement('strong'); title.textContent = `Match ${i+1}`;
    const hint = document.createElement('span'); hint.textContent = 'Telly + 1X2'; head.append(title,hint);
    const fields = document.createElement('div'); fields.className = 'fields';
    fields.append(makeField('Telly Home Cost',`m${i}_home`,'number','1'),makeField('Telly Away Cost',`m${i}_away`,'number','1'),makeField('Sharp 1',`m${i}_sharp1`),makeField('Sharp X',`m${i}_sharpx`),makeField('Sharp 2',`m${i}_sharp2`));
    card.append(head,fields); entryGrid.append(card);
  }
  function readMatches() {
    const matches=[];
    for(let i=0;i<4;i++) {
      const raw=['home','away','sharp1','sharpx','sharp2'].map(s=>$( `m${i}_${s}`).value.trim());
      if(raw.every(v=>v==='')) continue;
      if(!raw[0]&&!raw[1]) throw new Error(`Match ${i+1}: enter a Telly home or away cost.`);
      if(raw[0]!==''&&raw[1]!==''&&Number(raw[0])>0&&Number(raw[1])>0) throw new Error(`Match ${i+1}: enter a cost for only the favorite side; leave the other Telly field blank or 0.`);
      if(!raw.slice(2).every(v=>v!=='')) throw new Error(`Match ${i+1}: enter all three Sharp odds.`);
      const nums=raw.map((v,j)=>v===''?0:Number(v));
      if(!nums.every(Number.isFinite)) throw new Error(`Match ${i+1}: check the numeric values.`);
      if(!Number.isInteger(nums[0])||!Number.isInteger(nums[1])) throw new Error(`Match ${i+1}: Telly costs must be whole numbers.`);
      if(nums[0]<0||nums[1]<0||nums.slice(2).some(v=>v<=0)) throw new Error(`Match ${i+1}: Telly costs cannot be negative and Sharp odds must be greater than zero.`);
      if((nums[0]>0)===(nums[1]>0)) throw new Error(`Match ${i+1}: set exactly one Telly cost above zero.`);
      matches.push(nums);
    }
    return matches;
  }
  function trueProbFromOdds(odds) {
    const inv=odds.map(o=>1/o), total=inv.reduce((a,b)=>a+b,0);
    return inv.map(v=>v/total);
  }
  function getFavoriteData(rows) {
    const costs=[], probs=[];
    for(const row of rows) {
      const home=Number(row[0]), away=Number(row[1]);
      const cost=home>0?home:away, index=home>0?0:2;
      costs.push(cost); probs.push(trueProbFromOdds(row.slice(2,5))[index]);
    }
    return {costs,probs};
  }
  // Least-squares quadratic regression, matching np.polyfit(..., degree=2) in intent.
  // Center/scale x for numerical stability, then evaluate in scaled coordinates.
  function fitQuadratic(xs, ys) {
    if(xs.length<3 || new Set(xs).size<3) throw new Error('Quadratic regression needs at least 3 distinct Telly costs in the LUT. Add more historical entries.');
    const mean=xs.reduce((a,b)=>a+b,0)/xs.length;
    const scale=Math.sqrt(xs.reduce((a,x)=>a+(x-mean)**2,0)/xs.length);
    if(!scale) throw new Error('The LUT needs more than one distinct Telly cost.');
    const z=xs.map(x=>(x-mean)/scale);
    const A=[[0,0,0],[0,0,0],[0,0,0]], b=[0,0,0];
    for(let i=0;i<z.length;i++) {
      const v=[z[i]*z[i],z[i],1];
      for(let r=0;r<3;r++){ b[r]+=v[r]*ys[i]; for(let c=0;c<3;c++) A[r][c]+=v[r]*v[c]; }
    }
    const M=A.map((row,i)=>[...row,b[i]]);
    for(let col=0;col<3;col++) {
      let pivot=col; for(let r=col+1;r<3;r++) if(Math.abs(M[r][col])>Math.abs(M[pivot][col])) pivot=r;
      if(Math.abs(M[pivot][col])<1e-12) throw new Error('Could not fit the quadratic regression. Add more varied Telly costs.');
      [M[col],M[pivot]]=[M[pivot],M[col]];
      const div=M[col][col]; for(let c=col;c<4;c++) M[col][c]/=div;
      for(let r=0;r<3;r++) if(r!==col){ const f=M[r][col]; for(let c=col;c<4;c++) M[r][c]-=f*M[col][c]; }
    }
    const coef=M.map(row=>row[3]);
    return {mean,scale,coef,predict(x){const t=(x-mean)/scale;return coef[0]*t*t+coef[1]*t+coef[2];}};
  }
  function fmtPct(v){return `${(v*100).toFixed(2)}%`;}
  function fmtOdds(v){return Number(v).toLocaleString(undefined,{maximumFractionDigits:2});}
  function compare() {
    clearNotice();
    let matches; try {matches=readMatches();} catch(e){showNotice(e.message,true);return;}
    if(!matches.length){showNotice('Enter at least one match before comparing.',true);return;}
    let model; try {const d=getFavoriteData(lut);model=fitQuadratic(d.costs,d.probs);} catch(e){showNotice(e.message,true);return;}
    const results=$('results'); results.className='result-list'; results.replaceChildren();
    matches.forEach((row,i)=>{
      const home=row[0], away=row[1], cost=home>0?home:away, favIndex=home>0?0:2;
      const sharpProb=trueProbFromOdds(row.slice(2,5))[favIndex];
      const tellyProb=Math.min(Math.max(model.predict(cost),0.001),0.999);
      const ev=sharpProb*(1/tellyProb)-1;
      const diff=(tellyProb-sharpProb)*100;
      let comment, cls;
      if(diff>0.01){comment=`${cost.toLocaleString()} is too high by ${Math.abs(diff).toFixed(2)}%`;cls='bad';}
      else if(diff<-.01){comment=`${cost.toLocaleString()} is too cheap by ${Math.abs(diff).toFixed(2)}%`;cls='good';}
      else {comment=`${cost.toLocaleString()} is correctly priced.`;cls='neutral';}
      const card=document.createElement('article');card.className='result-card';
      const h=document.createElement('h3');h.textContent=`Match ${i+1} · Favorite cost ${cost.toLocaleString()}`;card.append(h);
      const lines=[['Telly probability',fmtPct(tellyProb)],['Sharp favorite probability',fmtPct(sharpProb)],['Difference',`${diff>0?'+':''}${diff.toFixed(2)} percentage points`],['Expected value (EV)',`${ev>=0?'+':''}${(ev*100).toFixed(2)}%`]];
      lines.forEach(([label,value])=>{const line=document.createElement('div');line.className='result-line';const l=document.createElement('span');l.textContent=label;const v=document.createElement('strong');v.textContent=value;line.append(l,v);card.append(line);});
      const p=document.createElement('p');p.className=`result-comment ${cls}`;p.textContent=comment;card.append(p);results.append(card);
    });
    $('resultsPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function addEntries() {
    clearNotice(); let matches;try{matches=readMatches();}catch(e){showNotice(e.message,true);return;}
    if(!matches.length){showNotice('There are no complete entries to add.',true);return;}
    const previous=lut.slice(-matches.length);
    if(previous.length===matches.length && JSON.stringify(previous)===JSON.stringify(matches)){showNotice('These entries match the most recent LUT entries; nothing was added.');return;}
    lut.push(...matches);persist();showNotice(`${matches.length} entr${matches.length===1?'y':'ies'} added to the LUT. Total: ${lut.length}.`);drawChart();
  }
  function csvEscape(v){const s=String(v);return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function exportCsv() {
    const content=[HEADER,...lut].map(row=>row.map(csvEscape).join(',')).join('\r\n');
    const blob=new Blob([content],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='lut_data.csv';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  function parseCsv(text) {
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++) {const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"'){quoted=true;}else if(c===','){row.push(field.trim());field='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(x=>x!==''))rows.push(row);row=[];field='';}else field+=c;}
    if(field!==''||row.length){row.push(field.trim());if(row.some(x=>x!==''))rows.push(row);} return rows;
  }
  $('importBtn').addEventListener('click',()=>$('csvFile').click());
  $('csvFile').addEventListener('change',async(e)=>{
    const file=e.target.files[0];if(!file)return;
    try {const rows=parseCsv(await file.text());if(!rows.length)throw new Error('The CSV file is empty.');
      const first=rows[0].map(s=>s.toLowerCase().replace(/^\ufeff/,''));const hasHeader=first[0].includes('telly')||first[2].includes('sharp');const data=hasHeader?rows.slice(1):rows;
      const imported=[];for(let i=0;i<data.length;i++){const r=data[i];if(r.length<5)throw new Error(`CSV row ${i+(hasHeader?2:1)} has fewer than 5 columns.`);const nums=r.slice(0,5).map(Number);if(!validLutRow(nums))throw new Error(`CSV row ${i+(hasHeader?2:1)} contains invalid values.`);if((nums[0]>0)===(nums[1]>0))throw new Error(`CSV row ${i+(hasHeader?2:1)} must have exactly one positive Telly cost.`);imported.push(nums);}
      if(!imported.length)throw new Error('No data rows were found.');
      if(!confirm(`Import ${imported.length} rows and replace the current LUT (${lut.length} rows)?`))return;
      lut=imported;persist();drawChart();showNotice(`Imported ${lut.length} rows from ${file.name}.`);
    } catch(err){showNotice(err.message||'Could not read that CSV file.',true);} finally {e.target.value='';}
  });
  $('exportBtn').addEventListener('click',exportCsv);
  $('addBtn').addEventListener('click',addEntries);
  $('compareBtn').addEventListener('click',compare);
  $('plotBtn').addEventListener('click',()=>{drawChart();$('chartPanel').scrollIntoView({behavior:'smooth',block:'start'});});
  $('clearInputsBtn').addEventListener('click',()=>{for(const input of entryGrid.querySelectorAll('input'))input.value='';clearNotice();$('results').className='empty-state';$('results').textContent='Enter Telly costs and all three Sharp odds, then select Compare Odds.';});
  $('clearLutBtn').addEventListener('click',()=>{if(!lut.length)return showNotice('The LUT is already empty.');if(confirm('Permanently clear the LUT saved in this browser? Export a backup first if needed.')){lut=[];persist();drawChart();showNotice('LUT cleared from this browser.');}});

  function drawChart() {
    const canvas=$('chart'),ctx=canvas.getContext('2d'),wrap=canvas.parentElement,rect=wrap.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);
    const w=rect.width,h=rect.height;ctx.clearRect(0,0,w,h);
    const msg=$('chartMessage');
    if(!lut.length){msg.hidden=false;msg.textContent='Add historical entries to the LUT to see the regression plot.';return;}
    let data=getFavoriteData(lut),model=null;try{model=fitQuadratic(data.costs,data.probs);msg.hidden=true;}catch(e){msg.hidden=false;msg.textContent=e.message;}
    const pad={l:48,r:15,t:15,b:36};const pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
    let xmin=Math.min(...data.costs),xmax=Math.max(...data.costs);if(xmin===xmax){xmin-=1;xmax+=1;}const ymin=0,ymax=1;
    const X=x=>pad.l+(x-xmin)/(xmax-xmin)*pw,Y=y=>pad.t+(1-(y-ymin)/(ymax-ymin))*ph;
    ctx.font='11px ui-sans-serif, sans-serif';ctx.lineWidth=1;ctx.strokeStyle='#293649';ctx.fillStyle='#9caabe';
    for(let j=0;j<=4;j++){const val=j/4,yy=Y(val);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.fillText(`${Math.round(val*100)}%`,4,yy+4);}
    for(let j=0;j<=4;j++){const val=xmin+(xmax-xmin)*j/4,xx=X(val);ctx.beginPath();ctx.moveTo(xx,pad.t);ctx.lineTo(xx,h-pad.b);ctx.stroke();ctx.fillText(Math.round(val).toLocaleString(),xx-12,h-12);}
    ctx.fillStyle='#71b7ff';for(let i=0;i<data.costs.length;i++){ctx.beginPath();ctx.arc(X(data.costs[i]),Y(data.probs[i]),3.5,0,Math.PI*2);ctx.fill();}
    if(model){ctx.strokeStyle='#ff7777';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();for(let i=0;i<=100;i++){const x=xmin+(xmax-xmin)*i/100,y=model.predict(x);if(i===0)ctx.moveTo(X(x),Y(y));else ctx.lineTo(X(x),Y(y));}ctx.stroke();ctx.setLineDash([]);}
    ctx.fillStyle='#9caabe';ctx.font='11px ui-sans-serif,sans-serif';ctx.fillText('Telly cost',Math.max(pad.l,w/2-22),h-1);
  }
  window.addEventListener('resize',drawChart);
  persist();drawChart();
})();
