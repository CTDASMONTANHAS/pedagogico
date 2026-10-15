/* Reuniões mensais com os professores: controle (1 por professor/mês) e atas em Word e PDF. */

const MESES_EXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function fmtDataExtenso(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  return `${+iso.slice(8, 10)} de ${MESES_EXT[+iso.slice(5, 7) - 1]} de ${iso.slice(0, 4)}`;
}
function horarioFormato(r) {
  const h = [r.hora_inicio, r.hora_fim].filter(Boolean).join(' às ');
  return [h, r.formato].filter(Boolean).join(' - ');
}
const jsonParse = (s, def) => { try { return s ? JSON.parse(s) : def; } catch (e) { return def; } };
const reuniao = id => DB.Reunioes.find(r => r.id === id);
const reuniaoObj = r => Object.assign({}, r, {
  participantes: jsonParse(r.participantes, []), itens: jsonParse(r.itens, []), assinantes: jsonParse(r.assinantes, []),
});

/** Outras pessoas da equipe com reunião mensal obrigatória (além dos professores). */
const EQUIPE_REUNIAO = [
  { nome: 'Juliete', funcao: 'Secretaria' },
  { nome: 'Marcelo Ferreira Coutinho', funcao: 'Responsável pela van' },
];

/** Professores a partir das turmas ativas (nomes abreviados são unidos ao nome completo). */
function professores() {
  const map = {};
  turmasAtivas().forEach(t => String(t.professor || '').split(/\s*,\s*|\s+e\s+/).map(s => s.trim()).filter(Boolean)
    .forEach(p => { (map[p] = map[p] || []).push(t); }));
  DB.Reunioes.forEach(r => { if (r.professor && !map[r.professor]) map[r.professor] = []; });
  const nomes = Object.keys(map).sort((a, b) => b.length - a.length);
  const final = {};
  nomes.forEach(n => {
    const maior = Object.keys(final).find(f => norm(f).startsWith(norm(n) + ' '));
    if (maior) final[maior] = [...new Set(final[maior].concat(map[n]))]; else final[n] = map[n];
  });
  const lista = Object.keys(final).filter(n => !EQUIPE_REUNIAO.some(e => e.nome === n))
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).map(nome => ({ nome, turmas: final[nome], funcao: 'Professor(a)' }));
  return lista.concat(EQUIPE_REUNIAO.map(e => ({ nome: e.nome, turmas: [], funcao: e.funcao })));
}
const reunioesDo = (prof, mes) => DB.Reunioes.filter(r => r.professor === prof && r.mes === mes);

function proximoNumero(ano) {
  const nums = DB.Reunioes.filter(r => (r.numero || '').endsWith('/' + ano)).map(r => parseInt(r.numero, 10) || 0);
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0') + '/' + ano;
}

