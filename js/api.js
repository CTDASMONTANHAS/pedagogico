/* Comunicação com o Apps Script (planilha) — ou armazenamento local no modo demonstração. */
const SHEETS = ['Turmas', 'Alunos', 'Conferencias', 'Frequencia', 'Contatos', 'Eventos', 'EventoParticipantes'];

const API = {
  get demo() { return !window.APP_CONFIG.API_URL; },
  get key() { try { return localStorage.getItem('ped_key') || ''; } catch (e) { return ''; } },
  set key(v) { try { v ? localStorage.setItem('ped_key', v) : localStorage.removeItem('ped_key'); } catch (e) { /* sem storage */ } },

  async call(payload) {
    if (this.demo) return Demo.handle(payload);
    const res = await fetch(window.APP_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
      body: JSON.stringify(Object.assign({ key: this.key }, payload)),
    });
    const json = await res.json();
    if (!json.ok) {
      const err = new Error(json.error || 'Erro na planilha');
      err.auth = json.auth === false;
      throw err;
    }
    return json.data;
  },

  ping() { return this.call({ action: 'ping' }); },
  getAll() { return this.call({ action: 'getAll' }); },
  save(sheet, record) { return this.call({ action: 'save', sheet, record }); },
  saveMany(sheet, records) { return this.call({ action: 'saveMany', sheet, records }); },
  remove(sheet, id) { return this.call({ action: 'remove', sheet, id }); },
  removeMany(sheet, ids) { return this.call({ action: 'removeMany', sheet, ids }); },
  replaceFrequencia(turma_id, datas, registros) { return this.call({ action: 'replaceFrequencia', turma_id, datas, registros }); },
};

const Demo = {
  load() {
    try { return JSON.parse(localStorage.getItem('ped_demo_db')) || this.empty(); } catch (e) { return this.mem || (this.mem = this.empty()); }
  },
  store(db) {
    this.mem = db;
    try { localStorage.setItem('ped_demo_db', JSON.stringify(db)); } catch (e) { /* memória apenas */ }
  },
  empty() { const o = {}; SHEETS.forEach(s => { o[s] = []; }); return o; },
  handle(p) {
    const db = this.load();
    const clone = x => JSON.parse(JSON.stringify(x));
    const upsert = (sheet, rec) => {
      if (!rec.id) rec.id = uid();
      const list = db[sheet];
      const i = list.findIndex(r => r.id === rec.id);
      if (i >= 0) list[i] = Object.assign({}, list[i], rec); else list.push(Object.assign({}, rec));
      return clone(i >= 0 ? list[i] : list[list.length - 1]);
    };
    let out;
    switch (p.action) {
      case 'ping': out = true; break;
      case 'getAll': out = clone(db); break;
      case 'save': out = upsert(p.sheet, p.record); break;
      case 'saveMany': out = p.records.map(r => upsert(p.sheet, r)); break;
      case 'remove': db[p.sheet] = db[p.sheet].filter(r => r.id !== p.id); break;
      case 'removeMany': db[p.sheet] = db[p.sheet].filter(r => !p.ids.includes(r.id)); break;
      case 'replaceFrequencia':
        db.Frequencia = db.Frequencia.filter(r => !(r.turma_id === p.turma_id && p.datas.includes(r.data)));
        p.registros.forEach(r => db.Frequencia.push(Object.assign({ id: uid(), turma_id: p.turma_id }, r)));
        out = p.registros.length;
        break;
      default: throw new Error('Ação desconhecida');
    }
    this.store(db);
    return Promise.resolve(out);
  },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
