/* Estado e regras de negócio (cálculos de frequência, alertas, importação). */
const DB = {};
SHEETS.forEach(s => { DB[s] = []; });

const AREAS = { MUSICA: 'Música', ESPORTE: 'Esporte' };
const CONF_ITENS = [
  ['plano_aula', 'Plano de aula mensal'],
  ['relatorio_aulas', 'Relatório de aulas'],
  ['registro_chamada', 'Registro de chamada'],
  ['fechamento_mensal', 'Fechamento mensal'],
];
const CONF_STATUS = {
  '': { label: 'Não conferido', cls: 'st-none' },
  EM_DIA: { label: 'Em dia', cls: 'st-ok' },
  PARCIAL: { label: 'Parcial', cls: 'st-warn' },
  PENDENTE: { label: 'Pendente', cls: 'st-bad' },
};
const FREQ_STATUS = { P: 'Presente', F: 'Falta', J: 'Falta justificada' };
const DOCS_EVENTO = [
  ['autorizacao', 'Autorização do responsável'],
  ['documento_identidade', 'Documento c/ foto (RG/Certidão)'],
  ['cartao_sus', 'Cartão SUS'],
  ['termo_imagem', 'Termo de uso de imagem'],
  ['ficha_saude', 'Ficha de saúde'],
];

// Pessoas que assinam os relatórios
const SIGNATARIOS = ['Diego Padua Silva', 'Drielhe de Souza Sten Padua'];

/** Signatários cadastrados (os padrões aparecem mesmo antes de salvar). */
function assinaturas() {
  const out = SIGNATARIOS.map(nome => DB.Assinaturas.find(a => a.nome === nome) || { id: '', nome, cargo: '', imagem: '' });
  DB.Assinaturas.filter(a => !SIGNATARIOS.includes(a.nome)).forEach(a => out.push(a));
  return out;
}

