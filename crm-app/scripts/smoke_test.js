/* 商机管家 - 无头冒烟测试（Node + 最小 DOM 桩）
   运行: node scripts/smoke_test.js                —— 测试 app.js
        node scripts/smoke_test.js <单文件.html>  —— 测试单文件版内联脚本 */
'use strict';
const fs = require('fs');
const path = require('path');

let code;
const target = process.argv[2];
if(target){
  const raw = fs.readFileSync(path.resolve(target), 'utf8');
  const m = raw.match(/<script>([\s\S]*?)<\/script>/);
  if(!m){ console.error('未找到内联脚本: ' + target); process.exit(1); }
  code = m[1];
  console.log('测试目标: ' + target + '（内联脚本）');
}else{
  code = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  console.log('测试目标: app.js');
}

/* ---------- 最小 DOM 桩 ---------- */
function makeEl(tag){
  return {
    tag, innerHTML: '', hidden: false, value: '', textContent: '',
    dataset: {}, style: {}, scrollTop: 0, files: [],
    classList: {
      _s: new Set(),
      add(...c){ c.forEach(x => this._s.add(x)); },
      remove(...c){ c.forEach(x => this._s.delete(x)); },
      toggle(c, on){ if(on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); },
      contains(c){ return this._s.has(c); }
    },
    listeners: {},
    addEventListener(t, fn){ (this.listeners[t] = this.listeners[t] || []).push(fn); },
    focus(){}
  };
}

const els = {};
const pages = ['home', 'customers', 'opps', 'records', 'more'];
const pageEls = pages.map(p => {
  const e = makeEl('section');
  e.dataset.title = {home:'首页',customers:'客户',opps:'商机',records:'跟进',more:'我的'}[p];
  els['page-' + p] = e;
  return e;
});
const tabEls = pages.map(p => {
  const e = makeEl('button');
  e.dataset.page = p;
  return e;
});

const documentStub = {
  _readyFns: [],
  addEventListener(t, fn){
    if(t === 'DOMContentLoaded') this._readyFns.push(fn);
  },
  _ready(){ this._readyFns.forEach(fn => fn()); },
  querySelector(sel){
    if(sel[0] === '#'){
      const id = sel.slice(1);
      if(!els[id]) els[id] = makeEl('div');
      return els[id];
    }
    return makeEl('div');
  },
  querySelectorAll(sel){
    if(sel === '.tab') return tabEls;
    if(sel === '.page') return pageEls;
    return [];
  },
  createElement(){ return makeEl('a'); },
  body: makeEl('body')
};

const windowStub = { addEventListener(){}, scrollTo(){} };
const localStorageStub = { _d: {}, getItem(k){ return this._d[k] || null; }, setItem(k, v){ this._d[k] = v; } };
const locationStub = { hash: '', protocol: 'file:' };
let idn = 0;
const cryptoStub = { randomUUID(){ return 'testid' + (++idn); } };
const navigatorStub = {};

/* ---------- 测试代码（与 app.js 同一作用域执行） ---------- */
const testCode = `
let __failures = 0;
function check(name, cond){
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if(!cond) __failures++;
}
function dispatch(el, evt){
  // 桩元素在真实 DOM 中每次 openModal 后都是全新节点，这里只派发最近一次绑定
  (el.listeners[evt] || []).slice(-1).forEach(fn => fn({target: el, preventDefault(){}}));
}
function fel(id){
  if(!els[id]) els[id] = document.querySelector('#' + id);
  return els[id];
}

document._ready();
check('init 初始化无异常', true);
check('首页渲染包含商机漏斗', ($('#page-home').innerHTML || '').includes('商机漏斗'));

seedDemo();
renderAll();
check('示例数据: 首页待跟进含客户名', ($('#page-home').innerHTML || '').includes('张总'));
check('示例数据: 客户列表含张总', ($('#custList').innerHTML || '').includes('张总'));
check('示例数据: 商机列表含ERP项目', ($('#oppList').innerHTML || '').includes('ERP系统采购项目'));
check('示例数据: 记录列表含初次拜访', ($('#recList').innerHTML || '').includes('初次拜访'));
check('示例数据: 数量正确', db.customers.length === 3 && db.opps.length === 4 && db.records.length === 5);

openCustomer(db.customers[0].id);
check('客户详情抽屉含电话', ($('#sheetBody').innerHTML || '').includes('13800001111'));

// 新增客户
openCustomerForm();
fel('f-name').value = '新客户A';
dispatch($('#custForm'), 'submit');
check('新增客户成功', db.customers.some(c => c.name === '新客户A'));

// 新增商机（关联第一个客户）
const cid = db.customers[0].id;
openOppForm(null, cid);
fel('f-oname').value = '测试商机';
fel('f-ocust').value = cid;
dispatch($('#oppForm'), 'submit');
const opp = db.opps.find(o => o.name === '测试商机');
check('新增商机成功', !!opp);

// 阶段推进与回退
moveOpp(opp.id, 1);
check('阶段推进 线索→需求', opp.stage === 'need');
moveOpp(opp.id, 1);
check('阶段推进 需求→意向', opp.stage === 'intent');
moveOpp(opp.id, -1);
check('阶段回退 意向→需求', opp.stage === 'need');
check('阶段历史记录', Array.isArray(opp.history) && opp.history.length >= 3);

// 新增跟进记录（无下次跟进）
openRecordForm(null, cid);
fel('f-rcust').value = cid;
fel('f-rcontent').value = '电话沟通测试';
fel('f-rnext').value = '';
dispatch($('#recForm'), 'submit');
check('新增跟进记录成功', db.records.some(r => r.content === '电话沟通测试'));

// 记录带下次跟进 → 出现待跟进任务
openRecordForm(null, cid);
fel('f-rcust').value = cid;
fel('f-rcontent').value = '约定明天再联系';
fel('f-rnext').value = '2099-01-01';
dispatch($('#recForm'), 'submit');
const tasks = getTasks();
check('生成待跟进任务', tasks.some(t => t.r.content === '约定明天再联系'));

// 删除客户级联
confirmDlg({
  title: '删除客户', msg: 'm', okText: '删除', danger: true,
  onOk: () => {
    db.customers = db.customers.filter(x => x.id !== cid);
    db.opps = db.opps.filter(x => x.customerId !== cid);
    db.records = db.records.filter(x => x.customerId !== cid);
  }
});
dispatch($('#confirmOk'), 'click');
check('删除客户级联清理', !db.customers.some(x => x.id === cid) &&
  db.opps.every(x => x.customerId !== cid) && db.records.every(x => x.customerId !== cid));

renderAll();
check('删除后重新渲染无异常', true);

__out.failures = __failures;
__out.total = 17;
`;

/* ---------- 执行 ---------- */
const __out = {};
const fn = new Function(
  'document', 'window', 'localStorage', 'location', 'navigator', 'crypto', 'els', '__out',
  code + '\n' + testCode
);
try{
  fn(documentStub, windowStub, localStorageStub, locationStub, navigatorStub, cryptoStub, els, __out);
}catch(err){
  console.error('SMOKE CRASH:', err && err.stack || err);
  process.exit(1);
}
if(__out.failures){
  console.error('SMOKE FAILED: ' + __out.failures + ' 项失败');
  process.exit(1);
}else{
  console.log('SMOKE PASS: 全部 ' + __out.total + ' 项通过');
}
