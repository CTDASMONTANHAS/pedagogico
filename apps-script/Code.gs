/**
 * Sistema de Gestão Pedagógica — Instituto Cultural das Montanhas
 * Backend em Google Apps Script. A planilha é o banco de dados.
 *
 * Instalação (uma única vez, pela conta dona da planilha):
 *  1. Na planilha: Extensões > Apps Script. Cole este arquivo em Code.gs e salve.
 *  2. Recarregue a planilha. Use o menu "Sistema Pedagógico":
 *       - "Criar/atualizar abas"  → cria as abas com os cabeçalhos.
 *       - "Definir senha de acesso" → senha usada para entrar no sistema.
 *  3. No Apps Script: Implantar > Nova implantação > Tipo "App da Web"
 *       Executar como: Eu  |  Quem pode acessar: Qualquer pessoa
 *     Copie a URL gerada (termina em /exec) para js/config.js no site.
 */

// Planilha usada como banco (funciona tanto em projeto vinculado quanto avulso)
const SPREADSHEET_ID = '1kBwECN3nwie28-sc-JWl15kuJaIaThJZBhbbXu_XFtA';

function ss_() {
  return SpreadsheetApp.getActive() || SpreadsheetApp.openById(SPREADSHEET_ID);
}

const SCHEMA = {
  Turmas: ['id', 'area', 'nome', 'modalidade', 'professor', 'dias_horario', 'local', 'ativa', 'criado_em'],
  Alunos: ['id', 'turma_id', 'nome', 'data_nascimento', 'responsavel', 'telefone', 'ativo',
    'data_desligamento', 'motivo_desligamento', 'criado_em'],
  Conferencias: ['id', 'turma_id', 'mes', 'plano_aula', 'relatorio_aulas', 'registro_chamada',
    'fechamento_mensal', 'observacoes', 'conferido_em'],
  Frequencia: ['id', 'turma_id', 'aluno_id', 'data', 'status'],
  Contatos: ['id', 'aluno_id', 'data', 'alerta', 'resultado', 'motivo', 'observacoes'],
  Eventos: ['id', 'area', 'nome', 'municipio', 'local', 'data_evento', 'horario_saida', 'data_retorno',
    'transporte', 'responsavel', 'documentos_exigidos', 'observacoes', 'status'],
  EventoParticipantes: ['id', 'evento_id', 'aluno_id', 'autorizacao', 'documento_identidade', 'cartao_sus',
    'termo_imagem', 'ficha_saude', 'observacoes'],
};

/* ---------- Menu na planilha ---------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sistema Pedagógico')
    .addItem('Criar/atualizar abas', 'setup')
    .addItem('Definir senha de acesso', 'definirSenha')
    .addToUi();
}

function setup() {
  const ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SCHEMA[name];
    const existing = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    // Acrescenta colunas novas sem apagar dados existentes
    headers.forEach(function (h) {
      if (existing.indexOf(h) === -1) {
        existing.push(h);
        sh.getRange(1, existing.length).setValue(h);
      }
    });
    sh.getRange(1, 1, 1, existing.length).setFontWeight('bold').setBackground('#1f3b2d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange('A:Z').setNumberFormat('@'); // tudo como texto (evita conversão de datas)
  });
  const def = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  seedTurmas_();
  return 'ok';
}

const TURMAS_INICIAIS = {
  ESPORTE: [
    ['Vôlei Feminino', 'Vôlei'], ['Vôlei OAB', 'Vôlei'], ['Vôlei VNI', 'Vôlei'],
    ['Futsal Lagoa Sub-9', 'Futsal'], ['Futsal Lagoa Sub-11', 'Futsal'], ['Futsal Lagoa Sub-13', 'Futsal'],
    ['Jiu-jitsu A', 'Jiu-jitsu'], ['Jiu-jitsu B', 'Jiu-jitsu'], ['Kickboxing A', 'Kickboxing'],
  ],
  MUSICA: [
    ['Orq. Desenvolvimento Jônice Tristão - C / Agudos 2026', 'Orquestra'],
    ['Orq. Desenvolvimento Jônice Tristão - C / Graves 2026', 'Orquestra'],
    ['Orq. Elementar Jônice Tristão - B / Agudos 2026', 'Orquestra'],
    ['Orq. Elementar Jônice Tristão - B / Graves 2026', 'Orquestra'],
    ['Orq. Fundamental Jônice Tristão - A 2026', 'Orquestra'],
    ['Orq. Fundamental Jônice Tristão - D 2026', 'Orquestra'],
    ['Coral Infantil A - Matutino - 2026', 'Coral'],
    ['Coral Infantil B - Vespertino - 2026', 'Coral'],
    ['Coral Infantil C - Vespertino - 2026', 'Coral'],
    ['Orquestra de Viola das Montanhas - Turma A', 'Viola caipira'],
    ['Orquestra de Viola das Montanhas - Turma B', 'Viola caipira'],
    ['Piano Turma A - Terça-feira - 2026', 'Piano'],
    ['Piano Turma B - Quinta-feira - 2026', 'Piano'],
    ['Sopros Matutino A', 'Sopros'],
    ['Sopros Vespertino B', 'Sopros'],
    ['Sopros Vespertino C', 'Sopros'],
  ],
};

/** Cadastra as turmas iniciais apenas se a aba Turmas estiver vazia. */
function seedTurmas_() {
  if (read_('Turmas').length) return;
  const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const recs = [];
  Object.keys(TURMAS_INICIAIS).forEach(function (area) {
    TURMAS_INICIAIS[area].forEach(function (t) {
      recs.push({ area: area, nome: t[0], modalidade: t[1], ativa: 'SIM', criado_em: hoje });
    });
  });
  saveMany_('Turmas', recs);
}

