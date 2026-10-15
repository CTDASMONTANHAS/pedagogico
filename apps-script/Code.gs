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
  Turmas: ['id', 'area', 'nome', 'modalidade', 'professor', 'dias_horario', 'local', 'ativa', 'criado_em', 'inicio',
    'meta_alunos', 'aulas_previstas_mes', 'duracao_aula'],
  Alunos: ['id', 'turma_id', 'nome', 'data_nascimento', 'responsavel', 'telefone', 'ativo',
    'data_desligamento', 'motivo_desligamento', 'criado_em', 'sexo', 'escola', 'tipo_escola', 'bairro'],
  Conferencias: ['id', 'turma_id', 'mes', 'plano_aula', 'relatorio_aulas', 'registro_chamada',
    'fechamento_mensal', 'observacoes', 'conferido_em'],
  Frequencia: ['id', 'turma_id', 'aluno_id', 'data', 'status'],
  Contatos: ['id', 'aluno_id', 'data', 'alerta', 'resultado', 'motivo', 'observacoes'],
  Eventos: ['id', 'area', 'nome', 'municipio', 'local', 'data_evento', 'horario_saida', 'data_retorno',
    'transporte', 'responsavel', 'documentos_exigidos', 'observacoes', 'status'],
  EventoParticipantes: ['id', 'evento_id', 'aluno_id', 'autorizacao', 'documento_identidade', 'cartao_sus',
    'termo_imagem', 'ficha_saude', 'observacoes'],
  Assinaturas: ['id', 'nome', 'cargo', 'imagem', 'atualizado_em'],
  Reunioes: ['id', 'numero', 'status', 'professor', 'mes', 'data', 'hora_inicio', 'hora_fim', 'formato', 'local', 'projeto',
    'redator', 'assunto', 'relato', 'itens', 'encaminhamentos', 'participantes', 'assinantes', 'criado_em', 'atualizado_em'],
  Ocorrencias: ['id', 'numero', 'tipo', 'gravidade', 'status', 'turma_id', 'aluno_id', 'aluno_nome', 'data_nascimento', 'responsavel',
    'telefone', 'data_ocorrencia', 'hora', 'local', 'descricao', 'providencias', 'testemunha_nome', 'testemunha_funcao',
    'data_emissao', 'assinatura_digital', 'criado_em', 'atualizado_em', 'termo_id', 'termo_link'],
  Fotos: ['id', 'tipo', 'turma_id', 'evento_id', 'data', 'mes', 'legenda', 'miniatura', 'largura', 'altura', 'partes', 'criado_em',
    'visita_id', 'drive_id', 'ordem'],
  Visitas: ['id', 'numero', 'status', 'data', 'hora', 'turma_id', 'professor', 'observador', 'observador_cargo', 'alunos_presentes',
    'aspectos', 'relato', 'pontos_positivos', 'pontos_melhorar', 'encaminhamentos', 'criado_em', 'atualizado_em'],
  // imagem em tamanho de relatório, dividida em partes (limite de 50 mil caracteres por célula); não vai no getAll
  FotosDados: ['id', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
};
const LAZY_ = { FotosDados: true };
// Pasta do Google Drive do pedagógico onde ficam as fotos (uma subpasta por mês)
const PASTA_FOTOS = '1eFKhRiSeZ9_Hrf_pFixBTqLAPYwFOEt5';
// Pasta de documentos que a diretoria pode consultar (somente leitura, dentro do painel)
const PASTA_DIRETORIA = '139uCJIGRFzMtCva95cFIFv33ZOn4EKTI';
// Planilha "Controle de Ocorrências e Advertências - ICM" (Planilhas Google), preenchida a cada ocorrência
const PLANILHA_OCORRENCIAS = '1W0nFPgV-GXMokG5fxnkT4TWGlwkCfk8Kt1CO02jhBG8';

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
    // Painel da diretoria: senha própria, somente leitura
    if (req.action === 'diretoria' || req.action === 'diretoriaFotos' || req.action === 'diretoriaArquivos' || req.action === 'diretoriaArquivo') {
      const dk = props.getProperty('DIRETORIA_KEY');
      if (!dk) return json_({ ok: false, error: 'O acesso da diretoria ainda não foi liberado pela coordenação.' });
      if (req.key !== dk) return json_({ ok: false, error: 'Senha inválida', auth: false });
      if (req.action === 'diretoriaArquivos') return json_({ ok: true, data: listarDocumentosDiretoria_() });
      if (req.action === 'diretoriaArquivo') return json_({ ok: true, data: abrirDocumentoDiretoria_(req.id) });
      if (req.action === 'diretoriaFotos') {
        // só fotos de visitas às aulas
        const permitidas = {};
        read_('Fotos').forEach(function (f) { if (f.visita_id) permitidas[f.id] = true; });
        return json_({ ok: true, data: getFotos_((req.ids || []).filter(function (id) { return permitidas[id]; }).slice(0, 8)) });
      }
      return json_({ ok: true, data: dadosDiretoria_() });
    }
    if (req.key !== key) return json_({ ok: false, error: 'Senha inválida', auth: false });

    const lock = LockService.getScriptLock();
    const writes = ['save', 'saveMany', 'remove', 'removeMany', 'replaceFrequencia', 'saveFoto', 'removeFoto', 'syncOcorrencia', 'removerOcorrencia'];
    if (writes.indexOf(req.action) !== -1) lock.waitLock(20000);
    try {
      switch (req.action) {
        case 'ping': return json_({ ok: true });
        case 'getAll': return json_({ ok: true, data: getAll_() });
        case 'save': return json_({ ok: true, data: saveMany_(req.sheet, [req.record])[0] });
        case 'saveMany': return json_({ ok: true, data: saveMany_(req.sheet, req.records || []) });
        case 'remove': removeMany_(req.sheet, [req.id]); return json_({ ok: true });
        case 'removeMany': removeMany_(req.sheet, req.ids || []); return json_({ ok: true });
        case 'saveFoto': return json_({ ok: true, data: saveFoto_(req.foto, req.dados) });
        case 'removeFoto': removeFoto_(req.id); return json_({ ok: true });
        case 'definirSenhaDiretoria': {
          const nova = String(req.nova || '');
          if (nova.length < 6) throw new Error('A senha da diretoria precisa ter pelo menos 6 caracteres.');
          if (nova === key) throw new Error('Use uma senha diferente da senha da coordenação.');
          props.setProperty('DIRETORIA_KEY', nova);
          return json_({ ok: true });
        }
        case 'syncOcorrencia': return json_({ ok: true, data: syncOcorrencia_(req.ocorrencia, req.pdf) });
        case 'removerOcorrencia': removerOcorrencia_(req.id); return json_({ ok: true });
        case 'statusDiretoria': return json_({ ok: true, data: !!props.getProperty('DIRETORIA_KEY') });
        case 'getFotos': return json_({ ok: true, data: getFotos_(req.ids || []) });
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
  if (!headersOk_[name]) { ensureHeaders_(sh, name); headersOk_[name] = true; }
  return sh;
}

const headersOk_ = {};

/** Acrescenta colunas novas do SCHEMA em abas já existentes (sem mexer nos dados). */
function ensureHeaders_(sh, name) {
  const lc = sh.getLastColumn();
  const ex = lc ? sh.getRange(1, 1, 1, lc).getValues()[0].map(String) : [];
  SCHEMA[name].forEach(function (h) {
    if (ex.indexOf(h) === -1) {
      ex.push(h);
      sh.getRange(1, ex.length).setValue(h).setFontWeight('bold').setBackground('#1f3b2d').setFontColor('#ffffff');
      sh.getRange(2, ex.length, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@');
    }
  });
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
  Object.keys(SCHEMA).forEach(function (n) { if (!LAZY_[n]) out[n] = read_(n); });
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
  const data = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues(); // só a coluna id
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

/* ---------- Fotos (comprovação) ---------- */

function subpasta_(mes) {
  const raiz = DriveApp.getFolderById(PASTA_FOTOS);
  const nome = mes || 'Sem data';
  const it = raiz.getFoldersByName(nome);
  return it.hasNext() ? it.next() : raiz.createFolder(nome);
}

/** Salva a imagem no Google Drive (pasta do pedagógico) e os dados da foto na planilha. */
function saveFoto_(foto, imagem) {
  if (!foto || !imagem) throw new Error('Foto inválida');
  if (!foto.id) foto.id = Utilities.getUuid().slice(0, 12);
  const m = String(imagem).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error('Imagem inválida');
  const nome = [foto.data || '', foto.legenda || 'foto', foto.id].join(' - ').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120) + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], nome);
  const file = subpasta_(foto.mes || String(foto.data || '').slice(0, 7)).createFile(blob);
  if (foto.legenda) file.setDescription(foto.legenda);
  foto.drive_id = file.getId();
  return saveMany_('Fotos', [foto])[0];
}

