const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf-8');
let assertions = 0, failures = 0;
function assert(cond, msg) {
  assertions++;
  if (!cond) { failures++; console.error('FALHOU:', msg); }
  else console.log('ok -', msg);
}

const fetchCalls = [];
function mockFetch(url, opts) {
  fetchCalls.push({ url, opts });
  return Promise.resolve({ ok: true, json: async () => [] });
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = mockFetch;
    window.alert = (m) => { window.__lastAlert = m; };
    window.confirm = () => true;
  }
});

const { window } = dom;

setTimeout(() => {
  try {
    const getLeads = () => window.eval('leads');
    const getLeadEtapas = () => window.eval('LEAD_ETAPAS');

    // 1) globais essenciais existem
    assert(Array.isArray(getLeads()), 'leads (escopo do script) é um array');
    assert(Array.isArray(getLeadEtapas()) && getLeadEtapas().length === 14, 'LEAD_ETAPAS tem 13 etapas (' + getLeadEtapas().length + ')');

    // 2) render inicial sem leads não quebra
    window.renderLeadsPage();
    window.renderPipelinePage();
    assert(window.document.getElementById('kanban-board').children.length === 14, 'Kanban renderiza 14 colunas');
    assert(window.document.getElementById('leads-list-area').textContent.includes('Nenhum lead'), 'Lista vazia mostra mensagem de vazio');

    // 3) abrir form de novo lead
    window.openLeadForm(null);
    assert(!!window.document.getElementById('lf-nome'), 'Form de novo lead renderizou o campo nome');

    // 4) salvar lead válido
    window.document.getElementById('lf-nome').value = 'Loja Teste QA';
    window.document.getElementById('lf-telefone').value = '41999998888';
    window.document.getElementById('lf-email').value = 'qa@teste.com';
    window.saveLeadForm();
    assert(getLeads().length === 1, 'Lead foi adicionado ao array local após salvar (' + getLeads().length + ')');
    assert(fetchCalls.some(c => c.url.includes('/rest/v1/leads')), 'sbUpsert chamou o endpoint /rest/v1/leads');
    const leadId = getLeads()[0].id;

    // 5) tentar criar segundo lead com mesmo telefone -> deve bloquear (dedupe)
    window.openLeadForm(null);
    window.document.getElementById('lf-nome').value = 'Duplicado QA';
    window.document.getElementById('lf-telefone').value = '41999998888';
    window.saveLeadForm();
    assert(getLeads().length === 1, 'Dedupe por telefone bloqueou segundo cadastro (continua ' + getLeads().length + ' lead)');
    assert(!!window.__lastAlert, 'Alerta de duplicidade foi disparado: "' + window.__lastAlert + '"');
    window.__lastAlert = null;

    // 6) mesmo email, telefone diferente -> também deve bloquear
    window.openLeadForm(null);
    window.document.getElementById('lf-nome').value = 'Duplicado Email QA';
    window.document.getElementById('lf-telefone').value = '41911112222';
    window.document.getElementById('lf-email').value = 'QA@teste.com'; // case-insensitive
    window.saveLeadForm();
    assert(getLeads().length === 1, 'Dedupe por email (case-insensitive) bloqueou segundo cadastro');

    // 7) abrir detalhe e mover de etapa via dropdown -> deve gerar histórico local e chamar upsert
    window.openLeadDetail(leadId);
    assert(!!window.document.getElementById('ld-etapa-move'), 'Detalhe do lead renderizou o seletor de etapa');
    const fetchCountBefore = fetchCalls.length;
    window.moverLeadEtapa(leadId, 'qualificado');
    assert(getLeads()[0].etapa === 'qualificado', 'Etapa do lead foi atualizada localmente para qualificado');
    assert(fetchCalls.length > fetchCountBefore, 'moverLeadEtapa disparou nova chamada de rede (upsert)');

    // 8) pipeline reflete a nova etapa
    window.renderPipelinePage();
    const board = window.document.getElementById('kanban-board');
    const qualCol = [...board.children].find(c => c.dataset.etapa === 'qualificado');
    assert(qualCol.querySelector('.kanban-card') !== null, 'Card aparece na coluna Qualificado depois de mover etapa');
    const novoCol = [...board.children].find(c => c.dataset.etapa === 'lead_novo');
    assert(novoCol.textContent.includes('vazio'), 'Coluna Lead Novo ficou vazia depois de mover o único lead');

    // 9) drop via kanban (drag and drop simulado)
    window.kbDrop({ preventDefault(){}, currentTarget: { classList: { remove(){} } }, dataTransfer: { getData: () => leadId } }, 'proposta_enviada');
    assert(getLeads()[0].etapa === 'proposta_enviada', 'kbDrop moveu o lead para a etapa de destino');

    // 10) excluir lead
    window.delLead(leadId);
    assert(getLeads().length === 0, 'Lead foi removido do array local após exclusão');
    assert(fetchCalls.some(c => c.url.includes('/rest/v1/leads?id=eq.' + leadId) && c.opts && c.opts.method === 'DELETE'), 'sbDelete chamou DELETE no endpoint correto');

    console.log(`\n${assertions - failures}/${assertions} checagens passaram.`);
    process.exit(failures > 0 ? 1 : 0);
  } catch (e) {
    console.error('ERRO NÃO TRATADO DURANTE O TESTE:', e);
    process.exit(1);
  }
}, 300);