function definirSenha() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Senha de acesso ao sistema', 'Digite a nova senha (mínimo 6 caracteres):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const pwd = r.getResponseText().trim();
  if (pwd.length < 6) { ui.alert('Senha muito curta.'); return; }
  PropertiesService.getScriptProperties().setProperty('API_KEY', pwd);
  ui.alert('Senha definida.');
}

/* ---------- API HTTP ---------- */

function doGet(e) {
  return handle_(e.parameter || {});
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, error: 'JSON inválido' }); }
  return handle_(body);
}

function handle_(req) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty('API_KEY');
    if (!key) {
      // Primeiro acesso: a senha informada passa a ser a senha do sistema
      if (req.action === 'definirSenha' && String(req.key || '').length >= 6) {
        props.setProperty('API_KEY', String(req.key));
        setup();
        return json_({ ok: true });
      }
      return json_({ ok: false, error: 'Primeiro acesso: crie a senha do sistema.', semSenha: true });
    }
    if (req.key !== key) return json_({ ok: false, error: 'Senha inválida', auth: false });

    const lock = LockService.getScriptLock();
    const writes = ['save', 'saveMany', 'remove', 'removeMany', 'replaceFrequencia'];
    if (writes.indexOf(req.action) !== -1) lock.waitLock(20000);
    try {
      switch (req.action) {
        case 'ping': return json_({ ok: true });
        case 'getAll': return json_({ ok: true, data: getAll_() });
        case 'save': return json_({ ok: true, data: saveMany_(req.sheet, [req.record])[0] });
        case 'saveMany': return json_({ ok: true, data: saveMany_(req.sheet, req.records || []) });
        case 'remove': removeMany_(req.sheet, [req.id]); return json_({ ok: true });
        case 'removeMany': removeMany_(req.sheet, req.ids || []); return json_({ ok: true });
        case 'replaceFrequencia': return json_({ ok: true, data: replaceFrequencia_(req.turma_id, req.datas || [], req.registros || []) });
        default: return json_({ ok: false, error: 'Ação desconhecida: ' + req.action });
      }
    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Acesso aos dados ---------- */

function sheet_(name) {
  if (!SCHEMA[name]) throw new Error('Aba inválida: ' + name);
  let sh = ss_().getSheetByName(name);
  if (!sh) { setup(); sh = ss_().getSheetByName(name); }
  return sh;
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}

function read_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  const out = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === '' || values[i][0] === null) continue;
    const o = {};
    headers.forEach(function (h, j) { if (h) o[h] = cell_(values[i][j]); });
    out.push(o);
  }
  return out;
}

function getAll_() {
  const out = {};
  Object.keys(SCHEMA).forEach(function (n) { out[n] = read_(n); });
  return out;
}

function saveMany_(name, records) {
  const sh = sheet_(name);
  const data = sh.getDataRange().getValues();
  const headers = data[0].map(String);
  const index = {};
  for (let i = 1; i < data.length; i++) index[String(data[i][0])] = i + 1;
  const appends = [];
  const saved = [];
  records.forEach(function (rec) {
    if (!rec.id) rec.id = Utilities.getUuid().slice(0, 12);
    const row = headers.map(function (h) { return rec[h] === undefined || rec[h] === null ? '' : String(rec[h]); });
    if (index[rec.id]) {
      // preserva campos não enviados
      const cur = data[index[rec.id] - 1];
      headers.forEach(function (h, j) { if (rec[h] === undefined) row[j] = cell_(cur[j]); });
      sh.getRange(index[rec.id], 1, 1, headers.length).setValues([row]);
    } else {
      appends.push(row);
    }
    const o = {};
    headers.forEach(function (h, j) { o[h] = row[j]; });
    saved.push(o);
  });
  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, headers.length).setNumberFormat('@').setValues(appends);
  }
  return saved;
}

function removeMany_(name, ids) {
  if (!ids.length) return;
  const sh = sheet_(name);
  const data = sh.getDataRange().getValues();
  const set = {};
  ids.forEach(function (id) { set[String(id)] = true; });
  for (let i = data.length - 1; i >= 1; i--) {
    if (set[String(data[i][0])]) sh.deleteRow(i + 1);
  }
}

/** Substitui a chamada de uma turma nas datas informadas (reimportação não duplica). */
function replaceFrequencia_(turmaId, datas, registros) {
  const sh = sheet_('Frequencia');
  const data = sh.getDataRange().getValues();
  const headers = data[0].map(String);
  const cT = headers.indexOf('turma_id'), cD = headers.indexOf('data');
  const dset = {};
  datas.forEach(function (d) { dset[d] = true; });
  const keep = [data[0]];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][cT]) === String(turmaId) && dset[cell_(data[i][cD])]) continue;
    keep.push(data[i].map(cell_));
  }
  registros.forEach(function (r) {
    if (!r.id) r.id = Utilities.getUuid().slice(0, 12);
    r.turma_id = turmaId;
    keep.push(headers.map(function (h) { return r[h] === undefined ? '' : String(r[h]); }));
  });
  sh.clearContents();
  sh.getRange(1, 1, keep.length, headers.length).setNumberFormat('@').setValues(keep);
  return registros.length;
}
