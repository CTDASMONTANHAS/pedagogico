/* Fotos de aulas, eventos e visitas: comprovação que entra nos relatórios em PDF. */

const TIPOS_FOTO = { AULA: 'Aula', EVENTO: 'Evento / apresentação', VISITA: 'Visita / supervisão', OUTRO: 'Outro' };
const PARTE = 45000; // caracteres por célula da planilha (limite 50 mil)

const Fotos = {
  cache: {},
  /** Imagens completas (dataURL) das fotos pedidas, buscadas na planilha sob demanda. */
  async carregar(ids) {
    const faltam = ids.filter(id => !this.cache[id]);
    for (let i = 0; i < faltam.length; i += 6) {
      const lote = await API.getFotos(faltam.slice(i, i + 6));
      lote.forEach(f => { this.cache[f.id] = f.imagem; });
    }
    const out = {};
    ids.forEach(id => { if (this.cache[id]) out[id] = this.cache[id]; });
    return out;
  },
};

/** Fotos filtradas. turmas: lista de ids (fotos sem turma, como eventos e visitas gerais, entram se forem da área). */
function fotosFiltro({ turmas, de, ate, evento, tipo, area } = {}) {
  const areaDe = f => (turma(f.turma_id) || DB.Eventos.find(e => e.id === f.evento_id) || {}).area;
  return DB.Fotos.filter(f => {
    if ((de && (f.data || '') < de) || (ate && (f.data || '') > ate) || (tipo && f.tipo !== tipo)) return false;
    if (evento) return f.evento_id === evento;
    if (turmas) return turmas.includes(f.turma_id) || (!f.turma_id && (!area || !areaDe(f) || areaDe(f) === area));
    return !area || areaDe(f) === area || !areaDe(f);
  }).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
}

function legendaFoto(f) {
  const t = turma(f.turma_id), e = DB.Eventos.find(x => x.id === f.evento_id);
  return [fmtDate(f.data), TIPOS_FOTO[f.tipo] || '', e ? e.nome : t ? t.nome : '', f.legenda].filter(Boolean).join(' · ');
}

/** Redimensiona e comprime para JPEG; diminui a qualidade até caber no limite. */
async function comprimirImagem(file, max, limite) {
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Arquivo não é uma imagem válida')); img.src = url; });
  let tam = max, q = 0.78, out, w, h;
  for (let tent = 0; tent < 8; tent++) {
    const k = Math.min(1, tam / Math.max(img.naturalWidth, img.naturalHeight));
    w = Math.round(img.naturalWidth * k); h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    out = c.toDataURL('image/jpeg', q);
    if (!limite || out.length <= limite) break;
    if (q > 0.5) q -= 0.1; else tam = Math.round(tam * 0.85);
  }
  return { url: out, w, h };
}

