import { createStore } from './store.js';
import { runMigration } from './migrate.js';

// $ = un elemento, $$ = tutti
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 3 }).format(Number(n) || 0);
const fmtDate = iso => new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });

let store = createStore();
let items = [];
let movs  = [];
let filter = 'tutte';

/* ── Utente ── */
const USER_KEY  = 'cabb.user';
const ADMIN_KEY = 'cabb.admin';
const ADMIN_PW  = 'aditech';
const READ_KEY  = 'cabb.notif.read'; // set di id già letti

function getUser()  { return localStorage.getItem(USER_KEY) || ''; }
function isAdmin()  { return localStorage.getItem(ADMIN_KEY) === '1'; }

function setUser(name) {
  const n = name.trim();
  localStorage.setItem(USER_KEY, n);
  $('#userBadge').textContent = n;
  $('#userBadge').hidden = !n;
  const lbl = $('#currentUserLabel');
  if (lbl) lbl.textContent = n || '—';
}

function getReadSet() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY)) || []); } catch { return new Set(); }
}
function saveReadSet(s) { localStorage.setItem(READ_KEY, JSON.stringify([...s])); }

function initUser() {
  const name = getUser();
  if (name) { setUser(name); applyAdminUI(); return; }
  // primo accesso: mostra welcome overlay
  $('#welcomeScreen').hidden = false;
  $('#welcomeName').focus();
}

function confirmWelcome() {
  const name = $('#welcomeName').value.trim();
  if (!name) { $('#welcomeName').focus(); return; }
  setUser(name);
  $('#welcomeScreen').hidden = true;
  applyAdminUI();
  refresh();
}

$('#welcomeBtn').addEventListener('click', confirmWelcome);
$('#welcomeName').addEventListener('keydown', e => { if (e.key === 'Enter') confirmWelcome(); });

/* ── Admin ── */
function applyAdminUI() {
  const admin = isAdmin();
  $('#notifBtn').hidden = !admin;
  const lbl = $('#adminStatusLabel');
  const btn = $('#adminToggleBtn');
  if (lbl) {
    lbl.textContent = admin ? 'Abilitato' : 'Non abilitato';
    lbl.className   = admin ? 'enabled' : '';
  }
  if (btn) btn.textContent = admin ? 'Revoca' : 'Sblocca';
}

const adminDlg = $('#adminDialog');
$('#adminToggleBtn').addEventListener('click', () => {
  if (isAdmin()) {
    if (confirm('Vuoi revocare i privilegi amministratore su questo dispositivo?')) {
      localStorage.removeItem(ADMIN_KEY);
      applyAdminUI(); renderNotifications();
      toast('Accesso amministratore revocato');
    }
  } else {
    $('#adminPwInput').value = '';
    $('#adminPwError').style.display = 'none';
    adminDlg.showModal();
    setTimeout(() => $('#adminPwInput').focus(), 50);
  }
});
$('#adminCancelBtn').addEventListener('click', () => adminDlg.close());
$('#adminConfirmBtn').addEventListener('click', () => {
  if ($('#adminPwInput').value === ADMIN_PW) {
    localStorage.setItem(ADMIN_KEY, '1');
    adminDlg.close();
    applyAdminUI(); renderNotifications();
    toast('Accesso amministratore abilitato');
  } else {
    $('#adminPwError').style.display = 'block';
    $('#adminPwInput').value = '';
    $('#adminPwInput').focus();
  }
});
$('#adminPwInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#adminConfirmBtn').click(); });

/* ── Notifiche riordino (solo admin) ── */
function renderNotifications() {
  if (!isAdmin()) { closeNotifPanel(); return; }
  const read = getReadSet();
  // Gli articoli da riordinare NON ancora segnati come letti
  const pending = items.filter(it => isLow(it) && !read.has(it.id));
  // Aggiorna badge
  const badge = $('#notifBadge');
  badge.textContent = pending.length;
  badge.hidden = pending.length === 0;
  // Popola lista
  const list = $('#notifList');
  const empty = $('#notifEmpty');
  list.innerHTML = pending.map(it => `
    <li class="notif-item" data-id="${esc(it.id)}">
      <div class="notif-item-info">
        <div class="notif-item-title">${esc(label(it))}</div>
        <div class="notif-item-sub">Giacenza ${fmt(it.quantita)} · soglia ${fmt(it.scorta_minima)}</div>
      </div>
      <button class="notif-read-btn" data-id="${esc(it.id)}" aria-label="Segna come letta" title="Segna come letta">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </li>`).join('');
  empty.hidden = pending.length > 0;
}