/* ---------- utilidades ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thisMonth = () => todayISO().slice(0, 7);
const fmtDate = iso => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : (iso || '');
const fmtDateShort = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const fmtMonth = ym => ym ? `${MESES[+ym.slice(5, 7) - 1]} de ${ym.slice(0, 4)}` : '';
const isTrue = v => v === true || v === 'TRUE' || v === 'true' || v === 'SIM' || v === '1';
const pct = (a, b) => b ? Math.round((a / b) * 100) : null;
const addMonths = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
/** Encurta nomes longos de turma para rótulos de gráfico. */
const shortName = s => String(s).replace('Jônice Tristão', 'J.T.').replace('Desenvolvimento', 'Desenv.').replace('Fundamental', 'Fund.').replace('Orquestra de Viola das Montanhas', 'Viola').replace(/ - 2026| 2026/g, '');
const byName =(a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

/** Converte '06/10/2026', '6/10/26', '06/10' (ano informado) ou '2026-10-06' para ISO. */
function parseDate(s, defaultYear) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (m) {
    let y = m[3] ? +m[3] : (defaultYear || new Date().getFullYear());
    if (y < 100) y += 2000;
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  return null;
}

/* ---------- consultas ---------- */
const turma = id => DB.Turmas.find(t => t.id === id);
const aluno = id => DB.Alunos.find(a => a.id === id);
const turmasDaArea = area => DB.Turmas.filter(t => (!area || t.area === area)).sort(byName);
const turmasAtivas = area => turmasDaArea(area).filter(t => t.ativa !== 'NAO');
const alunosDaTurma = (tid, todos) => DB.Alunos.filter(a => a.turma_id === tid && (todos || a.ativo !== 'NAO')).sort(byName);
const conferencia = (tid, mes) => DB.Conferencias.find(c => c.turma_id === tid && c.mes === mes);

function registrosAluno(aid, de, ate) {
  return DB.Frequencia
    .filter(r => r.aluno_id === aid && (!de || r.data >= de) && (!ate || r.data <= ate))
    .sort((a, b) => a.data.localeCompare(b.data));
}

function datasDaTurma(tid, de, ate) {
  const set = new Set();
  DB.Frequencia.forEach(r => { if (r.turma_id === tid && (!de || r.data >= de) && (!ate || r.data <= ate)) set.add(r.data); });
  return [...set].sort();
}

/** Estatísticas de um aluno no período. Assiduidade = presenças / aulas registradas. */
function statsAluno(aid, de, ate) {
  const regs = registrosAluno(aid, de, ate);
  const s = { total: regs.length, P: 0, F: 0, J: 0, maxSeq: 0, seqAtual: 0, ultimaData: '', faltasSeq: [] };
  let run = 0;
  regs.forEach(r => {
    if (r.status === 'P' || r.status === 'F' || r.status === 'J') s[r.status]++;
    if (r.status === 'F') { run++; s.maxSeq = Math.max(s.maxSeq, run); } else run = 0;
  });
  s.pct = pct(s.P, s.total);
  // Sequência atual: faltas não justificadas consecutivas a partir da aula mais recente
  const all = registrosAluno(aid);
  for (let i = all.length - 1; i >= 0 && all[i].status === 'F'; i--) s.faltasSeq.unshift(all[i].data);
  s.seqAtual = s.faltasSeq.length;
  s.ultimaData = all.length ? all[all.length - 1].data : '';
  return s;
}

function statsTurma(tid, de, ate) {
  const datas = datasDaTurma(tid, de, ate);
  let P = 0, total = 0;
  DB.Frequencia.forEach(r => {
    if (r.turma_id === tid && (!de || r.data >= de) && (!ate || r.data <= ate)) { total++; if (r.status === 'P') P++; }
  });
  return { aulas: datas.length, registros: total, presencas: P, pct: pct(P, total) };
}

/** Alunos ativos com 2+ faltas seguidas (não justificadas) até a aula mais recente. */
function alertasFaltas(area) {
  const out = [];
  turmasAtivas(area).forEach(t => {
    alunosDaTurma(t.id).forEach(a => {
      const s = statsAluno(a.id);
      if (s.seqAtual >= 2) {
        const desde = s.faltasSeq[0];
        const contatos = DB.Contatos.filter(c => c.aluno_id === a.id && c.data >= desde).sort((x, y) => y.data.localeCompare(x.data));
        out.push({ aluno: a, turma: t, stats: s, nivel: s.seqAtual >= 3 ? 3 : 2, desde, contato: contatos[0] || null });
      }
    });
  });
  return out.sort((x, y) => y.stats.seqAtual - x.stats.seqAtual || x.aluno.nome.localeCompare(y.aluno.nome, 'pt-BR'));
}

function resumoConferencia(mes, area) {
  const ts = turmasAtivas(area);
  let ok = 0, total = 0, pend = 0;
  ts.forEach(t => {
    const c = conferencia(t.id, mes) || {};
    CONF_ITENS.forEach(([k]) => { total++; if (c[k] === 'EM_DIA') ok++; if (c[k] === 'PENDENTE' || !c[k]) pend++; });
  });
  return { turmas: ts.length, ok, total, pend, pct: pct(ok, total) };
}

/* ---------- importação de chamada ---------- */
function statusFromCell(v) {
  const s = norm(v).replace(/[^a-z0-9✓✔]/g, '');
  if (!s) return null;
  if (['p', 'c', '1', 'presente', 'pres', 'ok', '✓', '✔', 'sim', 's', 'v'].includes(s)) return 'P';
  if (['fj', 'j', 'justificada', 'faltajustificada', 'atestado', 'jus'].includes(s)) return 'J';
  if (['f', '0', 'falta', 'ausente', 'a', 'nao', 'n', 'aus'].includes(s)) return 'F';
  return null;
}

/**
 * Lê uma grade colada (Excel/Planilha/CSV). Formatos aceitos:
 *  1) Matriz: 1ª linha = "Aluno | 01/10 | 08/10 ..."; linhas = nome + P/F/J
 *  2) Lista:  "Nome | Data | Status" (uma linha por aluno/aula)
 */
function parseChamada(text, ano) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
  if (!lines.length) return { erro: 'Nada para importar.' };
  const sep = lines[0].includes('\t') ? '\t' : (lines[0].split(';').length > lines[0].split(',').length ? ';' : ',');
  const rows = lines.map(l => l.split(sep).map(c => c.trim()));
  const regs = [];
  const avisos = [];
  const header = rows[0];
  const headerDates = header.slice(1).map(h => parseDate(h, ano));
  const isMatrix = headerDates.filter(Boolean).length >= 1 && headerDates.filter(Boolean).length >= headerDates.filter(x => !x).length;
  if (isMatrix) {
    rows.slice(1).forEach(r => {
      const nome = (r[0] || '').replace(/^\d+[\s.)-]+/, '').trim();
      if (!nome) return;
      headerDates.forEach((d, i) => {
        if (!d) return;
        const st = statusFromCell(r[i + 1]);
        if (st) regs.push({ nome, data: d, status: st });
        else if (r[i + 1]) avisos.push(`Valor "${r[i + 1]}" ignorado (${nome}, ${fmtDate(d)})`);
      });
    });
  } else {
    rows.forEach((r, i) => {
      const d = parseDate(r[1], ano);
      const st = statusFromCell(r[2]);
      if (!d || !st) { if (i > 0) avisos.push(`Linha ${i + 1} ignorada`); return; }
      regs.push({ nome: r[0].replace(/^\d+[\s.)-]+/, '').trim(), data: d, status: st });
    });
  }
  if (!regs.length) return { erro: 'Não reconheci datas e presenças. Confira o formato.' };
  return { regs, avisos, datas: [...new Set(regs.map(r => r.data))].sort(), nomes: [...new Set(regs.map(r => r.nome))] };
}

/** Associa nomes importados aos alunos da turma (sem acento/maiúsculas; aceita nome contido). */
function matchAluno(tid, nome) {
  const n = norm(nome);
  const lista = DB.Alunos.filter(a => a.turma_id === tid);
  const exato = lista.find(a => norm(a.nome) === n);
  if (exato) return exato;
  // Nome abreviado/completo: aceita só se for prefixo por palavras inteiras e único
  const parciais = lista.filter(a => { const m = norm(a.nome); return m.startsWith(n + ' ') || n.startsWith(m + ' '); });
  return parciais.length === 1 ? parciais[0] : null;
}
