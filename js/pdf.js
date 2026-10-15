/* Relatórios em PDF no padrão da folha timbrada do Instituto (logo, cabeçalho e rodapé). */
const PDF = (() => {
  const M = 25.4; // margens da folha modelo (1 polegada)
  let logoData = null;
  let assinante = null; // { nome, cargo, imagem, w, h } escolhido ao gerar o relatório

  /** Define quem assina os próximos relatórios (null = linha em branco). */
  async function setAssinante(rec) {
    if (!rec) { assinante = null; return; }
    assinante = Object.assign({}, rec);
    if (rec.imagem) {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = rec.imagem; });
      assinante.w = img.naturalWidth; assinante.h = img.naturalHeight;
    }
  }

  async function loadLogo() {
    if (logoData) return logoData;
    const blob = await (await fetch('assets/logo.png')).blob();
    logoData = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    return logoData;
  }

  function drawLetterhead(doc) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
      if (logoData) doc.addImage(logoData, 'PNG', M - 2, 3, 34, 34);
      const tx = M + 50.8 - 4;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(153);
      doc.text('INSTITUTO TRÊS PONTÕES DE AÇÃO SOCIAL E CULTURAL', tx, 19);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('INSTITUTO CULTURAL DAS MONTANHAS', tx, 24.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0);
      doc.text('Rua Alcino Martins de Souza, 110, Afonso Cláudio - Espírito Santo–ES , Brasil, CEP: 29600-000. CNPJ 51.892.817/0001-52', W / 2, H - 16, { align: 'center' });
      doc.text('E-mail: institutodasmontanhas@gmail.com  - Telefone: +55 27 99699-6584.', W / 2, H - 12.5, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(String(i), W - M, H - 6, { align: 'right' });
    }
  }

  async function create(title, subtitle, orientation) {
    await loadLogo();
    const doc = new jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: orientation || 'portrait' });
    const W = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0);
    doc.text(title.toUpperCase(), W / 2, 46, { align: 'center' });
    let y = 46;
    if (subtitle) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60);
      (Array.isArray(subtitle) ? subtitle : [subtitle]).forEach(s => { y += 5.5; doc.text(s, W / 2, y, { align: 'center' }); });
    }
    doc.setTextColor(0);
    return { doc, y: y + 8 };
  }

  const TABLE = {
    margin: { left: M, right: M, top: 44, bottom: 24 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [20, 20, 20] },
    headStyles: { fillColor: [45, 45, 45], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 246, 246] },
  };
  function table(doc, y, opts) {
    doc.autoTable(Object.assign({}, TABLE, { startY: y }, opts, {
      styles: Object.assign({}, TABLE.styles, opts.styles || {}),
      headStyles: Object.assign({}, TABLE.headStyles, opts.headStyles || {}),
    }));
    return doc.lastAutoTable.finalY + 6;
  }

  function section(doc, y, text) {
    y = ensure(doc, y, 14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(0);
    doc.text(text, M, y);
    return y + 4;
  }

  function paragraph(doc, y, text, opts) {
    const W = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', (opts && opts.bold) ? 'bold' : 'normal');
    doc.setFontSize((opts && opts.size) || 10);
    const lines = doc.splitTextToSize(text, W - 2 * M);
    const lh = ((opts && opts.size) || 10) * 0.48;
    lines.forEach(l => { y = ensure(doc, y, lh + 1); doc.text(l, M, y, { align: 'left', maxWidth: W - 2 * M }); y += lh; });
    return y + 2;
  }

  function ensure(doc, y, need) {
    const H = doc.internal.pageSize.getHeight();
    if (y + need > H - 26) { doc.addPage(); return 48; }
    return y;
  }

  function image(doc, y, dataUrl, w, h) {
    y = ensure(doc, y, h + 4);
    const W = doc.internal.pageSize.getWidth();
    doc.addImage(dataUrl, 'PNG', (W - w) / 2, y, w, h);
    return y + h + 6;
  }

  function signature(doc, y, label) {
    y = ensure(doc, y + 6, 34);
    const W = doc.internal.pageSize.getWidth();
    const d = new Date();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Afonso Cláudio - ES, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}.`, W - M, y, { align: 'right' });
    y += 22;
    if (assinante && assinante.imagem && assinante.w) {
      // imagem da assinatura sobre a linha, até 62 x 20 mm mantendo a proporção
      let w = 62, h = w * assinante.h / assinante.w;
      if (h > 20) { h = 20; w = h * assinante.w / assinante.h; }
      doc.addImage(assinante.imagem, 'PNG', W / 2 - w / 2, y - h + 2, w, h);
    }
    doc.line(W / 2 - 40, y, W / 2 + 40, y);
    if (assinante) {
      doc.setFont('helvetica', 'bold');
      doc.text(assinante.nome, W / 2, y + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(assinante.cargo || label || 'Coordenação Pedagógica', W / 2, y + 9.5, { align: 'center' });
      return y + 16;
    }
    doc.text(label || 'Coordenação Pedagógica', W / 2, y + 5, { align: 'center' });
    return y + 12;
  }

  /** Renderiza um gráfico Chart.js fora da tela e devolve PNG. */
  function chartImage(config, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.style.cssText = `position:fixed;left:-9999px;width:${w}px;height:${h}px`;
    document.body.appendChild(canvas);
    const cfg = Object.assign({}, config);
    cfg.options = Object.assign({}, config.options, { responsive: false, animation: false, devicePixelRatio: 1 });
    cfg.plugins = [{ id: 'bg', beforeDraw: c => { const x = c.ctx; x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.restore(); } }];
    Chart.defaults.font.family = 'Helvetica, Arial, sans-serif';
    const chart = new Chart(canvas, cfg);
    const url = chart.toBase64Image('image/png');
    chart.destroy(); canvas.remove();
    return url;
  }

  function save(doc, filename) {
    drawLetterhead(doc);
    doc.save(filename.replace(/[^\w\-áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ ]+/g, '').replace(/\s+/g, '_') + '.pdf');
  }

  const areaTxt = area => area ? AREAS[area] : 'Música e Esporte';
  const statusTxt = v => (CONF_STATUS[v || ''] || CONF_STATUS['']).label;
  const periodTxt = (de, ate) => (de || ate) ? `Período: ${de ? fmtDate(de) : 'início'} a ${ate ? fmtDate(ate) : 'hoje'}` : 'Período: todos os registros';

  /* ---------- Relatórios ---------- */

  async function relConferencia(mes, area) {
    const { doc, y: y0 } = await create('Relatório de Conferência Pedagógica', [`Área: ${areaTxt(area)}`, `Referência: ${fmtMonth(mes)}`], 'landscape');
    let y = y0;
    const areas = area ? [area] : Object.keys(AREAS);
    for (const ar of areas) {
      const r = resumoConferencia(mes, ar);
      y = section(doc, y, `${AREAS[ar]} — ${r.turmas} turma(s) · ${r.pct == null ? 0 : r.pct}% dos itens em dia`);
      const body = turmasConferencia(ar, mes).map(t => {
        const c = conferencia(t.id, mes) || {};
        return [t.nome, t.professor || '', ...CONF_ITENS.map(([k]) => c[k] ? statusTxt(c[k]) : '—'), c.observacoes || ''];
      });
      y = table(doc, y, {
        head: [['Turma', 'Professor(a)', 'Plano de aula', 'Relatório de aulas', 'Registro de chamada', 'Fechamento mensal', 'Observações']],
        body: body.length ? body : [['Nenhuma turma cadastrada', '', '', '', '', '', '']],
        styles: { fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 72 }, 1: { cellWidth: 38 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 25 }, 5: { cellWidth: 25 } },
        didParseCell: d => {
          if (d.section === 'body' && d.column.index >= 2 && d.column.index <= 5) {
            const t = d.cell.raw;
            d.cell.styles.halign = 'center';
            if (t === 'Em dia') d.cell.styles.textColor = [20, 110, 50];
            else if (t === 'Pendente') { d.cell.styles.textColor = [180, 30, 30]; d.cell.styles.fontStyle = 'bold'; }
            else if (t === 'Parcial') d.cell.styles.textColor = [170, 100, 0];
          }
        },
      });
    }
    // Resumo por item
    y = section(doc, y, 'Resumo por item');
    y = table(doc, y, {
      head: [['Item', 'Em dia', 'Parcial', 'Pendente', 'Não conferido', '% em dia']],
      body: CONF_ITENS.map(([k, l]) => {
        const ts = areas.flatMap(ar => turmasConferencia(ar, mes));
        const n = s => ts.filter(t => ((conferencia(t.id, mes) || {})[k] || '') === s).length;
        return [l, n('EM_DIA'), n('PARCIAL'), n('PENDENTE'), n(''), ts.length ? Math.round(100 * n('EM_DIA') / ts.length) + '%' : '—'];
      }),
      styles: { halign: 'center' }, columnStyles: { 0: { halign: 'left' } },
    });
    // Pendências
    const pend = [];
    areas.forEach(ar => turmasConferencia(ar, mes).forEach(t => {
      const c = conferencia(t.id, mes) || {};
      const itens = CONF_ITENS.filter(([k]) => c[k] && c[k] !== 'EM_DIA').map(([k, l]) => `${l} (${statusTxt(c[k]).toLowerCase()})`);
      if (itens.length) pend.push([AREAS[ar], t.nome, t.professor || '', itens.join('; ')]);
    }));
    if (pend.length) {
      y = section(doc, y, 'Pendências a cobrar dos professores (itens parciais ou pendentes)');
      y = table(doc, y, { head: [['Área', 'Turma', 'Professor(a)', 'Itens pendentes']], body: pend, styles: { fontSize: 8 } });
    }
    y = paragraph(doc, y, 'Legenda: Em dia · Parcial · Pendente · — (ainda não conferido).', { size: 8 });
    signature(doc, y);
    save(doc, `Conferencia_${mes}_${areaTxt(area)}`);
  }

  /* ---------- Relatório pedagógico (mensal / trimestral / semestral / anual) ---------- */
  const COR = { musica: '#7b5cc4', esporte: '#2a8f57', ok: '#2a8f57', warn: '#e0a526', bad: '#d0443e', none: '#c9c9c9', azul: '#1a3a5c' };

  function periodoRelatorio(tipo, ref) {
    const ano = +ref.slice(0, 4), m = +ref.slice(5, 7);
    let ini = m, fim = m, nome;
    if (tipo === 'trimestral') { const q = Math.ceil(m / 3); ini = (q - 1) * 3 + 1; fim = ini + 2; nome = `${q}º trimestre de ${ano}`; }
    else if (tipo === 'semestral') { const s = m <= 6 ? 1 : 2; ini = s === 1 ? 1 : 7; fim = ini + 5; nome = `${s}º semestre de ${ano}`; }
    else if (tipo === 'anual') { ini = 1; fim = 12; nome = `Ano de ${ano}`; }
    else { const t = fmtMonth(ref); nome = t.charAt(0).toUpperCase() + t.slice(1); }
    const meses = [];
    for (let k = ini; k <= fim; k++) { const mm = `${ano}-${pad(k)}`; if (mm <= thisMonth()) meses.push(mm); }
    return { tipo, nome, meses: meses.length ? meses : [`${ano}-${pad(ini)}`], de: `${ano}-${pad(ini)}-01`, ate: `${ano}-${pad(fim)}-31` };
  }

  // rótulos de valor nas barras
  const rotulos = (sufixo) => ({
    id: 'rotulos', afterDatasetsDraw(chart) {
      const ctx = chart.ctx; ctx.save(); ctx.font = 'bold 13px Helvetica, Arial'; ctx.fillStyle = '#333';
      chart.data.datasets.forEach((ds, di) => {
        if (chart.config.type !== 'bar' || chart.data.datasets.length > 1) return;
        chart.getDatasetMeta(di).data.forEach((el, i) => {
          const v = ds.data[i]; if (v == null) return;
          const horiz = chart.options.indexAxis === 'y';
          ctx.textAlign = horiz ? 'left' : 'center'; ctx.textBaseline = horiz ? 'middle' : 'bottom';
          ctx.fillText(v + (sufixo || ''), horiz ? el.x + 6 : el.x, horiz ? el.y : el.y - 4);
        });
      });
      ctx.restore();
    },
  });
  function grafico(doc, y, titulo, config, hpx, extra) {
    const wpx = 1000;
    const cfg = Object.assign({}, config, { plugins: (config.plugins || []).concat(extra || []) });
    const url = chartImageP(cfg, wpx, hpx);
    const w = 165, h = w * hpx / wpx;
    y = ensure(doc, y, h + 12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(26, 58, 92);
    doc.text(titulo, M, y); doc.setTextColor(0);
    doc.addImage(url, 'PNG', (doc.internal.pageSize.getWidth() - w) / 2, y + 2, w, h);
    return y + h + 8;
  }
  function chartImageP(config, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.style.cssText = `position:fixed;left:-9999px;width:${w}px;height:${h}px`;
    document.body.appendChild(canvas);
    Chart.defaults.font.family = 'Helvetica, Arial, sans-serif';
    Chart.defaults.font.size = 14;
    Chart.defaults.color = '#333';
    const cfg = Object.assign({}, config);
    cfg.options = Object.assign({}, config.options, { responsive: false, animation: false, devicePixelRatio: 1 });
    cfg.plugins = [{ id: 'bg', beforeDraw: c => { const x = c.ctx; x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.restore(); } }].concat(config.plugins || []);
    const chart = new Chart(canvas, cfg);
    const url = chart.toBase64Image('image/png');
    chart.destroy(); canvas.remove();
    Chart.defaults.font.size = 12;
    return url;
  }
  function caixas(doc, y, itens) {
    const W = doc.internal.pageSize.getWidth(), cols = 4, gap = 3, bw = (W - 2 * M - gap * (cols - 1)) / cols, bh = 24;
    itens.forEach((it, i) => {
      const cx = M + (i % cols) * (bw + gap), cy = y + Math.floor(i / cols) * (bh + gap);
      doc.setFillColor(247, 249, 252); doc.setDrawColor(174, 205, 232); doc.roundedRect(cx, cy, bw, bh, 2, 2, 'FD');
      doc.setFillColor(...(it.cor || [26, 58, 92])); doc.rect(cx, cy, bw, 1.2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...(it.cor || [26, 58, 92]));
      doc.text(String(it.valor), cx + 3, cy + 10);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80);
      doc.text(doc.splitTextToSize(it.rotulo, bw - 6), cx + 3, cy + 15);
    });
    doc.setTextColor(0); doc.setDrawColor(0);
    return y + Math.ceil(itens.length / cols) * (bh + gap) + 8;
  }

  async function relPedagogico(tipo, ref, comFotos) {
    const P = periodoRelatorio(tipo, ref);
    const { meses, de, ate } = P;
    const ultimo = meses[meses.length - 1];
    const TIPOS = { mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
    const { doc, y: y0 } = await create(`Relatório Pedagógico ${TIPOS[tipo]}`, [P.nome, `Música e Esporte · gerado em ${fmtDate(todayISO())}`]);
    let y = y0;
    const ts = turmasAtivas().filter(t => meses.some(m => iniciou(t, m)));
    const noMes = (d, m) => d && d.slice(0, 7) === m;
    const freqPer = DB.Frequencia.filter(r => r.data >= de && r.data <= ate && ts.some(t => t.id === r.turma_id));
    const pctArr = (rs) => rs.length ? Math.round(100 * rs.filter(r => r.status === 'P').length / rs.length) : null;
    const areaDe = tid => (turma(tid) || {}).area;
    // conferência no período
    const confCel = [];
    ts.forEach(t => meses.filter(m => iniciou(t, m)).forEach(m => { const c = conferencia(t.id, m) || {}; CONF_ITENS.forEach(([k, l]) => confCel.push({ t, m, k, l, v: c[k] || '' })); }));
    const pctConf = cel => cel.length ? Math.round(100 * cel.filter(c => c.v === 'EM_DIA').length / cel.length) : null;
    const alertas = alertasFaltas();
    const deslig = alunosDesligados('', de, ate);
    const pessoas = typeof professores === 'function' ? professores() : [];
    const reun = pessoas.map(p => ({ p, feitas: meses.filter(m => (typeof reunioesDo === 'function' ? reunioesDo(p.nome, m) : []).some(r => r.status === 'REALIZADA')).length }));
    const totalReun = reun.reduce((s, r) => s + r.feitas, 0), esperadas = pessoas.length * meses.length;
    const eventos = DB.Eventos.filter(e => e.data_evento >= de && e.data_evento <= ate).sort((a, b) => a.data_evento.localeCompare(b.data_evento));
    const ativos = DB.Alunos.filter(a => a.ativo !== 'NAO' && ts.some(t => t.id === a.turma_id));
    const pAss = pctArr(freqPer), pConf = pctConf(confCel);

    // 1. visão geral
    y = section(doc, y, '1. Visão geral do período');
    y = caixas(doc, y, [
      { valor: ts.filter(t => t.area === 'MUSICA').length + ' / ' + ts.filter(t => t.area === 'ESPORTE').length, rotulo: 'turmas ativas (Música / Esporte)' },
      { valor: ativos.length, rotulo: 'alunos ativos nas turmas' },
      { valor: pAss == null ? '—' : pAss + '%', rotulo: `assiduidade média (${freqPer.length} registros de presença)`, cor: pAss != null && pAss < 60 ? [208, 68, 62] : [42, 143, 87] },
      { valor: pConf == null ? '—' : pConf + '%', rotulo: 'itens da conferência pedagógica em dia', cor: pConf != null && pConf < 60 ? [208, 68, 62] : [42, 143, 87] },
      { valor: alertas.filter(a => a.nivel === 3).length, rotulo: 'alunos aptos a desligamento (3+ faltas seguidas, situação atual)', cor: [208, 68, 62] },
      { valor: alertas.filter(a => a.nivel === 2).length, rotulo: 'alunos com 2 faltas seguidas (contatar família)', cor: [224, 165, 38] },
      { valor: deslig.length, rotulo: 'alunos desligados no período', cor: [120, 120, 120] },
      { valor: `${totalReun}/${esperadas}`, rotulo: 'reuniões mensais realizadas com a equipe' },
    ]);
    const destaques = [];
    ts.forEach(t => { const p = pctArr(freqPer.filter(r => r.turma_id === t.id)); if (p != null && p < 60) destaques.push(`Assiduidade baixa em ${t.nome}: ${p}%.`); });
    ts.forEach(t => { const p = pctConf(confCel.filter(c => c.t.id === t.id)); if (p != null && p < 50) destaques.push(`Conferência com menos da metade dos itens em dia em ${t.nome} (${p}%).`); });
    const semReuniao = pessoas.filter(p => !(typeof reunioesDo === 'function' ? reunioesDo(p.nome, ultimo) : []).some(r => r.status === 'REALIZADA'));
    if (semReuniao.length) destaques.push(`${semReuniao.length} pessoa(s) sem reunião registrada em ${fmtMonth(ultimo)}: ${semReuniao.map(p => p.nome).join(', ')}.`);
    if (alertas.some(a => a.nivel === 3)) destaques.push(`${alertas.filter(a => a.nivel === 3).length} aluno(s) com 3 ou mais faltas seguidas aguardam decisão de desligamento.`);
    if (deslig.length) destaques.push(`${deslig.length} aluno(s) desligado(s) no período, ${deslig.filter(x => !x.ultimaPresenca).length} sem nenhuma presença registrada.`);
    if (destaques.length) {
      y = section(doc, y, 'Pontos de atenção');
      destaques.slice(0, 14).forEach(d => { y = paragraph(doc, y, '• ' + d, { size: 9 }); y -= 1; });
      y += 3;
    }

    // 2. frequência
    doc.addPage(); y = 48;
    y = section(doc, y, '2. Frequência e assiduidade');
    const tsF = ts.map(t => ({ t, p: pctArr(freqPer.filter(r => r.turma_id === t.id)), n: new Set(freqPer.filter(r => r.turma_id === t.id).map(r => r.data)).size })).filter(x => x.p != null).sort((a, b) => b.p - a.p);
    if (tsF.length) {
      y = grafico(doc, y, 'Assiduidade por turma (% de presença no período)', {
        type: 'bar', data: { labels: tsF.map(x => shortName(x.t.nome)), datasets: [{ data: tsF.map(x => x.p), backgroundColor: tsF.map(x => x.t.area === 'MUSICA' ? COR.musica : COR.esporte), borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } },
      }, Math.max(260, 50 + tsF.length * 34), [rotulos('%')]);
    } else y = paragraph(doc, y, 'Nenhum relatório de presenças importado para o período.', { size: 9 });
    if (meses.length > 1 && freqPer.length) {
      const serie = area => meses.map(m => pctArr(freqPer.filter(r => noMes(r.data, m) && areaDe(r.turma_id) === area)));
      y = grafico(doc, y, 'Evolução mensal da assiduidade por área', {
        type: 'line', data: { labels: meses.map(fmtMonthShort), datasets: [
          { label: 'Música', data: serie('MUSICA'), borderColor: COR.musica, backgroundColor: COR.musica, tension: .3, spanGaps: true, borderWidth: 3 },
          { label: 'Esporte', data: serie('ESPORTE'), borderColor: COR.esporte, backgroundColor: COR.esporte, tension: .3, spanGaps: true, borderWidth: 3 }] },
        options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } },
      }, 340);
      y = grafico(doc, y, 'Presenças e faltas registradas por mês', {
        type: 'bar', data: { labels: meses.map(fmtMonthShort), datasets: [
          { label: 'Presenças', data: meses.map(m => freqPer.filter(r => noMes(r.data, m) && r.status === 'P').length), backgroundColor: COR.ok, stack: 's' },
          { label: 'Faltas justificadas', data: meses.map(m => freqPer.filter(r => noMes(r.data, m) && r.status === 'J').length), backgroundColor: COR.warn, stack: 's' },
          { label: 'Faltas', data: meses.map(m => freqPer.filter(r => noMes(r.data, m) && r.status === 'F').length), backgroundColor: COR.bad, stack: 's' }] },
        options: { plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } } },
      }, 320);
    }
    if (tsF.length) {
      y = table(doc, y, {
        head: [['Área', 'Turma', 'Professor(a)', 'Aulas', '% presença']],
        body: tsF.map(x => [AREAS[x.t.area], x.t.nome, x.t.professor || '', x.n, x.p + '%']),
        styles: { fontSize: 7.6 }, columnStyles: { 3: { halign: 'center' }, 4: { halign: 'center' } },
      });
    }

    // 3. alunos
    doc.addPage(); y = 48;
    y = section(doc, y, '3. Alunos: matrículas, alertas e desligamentos');
    const porTurma = ts.map(t => ({ t, ativos: alunosDaTurma(t.id).length, desl: deslig.filter(x => x.turma.id === t.id).length })).filter(x => x.ativos || x.desl).sort((a, b) => b.ativos - a.ativos);
    if (porTurma.length) {
      y = grafico(doc, y, 'Alunos ativos e desligados no período, por turma', {
        type: 'bar', data: { labels: porTurma.map(x => shortName(x.t.nome)), datasets: [
          { label: 'Ativos', data: porTurma.map(x => x.ativos), backgroundColor: '#3d6fb0', stack: 's' },
          { label: 'Desligados no período', data: porTurma.map(x => x.desl), backgroundColor: '#9a9a95', stack: 's' }] },
        options: { indexAxis: 'y', plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true } } },
      }, Math.max(280, 70 + porTurma.length * 30));
    }
    const comFreq = ativos.filter(a => registrosAluno(a.id).length);
    const n3 = alertas.filter(a => a.nivel === 3).length, n2 = alertas.filter(a => a.nivel === 2).length;
    y = grafico(doc, y, `Situação dos ${comFreq.length} alunos ativos com frequência registrada (situação atual)`, {
      type: 'doughnut', data: { labels: [`Regulares (${Math.max(0, comFreq.length - n2 - n3)})`, `2 faltas seguidas (${n2})`, `3+ faltas seguidas (${n3})`], datasets: [{ data: [Math.max(0, comFreq.length - n2 - n3), n2, n3], backgroundColor: [COR.ok, COR.warn, COR.bad] }] },
      options: { plugins: { legend: { position: 'right', labels: { font: { size: 15 } } } }, cutout: '55%' },
    }, 300);
    if (alertas.length) {
      y = section(doc, y, 'Alunos em alerta de faltas');
      y = table(doc, y, {
        head: [['Aluno(a)', 'Turma', 'Faltas seguidas', 'Situação']],
        body: alertas.map(x => [x.aluno.nome, x.turma.nome, x.stats.seqAtual, x.nivel === 3 ? 'Apto a desligamento' : 'Contatar família']),
        styles: { fontSize: 7.6 }, columnStyles: { 2: { halign: 'center' } },
        didParseCell: d => { if (d.section === 'body' && d.column.index === 3) d.cell.styles.textColor = d.cell.raw === 'Apto a desligamento' ? [180, 30, 30] : [170, 100, 0]; },
      });
    }
    if (deslig.length) {
      y = section(doc, y, `Alunos desligados no período: ${deslig.length}`);
      y = table(doc, y, {
        head: [['Aluno(a)', 'Turma', 'Desligado em', 'Última presença']],
        body: deslig.map(x => [x.aluno.nome, x.turma.nome, fmtDate(x.aluno.data_desligamento), x.ultimaPresenca ? fmtDate(x.ultimaPresenca) : 'nunca compareceu']),
        styles: { fontSize: 7.6 },
      });
    }

    // 4. conferência
    doc.addPage(); y = 48;
    y = section(doc, y, '4. Conferência pedagógica dos professores');
    const cnt = (cel, v) => cel.filter(c => c.v === v).length;
    y = grafico(doc, y, 'Situação de cada item da conferência no período (turmas × meses)', {
      type: 'bar', data: { labels: CONF_ITENS.map(([, l]) => l), datasets: [['EM_DIA', 'Em dia', COR.ok], ['PARCIAL', 'Parcial', COR.warn], ['PENDENTE', 'Pendente', COR.bad], ['', 'Não conferido', COR.none]]
        .map(([v, l, c]) => ({ label: l, data: CONF_ITENS.map(([k]) => cnt(confCel.filter(x => x.k === k), v)), backgroundColor: c, stack: 's' })) },
      options: { indexAxis: 'y', plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true } } },
    }, 300);
    if (meses.length > 1) {
      y = grafico(doc, y, '% de itens em dia por mês e área', {
        type: 'bar', data: { labels: meses.map(fmtMonthShort), datasets: [
          { label: 'Música', data: meses.map(m => pctConf(confCel.filter(c => c.m === m && c.t.area === 'MUSICA')) || 0), backgroundColor: COR.musica },
          { label: 'Esporte', data: meses.map(m => pctConf(confCel.filter(c => c.m === m && c.t.area === 'ESPORTE')) || 0), backgroundColor: COR.esporte }] },
        options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } },
      }, 320);
    }
    const confT = ts.map(t => ({ t, p: pctConf(confCel.filter(c => c.t.id === t.id)) })).filter(x => x.p != null).sort((a, b) => b.p - a.p);
    if (confT.length) {
      y = grafico(doc, y, '% de itens em dia por turma', {
        type: 'bar', data: { labels: confT.map(x => shortName(x.t.nome)), datasets: [{ data: confT.map(x => x.p), backgroundColor: confT.map(x => x.p >= 75 ? COR.ok : x.p >= 50 ? COR.warn : COR.bad), borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } },
      }, Math.max(260, 50 + confT.length * 30), [rotulos('%')]);
      y = table(doc, y, {
        head: [['Turma', 'Professor(a)', ...CONF_ITENS.map(([, l]) => l), '% em dia']],
        body: confT.map(x => { const cc = confCel.filter(c => c.t.id === x.t.id); return [x.t.nome, x.t.professor || '', ...CONF_ITENS.map(([k]) => { const c = cc.filter(z => z.k === k); return `${cnt(c, 'EM_DIA')}/${c.length}`; }), x.p + '%']; }),
        styles: { fontSize: 7, halign: 'center' }, columnStyles: { 0: { halign: 'left', cellWidth: 46 }, 1: { halign: 'left', cellWidth: 32 } },
      });
      y = paragraph(doc, y, 'Nas colunas dos itens: meses em dia / meses conferidos para a turma no período.', { size: 7.5 });
    }

    // 5. reuniões e eventos
    doc.addPage(); y = 48;
    y = section(doc, y, '5. Reuniões mensais com a equipe');
    if (pessoas.length) {
      y = grafico(doc, y, 'Reuniões realizadas no período', {
        type: 'doughnut', data: { labels: [`Realizadas (${totalReun})`, `Não realizadas (${Math.max(0, esperadas - totalReun)})`], datasets: [{ data: [totalReun, Math.max(0, esperadas - totalReun)], backgroundColor: [COR.ok, COR.none] }] },
        options: { plugins: { legend: { position: 'right', labels: { font: { size: 15 } } } }, cutout: '55%' },
      }, 260);
      y = table(doc, y, {
        head: [['Pessoa', 'Função', 'Reuniões realizadas', 'Meses do período']],
        body: reun.map(r => [r.p.nome, r.p.funcao || 'Professor(a)', r.feitas, meses.length]),
        styles: { fontSize: 7.8 }, columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' } },
        didParseCell: d => { if (d.section === 'body' && d.column.index === 2 && +d.cell.raw < meses.length) d.cell.styles.textColor = [180, 30, 30]; },
      });
    }
    y = section(doc, y, `6. Eventos e viagens no período: ${eventos.length}`);
    if (eventos.length) {
      y = table(doc, y, {
        head: [['Data', 'Evento', 'Destino', 'Área', 'Alunos', 'Autorizações']],
        body: eventos.map(e => { const p = participantesEvento(e.id); return [fmtDate(e.data_evento), e.nome, e.municipio || '', AREAS[e.area] || '', p.length, `${p.filter(x => isTrue(x.part.autorizacao)).length}/${p.length}`]; }),
        styles: { fontSize: 7.8 }, columnStyles: { 4: { halign: 'center' }, 5: { halign: 'center' } },
      });
    } else y = paragraph(doc, y, 'Nenhum evento cadastrado no período.', { size: 9 });
    if (comFotos) y = await registroFotos(doc, y, fotosFiltro({ de, ate }), '7. Registro fotográfico', 24);
    signature(doc, y);
    save(doc, `Relatorio_pedagogico_${tipo}_${P.nome}`);
  }

  /* ---------- Registro fotográfico (usado por vários relatórios) ---------- */
  async function registroFotos(doc, y, lista, titulo, max) {
    if (!lista.length) return y;
    const sel = max ? lista.slice(0, max) : lista;
    let imgs = {};
    try { imgs = await Fotos.carregar(sel.map(f => f.id)); } catch (e) { /* usa as miniaturas */ }
    const W = doc.internal.pageSize.getWidth(), gap = 6, cw = (W - 2 * M - gap) / 2, hmax = 62;
    y = ensure(doc, y, hmax + 26); // título junto com a primeira linha de fotos
    y = section(doc, y, titulo + (max && lista.length > max ? ` (${max} de ${lista.length} fotos)` : ''));
    let col = 0, linhaH = 0;
    for (const f of sel) {
      const url = imgs[f.id] || f.miniatura;
      const iw = +f.largura || 4, ih = +f.altura || 3;
      let w = cw, h = cw * ih / iw;
      if (h > hmax) { h = hmax; w = h * iw / ih; }
      const leg = doc.setFont('helvetica', 'normal').setFontSize(7.5).splitTextToSize(legendaFoto(f), cw);
      const bloco = hmax + 3 + leg.length * 3.3 + 4;
      if (col === 0) { const ny = ensure(doc, y, bloco); y = ny; linhaH = 0; }
      const x0 = M + col * (cw + gap);
      doc.setFillColor(245, 245, 245); doc.rect(x0, y, cw, hmax, 'F');
      try { doc.addImage(url, 'JPEG', x0 + (cw - w) / 2, y + (hmax - h) / 2, w, h); } catch (e) { /* imagem inválida */ }
      doc.setTextColor(70); doc.text(leg, x0, y + hmax + 3.5); doc.setTextColor(0);
      linhaH = Math.max(linhaH, bloco);
      col++;
      if (col === 2) { col = 0; y += linhaH; }
    }
    if (col) y += linhaH;
    return y + 2;
  }

  /* ---------- Avaliação dos professores ---------- */
  async function relAvaliacao(tipo, ref, nome) {
    const { P, lista: todos } = avaliacaoProfessores(tipo, ref);
    const lista = nome ? todos.filter(x => x.p.nome === nome) : todos;
    const TIPOS = { mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
    const { doc, y: y0 } = await create(nome ? 'Ficha de Avaliação do Professor' : `Avaliação dos Professores — ${TIPOS[tipo]}`, [nome || 'Indicadores de desempenho pedagógico', P.nome]);
    let y = y0;
    const corN = n => n == null ? [120, 120, 120] : n >= 70 ? [42, 143, 87] : n >= 50 ? [190, 130, 20] : [208, 68, 62];
    const fmtP = v => v == null ? '—' : v + '%';
    y = paragraph(doc, y, `Critérios: conferência pedagógica (itens em dia; parcial vale meio) ${PESOS_AVAL.conf}%, frequência média das turmas ${PESOS_AVAL.freq}%, permanência dos alunos (100% - evasão) ${PESOS_AVAL.ret}% e reuniões mensais realizadas ${PESOS_AVAL.reun}%. Nota: 85+ Excelente · 70+ Bom · 50+ Regular · abaixo de 50 Atenção.`, { size: 8.5 });
    if (!nome) {
      const com = lista.filter(x => x.nota != null);
      y = caixas(doc, y, [
        { valor: lista.length, rotulo: 'professores avaliados' },
        { valor: com.length ? Math.round(com.reduce((s, x) => s + x.nota, 0) / com.length) : '—', rotulo: 'nota média da equipe' },
        { valor: com.filter(x => x.nota >= 70).length, rotulo: 'com nota Bom ou Excelente', cor: [42, 143, 87] },
        { valor: com.filter(x => x.nota < 50).length, rotulo: 'em atenção (abaixo de 50)', cor: [208, 68, 62] },
      ]);
      if (com.length) {
        y = grafico(doc, y, 'Nota por professor', {
          type: 'bar', data: { labels: com.map(x => x.p.nome.split(' ').slice(0, 2).join(' ')), datasets: [{ data: com.map(x => x.nota), backgroundColor: com.map(x => x.nota >= 70 ? COR.ok : x.nota >= 50 ? COR.warn : COR.bad) }] },
          options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100 } } },
        }, Math.max(220, com.length * 34 + 60), [rotulos('')]);
      }
      y = section(doc, y, 'Quadro de indicadores');
      y = table(doc, y, {
        head: [['Professor(a)', 'Turmas', 'Conferência', 'Frequência', 'Evasão', 'Reuniões', 'Nota', 'Nível']],
        body: lista.map(x => [x.p.nome, x.turmas.map(t => shortName(t.nome)).join(', '), fmtP(x.conf), fmtP(x.freq), fmtP(x.evasao), `${x.reunFeitas}/${x.mesesProf.length}`, x.nota ?? '—', x.nivel[1]]),
        styles: { fontSize: 7.6 }, columnStyles: { 1: { cellWidth: 46 }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center', fontStyle: 'bold' }, 7: { halign: 'center' } },
        didParseCell: d => { if (d.section === 'body' && d.column.index >= 6) d.cell.styles.textColor = corN(lista[d.row.index].nota); },
      });
    }
    for (const x of (nome ? lista : [])) {
      y = caixas(doc, y, [
        { valor: x.nota ?? '—', rotulo: `nota no período — ${x.nivel[1]}`, cor: corN(x.nota) },
        { valor: fmtP(x.conf), rotulo: `conferência em dia (${x.conferidos}/${x.celulas} itens conferidos)` },
        { valor: fmtP(x.freq), rotulo: `frequência média (${x.aulas} aulas registradas)` },
        { valor: fmtP(x.evasao), rotulo: `evasão (${x.deslig.length} desligado(s) / ${x.ativos} ativos)`, cor: x.evasao > 25 ? [208, 68, 62] : undefined },
        { valor: `${x.reunFeitas}/${x.mesesProf.length}`, rotulo: 'reuniões mensais realizadas' },
        { valor: x.alertas.length, rotulo: 'alunos em alerta de faltas hoje', cor: x.alertas.length ? [190, 130, 20] : undefined },
        { valor: x.ocorr.length, rotulo: 'ocorrências registradas no período' },
        { valor: x.turmas.length, rotulo: 'turmas no período' },
      ]);
      y = section(doc, y, 'Turmas');
      y = table(doc, y, {
        head: [['Turma', 'Área', 'Aulas', 'Frequência', 'Alunos ativos', 'Desligados no período']],
        body: x.turmas.map(t => { const s = statsTurma(t.id, P.de, P.ate); return [t.nome, AREAS[t.area], s.aulas, fmtP(s.pct), alunosDaTurma(t.id).length, x.deslig.filter(a => a.turma_id === t.id).length]; }),
        styles: { fontSize: 8 }, columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' } },
      });
      y = section(doc, y, 'Conferência pedagógica — pendências');
      y = x.pendencias.length ? table(doc, y, {
        head: [['Mês', 'Turma', 'Item', 'Situação']], body: x.pendencias.map(d => [fmtMonth(d.mes), d.turma.nome, d.item, CONF_STATUS[d.status].label]), styles: { fontSize: 8 },
      }) : paragraph(doc, y, 'Nenhuma pendência nos meses conferidos.', { size: 9 });
      if (x.alertas.length) {
        y = section(doc, y, 'Alunos com faltas consecutivas');
        y = table(doc, y, { head: [['Aluno(a)', 'Turma', 'Faltas seguidas', 'Desde']], body: x.alertas.map(a => [a.aluno.nome, a.turma.nome, a.stats.seqAtual, fmtDate(a.desde)]), styles: { fontSize: 8 } });
      }
      y = section(doc, y, 'Pontos para a reunião mensal');
      const pts = [];
      if (x.conf != null && x.conf < 85) pts.push(`Regularizar a documentação da conferência (${x.pendencias.length} item(ns) parcial(is) ou pendente(s)).`);
      if (x.freq != null && x.freq < 75) pts.push(`Frequência média de ${x.freq}%: discutir estratégias de engajamento e contato com faltosos.`);
      if (x.evasao != null && x.evasao > 15) pts.push(`Evasão de ${x.evasao}% no período: levantar motivos das saídas e ações de permanência.`);
      if (x.alertas.length) pts.push(`${x.alertas.length} aluno(s) com faltas consecutivas: alinhar contato com a secretaria.`);
      if (x.reun != null && x.reun < 100) pts.push('Manter a regularidade das reuniões mensais.');
      if (!pts.length) pts.push('Indicadores satisfatórios no período: reconhecer o trabalho e manter as boas práticas.');
      pts.forEach(t => { y = paragraph(doc, y, '• ' + t, { size: 9.5 }); });
    }
    signature(doc, y);
    save(doc, nome ? `Avaliacao_${nome}_${P.nome}` : `Avaliacao_professores_${P.nome}`);
  }

  /* ---------- Prestação de contas ---------- */
  async function relPrestacao(o) {
    const d = dadosPrestacao(o);
    const per = `${fmtDate(o.de)} a ${fmtDate(o.ate)}`;
    const { doc, y: y0 } = await create('Relatório de Prestação de Contas — Execução do Objeto', [o.projeto || 'Projeto', `Período de execução: ${per}`]);
    let y = y0;
    y = section(doc, y, '1. Identificação');
    y = table(doc, y, {
      body: [
        ['Proponente', 'Instituto Três Pontões de Ação Social e Cultural — Instituto Cultural das Montanhas'], ['CNPJ', '51.892.817/0001-52'],
        ['Projeto', o.projeto || '—'], ...(o.processo ? [['Nº do processo / termo', o.processo]] : []),
        ['Área', o.area ? AREAS[o.area] : 'Música e Esporte'], ['Período', per],
        ['Núcleos / turmas', d.ts.map(t => t.nome).join('; ')],
      ], theme: 'grid', styles: { fontSize: 8.5 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, fillColor: [235, 240, 246] } },
    });
    // metas
    const pctExec = (r, p) => (p ? Math.round(100 * r / p) + '%' : '—');
    const n1 = v => v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('pt-BR');
    const metas = [
      ['Beneficiários atendidos (alunos com presença)', o.metaBenef || d.total.vagas, d.total.benef],
      ['Aulas / atividades realizadas', o.metaAulas || d.total.aulasPrev, d.total.aulas],
      ['Carga horária executada (horas)', o.metaCH || d.total.chPrev, d.total.ch],
      ['Eventos / apresentações', o.metaEventos || null, d.eventos.length],
      ['Frequência média dos alunos (%)', o.metaFreq || 75, d.total.freq],
    ];
    y = section(doc, y, '2. Metas previstas e realizadas');
    y = table(doc, y, {
      head: [['Meta / indicador', 'Previsto', 'Realizado', '% de execução']],
      body: metas.map(([l, p, r]) => [l, p == null ? '—' : n1(+p), r == null ? '—' : n1(r), p && r != null ? pctExec(r, +p) : '—']),
      styles: { fontSize: 8.5 }, columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center', fontStyle: 'bold' } },
      didParseCell: c => { if (c.section === 'body' && c.column.index === 3 && c.cell.raw !== '—') { const v = parseInt(c.cell.raw, 10); c.cell.styles.textColor = v >= 100 ? [20, 110, 50] : v >= 75 ? [170, 110, 0] : [180, 30, 30]; } },
    });
    y = paragraph(doc, y, 'Previsto: metas informadas para o projeto ou, na falta delas, as metas cadastradas nas turmas (vagas, aulas previstas por mês e duração da aula). Realizado: apurado pelos registros de chamada do sistema.', { size: 7.8 });
    const comMeta = metas.filter(([, p, r]) => p && r != null);
    if (comMeta.length) {
      y = grafico(doc, y, '% de execução das metas', {
        type: 'bar', data: { labels: comMeta.map(([l]) => l.split(' (')[0]), datasets: [{ data: comMeta.map(([, p, r]) => Math.round(100 * r / p)), backgroundColor: comMeta.map(([, p, r]) => r / p >= 1 ? COR.ok : r / p >= 0.75 ? COR.warn : COR.bad) }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { min: 0, suggestedMax: 120 } } },
      }, 60 + comMeta.length * 46, [rotulos('%')]);
    }
    y = section(doc, y, '3. Execução por turma');
    y = table(doc, y, {
      head: [['Turma', 'Vagas', 'Atendidos', 'Aulas prev.', 'Aulas real.', 'CH (h)', 'Freq.']],
      body: d.porTurma.map(x => [x.t.nome, x.vagas ?? '—', x.atendidos.length, x.aulasPrev ?? '—', x.aulas, x.ch == null ? '—' : n1(x.ch), x.freq == null ? '—' : x.freq + '%']),
      foot: [['Total', d.total.vagas ?? '—', d.total.benef, d.total.aulasPrev ?? '—', d.total.aulas, d.total.ch == null ? '—' : n1(d.total.ch), d.total.freq == null ? '—' : d.total.freq + '%']],
      footStyles: { fillColor: [235, 240, 246], textColor: 20, fontStyle: 'bold' },
      styles: { fontSize: 7.8 }, columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' } },
    });
    if (d.mensal.length > 1) {
      y = grafico(doc, y, 'Execução mensal: aulas realizadas e beneficiários', {
        type: 'bar', data: { labels: d.mensal.map(x => fmtMonthShort(x.m)), datasets: [
          { label: 'Aulas realizadas', data: d.mensal.map(x => x.aulas), backgroundColor: COR.azul },
          { label: 'Beneficiários com presença', data: d.mensal.map(x => x.benef), backgroundColor: COR.musica }] },
        options: { plugins: { legend: { position: 'bottom' } } },
      }, 330);
    }
    y = section(doc, y, '4. Perfil dos beneficiários');
    y = paragraph(doc, y, `${d.total.benef} beneficiário(s) direto(s) no período. ${d.total.desligados} desligamento(s) registrado(s).`, { size: 9 });
    const pizza = (titulo, obj) => {
      const ks = Object.keys(obj).sort((a, b) => (a === 'Não informado') - (b === 'Não informado') || obj[b] - obj[a]);
      const cores = ['#1a3a5c', '#7b5cc4', '#2a8f57', '#e0a526', '#d0443e', '#4aa3c9', '#a0522d', '#888', '#c9c9c9'];
      return grafico(doc, y, titulo, {
        type: 'doughnut', data: { labels: ks.map(k => `${k}: ${obj[k]}`), datasets: [{ data: ks.map(k => obj[k]), backgroundColor: ks.map((k, i) => k === 'Não informado' ? '#d5d5d5' : cores[i % cores.length]) }] },
        options: { plugins: { legend: { position: 'right', labels: { font: { size: 15 } } } }, cutout: '50%' },
      }, 250);
    };
    const ordemIdade = FAIXAS_IDADE.map(f => f[2]).concat('Não informado');
    const idades = ordemIdade.filter(k => d.perfil.idade[k]);
    if (idades.length) {
      y = grafico(doc, y, 'Faixa etária', {
        type: 'bar', data: { labels: idades, datasets: [{ data: idades.map(k => d.perfil.idade[k]), backgroundColor: idades.map(k => k === 'Não informado' ? COR.none : COR.azul) }] },
        options: { plugins: { legend: { display: false } } },
      }, 260, [rotulos('')]);
    }
    if (Object.keys(d.perfil.area).length > 1) y = pizza('Por área', d.perfil.area);
    y = pizza('Sexo', d.perfil.sexo);
    y = pizza('Tipo de escola', d.perfil.escola);
    const bairros = Object.entries(d.perfil.bairro).sort((a, b) => (a[0] === 'Não informado') - (b[0] === 'Não informado') || b[1] - a[1]);
    y = section(doc, y, 'Bairro / localidade de residência');
    y = table(doc, y, { head: [['Bairro / localidade', 'Beneficiários', '%']], body: bairros.map(([k, v]) => [k, v, Math.round(100 * v / Math.max(1, d.total.benef)) + '%']), styles: { fontSize: 8 }, columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } } });
    const naoInf = ['idade', 'sexo', 'escola', 'bairro'].filter(k => d.perfil[k]['Não informado']);
    if (naoInf.length) y = paragraph(doc, y, 'Observação: parte dos cadastros ainda não tem idade, sexo, tipo de escola ou bairro informados (campo "Não informado"). Complete os dados em Turmas e alunos para um perfil completo.', { size: 7.8 });
    y = section(doc, y, `5. Eventos e apresentações: ${d.eventos.length}`);
    y = d.eventos.length ? table(doc, y, {
      head: [['Data', 'Evento', 'Local', 'Participantes']],
      body: d.eventos.map(e => [fmtDate(e.data_evento), e.nome, [e.municipio, e.local].filter(Boolean).join(' — '), participantesEvento(e.id).length]),
      styles: { fontSize: 8 }, columnStyles: { 3: { halign: 'center' } },
    }) : paragraph(doc, y, 'Nenhum evento registrado no período.', { size: 9 });
    if (o.obs) { y = section(doc, y, '6. Considerações'); y = paragraph(doc, y, o.obs, { size: 9.5 }); }
    if (o.fotos) y = await registroFotos(doc, y, fotosFiltro({ turmas: o.turmas, de: o.de, ate: o.ate, area: o.area }), `${o.obs ? 7 : 6}. Registro fotográfico (comprovação)`);
    signature(doc, y, 'Responsável pelo projeto');
    save(doc, `Prestacao_de_contas_${o.projeto || ''}_${o.de}_${o.ate}`);
  }

  /* ---------- Relatório fotográfico / de visitas ---------- */
  async function relFotografico(o) {
    const lista = o.evento ? fotosFiltro({ evento: o.evento }) : fotosFiltro({ turmas: o.turma ? [o.turma] : null, de: o.de, ate: o.ate, tipo: o.tipo, area: o.area });
    const t = turma(o.turma), e = DB.Eventos.find(x => x.id === o.evento);
    const titulo = o.tipo === 'VISITA' ? 'Relatório de Visitas' : 'Relatório Fotográfico';
    const { doc, y: y0 } = await create(titulo, [e ? e.nome : t ? t.nome : (o.area ? AREAS[o.area] : 'Música e Esporte'), (o.de || o.ate) ? `Período: ${o.de ? fmtDate(o.de) : 'início'} a ${o.ate ? fmtDate(o.ate) : 'hoje'}` : '']);
    let y = y0;
    if (o.texto) { y = section(doc, y, 'Relato'); y = paragraph(doc, y, o.texto, { size: 9.5 }); }
    y = lista.length ? await registroFotos(doc, y, lista, `Registro fotográfico — ${lista.length} foto(s)`) : paragraph(doc, y, 'Nenhuma foto encontrada com esses filtros.', { size: 9.5 });
    signature(doc, y);
    save(doc, `${titulo.replace(/ /g, '_')}_${e ? e.nome : t ? t.nome : ''}_${todayISO()}`);
  }

  /** Termo formal de ocorrência / advertência disciplinar. */
  async function relOcorrencia(o) {
    const TIT = { OCORRENCIA: 'Termo de Registro de Ocorrência', ADV_VERBAL: 'Termo de Advertência Verbal', ADV_ESCRITA: 'Termo de Advertência Escrita', SUSPENSAO: 'Termo de Suspensão Temporária de Atividades' };
    const { doc } = await create(`${TIT[o.tipo] || TIT.OCORRENCIA} nº ${o.numero || ''}`, '');
    const W = doc.internal.pageSize.getWidth();
    const AZUL = [26, 58, 92], ROT = [214, 228, 240], VAL = [247, 249, 252], BORDA = [174, 205, 232];
    let y = 54;
    // quadro com pares rótulo/valor em 4 colunas; linha com 2 itens ocupa a largura toda
    const quadro = (titulo, linhas) => {
      y = ensure(doc, y + 2, 20);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AZUL); doc.text(titulo, M, y); doc.setTextColor(0);
      const rot = c => ({ content: c, styles: { fontStyle: 'bold', textColor: AZUL, fillColor: ROT } });
      doc.autoTable({
        startY: y + 2, margin: { left: M, right: M, top: 44, bottom: 24 }, theme: 'grid',
        body: linhas.map(l => l.length === 2 ? [rot(l[0]), { content: l[1], colSpan: 3 }] : [rot(l[0]), l[1], rot(l[2]), l[3]]),
        styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 1.3, bottom: 1.3, left: 2.2, right: 2.2 }, lineColor: BORDA, lineWidth: 0.2, textColor: [30, 30, 30], fillColor: VAL },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 62 }, 2: { cellWidth: 30 } },
      });
      y = doc.lastAutoTable.finalY + 5;
    };
    const bloco = (titulo, texto) => {
      y = ensure(doc, y + 2, 16);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AZUL); doc.text(titulo, M, y); doc.setTextColor(0);
      y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      String(texto || '—').split(/\n+/).filter(s => s.trim()).forEach(par => {
        const ls = doc.splitTextToSize(par.trim(), W - 2 * M);
        ls.forEach((l, i) => { y = ensure(doc, y, 6); doc.text(l, M, y, i < ls.length - 1 ? { align: 'justify', maxWidth: W - 2 * M } : {}); y += 4.6; });
        y += 1.2;
      });
      y += 1.5;
    };
    const t = turma(o.turma_id) || {};
    const GRAV = { LEVE: 'Leve', MEDIA: 'Média', GRAVE: 'Grave' };
    quadro('1. IDENTIFICAÇÃO DO(A) ALUNO(A) E DO(A) RESPONSÁVEL', [
      ['Aluno(a)', o.aluno_nome || ''],
      ['Nascimento', fmtDate(o.data_nascimento) || '—', 'Área', AREAS[t.area] || '—'],
      ['Turma', t.nome || '—', 'Professor(a)', t.professor || '—'],
      ['Responsável legal', o.responsavel || '—', 'Telefone', o.telefone || '—'],
    ]);
    quadro('2. DADOS DA OCORRÊNCIA', [
      ['Data', fmtDate(o.data_ocorrencia) || '—', 'Horário', o.hora || '—'],
      ['Natureza', (TIT[o.tipo] || TIT.OCORRENCIA).replace('Termo de ', '').replace('Registro de ', ''), 'Gravidade', GRAV[o.gravidade] || '—'],
      ['Local', o.local || '—'],
      ['Presenciado por', [o.testemunha_nome, o.testemunha_funcao].filter(Boolean).join(' — ') || '—'],
    ]);
    bloco('3. RELATO DOS FATOS', o.descricao);
    bloco('4. PROVIDÊNCIAS E MEDIDAS ADOTADAS', o.providencias);
    bloco('5. TERMO DE CIÊNCIA', `O Instituto Três Pontões de Ação Social e Cultural – Instituto Cultural das Montanhas, no exercício de sua responsabilidade educativa, registra a ocorrência acima descrita envolvendo o(a) aluno(a) ${o.aluno_nome || ''}, com o objetivo de zelar pela segurança, pelo respeito mútuo e pela boa convivência entre alunos, educadores e colaboradores.\nO(A) responsável legal declara ter tomado ciência do inteiro teor deste termo e compromete-se a orientar o(a) aluno(a) quanto à conduta esperada nas atividades do Instituto, ciente de que a reincidência poderá acarretar a aplicação de medidas mais rigorosas, inclusive o desligamento do(a) aluno(a) da atividade.`);
    // local e data
    y = ensure(doc, y + 1, 40);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text(`Afonso Cláudio - ES, ${fmtDataExtenso(o.data_emissao || todayISO())}.`, W - M, y, { align: 'right' });
    y += 2;
    // assinaturas
    const diego = (typeof assinaturas === 'function' ? assinaturas() : []).find(a => a.nome === 'Diego Padua Silva') || { nome: 'Diego Padua Silva' };
    let img = null;
    if (diego.imagem) { const im = new Image(); await new Promise(r => { im.onload = r; im.onerror = r; im.src = diego.imagem; }); if (im.naturalWidth) img = { url: diego.imagem, w: im.naturalWidth, h: im.naturalHeight }; }
    const assinatura = (cx, yy, nome, linhas, imagem) => {
      if (imagem) { let w = 44, h = w * imagem.h / imagem.w; if (h > 15) { h = 15; w = h * imagem.w / imagem.h; } doc.addImage(imagem.url, 'PNG', cx - w / 2, yy - h + 1, w, h); }
      doc.setDrawColor(60); doc.line(cx - 25, yy, cx + 25, yy); doc.setDrawColor(0);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      const ns = doc.splitTextToSize(nome || '', 52); doc.text(ns, cx, yy + 4, { align: 'center' });
      let yl = yy + 4 + ns.length * 3.6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
      linhas.filter(Boolean).forEach(l => { const ls = doc.splitTextToSize(l, 54); doc.text(ls, cx, yl, { align: 'center' }); yl += ls.length * 3.4; });
    };
    y = ensure(doc, y + 20, 26);
    const col = (W - 2 * M) / 3;
    assinatura(M + col / 2, y, 'Diego Padua Silva', ['Vice-Presidente', 'Instituto Cultural das Montanhas'], o.assinatura_digital === 'NAO' ? null : img);
    assinatura(M + col * 1.5, y, o.testemunha_nome || ' ', ['Colaborador(a) que presenciou o fato', o.testemunha_funcao]);
    assinatura(M + col * 2.5, y, o.responsavel || ' ', ['Responsável legal pelo(a) aluno(a)', 'Ciente em ____/____/______']);
    y += 22;
    y = ensure(doc, y, 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110);
    doc.text('Documento emitido em 2 (duas) vias: uma para o arquivo do Instituto e outra para o(a) responsável legal.', W / 2, y, { align: 'center' });
    doc.setTextColor(0);
    save(doc, `Ocorrencia_${(o.numero || '').replace('/', '-')}_${o.aluno_nome || ''}`);
  }

  /** Ata de reunião no layout do modelo do Instituto. */
  async function relAta(r) {
    const AZUL = [26, 58, 92], ROTULO = [214, 228, 240], VALOR = [247, 249, 252], BORDA = [174, 205, 232];
    const { doc, y: y0 } = await create('Ata de Reunião ' + (r.numero || ''), r.assunto || '');
    const W = doc.internal.pageSize.getWidth();
    let y = y0;
    const titulo = (texto) => {
      y = ensure(doc, y + 2, 14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL);
      doc.text(texto, M, y); doc.setTextColor(0);
      y += 6;
    };
    const texto = (t) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30);
      String(t || '').split(/\n+/).filter(s => s.trim()).forEach(par => {
        const linhas = doc.splitTextToSize(par.trim(), W - 2 * M);
        linhas.forEach((l, i) => {
          y = ensure(doc, y, 6);
          const ultima = i === linhas.length - 1;
          doc.text(l, M, y, ultima ? {} : { align: 'justify', maxWidth: W - 2 * M });
          y += 5;
        });
        y += 1.5;
      });
      doc.setTextColor(0);
    };
    // quadro de informações
    doc.autoTable({
      startY: y, margin: { left: M, right: M, top: 44, bottom: 24 }, theme: 'grid',
      body: [['Data', fmtDataExtenso(r.data)], ['Horário/formato', horarioFormato(r)], ['Local', r.local || ''], ['Projeto', r.projeto || ''], ['Redator(a)', r.redator || '']],
      styles: { font: 'helvetica', fontSize: 10, cellPadding: { top: 1.6, bottom: 1.6, left: 2.6, right: 2.6 }, lineColor: BORDA, lineWidth: 0.2, textColor: [30, 30, 30], fillColor: VALOR },
      columnStyles: { 0: { cellWidth: 49, fontStyle: 'bold', textColor: AZUL, fillColor: ROTULO } },
    });
    y = doc.lastAutoTable.finalY + 8;
    // participantes
    titulo('PARTICIPANTES');
    const parts = (r.participantes || []).filter(p => p.nome);
    doc.autoTable({
      startY: y, margin: { left: M, right: M, top: 44, bottom: 24 }, theme: 'grid',
      head: [['Nome', 'Função / Papel no Projeto']],
      body: parts.length ? parts.map(p => [p.nome, p.funcao || '']) : [['', '']],
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 2, lineColor: BORDA, lineWidth: 0.2, textColor: [30, 30, 30] },
      headStyles: { fillColor: ROTULO, textColor: AZUL, fontStyle: 'bold' },
    });
    y = doc.lastAutoTable.finalY + 8;
    titulo('RELATO DA REUNIÃO');
    texto(r.relato);
    (r.itens || []).filter(i => i.titulo || i.texto).forEach((it, k) => {
      titulo(`${k + 1}. ${(it.titulo || '').toUpperCase()}`);
      texto(it.texto);
    });
    titulo('ENCAMINHAMENTOS');
    texto(r.encaminhamentos);
    // lavrada
    y = ensure(doc, y + 4, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Lavrada em ${fmtDataExtenso(r.data)}.`, W / 2, y, { align: 'center' });
    y += 8;
    // assinaturas, 2 por linha
    const sig = (r.assinantes || []).filter(s => s.nome);
    for (let i = 0; i < sig.length; i += 2) {
      y = ensure(doc, y + 18, 26);
      sig.slice(i, i + 2).forEach((s, j) => {
        const cx = sig.length - i === 1 ? W / 2 : (j === 0 ? M + (W - 2 * M) / 4 : W - M - (W - 2 * M) / 4);
        doc.setDrawColor(80); doc.line(cx - 35, y, cx + 35, y); doc.setDrawColor(0);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(s.nome, cx, y + 5, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        if (s.funcao) doc.text(s.funcao, cx, y + 9.5, { align: 'center', maxWidth: 80 });
        if (s.instituicao) doc.text(s.instituicao, cx, y + 14, { align: 'center', maxWidth: 80 });
      });
      y += 18;
    }
    y = ensure(doc, y + 6, 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
    doc.text(`Instituto Três Pontões de Ação Social e Cultural - Instituto Cultural das Montanhas  •  Documento interno  •  ${fmtDate(r.data)}`, W / 2, y, { align: 'center' });
    doc.setTextColor(0);
    save(doc, `Ata_${(r.numero || '').replace('/', '-')}_${r.professor || 'reuniao'}`);
  }

  /** Conferência de uma turma: mês a mês, com resumo, assiduidade e observações. */
  async function relConferenciaTurma(tid, ano, comFotos) {
    const t = turma(tid);
    const atual = thisMonth();
    const ate = ano === atual.slice(0, 4) ? atual : `${ano}-12`;
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`).filter(m => m <= ate && iniciou(t, m));
    const sub2 = [t.professor ? `Professor(a): ${t.professor}` : '', `Ano: ${ano}`, t.inicio ? `Início: ${fmtMonth(t.inicio)}` : ''].filter(Boolean).join(' · ');
    const { doc, y: y0 } = await create('Conferência Pedagógica da Turma', [`${AREAS[t.area]} · ${t.nome}`, sub2]);
    let y = y0;
    const cor = d => {
      if (d.section !== 'body') return;
      const v = d.cell.raw;
      if (v === 'Em dia') d.cell.styles.textColor = [20, 110, 50];
      else if (v === 'Pendente') { d.cell.styles.textColor = [180, 30, 30]; d.cell.styles.fontStyle = 'bold'; }
      else if (v === 'Parcial') { d.cell.styles.textColor = [170, 100, 0]; d.cell.styles.fontStyle = 'bold'; }
    };
    if (!meses.length) {
      y = paragraph(doc, y, 'A turma ainda não havia iniciado no período selecionado.', { size: 10 });
      signature(doc, y);
      save(doc, `Conferencia_${t.nome}_${ano}`);
      return;
    }
    y = section(doc, y, `Resumo de ${fmtMonth(meses[0])} a ${fmtMonth(meses[meses.length - 1])}`);
    y = table(doc, y, {
      head: [['Item', 'Em dia', 'Parcial', 'Pendente', 'Não conferido']],
      body: CONF_ITENS.map(([k, l]) => {
        const n = s => meses.filter(m => ((conferencia(tid, m) || {})[k] || '') === s).length;
        return [l, n('EM_DIA'), n('PARCIAL'), n('PENDENTE'), n('')];
      }),
      styles: { halign: 'center' }, columnStyles: { 0: { halign: 'left' } },
    });
    y = section(doc, y, 'Situação mês a mês');
    y = table(doc, y, {
      head: [['Mês', 'Plano de aula', 'Relatório de aulas', 'Registro de chamada', 'Fechamento mensal', 'Assiduidade']],
      body: meses.map(m => {
        const c = conferencia(tid, m) || {};
        const st = statsTurma(tid, `${m}-01`, `${m}-31`);
        return [fmtMonth(m), ...CONF_ITENS.map(([k]) => c[k] ? statusTxt(c[k]) : '—'), st.pct == null ? '—' : st.pct + '%'];
      }),
      styles: { halign: 'center', fontSize: 8 }, columnStyles: { 0: { halign: 'left', cellWidth: 34 } },
      didParseCell: cor,
    });
    const obs = meses.map(m => [fmtMonth(m), ((conferencia(tid, m) || {}).observacoes || '').replace(/\s*\[Revisado em[^\]]*\]/, '').trim()]).filter(r => r[1]);
    if (obs.length) {
      y = section(doc, y, 'Observações da conferência');
      y = table(doc, y, { head: [['Mês', 'Observações']], body: obs, styles: { fontSize: 8 }, columnStyles: { 0: { cellWidth: 34 } } });
    }
    const al = alunosDaTurma(tid);
    const alr = alertasFaltas(t.area).filter(x => x.turma.id === tid);
    if (al.length) {
      y = paragraph(doc, y, `Alunos ativos: ${al.length}. Alunos com 2 faltas seguidas: ${alr.filter(x => x.nivel === 2).length}. Aptos a desligamento (3+ faltas seguidas): ${alr.filter(x => x.nivel === 3).length}.`, { size: 9 });
    }
    y = paragraph(doc, y, 'Legenda: Em dia · Parcial (aula sem registro) · Pendente · — (não conferido). Assiduidade calculada a partir dos relatórios de presença importados.', { size: 8 });
    if (comFotos) y = await registroFotos(doc, y, fotosFiltro({ turmas: [tid], de: `${ano}-01-01`, ate: `${ano}-12-31` }).filter(f => f.turma_id === tid), 'Registro fotográfico da turma');
    signature(doc, y);
    save(doc, `Conferencia_${t.nome}_${ano}`);
  }

  async function relConferenciaAnual(ano, area) {
    const atual = thisMonth();
    const ate = ano === atual.slice(0, 4) ? atual : `${ano}-12`;
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`);
    const areas = area ? [area] : Object.keys(AREAS);
    const { doc, y: y0 } = await create('Relatório Anual de Conferência Pedagógica',
      [`Área: ${areaTxt(area)}`, `Ano: ${ano}${ate < `${ano}-12` ? ` (até ${fmtMonth(ate)})` : ''}`], 'landscape');
    let y = y0;
    const mesesDa = t => meses.filter(m => m <= ate && iniciou(t, m));
    const conta = (ts) => {
      const c = { tot: 0, EM_DIA: 0, PARCIAL: 0, PENDENTE: 0, '': 0 };
      ts.forEach(t => mesesDa(t).forEach(m => { const r = conferencia(t.id, m) || {}; CONF_ITENS.forEach(([k]) => { c.tot++; c[r[k] || '']++; }); }));
      return c;
    };
    const linha = (rot, c) => [rot, c.tot, c.EM_DIA, c.PARCIAL, c.PENDENTE, c[''], c.tot ? Math.round(100 * c.EM_DIA / c.tot) + '%' : '—'];
    const HEAD = ['Itens previstos', 'Em dia', 'Parcial', 'Pendente', 'Não conferido', '% em dia'];

    y = section(doc, y, 'Resumo do ano por área');
    y = table(doc, y, {
      head: [['Área', ...HEAD]],
      body: areas.map(ar => linha(AREAS[ar], conta(turmasAtivas(ar)))).concat(areas.length > 1 ? [linha('Total', conta(areas.flatMap(ar => turmasAtivas(ar))))] : []),
      styles: { halign: 'center' }, columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    });

    y = section(doc, y, 'Resumo do ano por item');
    y = table(doc, y, {
      head: [['Item', 'Em dia', 'Parcial', 'Pendente', 'Não conferido', '% em dia']],
      body: CONF_ITENS.map(([k, l]) => {
        const c = { EM_DIA: 0, PARCIAL: 0, PENDENTE: 0, '': 0 }; let tot = 0;
        areas.forEach(ar => turmasAtivas(ar).forEach(t => mesesDa(t).forEach(m => { tot++; c[(conferencia(t.id, m) || {})[k] || '']++; })));
        return [l, c.EM_DIA, c.PARCIAL, c.PENDENTE, c[''], tot ? Math.round(100 * c.EM_DIA / tot) + '%' : '—'];
      }),
      styles: { halign: 'center' }, columnStyles: { 0: { halign: 'left' } },
    });

    for (const ar of areas) {
      const ts = turmasAtivas(ar);
      if (!ts.length) continue;
      y = section(doc, y, `${AREAS[ar]} — itens em dia por mês (de 4)`);
      y = table(doc, y, {
        head: [['Turma', 'Professor(a)', 'Início', ...meses.map(m => MESES[+m.slice(5) - 1].slice(0, 3)), '% ano']],
        body: ts.map(t => {
          let ok = 0, tot = 0;
          const cells = meses.map(m => {
            if (!iniciou(t, m)) return 'n/a';
            if (m > ate) return '';
            const c = conferencia(t.id, m) || {};
            const n = CONF_ITENS.filter(([k]) => c[k] === 'EM_DIA').length;
            tot += 4; ok += n;
            return CONF_ITENS.every(([k]) => !c[k]) ? '—' : n + '/4';
          });
          return [t.nome, t.professor || '', t.inicio ? fmtMonthShort(t.inicio) : '', ...cells, tot ? Math.round(100 * ok / tot) + '%' : '—'];
        }),
        styles: { fontSize: 6.8, halign: 'center', cellPadding: 1.1 },
        columnStyles: { 0: { halign: 'left', cellWidth: 58 }, 1: { halign: 'left', cellWidth: 32 }, 2: { cellWidth: 13 } },
        didParseCell: d => {
          if (d.section === 'body' && d.column.index >= 3 && d.column.index < 15) {
            const v = d.cell.raw;
            if (v === '4/4') d.cell.styles.textColor = [20, 110, 50];
            else if (/^[0-3]\/4$/.test(v)) { d.cell.styles.textColor = [180, 30, 30]; d.cell.styles.fontStyle = 'bold'; }
            else d.cell.styles.textColor = [160, 160, 160];
          }
        },
      });
    }

    // por professor
    const profs = {};
    areas.forEach(ar => turmasAtivas(ar).forEach(t => { const p = t.professor || '(sem professor)'; (profs[p] = profs[p] || []).push(t); }));
    y = section(doc, y, 'Resumo por professor(a)');
    y = table(doc, y, {
      head: [['Professor(a)', 'Turmas', ...HEAD]],
      body: Object.keys(profs).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(p => { const r = linha(p, conta(profs[p])); r.splice(1, 0, profs[p].length); return r; }),
      styles: { halign: 'center', fontSize: 8 }, columnStyles: { 0: { halign: 'left' } },
    });

    // pendências e parciais do ano
    const pend = [];
    areas.forEach(ar => turmasAtivas(ar).forEach(t => mesesDa(t).forEach(m => {
      const c = conferencia(t.id, m) || {};
      const it = CONF_ITENS.filter(([k]) => c[k] === 'PARCIAL' || c[k] === 'PENDENTE').map(([k, l]) => `${l} (${statusTxt(c[k]).toLowerCase()})`);
      if (it.length) pend.push([fmtMonthShort(m), AREAS[ar], t.nome, t.professor || '', it.join('; '), c.observacoes || '']);
    })));
    y = section(doc, y, `Itens parciais ou pendentes no ano: ${pend.length}`);
    if (pend.length) y = table(doc, y, { head: [['Mês', 'Área', 'Turma', 'Professor(a)', 'Itens', 'Observações']], body: pend, styles: { fontSize: 7.5 } });

    // meses ainda não conferidos
    const nc = [];
    areas.forEach(ar => turmasAtivas(ar).forEach(t => {
      const ms = mesesDa(t).filter(m => CONF_ITENS.some(([k]) => !(conferencia(t.id, m) || {})[k]));
      if (ms.length) nc.push([AREAS[ar], t.nome, t.professor || '', ms.map(fmtMonthShort).join(', ')]);
    }));
    if (nc.length) {
      y = section(doc, y, 'Meses com itens ainda não conferidos');
      y = table(doc, y, { head: [['Área', 'Turma', 'Professor(a)', 'Meses']], body: nc, styles: { fontSize: 7.5 } });
    }
    y = paragraph(doc, y, 'Legenda: x/4 = itens em dia no mês · — = mês não conferido · n/a = antes do início da turma · em branco = mês futuro.', { size: 8 });
    signature(doc, y);
    save(doc, `Conferencia_anual_${ano}_${areaTxt(area)}`);
  }

  async function frequenciaTurma(tid, de, ate) {
    const t = turma(tid);
    const datas = datasDaTurma(tid, de, ate);
    const alunos = alunosDaTurma(tid, true).filter(a => a.ativo !== 'NAO' || registrosAluno(a.id, de, ate).length);
    const st = statsTurma(tid, de, ate);
    const { doc, y: y0 } = await create('Relatório de Frequência e Assiduidade', [
      `${AREAS[t.area]} · Turma: ${t.nome}${t.professor ? ' · Professor(a): ' + t.professor : ''}`, periodTxt(de, ate)]);
    let y = paragraph(doc, y0, `Aulas registradas: ${st.aulas}   ·   Alunos: ${alunos.length}   ·   Assiduidade média da turma: ${st.pct == null ? '—' : st.pct + '%'}`, { bold: true, size: 9.5 });
    const stats = alunos.map(a => ({ a, s: statsAluno(a.id, de, ate) }));
    if (stats.length && datas.length) {
      const hpx = Math.max(300, 70 + stats.length * 26);
      const img = chartImage(chartAssiduidadeConfig(stats, 13), 900, hpx);
      const w = 160; const h = w * hpx / 900;
      y = section(doc, y, 'Assiduidade por aluno (% de presença)');
      y = image(doc, y, img, w, Math.min(h, 170));
    }
    y = section(doc, y, 'Resumo por aluno');
    y = table(doc, y, {
      head: [['Aluno(a)', 'Aulas', 'Presenças', 'Faltas', 'Justif.', '% Presença', 'Faltas seguidas (atual)', 'Situação']],
      body: stats.map(({ a, s }) => [a.nome + (a.ativo === 'NAO' ? ' (desligado)' : ''), s.total, s.P, s.F, s.J, s.pct == null ? '—' : s.pct + '%', s.seqAtual,
        s.seqAtual >= 3 ? 'Apto a desligamento' : s.seqAtual === 2 ? 'Contatar família' : 'Regular']),
      styles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' } },
      didParseCell: d => {
        if (d.section === 'body' && d.column.index === 7) {
          if (d.cell.raw === 'Apto a desligamento') { d.cell.styles.textColor = [180, 30, 30]; d.cell.styles.fontStyle = 'bold'; }
          if (d.cell.raw === 'Contatar família') { d.cell.styles.textColor = [170, 100, 0]; d.cell.styles.fontStyle = 'bold'; }
        }
      },
    });
    // Mapa de chamada (em blocos de até 16 datas)
    for (let i = 0; i < datas.length; i += 16) {
      const bloco = datas.slice(i, i + 16);
      y = section(doc, y, `Mapa de chamada${datas.length > 16 ? ` (${i / 16 + 1})` : ''} — P: presente · F: falta · J: justificada`);
      y = table(doc, y, {
        head: [['Aluno(a)', ...bloco.map(fmtDateShort)]],
        body: alunos.map(a => [a.nome, ...bloco.map(d => { const r = DB.Frequencia.find(x => x.aluno_id === a.id && x.data === d); return r ? r.status : '–'; })]),
        styles: { fontSize: 7, halign: 'center', cellPadding: 1.1 },
        columnStyles: { 0: { halign: 'left', cellWidth: 48 } },
        didParseCell: d => { if (d.section === 'body' && d.cell.raw === 'F') { d.cell.styles.textColor = [180, 30, 30]; d.cell.styles.fontStyle = 'bold'; } },
      });
    }
    signature(doc, y);
    save(doc, `Frequencia_${t.nome}_${de || ''}_${ate || ''}`);
  }

  async function assiduidadeGeral(area, de, ate) {
    const { doc, y: y0 } = await create('Relatório Geral de Assiduidade', [`Área: ${areaTxt(area)}`, periodTxt(de, ate)]);
    let y = y0;
    const ts = turmasAtivas(area);
    const rows = ts.map(t => ({ t, s: statsTurma(t.id, de, ate), n: alunosDaTurma(t.id).length }));
    if (rows.length) {
      const cfg = {
        type: 'bar',
        data: { labels: rows.map(r => shortName(r.t.nome)), datasets: [{ label: '% de presença', data: rows.map(r => r.s.pct || 0), backgroundColor: rows.map(r => r.t.area === 'MUSICA' ? '#7b5cc4' : '#2a8f57'), borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 12 } } }, y: { ticks: { font: { size: 12 } } } } },
      };
      const hpx = Math.max(280, 60 + rows.length * 26);
      y = section(doc, y, 'Assiduidade média por turma');
      y = image(doc, y, chartImage(cfg, 900, hpx), 160, Math.min(160 * hpx / 900, 170));
    }
    y = table(doc, y, {
      head: [['Área', 'Turma', 'Professor(a)', 'Alunos ativos', 'Aulas', '% Presença', 'Alertas 2 faltas', 'Alertas 3+ faltas']],
      body: rows.map(({ t, s, n }) => {
        const al = alertasFaltas(t.area).filter(x => x.turma.id === t.id);
        return [AREAS[t.area], t.nome, t.professor || '', n, s.aulas, s.pct == null ? '—' : s.pct + '%', al.filter(x => x.nivel === 2).length, al.filter(x => x.nivel === 3).length];
      }),
      styles: { fontSize: 8 },
      columnStyles: { 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' } },
    });
    signature(doc, y);
    save(doc, `Assiduidade_geral_${areaTxt(area)}`);
  }

  async function relDesligados(area, de, ate) {
    const lista = alunosDesligados(area, de, ate);
    const per = (de || ate) ? `Desligados de ${de ? fmtDate(de) : 'início'} a ${ate ? fmtDate(ate) : 'hoje'}` : `Situação em ${fmtDate(todayISO())}`;
    const { doc, y: y0 } = await create('Relação de Alunos Desligados', [`Área: ${areaTxt(area)}`, per]);
    let y = paragraph(doc, y0, 'Critério: o aluno é considerado desligado quando constava no relatório de presenças de um mês e não aparece mais no relatório seguinte, ou quando foi desligado manualmente pela coordenação.', { size: 9 });
    // resumo por turma
    const porTurma = {};
    lista.forEach(x => { const k = x.turma.id; (porTurma[k] = porTurma[k] || { t: x.turma, n: 0, nunca: 0 }).n++; if (!x.ultimaPresenca) porTurma[k].nunca++; });
    y = section(doc, y, `Resumo por turma — ${lista.length} aluno(s) desligado(s)`);
    y = table(doc, y, {
      head: [['Área', 'Turma', 'Desligados', 'Nunca compareceram', 'Alunos ativos hoje']],
      body: Object.values(porTurma).sort((a, b) => b.n - a.n).map(r => [AREAS[r.t.area], r.t.nome, r.n, r.nunca, alunosDaTurma(r.t.id).length]),
      styles: { halign: 'center' }, columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
    });
    y = section(doc, y, 'Relação nominal');
    y = table(doc, y, {
      head: [['Aluno(a)', 'Turma', 'Desligado em', 'Motivo', 'Última presença', 'Faltas seguidas ao sair', '% presença']],
      body: lista.length ? lista.map(x => [x.aluno.nome, `${AREAS[x.turma.area]} / ${x.turma.nome}`, fmtDate(x.aluno.data_desligamento) || '—', x.aluno.motivo_desligamento || '—',
        x.ultimaPresenca ? fmtDate(x.ultimaPresenca) : 'nunca compareceu', x.faltasAoSair, x.stats.pct == null ? '—' : x.stats.pct + '%'])
        : [['Nenhum aluno desligado no período', '', '', '', '', '', '']],
      styles: { fontSize: 7.6 }, columnStyles: { 2: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center', cellWidth: 16 }, 6: { halign: 'center', cellWidth: 14 } },
      didParseCell: d => { if (d.section === 'body' && d.column.index === 4 && d.cell.raw === 'nunca compareceu') { d.cell.styles.textColor = [180, 30, 30]; } },
    });
    signature(doc, y);
    save(doc, `Alunos_desligados_${areaTxt(area)}_${todayISO()}`);
  }

  async function alertas(area) {
    const lista = alertasFaltas(area);
    const { doc, y: y0 } = await create('Alunos com Faltas Consecutivas', [`Área: ${areaTxt(area)}`, `Situação em ${fmtDate(todayISO())}`]);
    let y = paragraph(doc, y0, 'Critério: faltas não justificadas consecutivas contadas a partir da aula mais recente registrada. Com 2 faltas seguidas a secretaria deve contatar o aluno ou a família; com 3 ou mais o aluno está apto a ser desligado da turma.', { size: 9 });
    const grupos = [[3, 'APTOS A DESLIGAMENTO — 3 ou mais faltas seguidas', [180, 30, 30]], [2, 'ATENÇÃO — 2 faltas seguidas (contatar aluno/família)', [170, 100, 0]]];
    grupos.forEach(([nivel, titulo, cor]) => {
      const itens = lista.filter(x => x.nivel === nivel);
      y = ensure(doc, y, 16);
      doc.setTextColor(...cor); y = section(doc, y, `${titulo}: ${itens.length}`); doc.setTextColor(0);
      y = table(doc, y, {
        head: [['Aluno(a)', 'Área / Turma', 'Responsável', 'Telefone', 'Faltas seguidas', 'Datas das faltas', 'Contato da secretaria']],
        body: itens.length ? itens.map(x => [x.aluno.nome, `${AREAS[x.turma.area]} / ${x.turma.nome}`, x.aluno.responsavel || '', x.aluno.telefone || '', x.stats.seqAtual,
          x.stats.faltasSeq.map(fmtDateShort).join(', '), x.contato ? `${fmtDate(x.contato.data)}: ${x.contato.resultado || ''}${x.contato.motivo ? ' — ' + x.contato.motivo : ''}` : 'Não realizado'])
          : [['Nenhum aluno nesta situação', '', '', '', '', '', '']],
        headStyles: { fillColor: cor },
        styles: { fontSize: 7.8 },
        columnStyles: { 0: { cellWidth: 30 }, 3: { cellWidth: 25 }, 4: { halign: 'center', cellWidth: 14 } },
      });
    });
    signature(doc, y, 'Coordenação Pedagógica');
    save(doc, `Alertas_faltas_${areaTxt(area)}_${todayISO()}`);
  }

  function eventoInfo(e) {
    return [
      ['Evento', e.nome], ['Área', AREAS[e.area] || ''], ['Município / Local', [e.municipio, e.local].filter(Boolean).join(' — ')],
      ['Data do evento', fmtDate(e.data_evento)], ['Saída', e.horario_saida || ''], ['Retorno', fmtDate(e.data_retorno) || ''],
      ['Transporte', e.transporte || ''], ['Responsável', e.responsavel || ''], ['Observações', e.observacoes || ''],
    ].filter(r => r[1]);
  }

  async function eventoLista(eid, comFotos) {
    const e = DB.Eventos.find(x => x.id === eid);
    const parts = participantesEvento(eid);
    const { doc, y: y0 } = await create('Relação de Participantes e Documentação', [`${e.nome} — ${e.municipio || ''}`, `Data: ${fmtDate(e.data_evento)}`]);
    let y = table(doc, y0, { body: eventoInfo(e), theme: 'plain', styles: { fontSize: 9, cellPadding: 1 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } } });
    const docs = docsDoEvento(e);
    y = section(doc, y, `Participantes: ${parts.length}`);
    y = table(doc, y, {
      head: [['#', 'Aluno(a)', 'Turma', 'Nascimento', 'Responsável / Telefone', ...docs.map(([, l]) => l.split(' ')[0] === 'Documento' ? 'Doc. foto' : l.replace('Autorização do responsável', 'Autoriz.').replace('Termo de uso de imagem', 'Termo imagem').replace('Ficha de saúde', 'Ficha saúde'))]],
      body: parts.map((p, i) => [i + 1, p.aluno.nome, p.turma ? p.turma.nome : '', fmtDate(p.aluno.data_nascimento), [p.aluno.responsavel, p.aluno.telefone].filter(Boolean).join(' · '),
        ...docs.map(([k]) => isTrue(p.part[k]) ? 'OK' : 'FALTA')]),
      styles: { fontSize: 7.5 },
      columnStyles: { 0: { cellWidth: 7, halign: 'center' } },
      didParseCell: d => {
        if (d.section === 'body' && d.column.index >= 5) {
          d.cell.styles.halign = 'center';
          d.cell.styles.textColor = d.cell.raw === 'OK' ? [20, 110, 50] : [180, 30, 30];
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
    const pend = parts.filter(p => docs.some(([k]) => !isTrue(p.part[k])));
    if (pend.length) {
      y = section(doc, y, 'Documentação pendente');
      y = table(doc, y, { head: [['Aluno(a)', 'Responsável / Telefone', 'Faltando']], body: pend.map(p => [p.aluno.nome, [p.aluno.responsavel, p.aluno.telefone].filter(Boolean).join(' · '), docs.filter(([k]) => !isTrue(p.part[k])).map(([, l]) => l).join(', ')]), styles: { fontSize: 8 } });
    }
    if (comFotos) y = await registroFotos(doc, y, fotosFiltro({ evento: eid }), 'Registro fotográfico do evento');
    signature(doc, y);
    save(doc, `Evento_${e.nome}_participantes`);
  }

  async function autorizacoes(eid, apenasPendentes) {
    const e = DB.Eventos.find(x => x.id === eid);
    let parts = participantesEvento(eid);
    if (apenasPendentes) parts = parts.filter(p => !isTrue(p.part.autorizacao));
    if (!parts.length) throw new Error('Nenhum participante para gerar autorização.');
    let first = true, doc;
    for (const p of parts) {
      if (first) { doc = (await create('Termo de Autorização', `${e.nome}`)).doc; first = false; } else {
        doc.addPage();
        const W = doc.internal.pageSize.getWidth();
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('TERMO DE AUTORIZAÇÃO', W / 2, 46, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(e.nome, W / 2, 51.5, { align: 'center' });
      }
      let y = 64;
      const a = p.aluno;
      const nasc = a.data_nascimento ? `, nascido(a) em ${fmtDate(a.data_nascimento)}` : '';
      const saida = e.horario_saida ? `, com saída prevista às ${e.horario_saida}` : '';
      const ret = e.data_retorno ? ` e retorno previsto em ${fmtDate(e.data_retorno)}` : '';
      y = paragraph(doc, y, `Eu, ${a.responsavel ? a.responsavel.toUpperCase() : '______________________________________________'}, portador(a) do RG/CPF nº ______________________, responsável legal pelo(a) aluno(a) ${a.nome.toUpperCase()}${nasc}, integrante da turma ${p.turma ? p.turma.nome : ''} (${AREAS[e.area] || ''}) do Instituto Cultural das Montanhas, AUTORIZO sua participação no evento "${e.nome}", a realizar-se no município de ${e.municipio || '________________'}${e.local ? ', em ' + e.local : ''}, no dia ${fmtDate(e.data_evento) || '___/___/_____'}${saida}${ret}${e.transporte ? ', utilizando o transporte: ' + e.transporte : ''}, sob a responsabilidade de ${e.responsavel || 'equipe do Instituto'}.`, { size: 11 });
      y += 2;
      y = paragraph(doc, y, 'Declaro estar ciente das atividades programadas e me comprometo a informar à coordenação qualquer condição de saúde, alergia ou uso de medicamento do(a) aluno(a).', { size: 11 });
      y += 4;
      y = paragraph(doc, y, 'Informações de saúde / alergias / medicamentos:', { size: 10.5 });
      const PW = doc.internal.pageSize.getWidth();
      doc.setDrawColor(120);
      [5, 13].forEach(dy => doc.line(M, y + dy, PW - M, y + dy));
      doc.setDrawColor(0);
      y += 20;
      y = paragraph(doc, y, `Telefone para contato em emergência: ${a.telefone || '(___) _____-______'}`, { size: 10.5 });
      y += 10;
      const W = doc.internal.pageSize.getWidth();
      doc.setFontSize(11);
      doc.text('Afonso Cláudio - ES, ______ de ______________________ de ________.', W - M, y, { align: 'right' });
      y += 26;
      doc.line(W / 2 - 50, y, W / 2 + 50, y);
      doc.text('Assinatura do(a) responsável legal', W / 2, y + 5, { align: 'center' });
    }
    save(doc, `Autorizacoes_${e.nome}`);
  }

  async function turmasAlunos(area) {
    const { doc, y: y0 } = await create('Relação de Turmas e Alunos', `Área: ${areaTxt(area)}`);
    let y = y0;
    turmasAtivas(area).forEach(t => {
      const al = alunosDaTurma(t.id);
      y = section(doc, y, `${AREAS[t.area]} · ${t.nome} — ${al.length} aluno(s)`);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text([t.professor && `Professor(a): ${t.professor}`, t.dias_horario, t.local].filter(Boolean).join('   ·   '), M, y + 1); y += 4;
      y = table(doc, y, {
        head: [['#', 'Aluno(a)', 'Nascimento', 'Responsável', 'Telefone', '% Presença']],
        body: al.map((a, i) => { const s = statsAluno(a.id); return [i + 1, a.nome, fmtDate(a.data_nascimento), a.responsavel || '', a.telefone || '', s.pct == null ? '—' : s.pct + '%']; }),
        styles: { fontSize: 8 }, columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 5: { halign: 'center' } },
      });
    });
    signature(doc, y);
    save(doc, `Turmas_e_alunos_${areaTxt(area)}`);
  }

  return { setAssinante, conferencia: relConferencia, conferenciaAnual: relConferenciaAnual, conferenciaTurma: relConferenciaTurma, ata: relAta, desligados: relDesligados, pedagogico: relPedagogico, ocorrencia: relOcorrencia, avaliacao: relAvaliacao, prestacao: relPrestacao, fotografico: relFotografico, periodoRelatorio, frequenciaTurma, assiduidadeGeral, alertas, eventoLista, autorizacoes, turmasAlunos };
})();

/* Compartilhados entre tela e PDF */
function chartAssiduidadeConfig(stats, fs) {
  fs = fs || 12;
  return {
    type: 'bar',
    data: {
      labels: stats.map(x => x.a.nome),
      datasets: [
        { label: 'Presença', data: stats.map(x => x.s.total ? Math.round(100 * x.s.P / x.s.total) : 0), backgroundColor: '#2a8f57', stack: 's' },
        { label: 'Falta justificada', data: stats.map(x => x.s.total ? Math.round(100 * x.s.J / x.s.total) : 0), backgroundColor: '#e0a526', stack: 's' },
        { label: 'Falta', data: stats.map(x => x.s.total ? 100 - Math.round(100 * x.s.P / x.s.total) - Math.round(100 * x.s.J / x.s.total) : 0), backgroundColor: '#d0443e', stack: 's' },
      ],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { position: 'bottom', labels: { font: { size: fs } } } },
      scales: { x: { stacked: true, min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: fs - 1 } } }, y: { stacked: true, ticks: { font: { size: fs - 1 } } } },
    },
  };
}

function docsDoEvento(e) {
  const req = (e.documentos_exigidos || '').split(',').map(s => s.trim()).filter(Boolean);
  return req.length ? DOCS_EVENTO.filter(([k]) => req.includes(k)) : DOCS_EVENTO;
}

function participantesEvento(eid) {
  return DB.EventoParticipantes.filter(p => p.evento_id === eid)
    .map(p => { const a = aluno(p.aluno_id); return a ? { part: p, aluno: a, turma: turma(a.turma_id) } : null; })
    .filter(Boolean)
    .sort((x, y) => x.aluno.nome.localeCompare(y.aluno.nome, 'pt-BR'));
}
