const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf-8');
let assertions = 0, failures = 0;
function assert(cond, msg) {
  assertions++;
  if (!cond) { failures++; console.error('FALHOU:', msg); }
  else console.log('ok -', msg);
}
const errors = [];
function mockFetch(url) {
  if (url.includes('/calls')) return Promise.resolve({ ok: true, json: async () => [{id:'1',nome:'Cliente Agenda',fone:'41999990000',data:'2026-08-05',hora:'10:00',obs:'',done:false,lead:'',vendedora:'PAULA',closer:'CHRISTIAN',status_fech:'',obs_fech:''}] });
  if (url.includes('/pagos')) return Promise.resolve({ ok: true, json: async () => [{id:'1',nome:'Pago Teste',fone:'41999991111',plano:'E1',data:'2026-08-01',valor:'500',obs:'',lead:'',vendedora:'PAULA',fechamento:'a_vista'}] });
  if (url.includes('/clientes')) return Promise.resolve({ ok: true, json: async () => [] });
  if (url.includes('/notas')) return Promise.resolve({ ok: true, json: async () => [] });
  if (url.includes('/avisos')) return Promise.resolve({ ok: true, json: async () => [] });
  if (url.includes('/leads')) return Promise.resolve({ ok: true, json: async () => [] });
  if (url.includes('/usuarios')) return Promise.resolve({ ok: true, json: async () => [] });
  return Promise.resolve({ ok: true, json: async () => [] });
}
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true,
  virtualConsole: (() => { const vc = require('jsdom').VirtualConsole ? new (require('jsdom').VirtualConsole)() : null; return vc; })(),
  beforeParse(window) {
    window.fetch = mockFetch;
    window.alert = () => {};
    window.confirm = () => true;
    window.addEventListener('error', (e) => errors.push(e.error || e.message));
  }
});
const { window } = dom;
window.onerror = (msg) => errors.push(msg);

setTimeout(() => {
  window.currentUser = 'ADMIN';
  try {
    window.loadAll().then(() => {
      try {
        const tabs = ['agenda','leads','pipeline','notas','pagos','vendas','conversao','meta-ind','motivos','followups','onboarding','desempenho','usuarios'];
        tabs.forEach(t => {
          const nav = window.document.getElementById('nav-' + t) || window.document.getElementById('nav-followups-sb');
          try {
            window.switchTabSB(t, nav);
            assert(true, `switchTabSB('${t}') executou sem lançar exceção`);
          } catch (e) {
            assert(false, `switchTabSB('${t}') lançou erro: ${e.message}`);
          }
        });
        assert(errors.length === 0, 'Nenhum erro assíncrono/onerror capturado durante a navegação (' + errors.length + ' encontrados)');
        if (errors.length) console.error(errors);
        console.log(`\n${assertions - failures}/${assertions} checagens passaram.`);
        process.exit(failures > 0 ? 1 : 0);
      } catch (e) {
        console.error('ERRO NO BLOCO DE NAVEGAÇÃO:', e);
        process.exit(1);
      }
    }).catch(e => { console.error('loadAll rejeitou:', e); process.exit(1); });
  } catch (e) {
    console.error('ERRO AO CHAMAR loadAll:', e);
    process.exit(1);
  }
}, 300);
