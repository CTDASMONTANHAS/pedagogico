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
routes.visitas = () => {
  setHeader('Visitas às aulas', `<input type="month" class="input" value="${ui.mesVisita}" data-change="setMesVisita">
    <button class="btn primary" data-action="novaVisita">+ Nova visita</button>`);
  const mes = ui.mesVisita;
  const doMes = DB.Visitas.filter(v => (v.data || '').startsWith(mes)).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const ts = turmasConferencia('', mes);
  const visitadas = new Set(doMes.map(v => v.turma_id));
  const semVisita = ts.filter(t => !visitadas.has(t.id));
  const nFotos = doMes.reduce((s, v) => s + fotosDaVisita(v.id).length, 0);
  view.innerHTML = `
    <div class="kpis">
      ${kpi('Visitas no mês', doMes.length, fmtMonth(mes))}
      ${kpi('Turmas visitadas', `${ts.filter(t => visitadas.has(t.id)).length}/${ts.length}`, '', semVisita.length ? 'k-amber' : '')}
      ${kpi('Fotos registradas', nFotos, 'salvas no Drive do pedagógico')}
      ${kpi('Visitas no ano', DB.Visitas.filter(v => (v.data || '').startsWith(mes.slice(0, 4))).length)}
    </div>
    <section class="card">
      <div class="card-head"><h3>Relatórios de visita — ${fmtMonth(mes)}</h3><small class="muted">o PDF sai na folha timbrada, com aspectos observados, fotos com legenda e assinaturas</small></div>
      ${doMes.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Nº</th><th>Data</th><th>Turma</th><th>Professor(a)</th><th>Observador(a)</th><th>Fotos</th><th></th></tr></thead><tbody>
      ${doMes.map(v => { const t = turma(v.turma_id) || {}; const fs = fotosDaVisita(v.id); return `<tr>
        <td><strong>${esc(v.numero)}</strong></td><td>${fmtDate(v.data)}${v.hora ? ' ' + esc(v.hora) : ''}</td>
        <td>${t.area ? areaBadge(t.area) : ''} ${esc(t.nome || '')}</td><td>${esc(v.professor || t.professor || '')}</td><td>${esc(v.observador || '')}</td>
        <td><div class="foto-mini">${fs.slice(0, 4).map(f => `<img src="${f.miniatura}" data-action="verFoto" data-id="${f.id}" title="${esc(f.legenda || '')}">`).join('')}${fs.length > 4 ? `<span>+${fs.length - 4}</span>` : ''}</div></td>
        <td class="row-actions"><button class="btn ghost small" data-action="editarVisita" data-id="${v.id}">Editar</button>
          <button class="btn primary small" data-action="pdfVisita" data-id="${v.id}">PDF</button></td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="empty">Nenhuma visita registrada neste mês.</p>'}
    </section>
    ${semVisita.length ? `<section class="card"><h3>Turmas ainda sem visita em ${fmtMonth(mes)} <span class="count">${semVisita.length}</span></h3>
      <div class="chips-list">${semVisita.map(t => `<button class="btn ghost small" data-action="novaVisita" data-turma="${t.id}">${esc(shortName(t.nome))}</button>`).join('')}</div></section>` : ''}`;
};
actions.setMesVisita = el => { ui.mesVisita = el.value || thisMonth(); render(); };

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