/** Devolve as imagens completas (dataURL) das fotos pedidas, lidas do Drive. */
function getFotos_(ids) {
  const fotos = read_('Fotos');
  const out = [];
  ids.forEach(function (id) {
    const f = fotos.filter(function (x) { return x.id === String(id); })[0];
    if (!f) return;
    if (f.drive_id) {
      try {
        const b = DriveApp.getFileById(f.drive_id).getBlob();
        out.push({ id: f.id, imagem: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) });
      } catch (e) { /* arquivo removido do Drive */ }
      return;
    }
    // fotos antigas guardadas na própria planilha
    const sh = sheet_('FotosDados');
    const last = sh.getLastRow();
    if (last < 2) return;
    const col = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < col.length; i++) {
      if (String(col[i][0]) !== f.id) continue;
      const row = sh.getRange(i + 2, 1, 1, sh.getLastColumn()).getValues()[0];
      out.push({ id: f.id, imagem: row.slice(1).map(cell_).join('') });
      break;
    }
  });
  return out;
}

/** Remove a foto da planilha e manda o arquivo para a lixeira do Drive. */
function removeFoto_(id) {
  const f = read_('Fotos').filter(function (x) { return x.id === String(id); })[0];
  if (f && f.drive_id) { try { DriveApp.getFileById(f.drive_id).setTrashed(true); } catch (e) { /* já removido */ } }
  removeMany_('FotosDados', [id]);
  removeMany_('Fotos', [id]);
}