function closeNotifPanel() {
  $('#notifPanel').hidden = true;
  $('#notifBackdrop').hidden = true;
}

$('#notifBtn').addEventListener('click', e => {
  e.stopPropagation();
  const panel = $('#notifPanel');
  const isOpen = !panel.hidden;
  panel.hidden = isOpen;
  $('#notifBackdrop').hidden = isOpen;
  if (!isOpen) renderNotifications();
});
$('#notifBackdrop').addEventListener('click', closeNotifPanel);

$('#notifList').addEventListener('click', e => {
  const btn = e.target.closest('.notif-read-btn');
  if (!btn) return;
  const read = getReadSet();
  read.add(btn.dataset.id);
  saveReadSet(read);
  renderNotifications();
});

$('#notifMarkAll').addEventListener('click', () => {
  const read = getReadSet();
  items.filter(isLow).forEach(it => read.add(it.id));
  saveReadSet(read);
  renderNotifications();
});

/* ── Utilità ── */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
}

const isLow = it => Number(it.scorta_minima) > 0 && Number(it.quantita) <= Number(it.scorta_minima);
const label  = it => `${it.larghezza} × ${it.altezza}`;

function setBadge(state, text) {
  const b = $('#syncBadge');
  b.className = 'badge ' + state; b.textContent = text;
}

/* ── Caricamento dati ── */
async function refresh(quiet = false) {
  try {
    [items, movs] = await Promise.all([store.listItems(), store.listMovements(300)]);
    setBadge(store.kind === 'supabase' ? 'online' : '', store.kind === 'supabase' ? 'condiviso' : 'locale');
    renderAll();
  } catch (e) {
    setBadge('error', 'errore');
    if (!quiet) toast('Errore dati: ' + String(e.message).slice(0, 80));
  }
}

/* ── Rendering ── */
function renderAll() { renderItems(); renderMoveSelect(); renderHistory(); renderUtilizzo(); renderNotifications(); }

function renderItems() {
  const q = $('#search').value.trim().toLowerCase();
  $('#totalCount').textContent   = items.length;
  $('#reorderCount').textContent = items.filter(isLow).length;

  const visible = items.filter(it =>
    (filter === 'tutte' || isLow(it)) &&
    (!q || (it.larghezza + 'x' + it.altezza).includes(q) ||
           (it.codice || '').toLowerCase().includes(q) ||
           (it.note   || '').toLowerCase().includes(q))
  );

  $('#emptyItems').hidden = visible.length > 0;

  const groups = {};
  for (const it of visible) {
    const k = it.altezza;
    (groups[k] = groups[k] || []).push(it);
  }
  const container = $('#itemGroups');
  container.innerHTML = '';
  Object.keys(groups).sort((a,b) => Number(a)-Number(b)).forEach(h => {
    const sec = document.createElement('div');
    sec.className = 'group-section';
    sec.innerHTML = `<div class="group-header">
      <span class="group-title">Altezza ${esc(h)} mm</span>
      <span class="group-count">${groups[h].length} up</span></div>`;
    for (const it of groups[h]) {
      const row = document.createElement('div');
      row.className = 'canal-row' + (isLow(it) ? ' low' : '');
      row.dataset.id = it.id;
      row.innerHTML = `
        <div class="canal-icon"></div>
        <div class="canal-info" data-action="edit">
          <span class="canal-label">${esc(label(it))}${isLow(it) ? '<span class="tag-bisogna">BISOGNA</span>' : ''}</span>
          <span class="canal-sub">L 2 m · soglia ${fmt(it.scorta_minima)}</span>
        </div>
        <div class="canal-stepper">
          <button class="step-btn" data-action="dec" aria-label="Diminuisci">−</button>
          <span class="step-val">${fmt(it.quantita)}</span>
          <button class="step-btn" data-action="inc" aria-label="Aumenta">+</button>
        </div>`;
      sec.appendChild(row);
    }
    container.appendChild(sec);
  });
}

