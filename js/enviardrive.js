/* "Enviar pro Drive": gera os relatórios do mês e grava cada um na sua pasta do PEDAGOGICO-2026. */

const ENVIOS_DRIVE = [
  { k: 'confMensal', l: 'Conferência mensal (todas as turmas)', pasta: 'CONFERÊNCIA MENSAL E ANUAL' },
  { k: 'confTurmas', l: 'Conferência de cada turma no ano', pasta: 'CONFERÊNCIA MENSAL E ANUAL' },
  { k: 'confAnual', l: 'Conferência anual', pasta: 'CONFERÊNCIA MENSAL E ANUAL' },
  { k: 'reunioes', l: 'Atas das reuniões do mês', pasta: 'REUNIÕES PEDAGÓGICAS' },
  { k: 'visitas', l: 'Relatórios das visitas do mês (com fotos)', pasta: 'VISITAS PEDAGÓGICAS' },
  { k: 'ocorrencias', l: 'Termos de ocorrência/advertência do mês', pasta: 'OCORRÊNCIAS/ADVERTÊNCIAS' },
];

/** Monta a lista de envios: { destino, subpasta, rotulo, gerar() } */
function tarefasEnvio(sel, mes) {
  const ano = mes.slice(0, 4), out = [];
  const add = (destino, subpasta, rotulo, gerar) => out.push({ destino, subpasta, rotulo, gerar });
  if (sel.confMensal) add('conferencia', mes, `Conferência mensal ${fmtMonth(mes)}`, () => PDF.conferencia(mes, ''));
  if (sel.confTurmas) turmasConferencia('', mes).forEach(t => add('conferencia', `${ano} - Por turma`, `Conferência ${shortName(t.nome).replace(/\//g, '-')} ${ano}`, () => PDF.conferenciaTurma(t.id, ano)));
  if (sel.confAnual) add('conferencia', `${ano} - Anual`, `Conferência anual ${ano}`, () => PDF.conferenciaAnual(ano, ''));
  if (sel.reunioes) DB.Reunioes.filter(r => r.mes === mes).forEach(r => add('reunioes', mes, `Ata ${(r.numero || '').replace('/', '-')} ${r.professor || r.assunto || ''}`, () => PDF.ata(reuniaoObj(r))));
  if (sel.visitas) DB.Visitas.filter(v => (v.data || '').startsWith(mes)).forEach(v => add('visitas', mes, `Visita ${(v.numero || '').replace('/', '-')} ${shortName((turma(v.turma_id) || {}).nome || '').replace(/\//g, '-')}`, () => PDF.visita(v)));
  if (sel.ocorrencias) DB.Ocorrencias.filter(o => (o.data_ocorrencia || '').startsWith(mes))
    .forEach(o => out.push({ destino: 'ocorrencias', rotulo: `Termo ${o.numero} ${o.aluno_nome || ''}`, ocorrencia: o }));
  return out;
}

actions.enviarDrive = () => {
  const h = location.hash;
  const mes = (h.startsWith('#reunioes') ? ui.mesReuniao : h.startsWith('#visitas') ? ui.mesVisita : ui.mes) || thisMonth();
  const lista = assinaturas();
  openModal('Enviar pro Drive', `<form id="envForm" class="form-grid">
    <p class="muted small full">Gera os relatórios em PDF e grava cada um na sua pasta do <strong>PEDAGOGICO-2026</strong> no Google Drive (em uma subpasta do mês). Se o arquivo já existir, ele é substituído pela versão nova.</p>
    <label class="field">Mês de referência<input type="month" name="mes" value="${mes}" required></label>
    <label class="field">Quem assina<select name="assina"><option value="">Sem assinatura (linha em branco)</option>${lista.map(a => `<option value="${esc(a.nome)}" ${a.imagem ? 'selected' : ''}>${esc(a.nome)}${a.imagem ? '' : ' (sem imagem)'}</option>`).join('')}</select></label>
    <div class="full env-lista">${ENVIOS_DRIVE.map(e => `<label class="check"><input type="checkbox" name="${e.k}" ${e.k === 'confTurmas' ? '' : 'checked'}> ${e.l} <small class="muted">→ ${e.pasta}</small></label>`).join('')}</div>
    <div class="full" id="envProg"></div>
    <div class="form-actions full"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary">Enviar pro Drive</button></div></form>`, true);
  $('#envForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target, v = Object.fromEntries(new FormData(f));
    const sel = {}; ENVIOS_DRIVE.forEach(e => { sel[e.k] = !!v[e.k]; });
    const tarefas = tarefasEnvio(sel, v.mes);
    const prog = $('#envProg');
    if (!tarefas.length) { prog.innerHTML = '<p class="warn">Nada para enviar neste mês com as opções marcadas.</p>'; return; }
    f.querySelectorAll('button,input,select').forEach(b => { b.disabled = true; });
    const assinante = lista.find(a => a.nome === v.assina) || null;
    await PDF.setAssinante(assinante);
    const linhas = tarefas.map((t, i) => `<li id="env${i}"><span class="env-st">⏳</span> ${esc(t.rotulo)}</li>`).join('');
    prog.innerHTML = `<ul class="env-prog">${linhas}</ul>`;
    let ok = 0, erro = 0;
    for (let i = 0; i < tarefas.length; i++) {
      const t = tarefas[i], li = $('#env' + i);
      li.querySelector('.env-st').textContent = '📤';
      try {
        if (t.ocorrencia) {
          // termo de ocorrência: grava no Drive e atualiza a planilha de controle
          const pdf = await PDF.ocorrencia(Object.assign({}, t.ocorrencia, { _base64: true }));
          const r = await API.syncOcorrencia(t.ocorrencia, pdf);
          if (r) upsertLocal('Ocorrencias', { id: t.ocorrencia.id, termo_id: r.termo_id, termo_link: r.termo_link });
        } else {
          const pdfs = await PDF.capturar(t.gerar);
          for (const p of pdfs) await API.enviarDrive(t.destino, t.subpasta, pdfs.length === 1 ? t.rotulo.trim() : p.nome.replace(/_/g, ' '), p.pdf);
        }
        li.querySelector('.env-st').textContent = '✅'; ok++;
      } catch (e) {
        li.querySelector('.env-st').textContent = '⚠️'; li.insertAdjacentHTML('beforeend', ` <small class="error">${esc(e.message)}</small>`); erro++;
      }
    }
    prog.insertAdjacentHTML('beforeend', `<p class="${erro ? 'warn' : 'ok-text'}"><strong>${ok} arquivo(s) enviado(s)${erro ? `, ${erro} com erro` : ''}.</strong></p>`);
    const btns = f.querySelector('.form-actions');
    btns.innerHTML = '<button type="button" class="btn primary" data-action="closeModal">Fechar</button>';
  });
};