/** Executar uma vez no editor para autorizar o acesso ao Google Drive. */
function autorizarDrive() {
  Logger.log('Pasta de fotos: ' + DriveApp.getFolderById(PASTA_FOTOS).getName());
}

/* ---------- Painel da diretoria (somente leitura, dados mínimos) ---------- */
function dadosDiretoria_() {
  const so = function (lista, campos) {
    return lista.map(function (r) { const o = {}; campos.forEach(function (c) { o[c] = r[c] === undefined ? '' : r[c]; }); return o; });
  };
  return {
    Turmas: so(read_('Turmas'), ['id', 'area', 'nome', 'modalidade', 'professor', 'dias_horario', 'local', 'ativa', 'inicio']),
    Alunos: so(read_('Alunos'), ['id', 'turma_id', 'nome', 'ativo', 'data_desligamento', 'motivo_desligamento']),
    Contatos: so(read_('Contatos'), ['id', 'aluno_id', 'data', 'alerta', 'resultado']),
    Conferencias: so(read_('Conferencias'), ['id', 'turma_id', 'mes', 'plano_aula', 'relatorio_aulas', 'registro_chamada', 'fechamento_mensal', 'observacoes']),
    Frequencia: so(read_('Frequencia'), ['turma_id', 'aluno_id', 'data', 'status']),
    Reunioes: read_('Reunioes'),
    Ocorrencias: so(read_('Ocorrencias'), ['id', 'numero', 'tipo', 'gravidade', 'status', 'turma_id', 'aluno_id', 'aluno_nome', 'data_ocorrencia', 'local',
      'descricao', 'providencias', 'testemunha_nome', 'testemunha_funcao']),
    Visitas: read_('Visitas'),
    Fotos: so(read_('Fotos').filter(function (f) { return f.visita_id; }),
      ['id', 'tipo', 'turma_id', 'visita_id', 'data', 'mes', 'legenda', 'miniatura', 'largura', 'altura', 'ordem']),
  };
}

