/* Ocorrências e advertências disciplinares dos alunos, com termo formal em PDF. */

const TIPOS_OCOR = { OCORRENCIA: 'Registro de ocorrência', ADV_VERBAL: 'Advertência verbal', ADV_ESCRITA: 'Advertência escrita', SUSPENSAO: 'Suspensão temporária' };
const GRAV_OCOR = { LEVE: 'Leve', MEDIA: 'Média', GRAVE: 'Grave' };
const STATUS_OCOR = { ABERTA: 'Aberta — aguardando ciência', CIENTE: 'Responsável ciente (termo assinado)', ENCERRADA: 'Encerrada' };
const ocorrencia = id => DB.Ocorrencias.find(o => o.id === id);
const ocorrenciasDoAluno = aid => DB.Ocorrencias.filter(o => o.aluno_id === aid);

function proximoNumeroOcor(ano) {
  const nums = DB.Ocorrencias.filter(o => (o.numero || '').endsWith('/' + ano)).map(o => parseInt(o.numero, 10) || 0);
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0') + '/' + ano;
}

ui.areaOcor = ui.areaOcor || '';
routes.ocorrencias = () => {
  setHeader('Ocorrências e advertências', `<button class="btn primary" data-action="novaOcorrencia">+ Nova ocorrência</button>`);
  const lista = DB.Ocorrencias.filter(o => { const t = turma(o.turma_id); return !ui.areaOcor || (t && t.area === ui.areaOcor); })
    .sort((a, b) => (b.data_ocorrencia || '').localeCompare(a.data_ocorrencia || '') || (b.numero || '').localeCompare(a.numero || ''));
  const ano = thisMonth().slice(0, 4);
  const doAno = lista.filter(o => (o.data_ocorrencia || '').startsWith(ano));
  const reincid = {};
  DB.Ocorrencias.forEach(o => { reincid[o.aluno_id] = (reincid[o.aluno_id] || 0) + 1; });
  view.innerHTML = `${areaTabs('areaOcor', true)}
    <div class="kpis">
      ${kpi(`Registros em ${ano}`, doAno.length)}
      ${kpi('Advertências', doAno.filter(o => o.tipo === 'ADV_VERBAL' || o.tipo === 'ADV_ESCRITA').length)}
      ${kpi('Aguardando ciência do responsável', lista.filter(o => o.status === 'ABERTA').length, '', lista.some(o => o.status === 'ABERTA') ? 'k-amber' : '')}
      ${kpi('Alunos reincidentes', Object.values(reincid).filter(n => n > 1).length, '2 ou mais registros', 'k-red')}
    </div>
    <section class="card">
      <div class="card-head"><h3>Registros</h3><small class="muted">O termo em PDF sai na folha timbrada, com assinaturas do Vice-Presidente, do colaborador que presenciou e do responsável</small></div>
      ${lista.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Nº</th><th>Data</th><th>Aluno(a)</th><th>Turma</th><th>Tipo</th><th>Gravidade</th><th>Situação</th><th></th></tr></thead><tbody>
      ${lista.map(o => { const t = turma(o.turma_id) || {}; const n = reincid[o.aluno_id] || 0; return `<tr>
        <td><strong>${esc(o.numero)}</strong></td><td>${fmtDate(o.data_ocorrencia)}</td>
        <td>${esc(o.aluno_nome)}${n > 1 ? ` <span class="flag red" title="Registros deste aluno">${n}×</span>` : ''}</td>
        <td>${t.area ? areaBadge(t.area) : ''} <small>${esc(t.nome || '')}</small></td>
        <td>${esc(TIPOS_OCOR[o.tipo] || '')}</td>
        <td><span class="tag ${o.gravidade === 'GRAVE' ? 'bad' : o.gravidade === 'MEDIA' ? 'warn' : ''}">${esc(GRAV_OCOR[o.gravidade] || '')}</span></td>
        <td>${o.status === 'ABERTA' ? '<span class="flag amber">aguardando ciência</span>' : `<span class="tag ok">${o.status === 'CIENTE' ? 'responsável ciente' : 'encerrada'}</span>`}</td>
        <td class="row-actions"><button class="btn ghost small" data-action="editarOcorrencia" data-id="${o.id}">Editar</button>
          <button class="btn primary small" data-action="pdfOcorrencia" data-id="${o.id}">Termo PDF</button>
          ${o.termo_link ? `<a class="btn ghost small" href="${esc(o.termo_link)}" target="_blank" rel="noopener" title="Termo guardado no Google Drive">Drive</a>` : `<button class="btn ghost small" data-action="planilhaOcorrencia" data-id="${o.id}" title="Preencher a planilha de controle">Planilha</button>`}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="empty">Nenhuma ocorrência registrada.</p>'}
    </section>`;
};

function abrirOcorrencia(o) {
  const opcoesAlunos = tid => alunosDaTurma(tid, true).map(a => `<option value="${a.id}" ${a.id === o.aluno_id ? 'selected' : ''}>${esc(a.nome)}${a.ativo === 'NAO' ? ' (desligado)' : ''}</option>`).join('');
  openModal(o.id ? `Ocorrência ${o.numero}` : 'Nova ocorrência / advertência', `<form id="ocForm" class="form-grid">
    <label class="field">Nº do termo<input name="numero" value="${esc(o.numero)}" required></label>
    <label class="field">Tipo<select name="tipo">${Object.entries(TIPOS_OCOR).map(([k, l]) => `<option value="${k}" ${k === (o.tipo || 'OCORRENCIA') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field">Turma<select name="turma_id" required>${turmaOptions(o.turma_id, true)}</select></label>
    <label class="field">Aluno(a)<select name="aluno_id" required><option value="">Selecione…</option>${o.turma_id ? opcoesAlunos(o.turma_id) : ''}</select></label>
    <label class="field">Data de nascimento<input type="date" name="data_nascimento" value="${esc(o.data_nascimento || '')}"></label>
    <label class="field">Gravidade<select name="gravidade">${Object.entries(GRAV_OCOR).map(([k, l]) => `<option value="${k}" ${k === (o.gravidade || 'LEVE') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field">Responsável legal<input name="responsavel" value="${esc(o.responsavel || '')}"></label>
    <label class="field">Telefone do responsável<input name="telefone" value="${esc(o.telefone || '')}"></label>
    <label class="field">Data da ocorrência<input type="date" name="data_ocorrencia" value="${esc(o.data_ocorrencia || todayISO())}" required></label>
    <label class="field">Horário<input type="time" name="hora" value="${esc(o.hora || '')}"></label>
    <label class="field full">Local<input name="local" value="${esc(o.local || '')}" placeholder="Ex.: Sede do Instituto — sala de ensaio"></label>
    <label class="field full">Relato dos fatos<textarea name="descricao" rows="5" required placeholder="Descreva de forma objetiva o que aconteceu, sem juízo de valor.">${esc(o.descricao || '')}</textarea></label>
    <label class="field full">Providências e medidas adotadas<textarea name="providencias" rows="3" placeholder="Ex.: conversa com o aluno, contato com o responsável, advertência escrita…">${esc(o.providencias || '')}</textarea></label>
    <label class="field">Colaborador(a) que presenciou<input name="testemunha_nome" value="${esc(o.testemunha_nome || '')}" required></label>
    <label class="field">Função do colaborador(a)<input name="testemunha_funcao" value="${esc(o.testemunha_funcao || '')}" placeholder="Ex.: Professor de violino"></label>
    <label class="field">Situação<select name="status">${Object.entries(STATUS_OCOR).map(([k, l]) => `<option value="${k}" ${k === (o.status || 'ABERTA') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field">Data de emissão do termo<input type="date" name="data_emissao" value="${esc(o.data_emissao || todayISO())}"></label>
    <label class="check full"><input type="checkbox" name="assinatura_digital" ${o.assinatura_digital === 'NAO' ? '' : 'checked'}> incluir a assinatura digital do Vice-Presidente (cadastrada em Assinaturas)</label>
    <div class="form-actions full">${o.id ? '<button type="button" class="btn ghost small danger-text" data-action="excluirOcorrencia" data-id="' + o.id + '">Excluir</button>' : ''}
      <button type="button" class="btn ghost" data-action="closeModal">Cancelar</button>
      <button type="submit" class="btn ghost" name="acao" value="salvar">Salvar</button>
      <button type="submit" class="btn primary" name="acao" value="pdf">Salvar e gerar termo PDF</button></div>
  </form>`, true);
  const f = $('#ocForm');
  f.turma_id.addEventListener('change', () => { f.aluno_id.innerHTML = '<option value="">Selecione…</option>' + opcoesAlunos(f.turma_id.value); });
  f.aluno_id.addEventListener('change', () => {
    const a = aluno(f.aluno_id.value); if (!a) return;
    if (a.responsavel) f.responsavel.value = a.responsavel;
    if (a.telefone) f.telefone.value = a.telefone;
    if (a.data_nascimento) f.data_nascimento.value = a.data_nascimento;
  });
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const acao = ev.submitter ? ev.submitter.value : 'salvar';
    const v = Object.fromEntries(new FormData(f));
    const a = aluno(v.aluno_id);
    const rec = Object.assign({}, o, v, {
      id: o.id || uid(), aluno_nome: a ? a.nome : (o.aluno_nome || ''), assinatura_digital: f.assinatura_digital.checked ? 'SIM' : 'NAO',
      criado_em: o.criado_em || todayISO(), atualizado_em: todayISO(),
    });
    try {
      await save('Ocorrencias', rec);
      // completa o cadastro do aluno com os dados informados, se estiverem vazios
      if (a && (!a.responsavel || !a.telefone || !a.data_nascimento)) {
        await save('Alunos', Object.assign({}, a, { responsavel: a.responsavel || v.responsavel, telefone: a.telefone || v.telefone, data_nascimento: a.data_nascimento || v.data_nascimento }), true);
      }
      closeModal(); render();
      await registrarNaPlanilha(rec);
      if (acao === 'pdf') await run(() => PDF.ocorrencia(rec), 'Gerando termo…');
    } catch (e) { /* toast já exibido */ }
  });
}

/** Guarda o termo em PDF no Drive e preenche a planilha de controle de ocorrências. */
async function registrarNaPlanilha(rec) {
  try {
    const r = await run(async () => API.syncOcorrencia(rec, await PDF.ocorrencia(Object.assign({}, rec, { _base64: true }))), 'Registrando na planilha de controle…');
    if (r) upsertLocal('Ocorrencias', Object.assign({ id: rec.id }, { termo_id: r.termo_id, termo_link: r.termo_link }));
    toast('Ocorrência registrada na planilha de controle');
    render();
  } catch (e) { toast('Ocorrência salva, mas não foi possível preencher a planilha: ' + e.message, 'error'); }
}

actions.novaOcorrencia = el => abrirOcorrencia({ numero: proximoNumeroOcor(thisMonth().slice(0, 4)), aluno_id: el.dataset.aluno || '', turma_id: el.dataset.turma || '' });
actions.editarOcorrencia = el => abrirOcorrencia(Object.assign({}, ocorrencia(el.dataset.id)));
actions.excluirOcorrencia = el => confirmBox('Excluir este registro de ocorrência? A linha da planilha de controle também será removida e o termo irá para a lixeira do Drive.', 'Excluir', async () => {
  try { await API.removerOcorrencia(el.dataset.id); } catch (e) { /* segue com a exclusão no sistema */ }
  await remove('Ocorrencias', el.dataset.id);
});
actions.planilhaOcorrencia = el => registrarNaPlanilha(ocorrencia(el.dataset.id));
actions.pdfOcorrencia = el => run(() => PDF.ocorrencia(ocorrencia(el.dataset.id)), 'Gerando termo…').catch(() => {});

if (location.hash.startsWith('#ocorrencias') && !document.getElementById('app').classList.contains('hidden')) render();
