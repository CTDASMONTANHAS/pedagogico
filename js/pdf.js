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

  /** Conferência de uma turma: mês a mês, com resumo, assiduidade e observações. */
  async function relConferenciaTurma(tid, ano) {
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

  async function eventoLista(eid) {
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

  return { setAssinante, conferencia: relConferencia, conferenciaAnual: relConferenciaAnual, conferenciaTurma: relConferenciaTurma, frequenciaTurma, assiduidadeGeral, alertas, eventoLista, autorizacoes, turmasAlunos };
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