/* ---------- Documentos da diretoria (pasta do Drive, somente leitura) ---------- */
function listarDocumentosDiretoria_() {
  const raiz = DriveApp.getFolderById(PASTA_DIRETORIA);
  const out = [];
  const percorre = function (pasta, caminho, nivel) {
    const fs = pasta.getFiles();
    while (fs.hasNext() && out.length < 800) {
      const f = fs.next();
      out.push({ id: f.getId(), nome: f.getName(), tipo: f.getMimeType(), pasta: caminho, tamanho: f.getSize(),
        modificado: Utilities.formatDate(f.getLastUpdated(), 'America/Sao_Paulo', 'yyyy-MM-dd') });
    }
    if (nivel >= 6) return;
    const ps = pasta.getFolders();
    while (ps.hasNext()) { const p = ps.next(); percorre(p, caminho ? caminho + ' / ' + p.getName() : p.getName(), nivel + 1); }
  };
  percorre(raiz, '', 0);
  return { pasta: raiz.getName(), arquivos: out };
}

/** Só entrega arquivos que estão dentro da pasta da diretoria (em qualquer subpasta). */
function dentroDaPastaDiretoria_(file) {
  let fila = [];
  const ps = file.getParents();
  while (ps.hasNext()) fila.push(ps.next());
  for (let nivel = 0; nivel < 8 && fila.length; nivel++) {
    const prox = [];
    for (let i = 0; i < fila.length; i++) {
      if (fila[i].getId() === PASTA_DIRETORIA) return true;
      const pp = fila[i].getParents();
      while (pp.hasNext()) prox.push(pp.next());
    }
    fila = prox;
  }
  return false;
}

