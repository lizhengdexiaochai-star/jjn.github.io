/* =====================================================
   商机管家 - 客户 · 商机 · 跟进记录管理
   数据保存在浏览器本地 localStorage，可导出 JSON 备份
   ===================================================== */
'use strict';

/* ==================== 运行错误可视化（页面会直接显示错误，便于诊断） ==================== */
function showFatal(msg){
  try{
    const el = document.getElementById('js-error');
    if(el){
      el.hidden = false;
      el.textContent = '⚠️ 应用运行出错：' + msg;
    }
  }catch(e){}
}
window.addEventListener('error', function(e){
  showFatal((e.message || e.type || '未知错误') + (e.lineno ? '（第 ' + e.lineno + ' 行）' : ''));
});

/* ==================== 常量 ==================== */
const DB_KEY = 'shangji-crm-db-v1';
const STAGES = [
  {id:'lead',  name:'线索', cls:'st-lead'},
  {id:'need',  name:'需求', cls:'st-need'},
  {id:'intent',name:'意向', cls:'st-intent'},
  {id:'plan',  name:'方案', cls:'st-plan'},
  {id:'quote', name:'报价', cls:'st-quote'},
  {id:'bid',   name:'投标', cls:'st-bid'},
  {id:'deal',  name:'签单', cls:'st-deal'},
  {id:'lost',  name:'输单', cls:'st-lost'}
];
const ACTIVE_STAGES = STAGES.slice(0, 7); // 线索 → 签单
const RECORD_TYPES = ['电话', '微信', '拜访', '邮件', '其他'];
const LEVELS = [['A','A · 重点客户'], ['B','B · 普通客户'], ['C','C · 潜力客户']];
const SOURCES = ['网络搜索','老客户转介绍','展会','电话开发','广告投放','合作伙伴','其他'];
const INDUSTRIES = ['制造业','贸易','软件/互联网','金融','教育','医疗','建筑/地产','物流','其他'];

/* ==================== 数据 ==================== */
let db = loadDB();
const state = {
  page: 'home',
  custQuery: '', oppQuery: '', oppStage: 'all',
  recQuery: '', recType: 'all'
};

function emptyDB(){ return {customers: [], opps: [], records: []}; }
function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(!raw) return emptyDB();
    const d = JSON.parse(raw);
    if(!d || !Array.isArray(d.customers) || !Array.isArray(d.opps) || !Array.isArray(d.records)) return emptyDB();
    return d;
  }catch(e){ return emptyDB(); }
}
function save(){
  try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  catch(e){ toast('保存失败：' + e.message); }
}

/* 导入数据净化：强制合法 id、补全字段、校正阶段值（防恶意/损坏的备份文件） */
function sanitizeImported(d){
  const okId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
  [d.customers, d.opps, d.records].forEach(arr => {
    const seen = {};
    (arr || []).forEach(x => {
      if(!x || typeof x !== 'object') return;
      if(!okId(x.id) || seen[x.id]) x.id = uid();
      seen[x.id] = 1;
    });
  });
  (d.opps || []).forEach(o => {
    if(!STAGES.some(s => s.id === o.stage)) o.stage = 'lead';
  });
  (d.records || []).forEach(r => {
    r.followDone = !!r.followDone;
  });
  return d;
}

/* ==================== 工具函数 ==================== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function uid(){
  return (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
    ('id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
}
function pad2(n){ n = String(n); return n.length < 2 ? '0' + n : n; }
function todayStr(){
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
}
function nowStr(){
  const d = new Date();
  return todayStr() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function dstr(offset){
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
}
function fmtDT(s){ return s ? String(s).replace('T', ' ') : '—'; }
function daysUntil(dateStr){ return Math.round((new Date(dateStr + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000); }
function fmtMoney(n){
  if(n == null || n === '') return '—';
  const v = Number(n);
  if(isNaN(v)) return '—';
  return '¥' + v.toLocaleString('zh-CN');
}
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
function stageById(id){ return STAGES.find(s => s.id === id) || STAGES[0]; }
function custById(id){ return db.customers.find(c => c.id === id); }
function oppById(id){ return db.opps.find(o => o.id === id); }
function custName(id){ const c = custById(id); return c ? c.name : '（已删除客户）'; }
function show(el){ if(el) el.hidden = false; }
function hide(el){ if(el) el.hidden = true; }

/* ==================== 提示 ==================== */
let toastTimer = null;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  show(t);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ==================== 页面切换 ==================== */
function showPage(name){
  state.page = name;
  $$('.page').forEach(p => hide(p));
  show($('#page-' + name));
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  $('#pageTitle').textContent = $('#page-' + name).dataset.title;
  $('#fab').hidden = !['home','customers','opps','records'].includes(name);
  renderAll();
  window.scrollTo(0, 0);
  if((location.hash || '') !== '#/' + name) location.hash = '#/' + name;
}

function renderAll(){
  renderHome();
  renderCustomers();
  renderOpps();
  renderRecords();
  renderMore();
}

/* ==================== 待跟进任务 ==================== */
function getTasks(){
  const list = [];
  for(const r of db.records){
    if(!r.nextDate || r.followDone) continue;
    const cust = custById(r.customerId);
    if(!cust) continue;
    list.push({r, cust, diff: daysUntil(r.nextDate)});
  }
  return list.sort((a, b) => a.r.nextDate.localeCompare(b.r.nextDate));
}
function customersWithoutRecords(){
  return db.customers.filter(c => !db.records.some(r => r.customerId === c.id));
}