/* ── Tab Utilizzo ── */
function renderMoveSelect() {
  const sel = $('#utilCanale'), cur = sel.value;
  sel.innerHTML = '<option value="">Tutte le canaline</option>' +
    items.map(it => `<option value="${esc(it.id)}">${esc(label(it))}</option>`).join('');
  if (cur) sel.value = cur;
}

$('#utilCanale').addEventListener('change', renderUtilizzo);
$('#utilPeriodo').addEventListener('change', renderUtilizzo);
$('#rConsegna').addEventListener('input', () => {
  localStorage.setItem('cabb.lead', $('#rConsegna').value);
  renderReorderTable();
});
$('#rSicurezza').addEventListener('input', () => {
  localStorage.setItem('cabb.safety', $('#rSicurezza').value);
  renderReorderTable();
});

// Applica valori lead/safety salvati dalla migrazione
(function applyLeadSafety() {
  const lead   = localStorage.getItem('cabb.lead');
  const safety = localStorage.getItem('cabb.safety');
  if (lead)   $('#rConsegna').value  = lead;
  if (safety) $('#rSicurezza').value = safety;
})();

function getFilteredMovs() {
  const days  = Number($('#utilPeriodo').value) || 90;
  const canId = $('#utilCanale').value;
  const since = Date.now() - days * 86400000;
  return movs.filter(m =>
    m.tipo === 'scarico' &&
    new Date(m.created_at).getTime() >= since &&
    (!canId || m.item_id === canId)
  );
}

function groupByWeek(list) {
  const weeks = {};
  for (const m of list) {
    const d = new Date(m.created_at);
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const mon = new Date(d); mon.setDate(d.getDate() - day); mon.setHours(0,0,0,0);
    const key = mon.toISOString().slice(0,10);
    weeks[key] = (weeks[key] || 0) + Number(m.qty);
  }
  return weeks;
}

function renderUtilizzo() {
  const filtered = getFilteredMovs();
  const days = Number($('#utilPeriodo').value) || 90;
  const weeks = groupByWeek(filtered);
  const allWeeks = [];
  const now = new Date(); now.setHours(0,0,0,0);
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const thisMon = new Date(now); thisMon.setDate(now.getDate() - dow);
  for (let w = Math.ceil(days / 7); w >= 0; w--) {
    const d = new Date(thisMon); d.setDate(thisMon.getDate() - w * 7);
    allWeeks.push(d.toISOString().slice(0,10));
  }
  const values   = allWeeks.map(k => weeks[k] || 0);
  const totale   = filtered.reduce((s, m) => s + Number(m.qty), 0);
  const perWeek  = days > 0 ? totale / (days / 7) : 0;
  const consegna = Number($('#rConsegna').value) || 0;
  const sicurezza= Number($('#rSicurezza').value) || 0;
  const perDay   = days > 0 ? totale / days : 0;
  const sogliaSugg = Math.ceil(perDay * (consegna + sicurezza));

  $('#uTotale').textContent   = totale;
  $('#uSettimana').textContent= perWeek.toFixed(1);
  $('#uSoglia').textContent   = sogliaSugg;
  drawChart(allWeeks, values);
  renderReorderTable();
}

function drawChart(labels, values) {
  const canvas = $('#usageChart');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth || 600;
  const H = 160;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const colBar   = '#3d9e96';
  const colMuted = cs.getPropertyValue('--muted').trim() || '#6b6b72';
  const colLine  = cs.getPropertyValue('--line').trim()  || '#e3e3e6';
  const padL=8,padR=8,padT=20,padB=28;
  const cW=W-padL-padR, cH=H-padT-padB;
  const max=Math.max(...values,1), n=labels.length;
  const barW=Math.max(4,Math.floor(cW/n)-4);
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle=colLine; ctx.lineWidth=1;
  for(let i=0;i<=3;i++){const y=padT+(cH/3)*i+.5;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();}
  for(let i=0;i<n;i++){
    const x=padL+(cW/n)*i+(cW/n-barW)/2;
    const bH=(values[i]/max)*cH; const y=padT+cH-bH;
    if(values[i]>0){
      ctx.fillStyle=colBar;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x,y,barW,bH,[3,3,0,0]); else ctx.rect(x,y,barW,bH);
      ctx.fill();
      ctx.fillStyle=colMuted; ctx.font='10px system-ui'; ctx.textAlign='center';
      ctx.fillText(values[i],x+barW/2,y-4);
    }
  }
  ctx.fillStyle=colMuted; ctx.font='9px system-ui'; ctx.textAlign='center';
  const step=Math.ceil(n/12);
  for(let i=0;i<n;i+=step){
    const d=new Date(labels[i]+'T00:00:00');
    ctx.fillText(d.getDate()+'/'+(d.getMonth()+1), padL+(cW/n)*i+cW/n/2, H-6);
  }
}

