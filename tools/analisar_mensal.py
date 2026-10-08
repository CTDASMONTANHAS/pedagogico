"""
Analisa uma série de "Relatórios mensais" de uma turma para a conferência pedagógica.

Para cada mês mostra: plano (tamanho), aulas esperadas pela carga horária, relatórios de aula,
participantes/frequência, relatório de conclusão; e aponta relatórios de aula copiados (>= 90%)
e planos repetidos (>= 80%).

Uso: python tools/analisar_mensal.py pasta_ou_arquivos...
"""
import difflib
import glob
import os
import re
import sys

import pypdf

sys.path.insert(0, os.path.dirname(__file__))
import ler_relatorio_mensal as L  # noqa: E402


def horas(s):
    m = re.fullmatch(r'(\d+)h(\d*)', s or '')
    return int(m.group(1)) * 60 + int(m.group(2) or 0) if m else None


def main(paths):
    arquivos = []
    for p in paths:
        arquivos += sorted(glob.glob(os.path.join(p, '*.pdf'))) if os.path.isdir(p) else [p]
    rel = []
    for f in arquivos:
        r = L.ler(f)
        full = '\n'.join(pg.extract_text() or '' for pg in pypdf.PdfReader(f).pages)
        m = re.search(r'(\d{2}h\d{0,2})\s*\n\s*Carga horária', full)
        r['ch_mes'] = m.group(1) if m else ''
        m = re.search(r'Educador\(es\)\s*\n(.+)', full)
        r['educadores'] = m.group(1).replace('*', '').strip() if m else ''
        rel.append(r)
    rel.sort(key=lambda r: r['mes'])
    if not rel:
        return
    print(f"TURMA: {rel[0]['atividade']} | educadores: {rel[0]['educadores']}")
    textos = {}
    for r in rel:
        dur = horas(r['aulas'][0]['carga']) if r['aulas'] else None
        esperadas = round(horas(r['ch_mes']) / dur) if dur and horas(r['ch_mes']) is not None else '?'
        print(f"\n== {r['mes']} | CH {r['ch_mes'] or '-'} (~{esperadas} aulas) | inscritos {r['inscritos']} | "
              f"conclusão: {r['conclusao_mensal'] or '-'} | plano: {r['plano']['chars']} chars")
        for a in r['aulas']:
            print(f"   {a['data']} {a['situacao']:<10} part {a['participantes']} freq {a['frequencia']} "
                  f"cont {a['conteudo_chars']} | {a['inicio_conteudo'][:60]}")
        for pg in pypdf.PdfReader(r['arquivo']).pages:
            t = pg.extract_text() or ''
            mm = re.match(r'\s*(\d{1,2})\s*\n\s*([A-ZÇ]+)\s*\n\s*\d{4}', t)
            if mm and mm.group(2) in L.MESES:
                k = f"{int(mm.group(1)):02d}/{L.MESES[mm.group(2)]:02d}"
                textos[k] = re.sub(r'\s+', ' ', t[mm.end():t.find('ATIVIDADE')])
    grupos = []
    for k in sorted(textos, key=lambda k: (k[3:], k[:2])):
        for g in grupos:
            if difflib.SequenceMatcher(None, textos[g[0]], textos[k]).ratio() >= 0.9:
                g.append(k)
                break
        else:
            grupos.append([k])
    print('\nRELATÓRIOS DE AULA IGUAIS (>=90%):', [g for g in grupos if len(g) > 1] or 'nenhum')
    rep = []
    for i in range(len(rel)):
        for j in range(i + 1, len(rel)):
            a, b = rel[i]['plano_texto'], rel[j]['plano_texto']
            if a and b:
                q = difflib.SequenceMatcher(None, a, b).ratio()
                if q >= 0.8:
                    rep.append((rel[i]['mes'], rel[j]['mes'], round(q, 2)))
    print('PLANOS REPETIDOS (>=80%):', rep or 'nenhum')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main(sys.argv[1:])