/* ==================== 首页 ==================== */
function statCard(label, val, color){
  return '<div class="stat"><div class="stat-v" style="color:' + color + '">' +
    esc(String(val)) + '</div><div class="stat-l">' + label + '</div></div>';
}
function taskRow(t){
  const d = t.diff;
  const lbl = d < 0 ? ('逾期 ' + (-d) + ' 天') : (d === 0 ? '今天' : (d === 1 ? '明天' : (d + ' 天后')));
  const cls = d < 0 ? 'tag-red' : (d === 0 ? 'tag-orange' : 'tag-slate');
  const brief = t.r.content ? String(t.r.content).slice(0, 30) : '（无内容）';
  return '<div class="task-row">' +
    '<div class="task-main" data-open="' + esc(t.cust.id) + '">' +
      '<div class="task-name">' + esc(t.cust.name) + '</div>' +
      '<div class="task-sub">' + esc(brief) + ' · 下次跟进 ' + esc(t.r.nextDate) + '</div>' +
    '</div>' +
    '<span class="tag ' + cls + '">' + lbl + '</span>' +
    '<button class="mini-btn primary" data-follow="' + esc(t.cust.id) + '">跟进</button>' +
    '<button class="mini-btn ghost" data-done="' + esc(t.r.id) + '">完成</button>' +
  '</div>';
}
function renderHome(){
  const el = $('#page-home');
  const month = todayStr().slice(0, 7);
  const active = db.opps.filter(o => o.stage !== 'deal' && o.stage !== 'lost');
  const tasks = getTasks();
  const due = tasks.filter(t => t.diff <= 0);
  const up = tasks.filter(t => t.diff > 0 && t.diff <= 7);
  const never = customersWithoutRecords();
  const dealAmt = db.opps
    .filter(o => o.stage === 'deal' && (o.winDate || '').slice(0, 7) === month)
    .reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const maxCount = Math.max(1, ...ACTIVE_STAGES.map(s => db.opps.filter(o => o.stage === s.id).length));

  let h = '';
  h += '<div class="stats-grid">' +
    statCard('客户', db.customers.length, '#2563eb') +
    statCard('商机进行中', active.length, '#7c3aed') +
    statCard('待跟进', due.length, '#dc2626') +
    statCard('本月签单金额', dealAmt ? fmtMoney(dealAmt) : '¥0', '#16a34a') +
  '</div>';

  h += '<div class="quick-actions">' +
    '<button class="qa qa-blue" data-qa="customer"><span class="qa-ico">👤</span>新增客户</button>' +
    '<button class="qa qa-violet" data-qa="opp"><span class="qa-ico">🎯</span>新增商机</button>' +
    '<button class="qa qa-green" data-qa="record"><span class="qa-ico">📝</span>新增跟进</button>' +
  '</div>';

  h += '<div class="card"><div class="card-title">商机漏斗 <span class="muted">点按查看</span></div>';
  ACTIVE_STAGES.forEach(s => {
    const list = db.opps.filter(o => o.stage === s.id);
    const amt = list.reduce((x, o) => x + (Number(o.amount) || 0), 0);
    const w = Math.max(3, Math.round(list.length / maxCount * 100));
    h += '<button class="funnel-row" data-funnel="' + s.id + '">' +
      '<span class="funnel-name ' + s.cls + '">' + s.name + '</span>' +
      '<span class="funnel-bar"><i class="' + s.cls + '" style="width:' + w + '%"></i></span>' +
      '<span class="funnel-num"><b>' + list.length + '</b><em>' + (amt ? fmtMoney(amt) : '') + '</em></span>' +
    '</button>';
  });
  h += '</div>';

  h += '<div class="card"><div class="card-title">待跟进 <span class="muted">' + due.length + ' 项</span></div>';
  if(!due.length) h += '<div class="empty">🎉 暂无待跟进任务</div>';
  due.slice(0, 20).forEach(t => { h += taskRow(t); });
  if(up.length){
    h += '<div class="card-title" style="margin-top:12px">7天内即将跟进 <span class="muted">' + up.length + ' 项</span></div>';
    up.slice(0, 10).forEach(t => { h += taskRow(t); });
  }
  h += '</div>';

  if(never.length){
    h += '<div class="card"><div class="card-title">从未跟进 <span class="muted">' + never.length + ' 个客户</span></div>' +
      '<div class="never-list">' +
      never.slice(0, 5).map(c => '<span class="never-chip" data-open="' + esc(c.id) + '">' + esc(c.name) + '</span>').join('') +
      (never.length > 5 ? '<span class="muted">等 ' + never.length + ' 个</span>' : '') +
      '</div></div>';
  }

  el.innerHTML = h;
}

