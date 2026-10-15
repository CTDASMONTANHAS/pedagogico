/* Fotos (comprovação): enviadas dentro do relatório de visita às aulas e guardadas no Google Drive do pedagógico. */

const TIPOS_FOTO = { VISITA: 'Visita à aula', AULA: 'Aula', EVENTO: 'Evento / apresentação', OUTRO: 'Outro' };

const Fotos = {
  cache: {},
  /** Imagens completas (dataURL) das fotos pedidas, buscadas no Drive sob demanda. */
  async carregar(ids) {
    const faltam = ids.filter(id => !this.cache[id]);
    for (let i = 0; i < faltam.length; i += 4) {
      const lote = await API.getFotos(faltam.slice(i, i + 4));
      lote.forEach(f => { this.cache[f.id] = f.imagem; });
    }
    const out = {};
    ids.forEach(id => { if (this.cache[id]) out[id] = this.cache[id]; });
    return out;
  },
  /** Comprime e envia uma foto para o Drive; devolve o registro salvo. */
  async enviar(file, meta) {
    const grande = await comprimirImagem(file, 1600, 0);
    const mini = await comprimirImagem(file, 220, 0);
    const rec = Object.assign({ id: uid(), miniatura: mini.url, largura: grande.w, altura: grande.h, criado_em: todayISO() }, meta);
    const salvo = await API.saveFoto(rec, grande.url);
    Fotos.cache[rec.id] = grande.url;
    const final = Object.assign({}, rec, salvo || {});
    DB.Fotos.push(final);
    return final;
  },
  async remover(id) {
    await API.removeFoto(id);
    DB.Fotos = DB.Fotos.filter(f => f.id !== id);
    delete Fotos.cache[id];
  },
};

/** Fotos filtradas. turmas: lista de ids (fotos sem turma, como eventos, entram se forem da área). */
function fotosFiltro({ turmas, de, ate, evento, tipo, area, visita } = {}) {
  const areaDe = f => (turma(f.turma_id) || DB.Eventos.find(e => e.id === f.evento_id) || {}).area;
  return DB.Fotos.filter(f => {
    if (visita) return f.visita_id === visita;
    if ((de && (f.data || '') < de) || (ate && (f.data || '') > ate) || (tipo && f.tipo !== tipo)) return false;
    if (evento) return f.evento_id === evento;
    if (turmas) return turmas.includes(f.turma_id) || (!f.turma_id && (!area || !areaDe(f) || areaDe(f) === area));
    return !area || areaDe(f) === area || !areaDe(f);
  }).sort((a, b) => (a.data || '').localeCompare(b.data || '') || (+a.ordem || 0) - (+b.ordem || 0));
}

function legendaFoto(f) {
  const t = turma(f.turma_id), e = DB.Eventos.find(x => x.id === f.evento_id);
  return [fmtDate(f.data), e ? e.nome : t ? t.nome : '', f.legenda].filter(Boolean).join(' · ');
}

/** Redimensiona e comprime para JPEG; diminui a qualidade até caber no limite (0 = sem limite). */
async function comprimirImagem(file, max, limite) {
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Arquivo não é uma imagem válida')); img.src = url; });
  let tam = max, q = 0.8, out, w, h;
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

actions.verFoto = async el => {
  const f = DB.Fotos.find(x => x.id === el.dataset.id);
  if (!f) return;
  const box = document.createElement('div');
  box.className = 'foto-zoom';
  box.innerHTML = `<figure><img src="${f.miniatura}"><figcaption>${esc(legendaFoto(f))}</figcaption></figure>`;
  box.onclick = () => box.remove();
  document.body.appendChild(box);
  try { const m = await Fotos.carregar([f.id]); if (m[f.id]) box.querySelector('img').src = m[f.id]; } catch (e) { /* fica a miniatura */ }
};
