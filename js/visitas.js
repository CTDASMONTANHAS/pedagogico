/* Visitas às aulas: relatório de acompanhamento pedagógico com fotos e legendas (fotos no Google Drive). */

const ASPECTOS_VISITA = [
  ['plano', 'Aula de acordo com o plano de aula mensal'],
  ['pontualidade', 'Pontualidade (início e término da aula)'],
  ['espaco', 'Organização do espaço e dos materiais'],
  ['didatica', 'Didática e condução da aula'],
  ['participacao', 'Participação e interesse dos alunos'],
  ['disciplina', 'Disciplina e convivência da turma'],
  ['chamada', 'Registro de chamada feito na aula'],
];
const NOTAS_VISITA = { OTIMO: 'Ótimo', BOM: 'Bom', REGULAR: 'Regular', INSUF: 'Insuficiente', NA: 'Não observado' };
const visita = id => DB.Visitas.find(v => v.id === id);
const fotosDaVisita = id => fotosFiltro({ visita: id });

function proximoNumeroVisita(ano) {
  const nums = DB.Visitas.filter(v => (v.numero || '').endsWith('/' + ano)).map(v => parseInt(v.numero, 10) || 0);
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0') + '/' + ano;
}

ui.mesVisita = ui.mesVisita || thisMonth();
ui.areaVisita = ui.areaVisita || '';
const visitasDe = (tid, mes) => DB.Visitas.filter(v => v.turma_id === tid && (v.data || '').startsWith(mes)).sort((a, b) => (a.data || '').localeCompare(b.data || ''));