function renderReorderTable() {
  const days = Number($('#utilPeriodo').value) || 90;
  const consegna  = Number($('#rConsegna').value)  || 0;
  const sicurezza = Number($('#rSicurezza').value) || 0;
  const since = Date.now() - days * 86400000;
  $('#reorderTable').innerHTML = items.map(it => {
    const usati = movs.filter(m => m.tipo==='scarico' && m.item_id===it.id && new Date(m.created_at).getTime()>=since)
                      .reduce((s,m)=>s+Number(m.qty),0);
    const sugg = Math.ceil((usati/days)*(consegna+sicurezza));
    return `<tr>
      <td>${esc(label(it))}</td>
      <td class="num">${usati}</td>
      <td class="num">${it.scorta_minima}</td>
      <td class="num">${sugg}</td></tr>`;
  }).join('');
}

function renderHistory() {
  $('#histList').innerHTML = movs.map(m => {
    const out = m.tipo === 'scarico';
    return `<li class="hist">
      <div class="main">
        <div><strong>${esc(m.larghezza && m.altezza ? m.larghezza+'×'+m.altezza : (m.codice||''))}</strong></div>
        <div class="meta">${fmtDate(m.created_at)}${m.utente ? ' · <b>'+esc(m.utente)+'</b>' : ''}${m.note ? ' · '+esc(m.note) : ''}</div>
      </div>
      <div class="delta ${out?'out':'in'}">${out?'−':'+'}${fmt(m.qty)}</div>
    </li>`;
  }).join('');
  $('#emptyHist').hidden = movs.length > 0;
}