function abrirDocumentoDiretoria_(id) {
  const file = DriveApp.getFileById(String(id || ''));
  if (!dentroDaPastaDiretoria_(file)) throw new Error('Arquivo não disponível.');
  const tipo = file.getMimeType();
  let blob;
  if (tipo.indexOf('application/vnd.google-apps.') === 0) {
    if (tipo === 'application/vnd.google-apps.folder' || tipo === 'application/vnd.google-apps.shortcut') throw new Error('Arquivo não disponível.');
    blob = file.getAs('application/pdf'); // Documentos, Planilhas e Apresentações Google viram PDF para leitura
  } else {
    if (file.getSize() > 30 * 1024 * 1024) throw new Error('Arquivo grande demais para abrir no painel (acima de 30 MB).');
    blob = file.getBlob();
  }
  return { nome: file.getName(), tipo: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

/* ---------- Ocorrências: planilha de controle + termo em PDF no Drive ---------- */
const TIPO_PLANILHA_ = { OCORRENCIA: 'Ocorrência', ADV_VERBAL: 'Advertência', ADV_ESCRITA: 'Advertência', SUSPENSAO: 'Suspensão' };

function abaOcorrencias_() {
  const ss = SpreadsheetApp.openById(PLANILHA_OCORRENCIAS);
  const sh = ss.getSheetByName('Ocorrências') || ss.getSheets()[0];
  const topo = sh.getRange(1, 1, Math.min(15, sh.getMaxRows()), 1).getDisplayValues();
  let cab = 0;
  for (let i = 0; i < topo.length; i++) if (String(topo[i][0]).trim().toUpperCase() === 'REGISTRO') { cab = i + 1; break; }
  if (!cab) throw new Error('Cabeçalho "REGISTRO" não encontrado na planilha de ocorrências.');
  return { sh: sh, cab: cab };
}

/** Linha da ocorrência (pelo nº) ou a primeira linha livre abaixo do cabeçalho. */
function linhaOcorrencia_(sh, cab, numero) {
  const n = sh.getMaxRows() - cab;
  const vals = sh.getRange(cab + 1, 1, n, 2).getDisplayValues();
  let livre = 0;
  for (let i = 0; i < vals.length; i++) {
    if (numero && String(vals[i][0]).trim() === String(numero)) return { linha: cab + 1 + i, existe: true };
    if (!livre && !String(vals[i][1]).trim()) livre = cab + 1 + i;
  }
  if (!livre) { sh.insertRowsAfter(sh.getMaxRows(), 50); livre = cab + 1 + n; }
  return { linha: livre, existe: false };
}

function pastaTermos_() {
  let base;
  try { const ps = DriveApp.getFileById(PLANILHA_OCORRENCIAS).getParents(); base = ps.hasNext() ? ps.next() : DriveApp.getRootFolder(); } catch (e) { base = DriveApp.getRootFolder(); }
  const it = base.getFoldersByName('Termos de Ocorrência');
  return it.hasNext() ? it.next() : base.createFolder('Termos de Ocorrência');
}

/** Grava o termo em PDF no Drive e preenche/atualiza a linha da planilha de controle. */
function syncOcorrencia_(o, pdf) {
  if (!o || !o.id) throw new Error('Ocorrência inválida');
  const atual = read_('Ocorrencias').filter(function (x) { return x.id === o.id; })[0] || {};
  let termoId = atual.termo_id || '', link = atual.termo_link || '';
  if (pdf) {
    const m = String(pdf).match(/base64,(.*)$/);
    const bytes = Utilities.base64Decode(m ? m[1] : pdf);
    const nome = ('Termo ' + (o.numero || '').replace('/', '-') + ' - ' + (o.aluno_nome || '') + '.pdf').replace(/[\\/:*?"<>|]+/g, ' ');
    if (termoId) { try { DriveApp.getFileById(termoId).setTrashed(true); } catch (e) { /* já removido */ } }
    const f = pastaTermos_().createFile(Utilities.newBlob(bytes, 'application/pdf', nome));
    termoId = f.getId(); link = f.getUrl();
  }
  const a = abaOcorrencias_();
  const pos = linhaOcorrencia_(a.sh, a.cab, o.numero);
  const partes = String(o.data_ocorrencia || '').split('-');
  const data = partes.length === 3 ? new Date(+partes[0], +partes[1] - 1, +partes[2]) : '';
  const primeiro = String(o.aluno_nome || '').trim().split(/\s+/)[0] || '';
  a.sh.getRange(pos.linha, 1, 1, 5).setValues([[o.numero || '', TIPO_PLANILHA_[o.tipo] || 'Ocorrência', primeiro, data, link]]);
  a.sh.getRange(pos.linha, 4).setNumberFormat('dd/mm/yyyy');
  saveMany_('Ocorrencias', [{ id: o.id, termo_id: termoId, termo_link: link }]);
  return { termo_id: termoId, termo_link: link, linha: pos.linha };
}

/** Ao excluir a ocorrência no sistema: limpa a linha da planilha e manda o termo para a lixeira. */
function removerOcorrencia_(id) {
  const o = read_('Ocorrencias').filter(function (x) { return x.id === String(id); })[0];
  if (!o) return;
  if (o.termo_id) { try { DriveApp.getFileById(o.termo_id).setTrashed(true); } catch (e) { /* já removido */ } }
  try {
    const a = abaOcorrencias_();
    const pos = linhaOcorrencia_(a.sh, a.cab, o.numero);
    if (pos.existe) a.sh.deleteRow(pos.linha);
  } catch (e) { /* planilha indisponível: segue com a exclusão no sistema */ }
}