/* ==================== 客户列表 ==================== */
function renderCustomers(){
  const q = state.custQuery.trim().toLowerCase();
  let list = db.customers.slice();
  if(q) list = list.filter(c =>
    ((c.name || '') + ' ' + (c.company || '') + ' ' + (c.contact || '') + ' ' + (c.phone || '')).toLowerCase().includes(q));
  list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const el = $('#custList');
  if(!list.length){
    el.innerHTML = '<div class="empty">' + (q ? '没有匹配的客户' : '还没有客户，点右下角 + 添加第一个客户') + '</div>';
    return;
  }
  el.innerHTML = list.map(c => {
    const opps = db.opps.filter(o => o.customerId === c.id);
    const activeN = opps.filter(o => o.stage !== 'deal' && o.stage !== 'lost').length;
    const recs = db.records.filter(r => r.customerId === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const lastRec = recs[0];
    const t = getTasks().filter(x => x.cust.id === c.id).sort((a, b) => a.diff - b.diff)[0];
    const lvl = LEVELS.find(l => l[0] === c.level);
    return '<div class="item" data-open="' + esc(c.id) + '">' +
      '<div class="cust-top">' +
        '<div class="avatar">' + esc((c.name || '?').slice(0, 1)) + '</div>' +
        '<div class="cust-info">' +
          '<div class="cust-name">' + esc(c.name) + (lvl ? '<span class="lvl lvl-' + lvl[0] + '">' + lvl[0] + '</span>' : '') + '</div>' +
          '<div class="cust-sub">' + esc([c.company, c.contact, c.phone].filter(Boolean).join(' · ') || '未填写详细信息') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cust-tags">' +
        (activeN ? '<span class="tag tag-blue">' + activeN + ' 个商机进行中</span>' : '') +
        (lastRec ? '<span class="tag tag-slate">最近跟进 ' + esc(String(lastRec.date).slice(0, 10)) + '</span>' : '') +
        (t ? '<span class="tag ' + (t.diff <= 0 ? 'tag-red' : (t.diff <= 7 ? 'tag-orange' : 'tag-slate')) + '">下次 ' + esc(t.r.nextDate) + '</span>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

/* ==================== 商机列表 ==================== */
function renderOpps(){
  const chips = $('#oppStageChips');
  chips.innerHTML = [['all', '全部']].concat(STAGES.map(s => [s.id, s.name])).map(pair => {
    const id = pair[0], name = pair[1];
    const n = id === 'all' ? db.opps.length : db.opps.filter(o => o.stage === id).length;
    return '<button class="chip' + (state.oppStage === id ? ' active' : '') + '" data-stage="' + id + '">' + name + '<i>' + n + '</i></button>';
  }).join('');

  let list = db.opps.slice();
  if(state.oppStage !== 'all') list = list.filter(o => o.stage === state.oppStage);
  const q = state.oppQuery.trim().toLowerCase();
  if(q) list = list.filter(o => (o.name + ' ' + custName(o.customerId)).toLowerCase().includes(q));
  list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const el = $('#oppList');
  if(!list.length){
    el.innerHTML = '<div class="empty">暂无商机，点右下角 + 添加</div>';
    return;
  }
  el.innerHTML = list.map(o => {
    const s = stageById(o.stage);
    const idx = STAGES.indexOf(s);
    const dots = s.id === 'lost' ? '' :
      '<div class="dots">' + ACTIVE_STAGES.map((st, i) =>
        '<i class="dot' + (i <= idx ? ' on' : '') + (st.id === 'deal' ? ' dot-deal' : '') + '"></i>').join('') + '</div>';
    let btns = '';
    if(s.id !== 'lead' && s.id !== 'lost') btns += '<button class="mini-btn ghost" data-prev="' + esc(o.id) + '">上一阶段</button>';
    if(s.id !== 'deal' && s.id !== 'lost') btns += '<button class="mini-btn primary" data-next="' + esc(o.id) + '">' + (s.id === 'bid' ? '签单' : '下一阶段') + '</button>';
    if(s.id === 'lost') btns += '<button class="mini-btn" data-reopen="' + esc(o.id) + '">↩ 移回线索</button>';
    return '<div class="item" data-opp="' + esc(o.id) + '">' +
      '<div class="opp-top"><span class="st-badge ' + s.cls + '">' + s.name + '</span>' +
      '<span class="opp-name">' + esc(o.name) + '</span></div>' +
      '<div class="opp-cust">客户：' + esc(custName(o.customerId)) + '</div>' +
      '<div class="opp-meta">' +
        '<span class="opp-amt">' + fmtMoney(o.amount) + '</span>' +
        (o.expectDate ? '<span class="tag tag-slate">预计 ' + esc(o.expectDate) + '</span>' : '') +
        (o.winDate ? '<span class="tag tag-green">签单 ' + esc(o.winDate) + '</span>' : '') +
      '</div>' +
      '<div class="opp-foot">' + dots + '<div class="opp-btns">' + btns + '</div></div>' +
    '</div>';
  }).join('');
}

/* 商机阶段推进 / 回退 */
function moveOpp(oppId, dir){
  const o = oppById(oppId);
  if(!o || o.stage === 'lost') return;
  const cur = stageById(o.stage);
  let idx = STAGES.findIndex(s => s.id === o.stage);
  if(idx < 0) idx = 0;
  let ni = idx + dir;
  if(ni > 6) ni = 6;   // 6 = 签单
  if(ni < 0) ni = 0;
  const to = STAGES[ni];
  if(to.id === cur.id) return;
  o.history = o.history || [];
  o.history.push({at: nowStr(), from: cur.name, to: to.name});
  o.stage = to.id;
  o.updatedAt = nowStr();
  if(to.id === 'deal' && !o.winDate) o.winDate = todayStr();
  save();
  renderAll();
  if(to.id === 'deal') toast('🎉 恭喜签单：' + o.name);
  else toast('已推进：' + cur.name + ' → ' + to.name);
}

/* ==================== 跟进记录列表 ==================== */
function renderRecords(){
  const chips = $('#recTypeChips');
  chips.innerHTML = [['all', '全部']].concat(RECORD_TYPES.map(t => [t, t])).map(pair => {
    const id = pair[0], name = pair[1];
    const n = id === 'all' ? db.records.length : db.records.filter(r => r.type === id).length;
    return '<button class="chip' + (state.recType === id ? ' active' : '') + '" data-type="' + id + '">' + name + '<i>' + n + '</i></button>';
  }).join('');

  let list = db.records.slice();
  if(state.recType !== 'all') list = list.filter(r => r.type === state.recType);
  const q = state.recQuery.trim().toLowerCase();
  if(q) list = list.filter(r => (r.content + ' ' + custName(r.customerId)).toLowerCase().includes(q));
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const el = $('#recList');
  if(!list.length){
    el.innerHTML = '<div class="empty">暂无跟进记录，点右下角 + 添加</div>';
    return;
  }
  el.innerHTML = list.map(r => {
    const o = r.oppId ? oppById(r.oppId) : null;
    let dueBadge = '';
    if(r.nextDate){
      if(r.followDone) dueBadge = '<span class="tag tag-slate">已跟进</span>';
      else dueBadge = '<span class="tag ' + (daysUntil(r.nextDate) <= 0 ? 'tag-red' : 'tag-orange') + '">下次 ' + esc(r.nextDate) + '</span>';
    }
    return '<div class="item" data-rec="' + esc(r.id) + '">' +
      '<div class="rec-head"><span class="type-badge">' + esc(r.type || '其他') + '</span>' +
      '<span class="rec-cust">' + esc(custName(r.customerId)) + (o ? '<em> · ' + esc(o.name) + '</em>' : '') + '</span></div>' +
      '<div class="rec-content">' + esc(r.content) + '</div>' +
      '<div class="rec-foot"><span class="muted">' + fmtDT(r.date) + '</span>' + dueBadge + '</div>' +
    '</div>';
  }).join('');
}

/* ==================== 我的 ==================== */
function renderMore(){
  const month = todayStr().slice(0, 7);
  const newC = db.customers.filter(c => (c.createdAt || '').startsWith(month)).length;
  const newO = db.opps.filter(o => (o.createdAt || '').startsWith(month)).length;
  const newR = db.records.filter(r => (r.createdAt || '').startsWith(month)).length;
  const deals = db.opps.filter(o => o.stage === 'deal');
  const dealAmt = deals.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const lostN = db.opps.filter(o => o.stage === 'lost').length;

  $('#moreBody').innerHTML =
    '<div class="card"><div class="card-title">本月统计</div>' +
      '<div class="kv"><span>新增客户</span><b>' + newC + '</b></div>' +
      '<div class="kv"><span>新增商机</span><b>' + newO + '</b></div>' +
      '<div class="kv"><span>新增跟进记录</span><b>' + newR + '</b></div>' +
      '<div class="kv"><span>累计签单</span><b>' + deals.length + ' 单 / ' + fmtMoney(dealAmt) + '</b></div>' +
      '<div class="kv"><span>输单</span><b>' + lostN + '</b></div>' +
    '</div>' +
    '<div class="card"><div class="card-title">数据备份</div>' +
      '<button class="row-btn" id="btnExport"><span>💾</span>导出数据备份（JSON）<em>›</em></button>' +
      '<button class="row-btn" id="btnImport"><span>📥</span>导入数据备份（JSON）<em>›</em></button>' +
      '<button class="row-btn" id="btnCsv"><span>📊</span>导出客户表格（Excel/CSV）<em>›</em></button>' +
    '</div>' +
    '<div class="card"><div class="card-title">演示</div>' +
      '<button class="row-btn" id="btnDemo"><span>🧪</span>载入示例数据<em>›</em></button>' +
    '</div>' +
    '<div class="card"><div class="card-title">使用说明</div>' +
      '<details class="help"><summary>如何使用？</summary><div class="help-body">先录入客户，再为客户创建商机，商机按「线索 → 需求 → 意向 → 方案 → 报价 → 投标 → 签单」七个阶段推进。每次电话、微信、拜访后记录跟进内容，并设置下次跟进日期，首页会按时提醒您。</div></details>' +
      '<details class="help"><summary>数据存在哪里？</summary><div class="help-body">数据保存在本机浏览器的本地存储中，不会上传到任何服务器。换手机、换浏览器或清除浏览器数据会丢失记录，请定期在「数据备份」中导出 JSON 文件备份。</div></details>' +
      '<details class="help"><summary>如何安装到手机桌面？</summary><div class="help-body">通过网址（http:// 或 https://）打开本应用后：iPhone Safari 点「分享 → 添加到主屏幕」；Android Chrome 点菜单「安装应用 / 添加到主屏幕」。安装后可像 App 一样全屏使用、离线打开。</div></details>' +
    '</div>' +
    '<div class="card"><div class="card-title">危险操作</div>' +
      '<button class="row-btn danger" id="btnClear"><span>🗑️</span>清空全部数据<em>›</em></button>' +
    '</div>' +
    '<div class="about">商机管家 v1.0 · 数据仅保存在本机浏览器</div>';

  $('#btnExport').onclick = exportJSON;
  $('#btnImport').onclick = () => $('#importInput').click();
  $('#btnCsv').onclick = exportCustomersCSV;
  $('#btnDemo').onclick = () => confirmDlg({
    title: '载入示例数据',
    msg: '将添加 3 个示例客户、4 个商机和 5 条跟进记录（不会覆盖现有数据）。继续？',
    okText: '载入',
    onOk: () => { seedDemo(); save(); renderAll(); toast('示例数据已载入'); }
  });
  $('#btnClear').onclick = () => confirmDlg({
    title: '清空数据',
    msg: '将删除所有客户、商机和跟进记录，且无法恢复。确定清空？',
    okText: '清空',
    danger: true,
    onOk: () => { db = emptyDB(); save(); renderAll(); toast('已清空'); }
  });
}

/* ==================== 数据导出 / 导入 ==================== */
function download(content, filename, mime){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON(){
  download(JSON.stringify(db, null, 2), '商机管家备份_' + todayStr() + '.json', 'application/json');
  toast('备份已导出');
}
function exportCustomersCSV(){
  const head = ['客户名称','联系人','电话','公司','行业','客户来源','客户等级','地址','备注','创建时间'];
  const rows = db.customers.map(c => [
    c.name, c.contact, c.phone, c.company, c.industry, c.source, c.level, c.address, c.remark, (c.createdAt || '').slice(0, 10)
  ]);
  const csv = '\ufeff' + [head].concat(rows).map(r =>
    r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')
  ).join('\r\n');
  download(csv, '客户列表_' + todayStr() + '.csv', 'text/csv;charset=utf-8');
  toast('客户表格已导出');
}

/* ==================== 示例数据 ==================== */
function seedDemo(){
  const mkC = (name, company, phone, contact, industry, source, level) => ({
    id: uid(), name, company, phone, contact, industry, source, level,
    address: '', remark: '示例数据', createdAt: nowStr(), updatedAt: nowStr()
  });
  const c1 = mkC('张总', '华信科技有限公司', '13800001111', '张伟', '软件/互联网', '网络搜索', 'A');
  const c2 = mkC('李经理', '宏图制造有限公司', '13900002222', '李芳', '制造业', '老客户转介绍', 'B');
  const c3 = mkC('王主任', '蓝天教育集团', '13700003333', '王强', '教育', '展会', 'C');
  const mkO = (name, customerId, amount, stage, expectOff, winOff) => ({
    id: uid(), name, customerId, amount, stage,
    expectDate: dstr(expectOff), remark: '',
    history: [{at: nowStr(), from: '—', to: stageById(stage).name}],
    winDate: stage === 'deal' ? dstr(winOff) : '',
    createdAt: nowStr(), updatedAt: nowStr()
  });
  const o1 = mkO('ERP系统采购项目', c1.id, 150000, 'quote', 30);
  const o2 = mkO('官网改版项目', c1.id, 50000, 'need', 60);
  const o3 = mkO('自动化产线升级', c2.id, 800000, 'bid', 20);
  const o4 = mkO('智慧教室建设', c3.id, 120000, 'deal', -5, -5);
  const mkR = (customerId, oppId, type, dateOff, nextOff, content) => ({
    id: uid(), customerId, oppId: oppId || '', type,
    date: dstr(dateOff) + 'T10:30', nextDate: nextOff == null ? '' : dstr(nextOff),
    content, followDone: nextOff == null,
    createdAt: nowStr(), updatedAt: nowStr()
  });
  const r1 = mkR(c1.id, o1.id, '拜访', -6, -2, '初次拜访，介绍了公司产品，客户对方案感兴趣，约好本周再聊。');
  const r2 = mkR(c1.id, o1.id, '电话', -1, 3, '电话沟通需求细节，客户要求提供详细报价单。');
  const r3 = mkR(c2.id, o3.id, '微信', -3, 0, '发送了投标方案初稿，等客户反馈修改意见。');
  const r4 = mkR(c3.id, o4.id, '拜访', -8, 0, '项目验收沟通，进展顺利。');
  const r5 = mkR(c3.id, o4.id, '电话', -5, 0, '确认合同细节，等待对方盖章。');
  db.customers.push(c1, c2, c3);
  db.opps.push(o1, o2, o3, o4);
  db.records.push(r1, r2, r3, r4, r5);
}

/* ==================== 弹窗 ==================== */
function openModal(html){
  $('#modalBox').innerHTML = html;
  show($('#modalBackdrop'));
  show($('#modalWrap'));
  const box = $('#modalBox');
  box.scrollTop = 0;
}
function closeModal(){
  hide($('#modalWrap'));
  hide($('#modalBackdrop'));
  $('#modalBox').innerHTML = '';
}
function confirmDlg(opts){
  openModal(
    '<div class="modal-head">' + esc(opts.title || '确认') + '</div>' +
    '<div class="confirm-msg">' + esc(opts.msg || '') + '</div>' +
    '<div class="form-btns">' +
      '<button type="button" class="btn ghost" data-close>取消</button>' +
      '<button type="button" class="btn ' + (opts.danger ? 'danger' : 'primary') + '" id="confirmOk">' + esc(opts.okText || '确定') + '</button>' +
    '</div>'
  );
  $('#confirmOk').addEventListener('click', () => {
    closeModal();
    if(opts.onOk) opts.onOk();
  });
}

/* ==================== 客户表单 ==================== */
function openCustomerForm(cust){
  const c = cust || {};
  openModal(
    '<div class="modal-head">' + (cust ? '编辑客户' : '新增客户') + '</div>' +
    '<form id="custForm" novalidate>' +
      '<div class="field"><label>客户名称 <i class="req">*</i></label>' +
        '<input id="f-name" required placeholder="如：张总 / 某某公司" value="' + esc(c.name || '') + '"></div>' +
      '<div class="field"><label>联系人</label>' +
        '<input id="f-contact" placeholder="联系人姓名" value="' + esc(c.contact || '') + '"></div>' +
      '<div class="field"><label>电话</label>' +
        '<input id="f-phone" type="tel" placeholder="手机或座机" value="' + esc(c.phone || '') + '"></div>' +
      '<div class="field"><label>公司</label>' +
        '<input id="f-company" placeholder="公司名称" value="' + esc(c.company || '') + '"></div>' +
      '<div class="field"><label>行业</label>' +
        '<input id="f-industry" list="industryList" placeholder="选择或输入" value="' + esc(c.industry || '') + '"></div>' +
      '<div class="field"><label>客户来源</label>' +
        '<input id="f-source" list="sourceList" placeholder="选择或输入" value="' + esc(c.source || '') + '"></div>' +
      '<div class="field"><label>客户等级</label>' +
        '<select id="f-level">' + LEVELS.map(l =>
          '<option value="' + l[0] + '"' + ((c.level || 'B') === l[0] ? ' selected' : '') + '>' + l[1] + '</option>').join('') +
        '</select></div>' +
      '<div class="field"><label>地址</label>' +
        '<input id="f-address" placeholder="办公地址" value="' + esc(c.address || '') + '"></div>' +
      '<div class="field"><label>备注</label>' +
        '<textarea id="f-remark" rows="3" placeholder="客户特点、喜好、注意点…">' + esc(c.remark || '') + '</textarea></div>' +
      '<div class="form-btns">' +
        '<button type="button" class="btn ghost" data-close>取消</button>' +
        '<button type="submit" class="btn primary">保存</button>' +
      '</div>' +
    '</form>' +
    '<datalist id="industryList">' + INDUSTRIES.map(i => '<option value="' + i + '">').join('') + '</datalist>' +
    '<datalist id="sourceList">' + SOURCES.map(i => '<option value="' + i + '">').join('') + '</datalist>'
  );
  $('#custForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const name = $('#f-name').value.trim();
    if(!name){ toast('请填写客户名称'); $('#f-name').focus(); return; }
    const data = {
      name,
      contact: $('#f-contact').value.trim(),
      phone: $('#f-phone').value.trim(),
      company: $('#f-company').value.trim(),
      industry: $('#f-industry').value.trim(),
      source: $('#f-source').value.trim(),
      level: $('#f-level').value,
      address: $('#f-address').value.trim(),
      remark: $('#f-remark').value.trim()
    };
    if(cust){
      Object.assign(cust, data);
      cust.updatedAt = nowStr();
      toast('已保存');
    }else{
      db.customers.push(Object.assign({id: uid(), createdAt: nowStr(), updatedAt: nowStr()}, data));
      toast('客户已添加');
    }
    save();
    closeModal();
    renderAll();
  });
}

/* ==================== 商机表单 ==================== */
function openOppForm(opp, presetCustomerId){
  const o = opp || {};
  const custSel = db.customers.map(c =>
    '<option value="' + esc(c.id) + '"' + ((o.customerId || presetCustomerId || '') === c.id ? ' selected' : '') + '>' +
    esc(c.name) + (c.company ? '（' + esc(c.company) + '）' : '') + '</option>').join('');
  const history = (o.history && o.history.length) ?
    '<div class="card" style="margin-top:4px"><div class="card-title">阶段变更记录</div><div class="timeline">' +
    o.history.slice().reverse().map(h =>
      '<div class="tl-item"><span class="tl-dot"></span><div>' +
      '<div>' + esc(h.from) + ' → ' + esc(h.to) + '</div>' +
      '<div class="muted" style="font-size:12px">' + esc(h.at || '') + '</div>' +
      '</div></div>').join('') +
    '</div></div>' : '';

  openModal(
    '<div class="modal-head">' + (opp ? '编辑商机' : '新增商机') + '</div>' +
    '<form id="oppForm" novalidate>' +
      '<div class="field"><label>商机名称 <i class="req">*</i></label>' +
        '<input id="f-oname" required placeholder="如：某某项目采购" value="' + esc(o.name || '') + '"></div>' +
      '<div class="field"><label>所属客户 <i class="req">*</i></label>' +
        '<select id="f-ocust">' + custSel + '</select></div>' +
      '<div class="field"><label>预计金额（元）</label>' +
        '<input id="f-oamount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="如：100000" value="' + esc(o.amount == null ? '' : o.amount) + '"></div>' +
      '<div class="field"><label>当前阶段</label>' +
        '<div class="stage-chips">' + STAGES.map(s =>
          '<button type="button" class="st-chip ' + s.cls + ((o.stage || 'lead') === s.id ? ' on' : '') + '" data-schip="' + s.id + '">' + s.name + '</button>').join('') +
        '</div>' +
        '<input type="hidden" id="f-ostage" value="' + esc(o.stage || 'lead') + '"></div>' +
      '<div class="field"><label>预计成交日期</label>' +
        '<input id="f-oexpect" type="date" value="' + esc(o.expectDate || '') + '"></div>' +
      '<div class="field"><label>备注</label>' +
        '<textarea id="f-oremark" rows="3" placeholder="商机详情、竞争情况…">' + esc(o.remark || '') + '</textarea></div>' +
      history +
      '<div class="form-btns">' +
        (opp ? '<button type="button" class="btn ghost danger-text" id="f-odel">删除</button>' : '') +
        '<div class="spacer"></div>' +
        '<button type="button" class="btn ghost" data-close>取消</button>' +
        '<button type="submit" class="btn primary">保存</button>' +
      '</div>' +
    '</form>'
  );

  $$('#oppForm .st-chip').forEach(b => b.addEventListener('click', () => {
    $('#f-ostage').value = b.dataset.schip;
    $$('#oppForm .st-chip').forEach(x => x.classList.toggle('on', x === b));
  }));
  if(opp){
    $('#f-odel').addEventListener('click', () => {
      const oid = opp.id;
      closeModal();
      confirmDlg({
        title: '删除商机',
        msg: '确定删除商机「' + opp.name + '」？跟进记录会保留。',
        okText: '删除',
        danger: true,
        onOk: () => {
          db.opps = db.opps.filter(x => x.id !== oid);
          save(); renderAll(); toast('商机已删除');
        }
      });
    });
  }
  $('#oppForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const name = $('#f-oname').value.trim();
    const customerId = $('#f-ocust').value;
    if(!name){ toast('请填写商机名称'); $('#f-oname').focus(); return; }
    if(!customerId){ toast('请选择所属客户'); return; }
    const stage = $('#f-ostage').value;
    const data = {
      name,
      customerId,
      amount: $('#f-oamount').value ? Number($('#f-oamount').value) : '',
      stage,
      expectDate: $('#f-oexpect').value,
      remark: $('#f-oremark').value.trim()
    };
    if(opp){
      if(opp.stage !== stage){
        data.history = (opp.history || []).concat([{at: nowStr(), from: stageById(opp.stage).name, to: stageById(stage).name}]);
      }
      if(stage === 'deal' && !opp.winDate) data.winDate = todayStr();
      Object.assign(opp, data);
      opp.updatedAt = nowStr();
      toast('已保存');
    }else{
      db.opps.push(Object.assign({
        id: uid(),
        history: [{at: nowStr(), from: '—', to: stageById(stage).name}],
        winDate: stage === 'deal' ? todayStr() : '',
        createdAt: nowStr(), updatedAt: nowStr()
      }, data));
      toast('商机已添加');
    }
    save();
    closeModal();
    renderAll();
  });
}

/* ==================== 跟进记录表单 ==================== */
function syncOppOptions(customerId, selected){
  const sel = $('#f-ropp');
  if(!sel) return;
  sel.innerHTML = '<option value="">不关联商机</option>' +
    db.opps.filter(o => o.customerId === customerId).map(o =>
      '<option value="' + esc(o.id) + '"' + (o.id === selected ? ' selected' : '') + '>' +
      esc(o.name) + ' · ' + stageById(o.stage).name + '</option>').join('');
}
function openRecordForm(rec, presetCustomerId){
  const r = rec || {};
  const custSel = db.customers.map(c =>
    '<option value="' + esc(c.id) + '"' + ((r.customerId || presetCustomerId || '') === c.id ? ' selected' : '') + '>' +
    esc(c.name) + '</option>').join('');
  const now = new Date();
  const defaultDT = todayStr() + 'T' + pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  const typeSel = r.type || '电话';
  openModal(
    '<div class="modal-head">' + (rec ? '编辑跟进记录' : '新增跟进记录') + '</div>' +
    '<form id="recForm" novalidate>' +
      '<div class="field"><label>客户 <i class="req">*</i></label>' +
        '<select id="f-rcust">' + custSel + '</select></div>' +
      '<div class="field"><label>关联商机（可选）</label>' +
        '<select id="f-ropp"><option value="">不关联商机</option></select></div>' +
      '<div class="field"><label>跟进方式</label>' +
        '<div class="seg">' + RECORD_TYPES.map(t =>
          '<button type="button" class="seg-btn' + (t === typeSel ? ' on' : '') + '" data-rtype="' + t + '">' + t + '</button>').join('') +
        '</div>' +
        '<input type="hidden" id="f-rtype" value="' + esc(typeSel) + '"></div>' +
      '<div class="field"><label>日期时间</label>' +
        '<input id="f-rdate" type="datetime-local" value="' + esc(r.date || defaultDT) + '"></div>' +
      '<div class="field"><label>下次跟进日期（可选）</label>' +
        '<input id="f-rnext" type="date" value="' + esc(r.nextDate || '') + '"></div>' +
      '<div class="field"><label>记录内容 <i class="req">*</i></label>' +
        '<textarea id="f-rcontent" rows="4" placeholder="沟通了什么、客户反馈、下一步计划…">' + esc(r.content || '') + '</textarea></div>' +
      '<div class="form-btns">' +
        (rec ? '<button type="button" class="btn ghost danger-text" id="f-rdel">删除</button>' : '') +
        '<div class="spacer"></div>' +
        '<button type="button" class="btn ghost" data-close>取消</button>' +
        '<button type="submit" class="btn primary">保存</button>' +
      '</div>' +
    '</form>'
  );
  syncOppOptions(r.customerId || presetCustomerId || '', r.oppId || '');
  $('#f-rcust').addEventListener('change', () => syncOppOptions($('#f-rcust').value, ''));
  $$('#recForm .seg-btn').forEach(b => b.addEventListener('click', () => {
    $('#f-rtype').value = b.dataset.rtype;
    $$('#recForm .seg-btn').forEach(x => x.classList.toggle('on', x === b));
  }));
  if(rec){
    $('#f-rdel').addEventListener('click', () => {
      const rid = rec.id;
      closeModal();
      confirmDlg({
        title: '删除跟进记录',
        msg: '确定删除这条跟进记录？',
        okText: '删除',
        danger: true,
        onOk: () => {
          db.records = db.records.filter(x => x.id !== rid);
          save(); renderAll(); toast('记录已删除');
        }
      });
    });
  }
  $('#recForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const customerId = $('#f-rcust').value;
    const content = $('#f-rcontent').value.trim();
    if(!customerId){ toast('请选择客户'); return; }
    if(!content){ toast('请填写记录内容'); $('#f-rcontent').focus(); return; }
    const nextDate = $('#f-rnext').value;
    const data = {
      customerId,
      oppId: $('#f-ropp').value || '',
      type: $('#f-rtype').value,
      date: $('#f-rdate').value || defaultDT,
      nextDate,
      content,
      followDone: !nextDate
    };
    let savedRec = rec || null;
    if(rec){
      Object.assign(rec, data);
      rec.updatedAt = nowStr();
      toast('已保存');
    }else{
      savedRec = Object.assign({id: uid(), createdAt: nowStr(), updatedAt: nowStr()}, data);
      db.records.push(savedRec);
      toast('跟进记录已保存');
    }
    if(nextDate){
      // 自动完成该客户此前的待跟进任务（已被本次跟进取代），排除刚保存的这条
      db.records.forEach(x => {
        if(x.id !== savedRec.id && x.customerId === customerId && x.nextDate && !x.followDone){
          x.followDone = true;
        }
      });
    }
    save();
    closeModal();
    renderAll();
  });
}

/* ==================== 客户详情（底部抽屉） ==================== */
function openCustomer(id){
  const c = custById(id);
  if(!c) return;
  const lvl = LEVELS.find(l => l[0] === c.level);
  const opps = db.opps.filter(o => o.customerId === id).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const recs = db.records.filter(r => r.customerId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  $('#sheetBody').innerHTML =
    '<div class="sheet-head">' +
      '<div class="avatar big">' + esc((c.name || '?').slice(0, 1)) + '</div>' +
      '<div><div class="cust-name">' + esc(c.name) + (lvl ? '<span class="lvl lvl-' + lvl[0] + '">' + lvl[0] + '</span>' : '') + '</div>' +
      '<div class="muted">' + esc([c.company, c.industry].filter(Boolean).join(' · ') || '未填写公司/行业') + '</div></div>' +
    '</div>' +
    (c.phone ? '<a class="info-row" href="tel:' + esc(c.phone) + '"><span>📞</span>' + esc(c.phone) + '<em>拨打</em></a>' : '') +
    (c.contact ? '<div class="info-row"><span>👤</span>联系人：' + esc(c.contact) + '</div>' : '') +
    (c.source ? '<div class="info-row"><span>🔎</span>来源：' + esc(c.source) + '</div>' : '') +
    (c.address ? '<div class="info-row"><span>📍</span>' + esc(c.address) + '</div>' : '') +
    (c.remark ? '<div class="info-row"><span>📌</span>' + esc(c.remark) + '</div>' : '') +
    '<div class="sheet-actions">' +
      '<button class="btn primary" id="sheetNewOpp">＋ 新增商机</button>' +
      '<button class="btn" id="sheetNewRec">＋ 跟进记录</button>' +
      '<button class="btn ghost" id="sheetEdit">编辑</button>' +
      '<button class="btn ghost danger-text" id="sheetDel">删除</button>' +
    '</div>' +
    '<div class="card"><div class="card-title">商机（' + opps.length + '）</div>' +
      (opps.length ? opps.map(o => {
        const s = stageById(o.stage);
        return '<button class="mini-opp" data-edit-opp="' + esc(o.id) + '">' +
          '<span class="st-badge ' + s.cls + '">' + s.name + '</span>' +
          '<span class="mini-opp-name">' + esc(o.name) + '</span>' +
          '<b>' + fmtMoney(o.amount) + '</b></button>';
      }).join('') : '<div class="empty">暂无商机</div>') +
    '</div>' +
    '<div class="card"><div class="card-title">跟进记录（' + recs.length + '）</div>' +
      (recs.length ? recs.slice(0, 30).map(r =>
        '<button class="mini-rec" data-edit-rec="' + esc(r.id) + '">' +
        '<div class="mini-rec-top"><span class="type-badge">' + esc(r.type || '其他') + '</span>' +
        '<span class="muted">' + fmtDT(r.date) + '</span>' +
        (r.nextDate && !r.followDone ? '<span class="tag tag-orange">下次 ' + esc(r.nextDate) + '</span>' : '') +
        '</div><div class="mini-rec-content">' + esc(r.content) + '</div></button>'
      ).join('') : '<div class="empty">暂无跟进记录</div>') +
    '</div>';

  show($('#backdrop'));
  show($('#sheet'));

  $('#sheetNewOpp').onclick = () => openOppForm(null, id);
  $('#sheetNewRec').onclick = () => openRecordForm(null, id);
  $('#sheetEdit').onclick = () => { closeSheet(); openCustomerForm(c); };
  $('#sheetDel').onclick = () => {
    closeSheet();
    confirmDlg({
      title: '删除客户',
      msg: '将同时删除「' + c.name + '」的 ' + opps.length + ' 个商机和 ' + recs.length + ' 条跟进记录，确定删除？',
      okText: '删除',
      danger: true,
      onOk: () => {
        db.customers = db.customers.filter(x => x.id !== id);
        db.opps = db.opps.filter(x => x.customerId !== id);
        db.records = db.records.filter(x => x.customerId !== id);
        save(); renderAll(); toast('已删除');
      }
    });
  };
}
function closeSheet(){
  hide($('#sheet'));
  hide($('#backdrop'));
}

/* ==================== 悬浮按钮 ==================== */
function openFabMenu(){
  openModal(
    '<div class="modal-head">快捷新增</div>' +
    '<button class="row-btn" id="fabCust"><span>👤</span>新增客户<em>›</em></button>' +
    '<button class="row-btn" id="fabOpp"><span>🎯</span>新增商机<em>›</em></button>' +
    '<button class="row-btn" id="fabRec"><span>📝</span>新增跟进记录<em>›</em></button>' +
    '<div class="form-btns"><button type="button" class="btn ghost" data-close>取消</button></div>'
  );
  $('#fabCust').onclick = () => { closeModal(); openCustomerForm(); };
  $('#fabOpp').onclick = () => { closeModal(); openOppForm(); };
  $('#fabRec').onclick = () => { closeModal(); openRecordForm(); };
}

/* ==================== 事件绑定 ==================== */
function init(){
  // 底部导航
  $$('.tab').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));

  // 悬浮按钮
  $('#fab').addEventListener('click', () => {
    if(state.page === 'home') openFabMenu();
    else if(state.page === 'customers') openCustomerForm();
    else if(state.page === 'opps') openOppForm();
    else openRecordForm();
  });

  // 遮罩关闭
  $('#backdrop').addEventListener('click', closeSheet);
  $('#modalBackdrop').addEventListener('click', closeModal);
  $('#modalBox').addEventListener('click', e => { if(e.target.closest('[data-close]')) closeModal(); });

  // 客户详情抽屉内的商机 / 记录点击（委托，只绑定一次）
  $('#sheetBody').addEventListener('click', e => {
    const eo = e.target.closest('[data-edit-opp]');
    if(eo){ closeSheet(); openOppForm(oppById(eo.dataset.editOpp)); return; }
    const er = e.target.closest('[data-edit-rec]');
    if(er){ closeSheet(); openRecordForm(db.records.find(x => x.id === er.dataset.editRec)); return; }
  });

  // 搜索
  $('#custQuery').addEventListener('input', e => { state.custQuery = e.target.value; renderCustomers(); });
  $('#oppQuery').addEventListener('input', e => { state.oppQuery = e.target.value; renderOpps(); });
  $('#recQuery').addEventListener('input', e => { state.recQuery = e.target.value; renderRecords(); });

  // 筛选
  $('#oppStageChips').addEventListener('click', e => {
    const b = e.target.closest('[data-stage]');
    if(b){ state.oppStage = b.dataset.stage; renderOpps(); }
  });
  $('#recTypeChips').addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if(b){ state.recType = b.dataset.type; renderRecords(); }
  });

  // 首页交互
  $('#page-home').addEventListener('click', e => {
    const qa = e.target.closest('[data-qa]');
    if(qa){
      if(qa.dataset.qa === 'customer') openCustomerForm();
      else if(qa.dataset.qa === 'opp') openOppForm();
      else openRecordForm();
      return;
    }
    const fn = e.target.closest('[data-funnel]');
    if(fn){ state.oppStage = fn.dataset.funnel; showPage('opps'); return; }
    const fw = e.target.closest('[data-follow]');
    if(fw){ openRecordForm(null, fw.dataset.follow); return; }
    const dn = e.target.closest('[data-done]');
    if(dn){
      const r = db.records.find(x => x.id === dn.dataset.done);
      if(r) confirmDlg({
        title: '标记跟进完成',
        msg: '确认已完成对「' + custName(r.customerId) + '」的本次跟进？',
        okText: '完成',
        onOk: () => {
          r.followDone = true;
          save(); renderAll(); toast('已标记完成');
        }
      });
      return;
    }
    const op = e.target.closest('[data-open]');
    if(op) openCustomer(op.dataset.open);
  });

  // 客户列表
  $('#custList').addEventListener('click', e => {
    const it = e.target.closest('[data-open]');
    if(it) openCustomer(it.dataset.open);
  });

  // 商机列表
  $('#oppList').addEventListener('click', e => {
    const p = e.target.closest('[data-prev]');
    if(p){ moveOpp(p.dataset.prev, -1); return; }
    const n = e.target.closest('[data-next]');
    if(n){ moveOpp(n.dataset.next, 1); return; }
    const r = e.target.closest('[data-reopen]');
    if(r){
      const o = oppById(r.dataset.reopen);
      if(o){
        o.history = (o.history || []).concat([{at: nowStr(), from: '输单', to: '线索'}]);
        o.stage = 'lead';
        o.updatedAt = nowStr();
        save(); renderAll(); toast('已移回线索');
      }
      return;
    }
    const it = e.target.closest('[data-opp]');
    if(it) openOppForm(oppById(it.dataset.opp));
  });

  // 记录列表
  $('#recList').addEventListener('click', e => {
    const it = e.target.closest('[data-rec]');
    if(it) openRecordForm(db.records.find(x => x.id === it.dataset.rec));
  });

  // 导入备份
  $('#importInput').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if(!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try{
        const d = JSON.parse(fr.result);
        if(!d || !Array.isArray(d.customers) || !Array.isArray(d.opps) || !Array.isArray(d.records)) throw new Error('bad');
        confirmDlg({
          title: '导入数据',
          msg: '备份包含 ' + d.customers.length + ' 个客户、' + d.opps.length + ' 个商机、' + d.records.length + ' 条记录。导入将覆盖当前全部数据，确定继续？',
          okText: '导入',
          onOk: () => {
            db = sanitizeImported({customers: d.customers, opps: d.opps, records: d.records});
            save(); renderAll(); toast('导入成功');
          }
        });
      }catch(err){
        toast('文件格式不正确，导入失败');
      }
    };
    fr.readAsText(f);
  });

  // 路由
  window.addEventListener('hashchange', () => {
    const p = (location.hash || '').replace(/^#\//, '');
    if(p && p !== state.page && $('#page-' + p)) showPage(p);
  });

  // 初始页面
  const initPage = (location.hash || '').replace(/^#\//, '');
  showPage(initPage && $('#page-' + initPage) ? initPage : 'home');

  // 离线缓存（仅 http/https 环境生效；单文件版不注册，避免缓存缺失文件）
  if('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__SINGLE_FILE__){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', function(){
  try{ init(); }
  catch(err){ showFatal(err && err.message ? err.message : String(err)); }
});