routes.visitas = () => {
  setHeader('Visitas às aulas', `<input type="month" class="input" value="${ui.mesVisita}" data-change="setMesVisita">
    <button class="btn primary" data-action="novaVisita">+ Nova visita</button>`);
  const mes = ui.mesVisita, ano = mes.slice(0, 4);
  const ts = turmasConferencia(ui.areaVisita, mes);
  const visitadas = ts.filter(t => visitasDe(t.id, mes).length);
  const doMes = DB.Visitas.filter(v => (v.data || '').startsWith(mes) && ts.some(t => t.id === v.turma_id));
  const nFotos = doMes.reduce((s, v) => s + fotosDaVisita(v.id).length, 0);
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`);
  const todas = turmasAtivas(ui.areaVisita);
  const situacao = (t, m) => {
    const n = visitasDe(t.id, m).length;
    if (n) return `<span class="hist-cell st-ok" title="${n} visita(s)">✓${n > 1 ? n : ''}</span>`;
    if (!iniciou(t, m)) return '<span class="hist-cell st-future" title="Turma ainda não iniciada">·</span>';
    if (m > thisMonth()) return '<span class="hist-cell st-future">·</span>';
    return '<span class="hist-cell st-none" title="Sem visita">—</span>';
  };
  const linhaTurma = t => {
    const vs = visitasDe(t.id, mes);
    const fs = vs.flatMap(v => fotosDaVisita(v.id));
    const acoesVisita = v => `<button class="btn ghost small" data-action="editarVisita" data-id="${v.id}">Editar</button>
      <button class="btn ghost small" data-action="pdfVisita" data-id="${v.id}">PDF</button>`;
    return `<tr><td>${areaBadge(t.area)} <strong>${esc(shortName(t.nome))}</strong></td>
      <td><small class="muted">${esc(t.professor || '—')}</small></td>
      <td>${vs.length ? vs.map(v => `<span class="tag ok">✓ visitada ${fmtDate(v.data)}</span>`).join(' ') : '<span class="flag amber">pendente</span>'}</td>
      <td>${vs.length ? vs.map(v => `<small>Relatório ${esc(v.numero)}${v.observador ? ' · ' + esc(v.observador) : ''}</small>`).join('<br>') : '—'}</td>
      <td>${fs.length ? `<div class="foto-mini">${fs.slice(0, 3).map(f => `<img src="${f.miniatura}" data-action="verFoto" data-id="${f.id}" title="${esc(f.legenda || '')}">`).join('')}${fs.length > 3 ? `<span>+${fs.length - 3}</span>` : ''}</div>` : '<small class="muted">—</small>'}</td>
      <td class="row-actions">${vs.length ? vs.map(acoesVisita).join('') : `<button class="btn primary small" data-action="novaVisita" data-turma="${t.id}">Registrar visita</button>`}</td></tr>`;
  };
  view.innerHTML = `${areaTabs('areaVisita', true)}
    <div class="kpis">
      ${kpi('Referência', fmtMonth(mes))}
      ${kpi('Turmas visitadas', `${visitadas.length}/${ts.length}`, visitadas.length === ts.length && ts.length ? 'todas visitadas' : `${ts.length - visitadas.length} pendente(s)`, visitadas.length === ts.length ? '' : 'k-amber')}
      ${kpi('Relatórios no mês', doMes.length)}
      ${kpi('Fotos registradas', nFotos, 'salvas no Drive do pedagógico')}
    </div>
    <section class="card">
      <div class="card-head"><h3>Visitas de ${fmtMonth(mes)}</h3><small class="muted">uma visita por turma por mês · o relatório em PDF sai com aspectos observados, fotos e assinaturas</small></div>
      ${ts.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Turma</th><th>Professor(a)</th><th>Situação</th><th>Relatório</th><th>Fotos</th><th></th></tr></thead>
        <tbody>${ts.map(linhaTurma).join('')}</tbody></table></div>` : '<p class="empty">Nenhuma turma ativa neste mês.</p>'}
    </section>
    <section class="card">
      <h3>Controle de ${ano} <small class="muted">✓ visitada · — sem visita · · turma não iniciada</small></h3>
      <div class="table-wrap"><table class="table hist"><thead><tr><th>Turma</th>${meses.map(m => `<th><a href="javascript:void 0" data-action="irMesVisita" data-mes="${m}" class="${m === mes ? 'mes-atual' : ''}">${MESES[+m.slice(5) - 1].slice(0, 3)}</a></th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${todas.map(t => `<tr><td>${esc(shortName(t.nome))}</td>${meses.map(m => `<td>${situacao(t, m)}</td>`).join('')}
        <td><strong>${meses.filter(m => visitasDe(t.id, m).length).length}</strong></td></tr>`).join('')}</tbody></table></div>
    </section>`;
};
actions.setMesVisita = el => { ui.mesVisita = el.value || thisMonth(); render(); };
actions.irMesVisita = el => { ui.mesVisita = el.dataset.mes; render(); window.scrollTo(0, 0); };

function linhaFotoVisita(f) {
  // f: foto já salva (id) ou nova (key + file)
  const src = f.miniatura || f.preview;
  return `<div class="vf-row" data-id="${f.id || ''}" data-key="${f.key || ''}">
    <img src="${src}" ${f.id ? `data-action="verFoto" data-id="${f.id}"` : ''}>
    <input class="input" name="vf_leg" value="${esc(f.legenda || '')}" placeholder="Legenda da foto (ex.: alunos no ensaio de naipe)">
    <button type="button" class="btn ghost small danger-text" data-action="vfRemover">✕</button></div>`;
}

let visitaNovas = {}; // fotos escolhidas ainda não enviadas: key -> File
let visitaRemovidas = [];

function abrirVisita(v) {
  visitaNovas = {}; visitaRemovidas = [];
  const assin = assinaturas();
  const asp = jsonParse(v.aspectos, {});
  const fotos = v.id ? fotosDaVisita(v.id) : [];
  openModal(v.id ? `Visita ${v.numero}` : 'Nova visita à aula', `<form id="visitaForm" class="ata-form">
    <div class="form-grid">
      <label class="field">Nº do relatório<input name="numero" value="${esc(v.numero)}" required></label>
      <label class="field">Data<input type="date" name="data" value="${esc(v.data || todayISO())}" required></label>
      <label class="field">Turma<select name="turma_id" required>${turmaOptions(v.turma_id, true)}</select></label>
      <label class="field">Horário<input type="time" name="hora" value="${esc(v.hora || '')}"></label>
      <label class="field">Professor(a)<input name="professor" value="${esc(v.professor || (turma(v.turma_id) || {}).professor || '')}"></label>
      <label class="field">Alunos presentes<input type="number" name="alunos_presentes" min="0" value="${esc(v.alunos_presentes || '')}"></label>
      <label class="field">Observador(a)<input name="observador" list="obsLista" value="${esc(v.observador || (assin[0] && assin[0].nome) || '')}"></label>
      <label class="field">Cargo do observador(a)<input name="observador_cargo" value="${esc(v.observador_cargo || (assin[0] && assin[0].cargo) || 'Coordenação Pedagógica')}"></label>
      <datalist id="obsLista">${assin.map(a => `<option value="${esc(a.nome)}">`).join('')}</datalist>
    </div>
    <h4>Aspectos observados</h4>
    <div class="vis-asp">${ASPECTOS_VISITA.map(([k, l]) => `<label>${l}<select name="asp_${k}">${Object.entries(NOTAS_VISITA).map(([nk, nl]) => `<option value="${nk}" ${(asp[k] || 'NA') === nk ? 'selected' : ''}>${nl}</option>`).join('')}</select></label>`).join('')}</div>
    <h4>Relato da visita</h4>
    <textarea name="relato" rows="3" placeholder="Descreva a aula observada: conteúdo trabalhado, atividades, dinâmica da turma…">${esc(v.relato || '')}</textarea>
    <div class="form-grid">
      <label class="field">Pontos positivos<textarea name="pontos_positivos" rows="3">${esc(v.pontos_positivos || '')}</textarea></label>
      <label class="field">Pontos a melhorar<textarea name="pontos_melhorar" rows="3">${esc(v.pontos_melhorar || '')}</textarea></label>
    </div>
    <h4>Encaminhamentos</h4>
    <textarea name="encaminhamentos" rows="2">${esc(v.encaminhamentos || '')}</textarea>
    <h4>Fotos e evidências <small class="muted">(salvas no Google Drive do pedagógico; a legenda sai no relatório)</small></h4>
    <div id="vfLista">${fotos.map(linhaFotoVisita).join('')}</div>
    <label class="btn ghost small vf-add">+ Adicionar fotos<input type="file" accept="image/*" multiple hidden id="vfInput"></label>
    <p class="muted small" id="vfProg"></p>
    <div class="form-actions">${v.id ? `<button type="button" class="btn ghost small danger-text" data-action="excluirVisita" data-id="${v.id}">Excluir</button>` : ''}
      <button type="button" class="btn ghost" data-action="closeModal">Cancelar</button>
      <button type="submit" class="btn ghost" name="acao" value="salvar">Salvar</button>
      <button type="submit" class="btn primary" name="acao" value="pdf">Salvar e gerar PDF</button></div>
  </form>`, true);
  const f = $('#visitaForm');
  f.turma_id.addEventListener('change', () => { const t = turma(f.turma_id.value); if (t && t.professor) f.professor.value = t.professor; });
  $('#vfInput').addEventListener('change', ev => {
    [...ev.target.files].forEach(file => {
      const key = uid();
      visitaNovas[key] = file;
      $('#vfLista').insertAdjacentHTML('beforeend', linhaFotoVisita({ key, preview: URL.createObjectURL(file) }));
    });
    ev.target.value = '';
  });
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const acao = ev.submitter ? ev.submitter.value : 'salvar';
    const val = Object.fromEntries(new FormData(f));
    const aspectos = {};
    ASPECTOS_VISITA.forEach(([k]) => { aspectos[k] = val['asp_' + k]; });
    const rec = {
      id: v.id || uid(), numero: val.numero.trim(), status: 'REALIZADA', data: val.data, hora: val.hora, turma_id: val.turma_id,
      professor: val.professor.trim(), observador: val.observador.trim(), observador_cargo: val.observador_cargo.trim(), alunos_presentes: val.alunos_presentes,
      aspectos: JSON.stringify(aspectos), relato: val.relato.trim(), pontos_positivos: val.pontos_positivos.trim(), pontos_melhorar: val.pontos_melhorar.trim(),
      encaminhamentos: val.encaminhamentos.trim(), criado_em: v.criado_em || todayISO(), atualizado_em: todayISO(),
    };
    const btns = f.querySelectorAll('button'); btns.forEach(b => { b.disabled = true; });
    const prog = $('#vfProg');
    try {
      await save('Visitas', rec, true);
      for (const id of visitaRemovidas) await Fotos.remover(id);
      const linhas = [...f.querySelectorAll('.vf-row')];
      let ordem = 0, enviadas = 0;
      const novas = linhas.filter(l => l.dataset.key).length;
      for (const l of linhas) {
        ordem++;
        const legenda = l.querySelector('[name=vf_leg]').value.trim();
        const meta = { legenda, ordem, data: rec.data, mes: rec.data.slice(0, 7), turma_id: rec.turma_id, visita_id: rec.id, tipo: 'VISITA' };
        if (l.dataset.key) {
          prog.textContent = `Enviando foto ${++enviadas} de ${novas} para o Google Drive…`;
          await Fotos.enviar(visitaNovas[l.dataset.key], meta);
        } else if (l.dataset.id) {
          const atual = DB.Fotos.find(x => x.id === l.dataset.id);
          if (atual && (atual.legenda !== legenda || +atual.ordem !== ordem || atual.turma_id !== rec.turma_id || atual.data !== rec.data)) {
            await save('Fotos', Object.assign({}, atual, meta), true);
          }
        }
      }
      toast('Visita salva');
      ui.mesVisita = rec.data.slice(0, 7);
      closeModal(); render();
      if (acao === 'pdf') await gerarPdf(() => PDF.visita(visita(rec.id) || rec));
    } catch (e) { btns.forEach(b => { b.disabled = false; }); prog.textContent = ''; toast(e.message, 'error'); }
  });
}

actions.novaVisita = el => abrirVisita({ numero: proximoNumeroVisita(ui.mesVisita.slice(0, 4)), turma_id: el.dataset.turma || '', data: ui.mesVisita === thisMonth() ? todayISO() : ui.mesVisita + '-15' });
actions.editarVisita = el => abrirVisita(Object.assign({}, visita(el.dataset.id)));
actions.pdfVisita = el => gerarPdf(() => PDF.visita(visita(el.dataset.id)));
actions.excluirVisita = el => confirmBox('Excluir esta visita e as fotos dela? (as fotos vão para a lixeira do Drive)', 'Excluir', async () => {
  for (const f of fotosDaVisita(el.dataset.id)) await Fotos.remover(f.id);
  await remove('Visitas', el.dataset.id);
});
actions.vfRemover = el => {
  const row = el.closest('.vf-row');
  if (row.dataset.id) visitaRemovidas.push(row.dataset.id);
  if (row.dataset.key) delete visitaNovas[row.dataset.key];
  row.remove();
};

if (location.hash.startsWith('#visitas') && !document.getElementById('app').classList.contains('hidden')) render();