/* ── Schede ── */
function showTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.body.classList.toggle('on-magazzino', name === 'magazzino');
  history.replaceState(null, '', '#' + name);
  if (name === 'utilizzo') renderUtilizzo();
}
$$('.tabbar button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
showTab(['magazzino','utilizzo','storico','dati'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'magazzino');

/* ── Filtro e ricerca ── */
$$('.chip').forEach(c => c.addEventListener('click', () => {
  filter = c.dataset.filter;
  $$('.chip').forEach(x => x.classList.toggle('active', x === c));
  renderItems();
}));
$('#search').addEventListener('input', renderItems);

/* ── Stepper inline ── */
$('#itemGroups').addEventListener('click', async e => {
  const row = e.target.closest('.canal-row'); if (!row) return;
  const it = items.find(x => x.id === row.dataset.id); if (!it) return;
  const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
  if (action === 'inc' || action === 'dec') {
    const tipo = action === 'dec' ? 'scarico' : 'carico';
    if (tipo==='scarico' && Number(it.quantita)<1 && !confirm(`Giacenza a ${fmt(it.quantita)} pz: scendere sotto zero?`)) return;
    try {
      await store.registerMovement({ item_id:it.id, tipo, qty:1, note:'', utente:getUser() });
      toast(tipo==='scarico' ? '−1 registrato' : '+1 registrato'); refresh();
    } catch(err) { toast('Errore: '+String(err.message).slice(0,80)); }
    return;
  }
  if (action === 'edit') openMoveDialog(it);
});

/* ── Dialog carico/scarico ── */
const moveDlg = $('#moveDialog');
function openMoveDialog(it) {
  $('#moveDlgTitle').textContent = label(it);
  $('#moveDlgId').value   = it.id;
  $('#moveDlgQty').value  = 1;
  $('#moveDlgMin').value  = it.scorta_minima ?? 0;
  $('#moveDlgNote').value = '';
  moveDlg.showModal();
}
$('#moveDlgCancel').addEventListener('click', () => moveDlg.close());
$('#moveDlgSave').addEventListener('click', async () => {
  const id = $('#moveDlgId').value;
  const it = items.find(x => x.id === id); if (!it) return;
  const tipo   = $('input[name=dlgTipo]:checked').value;
  const qty    = Number($('#moveDlgQty').value);
  const newMin = Number($('#moveDlgMin').value);
  if (!(qty>0)) { toast('Inserisci una quantità valida'); return; }
  if (tipo==='scarico' && qty>Number(it.quantita) && !confirm(`Giacenza ${fmt(it.quantita)} pz: procedere?`)) return;
  try {
    await store.registerMovement({ item_id:id, tipo, qty, note:$('#moveDlgNote').value.trim(), utente:getUser() });
    if (newMin !== Number(it.scorta_minima)) await store.saveItem({...it, scorta_minima:newMin});
    moveDlg.close(); toast(tipo==='scarico'?'Prelievo registrato':'Carico registrato'); refresh();
  } catch(err) { toast('Errore: '+String(err.message).slice(0,80)); }
});

/* ── Dialog aggiungi/modifica canalina ── */
const dlg = $('#itemDialog');
function openItem(it) {
  $('#itemDialogTitle').textContent = it ? 'Modifica canalina' : 'Nuova canalina';
  $('#saveItem').textContent = it ? 'Salva' : 'Aggiungi';
  $('#itemId').value  = it?.id || '';
  $('#fLarg').value   = it?.larghezza ?? '';
  $('#fAlt').value    = it?.altezza ?? '';
  $('#fQty').value    = it?.quantita ?? 0;
  $('#fMin').value    = it?.scorta_minima ?? 0;
  $('#fCodice').value = it?.codice || '';
  $('#fNote').value   = it?.note || '';
  $('#deleteItem').hidden = !it;
  dlg.showModal();
}
$('#fab').addEventListener('click', () => openItem(null));
$('#saveItem').addEventListener('click', async () => {
  if (!$('#itemForm').reportValidity()) return;
  const larg = Number($('#fLarg').value), alt = Number($('#fAlt').value);
  const item = { id:$('#itemId').value||undefined, larghezza:larg, altezza:alt,
    codice:$('#fCodice').value.trim(), descrizione:`Canalina ${larg}×${alt}`,
    quantita:Number($('#fQty').value)||0, unita:'pz',
    scorta_minima:Number($('#fMin').value)||0, ubicazione:'', note:$('#fNote').value.trim() };
  try { await store.saveItem(item); dlg.close(); toast('Salvato'); refresh(); }
  catch(e) { toast('Errore: '+String(e.message).slice(0,80)); }
});
$('#deleteItem').addEventListener('click', async () => {
  const id = $('#itemId').value;
  if (!id || !confirm('Eliminare questa canalina?')) return;
  try { await store.deleteItem(id); dlg.close(); toast('Eliminata'); refresh(); }
  catch(e) { toast('Errore: '+String(e.message).slice(0,80)); }
});

/* ── Dati: cambio nome (usa dialog HTML invece di prompt) ── */
$('#changeNameBtn').addEventListener('click', () => {
  $('#renameInput').value = getUser();
  $('#renameDialog').showModal();
});
$('#renameCancelBtn').addEventListener('click', () => $('#renameDialog').close());
$('#renameSaveBtn').addEventListener('click', () => {
  const name = $('#renameInput').value.trim();
  if (!name) { toast('Il nome non può essere vuoto'); return; }
  setUser(name);
  $('#renameDialog').close();
  toast('Nome aggiornato');
});

/* ── Dati: condivisione ── */
$('#sbUrl').value = localStorage.getItem('cabb.sbUrl') || '';
$('#sbKey').value = localStorage.getItem('cabb.sbKey') || '';
$('#saveSync').addEventListener('click', async () => {
  const url=$('#sbUrl').value.trim(), key=$('#sbKey').value.trim();
  if (!url||!key) { $('#syncMsg').textContent='Inserisci URL e chiave.'; return; }
  localStorage.setItem('cabb.sbUrl',url); localStorage.setItem('cabb.sbKey',key);
  store = createStore();
  try { await store.listItems(); $('#syncMsg').textContent='Collegato: i dati ora sono condivisi.'; refresh(); }
  catch(e) { $('#syncMsg').textContent='Connessione non riuscita: '+String(e.message).slice(0,120); setBadge('error','errore'); }
});
$('#disconnectSync').addEventListener('click', () => {
  localStorage.removeItem('cabb.sbUrl'); localStorage.removeItem('cabb.sbKey');
  $('#sbUrl').value=''; $('#sbKey').value='';
  store=createStore(); $('#syncMsg').textContent='Scollegato: dati solo su questo dispositivo.'; refresh();
});

/* ── CSV export/import ── */
function download(name, text) {
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}));
  a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