/* ================= TELA ================= */
ui.mesReuniao = ui.mesReuniao || thisMonth();
routes.reunioes = () => {
  setHeader('Reuniões com professores', `<input type="month" class="input" value="${ui.mesReuniao}" data-change="setMesReuniao">
    <button class="btn primary" data-action="novaReuniao">+ Nova ata</button>`);
  const mes = ui.mesReuniao, ano = mes.slice(0, 4);
  const profs = professores();
  const feitas = profs.filter(p => reunioesDo(p.nome, mes).some(r => r.status === 'REALIZADA')).length;
  const agendadas = profs.filter(p => !reunioesDo(p.nome, mes).some(r => r.status === 'REALIZADA') && reunioesDo(p.nome, mes).length).length;
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`);
  const situacao = (prof, m) => {
    const rs = reunioesDo(prof, m);
    if (rs.some(r => r.status === 'REALIZADA')) return '<span class="hist-cell st-ok" title="Reunião realizada">✓</span>';
    if (rs.length) return '<span class="hist-cell st-warn" title="Agendada / ata em elaboração">◷</span>';
    if (m > thisMonth()) return '<span class="hist-cell st-future">·</span>';
    return '<span class="hist-cell st-none" title="Sem reunião">—</span>';
  };
  const gerais = DB.Reunioes.filter(r => r.mes === mes && !r.professor);
  view.innerHTML = `
    <div class="kpis">
      ${kpi('Referência', fmtMonth(mes))}
      ${kpi('Pessoas acompanhadas', profs.length, 'professores, secretaria e van')}
      ${kpi('Reuniões realizadas', `${feitas}/${profs.length}`, feitas === profs.length && profs.length ? 'todos em dia' : '', feitas === profs.length ? '' : 'k-amber')}
      ${kpi('Agendadas / em elaboração', agendadas)}
    </div>
    <section class="card">
      <div class="card-head"><h3>Reuniões de ${fmtMonth(mes)}</h3><small class="muted">uma reunião por pessoa por mês · marque "Realizada" na ata para dar o check</small></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Pessoa</th><th>Turmas / função</th><th>Situação</th><th>Ata</th><th></th></tr></thead>
        <tbody>${profs.map(p => {
          const rs = reunioesDo(p.nome, mes);
          const r = rs.find(x => x.status === 'REALIZADA') || rs[0];
          return `<tr><td><strong>${esc(p.nome)}</strong></td>
            <td><small class="muted">${p.turmas.map(t => esc(shortName(t.nome))).join(' · ') || esc(p.funcao)}</small></td>
            <td>${r ? (r.status === 'REALIZADA' ? `<span class="tag ok">✓ realizada ${fmtDate(r.data)}</span>` : `<span class="tag warn">agendada ${fmtDate(r.data)}</span>`) : '<span class="flag amber">pendente</span>'}</td>
            <td>${r ? `<small>Ata ${esc(r.numero)}${r.assunto ? ' · ' + esc(r.assunto) : ''}</small>` : '—'}</td>
            <td class="row-actions">${r ? `<button class="btn ghost small" data-action="editarReuniao" data-id="${r.id}">Editar</button>
              <button class="btn ghost small" data-action="ataWord" data-id="${r.id}">Word</button>
              <button class="btn ghost small" data-action="ataPdf" data-id="${r.id}">PDF</button>`
              : `<button class="btn primary small" data-action="novaReuniao" data-prof="${esc(p.nome)}">Registrar reunião</button>`}</td></tr>`;
        }).join('')}</tbody></table></div>
      ${gerais.length ? `<h4>Outras reuniões do mês</h4><ul class="list">${gerais.map(r => `<li><span><strong>Ata ${esc(r.numero)}</strong> · ${fmtDate(r.data)} · ${esc(r.assunto || '')}</span>
        <span class="actions"><button class="btn ghost small" data-action="editarReuniao" data-id="${r.id}">Editar</button><button class="btn ghost small" data-action="ataWord" data-id="${r.id}">Word</button><button class="btn ghost small" data-action="ataPdf" data-id="${r.id}">PDF</button></span></li>`).join('')}</ul>` : ''}
    </section>
    <section class="card">
      <h3>Controle de ${ano} <small class="muted">✓ realizada · ◷ agendada · — sem reunião</small></h3>
      <div class="table-wrap"><table class="table hist"><thead><tr><th>Pessoa</th>${meses.map(m => `<th><a href="javascript:void 0" data-action="irMesReuniao" data-mes="${m}" class="${m === mes ? 'mes-atual' : ''}">${MESES[+m.slice(5) - 1].slice(0, 3)}</a></th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${profs.map(p => `<tr><td>${esc(p.nome)}</td>${meses.map(m => `<td>${situacao(p.nome, m)}</td>`).join('')}
        <td><strong>${meses.filter(m => reunioesDo(p.nome, m).some(r => r.status === 'REALIZADA')).length}</strong></td></tr>`).join('')}</tbody></table></div>
    </section>`;
};
actions.setMesReuniao = el => { ui.mesReuniao = el.value || thisMonth(); render(); };
actions.irMesReuniao = el => { ui.mesReuniao = el.dataset.mes; render(); window.scrollTo(0, 0); };

/* ================= FORMULÁRIO DA ATA ================= */
function linhaParticipante(p) {
  return `<div class="ata-row part">
    <input class="input" name="pn" placeholder="Nome" value="${esc(p.nome || '')}">
    <input class="input" name="pf" placeholder="Função / papel no projeto" value="${esc(p.funcao || '')}">
    <input class="input" name="pi" placeholder="Instituição (assinatura)" value="${esc(p.instituicao || '')}">
    <label class="check small" title="Assina a ata"><input type="checkbox" name="pa" ${p.assina !== false ? 'checked' : ''}> assina</label>
    <button type="button" class="btn ghost small danger-text" data-action="ataRemoveLinha">✕</button></div>`;
}
function linhaItem(it) {
  return `<div class="ata-item"><div class="ata-row"><input class="input" name="it" placeholder="Título do assunto" value="${esc(it.titulo || '')}">
    <button type="button" class="btn ghost small danger-text" data-action="ataRemoveLinha">✕</button></div>
    <textarea name="ix" rows="3" placeholder="O que foi tratado">${esc(it.texto || '')}</textarea></div>`;
}

function abrirAta(r) {
  const profs = professores();
  const assin = assinaturas();
  const padraoPart = () => {
    const out = [];
    if (r.professor) {
      const p = profs.find(x => x.nome === r.professor);
      out.push({ nome: r.professor, funcao: (p ? p.funcao : 'Professor(a)') + (p && p.turmas.length ? ' — ' + p.turmas.map(t => shortName(t.nome)).join(', ') : ''), instituicao: 'Instituto Cultural das Montanhas', assina: true });
    }
    assin.filter(a => a.nome).slice(0, 1).forEach(a => out.push({ nome: a.nome, funcao: a.cargo || 'Coordenação Pedagógica', instituicao: 'Instituto Cultural das Montanhas', assina: true }));
    return out;
  };
  const parts = r.participantes && r.participantes.length ? r.participantes : padraoPart();
  const quem = profs.find(x => x.nome === r.professor);
  const sugestao = !quem || quem.funcao === 'Professor(a)'
    ? [{ titulo: 'Plano de aula mensal', texto: '' }, { titulo: 'Relatórios de aula e registro de chamada', texto: '' }, { titulo: 'Frequência e alunos faltosos', texto: '' }]
    : quem.funcao === 'Secretaria'
      ? [{ titulo: 'Contato com alunos faltosos e famílias', texto: '' }, { titulo: 'Matrículas, desligamentos e documentação', texto: '' }, { titulo: 'Autorizações e documentos para eventos', texto: '' }]
      : [{ titulo: 'Rotas e horários do transporte', texto: '' }, { titulo: 'Viagens e eventos do mês', texto: '' }, { titulo: 'Manutenção, segurança e ocorrências', texto: '' }];
  const itens = r.itens && r.itens.length ? r.itens : sugestao;
  openModal(r.id ? `Editar ata ${r.numero}` : 'Nova ata de reunião', `<form id="ataForm" class="ata-form">
    <div class="form-grid">
      <label class="field">Nº da ata<input name="numero" value="${esc(r.numero)}" required></label>
      <label class="field">Situação<select name="status"><option value="AGENDADA" ${r.status !== 'REALIZADA' ? 'selected' : ''}>Agendada / em elaboração</option><option value="REALIZADA" ${r.status === 'REALIZADA' ? 'selected' : ''}>Realizada ✓</option></select></label>
      <label class="field">Reunião com<select name="professor"><option value="">— Reunião geral —</option>${profs.map(p => `<option value="${esc(p.nome)}" ${p.nome === r.professor ? 'selected' : ''}>${esc(p.nome)}${p.funcao !== 'Professor(a)' ? ' (' + esc(p.funcao) + ')' : ''}</option>`).join('')}</select></label>
      <label class="field">Data<input type="date" name="data" value="${esc(r.data || todayISO())}" required></label>
      <label class="field">Início<input type="time" name="hora_inicio" value="${esc(r.hora_inicio || '')}"></label>
      <label class="field">Término<input type="time" name="hora_fim" value="${esc(r.hora_fim || '')}"></label>
      <label class="field">Formato<select name="formato">${['Presencial', 'Online', 'Híbrido'].map(f => `<option ${f === (r.formato || 'Presencial') ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
      <label class="field">Local<input name="local" value="${esc(r.local || '')}" placeholder="Ex.: Sede do Instituto"></label>
      <label class="field">Projeto<input name="projeto" value="${esc(r.projeto || '')}" placeholder="Ex.: 2026 - Orquestra Jônice Tristão"></label>
      <label class="field">Redator(a)<input name="redator" value="${esc(r.redator || (assin[0] && assin[0].nome) || '')}"></label>
      <label class="field full">Assunto da reunião<input name="assunto" value="${esc(r.assunto || (quem && quem.funcao === 'Secretaria' ? 'Reunião mensal com a secretaria' : quem && quem.funcao === 'Responsável pela van' ? 'Reunião mensal sobre o transporte (van)' : 'Reunião pedagógica mensal'))}"></label>
    </div>
    <div id="ataInd">${typeof painelIndicadoresAta === 'function' ? painelIndicadoresAta(r.professor, (r.data || todayISO()).slice(0, 7)) : ''}</div>
    <h4>Participantes <small class="muted">(marque quem assina a ata)</small></h4>
    <div id="ataParts">${parts.map(linhaParticipante).join('')}</div>
    <button type="button" class="btn ghost small" data-action="ataAddPart">+ Participante</button>
    <h4>Relato da reunião <button type="button" class="btn ghost small" data-action="ataRelatoPadrao">Gerar texto inicial</button></h4>
    <textarea name="relato" rows="3">${esc(r.relato || '')}</textarea>
    <h4>Assuntos tratados</h4>
    <div id="ataItens">${itens.map(linhaItem).join('')}</div>
    <button type="button" class="btn ghost small" data-action="ataAddItem">+ Assunto</button>
    <h4>Encaminhamentos</h4>
    <textarea name="encaminhamentos" rows="3">${esc(r.encaminhamentos || '')}</textarea>
    <div class="form-actions">${r.id ? `<button type="button" class="btn ghost small danger-text" data-action="excluirReuniao" data-id="${r.id}">Excluir</button>` : ''}
      <button type="button" class="btn ghost" data-action="closeModal">Cancelar</button>
      <button type="submit" class="btn ghost" name="acao" value="word">Salvar e baixar Word</button>
      <button type="submit" class="btn ghost" name="acao" value="pdf">Salvar e baixar PDF</button>
      <button type="submit" class="btn primary" name="acao" value="salvar">Salvar</button></div>
  </form>`, true);
  const f = $('#ataForm');
  const atualizaInd = () => { $('#ataInd').innerHTML = painelIndicadoresAta(f.professor.value, (f.data.value || todayISO()).slice(0, 7)); };
  f.professor.addEventListener('change', atualizaInd);
  f.data.addEventListener('change', atualizaInd);
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const acao = ev.submitter ? ev.submitter.value : 'salvar';
    const v = Object.fromEntries(new FormData(f));
    const participantes = [...f.querySelectorAll('.ata-row.part')].map(l => ({
      nome: l.querySelector('[name=pn]').value.trim(), funcao: l.querySelector('[name=pf]').value.trim(),
      instituicao: l.querySelector('[name=pi]').value.trim(), assina: l.querySelector('[name=pa]').checked,
    })).filter(p => p.nome);
    const itensF = [...f.querySelectorAll('.ata-item')].map(l => ({ titulo: l.querySelector('[name=it]').value.trim(), texto: l.querySelector('[name=ix]').value.trim() })).filter(i => i.titulo || i.texto);
    const rec = {
      id: r.id || uid(), numero: v.numero.trim(), status: v.status, professor: v.professor, mes: v.data.slice(0, 7), data: v.data,
      hora_inicio: v.hora_inicio, hora_fim: v.hora_fim, formato: v.formato, local: v.local.trim(), projeto: v.projeto.trim(),
      redator: v.redator.trim(), assunto: v.assunto.trim(), relato: v.relato.trim(), encaminhamentos: v.encaminhamentos.trim(),
      participantes: JSON.stringify(participantes), itens: JSON.stringify(itensF),
      assinantes: JSON.stringify(participantes.filter(p => p.assina).map(p => ({ nome: p.nome, funcao: p.funcao, instituicao: p.instituicao }))),
      criado_em: r.criado_em || todayISO(), atualizado_em: todayISO(),
    };
    try {
      await save('Reunioes', rec);
      closeModal(); ui.mesReuniao = rec.mes; render();
      if (acao === 'word') await baixarAtaWord(reuniaoObj(rec));
      if (acao === 'pdf') await run(() => PDF.ata(reuniaoObj(rec)), 'Gerando PDF…');
    } catch (e) { /* toast já exibido */ }
  });
}

actions.novaReuniao = el => {
  const data = ui.mesReuniao === thisMonth() ? todayISO() : ui.mesReuniao + '-15';
  abrirAta({ numero: proximoNumero(data.slice(0, 4)), professor: el.dataset.prof || '', data, status: 'AGENDADA' });
};
actions.editarReuniao = el => abrirAta(reuniaoObj(reuniao(el.dataset.id)));
actions.excluirReuniao = el => confirmBox('Excluir esta ata?', 'Excluir', () => remove('Reunioes', el.dataset.id));
actions.ataAddPart = () => $('#ataParts').insertAdjacentHTML('beforeend', linhaParticipante({ instituicao: 'Instituto Cultural das Montanhas' }));
actions.ataAddItem = () => $('#ataItens').insertAdjacentHTML('beforeend', linhaItem({}));
actions.ataRemoveLinha = el => (el.closest('.ata-item') || el.closest('.ata-row')).remove();
actions.ataRelatoPadrao = () => {
  const f = $('#ataForm'); const v = Object.fromEntries(new FormData(f));
  const nomes = [...f.querySelectorAll('[name=pn]')].map(i => i.value.trim()).filter(Boolean);
  const lista = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : (nomes[0] || '');
  f.relato.value = `A reunião realizada no dia ${fmtDataExtenso(v.data)}${v.hora_inicio ? ', com início às ' + v.hora_inicio : ''}, foi realizada de forma ${(v.formato || 'presencial').toLowerCase()}${v.local ? ' no(a) ' + v.local : ''}, com a participação de ${lista}, tendo como pauta: ${v.assunto || 'reunião pedagógica mensal'}.`;
};
actions.ataWord = el => baixarAtaWord(reuniaoObj(reuniao(el.dataset.id)));
actions.ataPdf = el => run(() => PDF.ata(reuniaoObj(reuniao(el.dataset.id))), 'Gerando PDF…').catch(() => {});

/* ================= WORD (.docx) ================= */
const xmlEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Posição [início, fim] do elemento <tag> que contém o índice. */
function envolvente(xml, idx, tag) {
  let s = idx;
  for (;;) {
    s = xml.lastIndexOf('<' + tag, s - 1);
    if (s < 0) throw new Error('modelo inválido: ' + tag);
    const c = xml[s + tag.length + 1];
    if (c === '>' || c === ' ') break;
  }
  const e = xml.indexOf('</' + tag + '>', idx) + tag.length + 3;
  return [s, e];
}

/** Troca o parágrafo que contém o campo por um parágrafo por linha do texto. */
function paragrafos(xml, campo, texto) {
  const i = xml.indexOf(campo);
  if (i < 0) return xml;
  const [s, e] = envolvente(xml, i, 'w:p');
  const p = xml.slice(s, e);
  const linhas = String(texto || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  const novo = (linhas.length ? linhas : ['']).map(l => p.replace(campo, xmlEsc(l))).join('');
  return xml.slice(0, s) + novo + xml.slice(e);
}

async function baixarAtaWord(r) {
  await run(async () => {
    const buf = await (await fetch('assets/ata_modelo.docx?v=1')).arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    let x = await zip.file('word/document.xml').async('string');
    const simples = {
      '{{NUMERO}}': r.numero, '{{ASSUNTO}}': r.assunto, '{{DATA}}': fmtDataExtenso(r.data), '{{HORARIO}}': horarioFormato(r),
      '{{LOCAL}}': r.local, '{{PROJETO}}': r.projeto, '{{REDATOR}}': r.redator,
      '{{LAVRADA}}': `Lavrada em ${fmtDataExtenso(r.data)}.`, '{{DATA_DOC}}': fmtDate(r.data),
    };
    Object.entries(simples).forEach(([k, v]) => { x = x.split(k).join(xmlEsc(v)); });
    x = paragrafos(x, '{{RELATO}}', r.relato);
    x = paragrafos(x, '{{ENCAMINHAMENTOS}}', r.encaminhamentos);
    // participantes
    { const i = x.indexOf('{{P_NOME}}'); const [s, e] = envolvente(x, i, 'w:tr'); const tr = x.slice(s, e);
      const parts = (r.participantes || []).filter(p => p.nome);
      const linhas = (parts.length ? parts : [{ nome: '', funcao: '' }]).map(p => tr.replace('{{P_NOME}}', xmlEsc(p.nome)).replace('{{P_FUNCAO}}', xmlEsc(p.funcao)));
      x = x.slice(0, s) + linhas.join('') + x.slice(e); }
    // assuntos
    { const i1 = x.indexOf('{{ITEM_TITULO}}'), i2 = x.indexOf('{{ITEM_TEXTO}}');
      const [s1] = envolvente(x, i1, 'w:p'); const [s2, e2] = envolvente(x, i2, 'w:p');
      const pt = x.slice(s1, envolvente(x, i1, 'w:p')[1]), px = x.slice(s2, e2);
      const blocos = (r.itens || []).filter(it => it.titulo || it.texto).map((it, k) =>
        pt.replace('{{ITEM_TITULO}}', xmlEsc(`${k + 1}. ${(it.titulo || '').toUpperCase()}`)) + paragrafos(px, '{{ITEM_TEXTO}}', it.texto));
      x = x.slice(0, s1) + blocos.join('') + x.slice(e2); }
    // assinaturas, 2 por linha
    { const i = x.indexOf('{{S_NOME}}'); const [ts, te] = envolvente(x, i, 'w:tbl'); let tbl = x.slice(ts, te);
      const [rs, re] = envolvente(tbl, tbl.indexOf('{{S_NOME}}'), 'w:tr'); const tr = tbl.slice(rs, re);
      const [cs, ce] = envolvente(tr, tr.indexOf('{{S_NOME}}'), 'w:tc'); const tc = tr.slice(cs, ce);
      const cel = s => tc.replace('{{S_NOME}}', xmlEsc(s.nome)).replace('{{S_FUNCAO}}', xmlEsc(s.funcao)).replace('{{S_INST}}', xmlEsc(s.instituicao));
      const vazia = cel({ nome: '', funcao: '', instituicao: '' });
      const sig = (r.assinantes || []).filter(s => s.nome);
      const linhas = [];
      for (let k = 0; k < Math.max(sig.length, 1); k += 2) {
        const a = sig[k] ? cel(sig[k]) : vazia, b = sig[k + 1] ? cel(sig[k + 1]) : vazia;
        linhas.push(tr.replace(tc, a).replace('{{S_VAZIA}}', b));
      }
      tbl = tbl.slice(0, rs) + linhas.join('') + tbl.slice(re);
      x = x.slice(0, ts) + tbl + x.slice(te); }
    zip.file('word/document.xml', x);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Ata_${(r.numero || '').replace('/', '-')}_${(r.professor || 'reuniao').replace(/\s+/g, '_')}.docx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'Gerando Word…');
}

// Se a página abriu direto em #reunioes antes deste módulo carregar, redesenha.
if (location.hash.startsWith('#reunioes') && !document.getElementById('app').classList.contains('hidden')) render();