/* ================= TELA ================= */
ui.fotoMes = ui.fotoMes || thisMonth();
ui.fotoTurma = ui.fotoTurma || '';
routes.fotos = () => {
  setHeader('Fotos e evidências', `<input type="month" class="input" value="${ui.fotoMes}" data-change="setFotoMes">
    <button class="btn primary" data-action="novaFoto">+ Adicionar fotos</button>`);
  const doMes = DB.Fotos.filter(f => (f.mes || (f.data || '').slice(0, 7)) === ui.fotoMes);
  const lista = doMes.filter(f => !ui.fotoTurma || f.turma_id === ui.fotoTurma || f.evento_id === ui.fotoTurma)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const semFoto = turmasConferencia('', ui.fotoMes).filter(t => !doMes.some(f => f.turma_id === t.id));
  view.innerHTML = `
    <div class="kpis">
      ${kpi('Fotos no mês', doMes.length, fmtMonth(ui.fotoMes))}
      ${kpi('Turmas com registro', turmasConferencia('', ui.fotoMes).length - semFoto.length, `de ${turmasConferencia('', ui.fotoMes).length}`)}
      ${kpi('Eventos / visitas', doMes.filter(f => f.tipo === 'EVENTO' || f.tipo === 'VISITA').length)}
      ${kpi('Total no sistema', DB.Fotos.length)}
    </div>
    <section class="card">
      <div class="card-head"><h3>Registro fotográfico</h3>
        <label class="muted small">Filtrar <select data-change="setFotoTurma"><option value="">Todas as turmas e eventos</option>${turmaOptions(ui.fotoTurma).replace('<optgroup', '<optgroup')}
          <optgroup label="Eventos">${DB.Eventos.map(e => `<option value="${e.id}" ${e.id === ui.fotoTurma ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</optgroup></select></label></div>
      <p class="muted small">As fotos entram como comprovação nos relatórios em PDF (prestação de contas, relatório pedagógico, conferência da turma, evento e relatório fotográfico de visitas).</p>
      ${lista.length ? `<div class="foto-grid">${lista.map(f => `<figure class="foto-card">
        <img src="${f.miniatura}" alt="" data-action="verFoto" data-id="${f.id}">
        <figcaption><span class="tag">${esc(TIPOS_FOTO[f.tipo] || '')}</span> ${esc(legendaFoto(f).replace(/^[^·]*· [^·]*· /, ''))}<br><small class="muted">${fmtDate(f.data)}</small></figcaption>
        <div class="row-actions"><button class="btn ghost small" data-action="editarFoto" data-id="${f.id}">Editar</button>
          <button class="btn ghost small danger-text" data-action="excluirFoto" data-id="${f.id}">Excluir</button></div></figure>`).join('')}</div>`
        : '<p class="empty">Nenhuma foto neste mês.</p>'}
    </section>
    ${semFoto.length ? `<section class="card"><h3>Turmas sem foto em ${fmtMonth(ui.fotoMes)} <span class="count">${semFoto.length}</span></h3>
      <p class="muted small">${semFoto.map(t => esc(shortName(t.nome))).join(' · ')}</p></section>` : ''}`;
};
actions.setFotoMes = el => { ui.fotoMes = el.value || thisMonth(); render(); };
actions.setFotoTurma = el => { ui.fotoTurma = el.value; render(); };

function formFoto(f, novo) {
  const evOpts = DB.Eventos.slice().sort((a, b) => (b.data_evento || '').localeCompare(a.data_evento || ''))
    .map(e => `<option value="${e.id}" ${e.id === f.evento_id ? 'selected' : ''}>${fmtDate(e.data_evento)} — ${esc(e.nome)}</option>`).join('');
  openModal(novo ? 'Adicionar fotos' : 'Editar foto', `<form id="fotoForm" class="form-grid">
    ${novo ? `<label class="field full">Fotos (pode selecionar várias)<input type="file" name="arquivos" accept="image/*" multiple required></label>` : `<div class="full"><img src="${f.miniatura}" class="foto-prev"></div>`}
    <label class="field">Tipo<select name="tipo">${Object.entries(TIPOS_FOTO).map(([k, l]) => `<option value="${k}" ${k === (f.tipo || 'AULA') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field">Data<input type="date" name="data" value="${esc(f.data || todayISO())}" required></label>
    <label class="field">Turma<select name="turma_id"><option value="">— nenhuma —</option>${turmaOptions(f.turma_id)}</select></label>
    <label class="field">Evento<select name="evento_id"><option value="">— nenhum —</option>${evOpts}</select></label>
    <label class="field full">Legenda / descrição<input name="legenda" value="${esc(f.legenda || '')}" placeholder="Ex.: Ensaio geral da orquestra; visita da coordenação à turma"></label>
    <p class="muted small full" id="fotoProg"></p>
    <div class="form-actions full"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>
  </form>`);
  const form = $('#fotoForm');
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(form));
    const meta = { tipo: v.tipo, data: v.data, mes: v.data.slice(0, 7), turma_id: v.turma_id, evento_id: v.evento_id, legenda: v.legenda.trim() };
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (!novo) { await save('Fotos', Object.assign({}, f, meta)); closeModal(); render(); return; }
      const arqs = [...form.arquivos.files];
      for (let i = 0; i < arqs.length; i++) {
        $('#fotoProg').textContent = `Enviando foto ${i + 1} de ${arqs.length}…`;
        const grande = await comprimirImagem(arqs[i], 1400, PARTE * 8);
        const mini = await comprimirImagem(arqs[i], 220, 0);
        const dados = {};
        for (let k = 0; k < 8; k++) dados['p' + (k + 1)] = grande.url.slice(k * PARTE, (k + 1) * PARTE);
        const rec = Object.assign({ id: uid(), miniatura: mini.url, largura: grande.w, altura: grande.h, partes: Math.ceil(grande.url.length / PARTE), criado_em: todayISO() }, meta);
        const salvo = await API.saveFoto(rec, dados);
        Fotos.cache[rec.id] = grande.url;
        DB.Fotos.push(Object.assign({}, rec, salvo || {}));
      }
      toast(`${arqs.length} foto(s) adicionada(s)`);
      ui.fotoMes = meta.mes; closeModal(); render();
    } catch (e) { btn.disabled = false; toast(e.message, 'error'); }
  });
}
actions.novaFoto = () => formFoto({ turma_id: turma(ui.fotoTurma) ? ui.fotoTurma : '', evento_id: DB.Eventos.some(e => e.id === ui.fotoTurma) ? ui.fotoTurma : '', data: ui.fotoMes === thisMonth() ? todayISO() : ui.fotoMes + '-15' }, true);
actions.editarFoto = el => formFoto(DB.Fotos.find(f => f.id === el.dataset.id), false);
actions.excluirFoto = el => confirmBox('Excluir esta foto?', 'Excluir', async () => {
  await API.removeFoto(el.dataset.id);
  DB.Fotos = DB.Fotos.filter(f => f.id !== el.dataset.id); delete Fotos.cache[el.dataset.id];
});
actions.verFoto = async el => {
  const f = DB.Fotos.find(x => x.id === el.dataset.id);
  openModal(legendaFoto(f), `<div class="foto-full"><img src="${f.miniatura}" id="fotoGrande"></div>`, true);
  try { const m = await Fotos.carregar([f.id]); if (m[f.id] && $('#fotoGrande')) $('#fotoGrande').src = m[f.id]; } catch (e) { /* fica a miniatura */ }
};

if (location.hash.startsWith('#fotos') && !document.getElementById('app').classList.contains('hidden')) render();