const csvCell = v => { const s=String(v??''); return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
$('#exportItems').addEventListener('click', () => {
  download('magazzino.csv', ['larghezza;altezza;quantita;soglia_riordino;codice_abb;note',
    ...items.map(i=>[i.larghezza,i.altezza,i.quantita,i.scorta_minima,i.codice,i.note].map(csvCell).join(';'))].join('\n'));
});
$('#exportMoves').addEventListener('click', () => {
  download('storico.csv', ['data;canalina;tipo;quantita;utente;note',
    ...movs.map(m=>[m.created_at,(m.larghezza||'')+'x'+(m.altezza||''),m.tipo,m.qty,m.utente,m.note].map(csvCell).join(';'))].join('\n'));
});

function parseCsv(text) {
  const rows=[]; let row=[],cur='',q=false;
  text=text.replace(/^\ufeff/,'');
  const sep=(text.split('\n')[0].match(/;/g)||[]).length>=(text.split('\n')[0].match(/,/g)||[]).length?';':',';
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
    else if(c==='"')q=true;
    else if(c===sep){row.push(cur);cur='';}
    else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur='';}
    else if(c!=='\r')cur+=c;
  }
  if(cur||row.length){row.push(cur);rows.push(row);}
  return rows.filter(r=>r.some(x=>x.trim()));
}
$('#importFile').addEventListener('change', async e => {
  const f=e.target.files[0]; if(!f) return;
  try {
    const [head,...rows]=parseCsv(await f.text());
    const col=n=>head.map(h=>h.trim().toLowerCase()).indexOf(n);
    const idx={larghezza:col('larghezza'),altezza:col('altezza'),quantita:col('quantita'),
      soglia_riordino:col('soglia_riordino'),codice_abb:col('codice_abb'),note:col('note')};
    if(idx.larghezza<0||idx.altezza<0) throw new Error('colonne "larghezza" e "altezza" richieste');
    const num=v=>Number(String(v??'').replace(',','.'))||0;
    let n=0;
    for(const r of rows){
      const get=k=>(idx[k]>=0?(r[idx[k]]||'').trim():'');
      const larg=num(get('larghezza')),alt=num(get('altezza'));
      if(!larg||!alt) continue;
      const existing=items.find(x=>x.larghezza===larg&&x.altezza===alt);
      await store.saveItem({id:existing?.id,larghezza:larg,altezza:alt,
        descrizione:`Canalina ${larg}×${alt}`,quantita:num(get('quantita')),
        scorta_minima:num(get('soglia_riordino')),unita:'pz',ubicazione:'',
        codice:get('codice_abb'),note:get('note')});
      n++;
    }
    toast(`Importate ${n} righe`); refresh();
  } catch(err){ toast('Import non riuscito: '+err.message); }
  e.target.value='';
});

/* ── Condividi ── */
$('#shareBtn').addEventListener('click', async () => {
  const data={title:'Canaline ABB',text:'Apri la gestione stock canaline ABB',url:location.href.split('#')[0]};
  try { if(navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); toast('Link copiato'); } }
  catch{ /* annullato */ }
});

/* ── PWA ── */
let deferredInstall;
window.addEventListener('beforeinstallprompt', e=>{e.preventDefault();deferredInstall=e;$('#installCard').hidden=false;});
$('#installBtn').addEventListener('click', async ()=>{
  if(!deferredInstall) return;
  deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall=null; $('#installCard').hidden=true;
});
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});

/* ── Avvio ── */
runMigration();   // one-shot: non fa nulla se già eseguita
initUser();
if (getUser()) refresh();
setInterval(()=>{ if(store.kind==='supabase'&&!document.hidden&&!dlg.open&&!moveDlg.open) refresh(true); },20000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&store.kind==='supabase') refresh(true); });
