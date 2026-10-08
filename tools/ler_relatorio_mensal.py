"""
Lê o PDF "Relatório mensal" de uma atividade (sistema do CT das Montanhas) e verifica:
  - Plano mensal: se há texto de planejamento nas páginas iniciais;
  - Relatórios de aula: cada página de aula (data, situação, conteúdo, participantes, frequência).

Uso: python tools/ler_relatorio_mensal.py arquivo.pdf [...]
"""
import json
import re
import sys

import pypdf

MESES = {'JANEIRO': 1, 'FEVEREIRO': 2, 'MARÇO': 3, 'ABRIL': 4, 'MAIO': 5, 'JUNHO': 6, 'JULHO': 7,
         'AGOSTO': 8, 'SETEMBRO': 9, 'OUTUBRO': 10, 'NOVEMBRO': 11, 'DEZEMBRO': 12}
RODAPE = re.compile(r'RELATÓRIO MENSAL - MÊS DE .*|Relatório mensal - mês de .*')


def limpa(txt):
    linhas = [l for l in txt.splitlines() if l.strip() and not RODAPE.match(l.strip())]
    if linhas and re.fullmatch(r'\s*\d{2}\s*', linhas[-1]):  # número da página no rodapé
        linhas = linhas[:-1]
    return '\n'.join(linhas)


def ler(path):
    pages = [p.extract_text() or '' for p in pypdf.PdfReader(path).pages]
    full = '\n'.join(pages)
    out = {'arquivo': path, 'atividade': '', 'mes': '', 'carga_horaria': '', 'plano': {}, 'aulas': [], 'inscritos': 0}
    m = re.search(r'Atividade\s*\n\s*(.+)', full)
    if m:
        out['atividade'] = m.group(1).strip()
    m = re.search(r'MÊS DE (\w+) DE (\d{4})', full)
    if m:
        out['mes'] = f"{m.group(2)}-{MESES[m.group(1).upper()]:02d}"
    m = re.search(r'Plano mensal\s*\n\s*([\dh]+)', full)
    if m:
        out['carga_horaria'] = m.group(1)

    plano_txt = []
    for i, txt in enumerate(pages):
        t = limpa(txt)
        aula = re.match(r'\s*(\d{1,2})\s*\n\s*([A-ZÇ]+)\s*\n\s*(\d{4})\s*\n\s*(\S+-feira|Sábado|Domingo)', t)
        if aula and aula.group(2) in MESES:
            dia, mes, ano = int(aula.group(1)), MESES[aula.group(2)], aula.group(3)
            sit = re.search(r'ATIVIDADE:\s*\n?\s*([A-ZÇÃÕÉ ]+)', t)
            part = re.search(r'Participantes\s*\n\s*(\d+)', t)
            freq = re.search(r'Frequência\s*\n\s*([\d,]+)%', t)
            ch = re.search(r'Carga horária:\s*([\dh]+)', t)
            corpo = t[aula.end():sit.start() if sit else len(t)]
            corpo = re.sub(r'Carga horária:.*', '', corpo).strip()
            out['aulas'].append({
                'data': f"{ano}-{mes:02d}-{dia:02d}", 'pagina': i + 1,
                'situacao': sit.group(1).strip() if sit else '',
                'carga': ch.group(1) if ch else '',
                'conteudo_chars': len(corpo), 'inicio_conteudo': corpo[:90].replace('\n', ' '),
                'participantes': int(part.group(1)) if part else None,
                'frequencia': freq.group(1).replace(',', '.') if freq else None,
            })
        elif 'Lista de Inscritos' in t:
            m = re.search(r'(\d+)\s*\n\s*Inscritos\s*\n\s*Inscritos', t)
            if m:
                out['inscritos'] = int(m.group(1))
        elif not out['aulas'] and 'Galeria de fotos' not in t:
            plano_txt.append(t)

    # Plano: texto que vem depois de cada título "Plano mensal" (o título também rotula a carga
    # horária no cabeçalho, ex. "Plano mensal\n03h" — esse caso é ignorado)
    p = '\n'.join(plano_txt)
    fim = r'(?=Relatório de conclusão mensal|\nDescrição\n|\nCarga horária\n|Instituto Cultural Das Montanhas|\Z)'
    blocos = [b.strip() for b in re.findall(r'Plano mensal\n(.*?)' + fim, p, flags=re.S)]
    blocos = [re.sub(r'^Plano Mensal\n', '', b) for b in blocos if b and not re.match(r'\d+h', b)]
    corpo = '\n'.join(blocos)
    out['plano'] = {'chars': len(corpo), 'inicio': corpo[:160].replace('\n', ' ')}
    m = re.search(r'Relatório de conclusão mensal\s*\n\s*Situação:\s*\n?\s*([^\n]+)', full)
    out['conclusao_mensal'] = m.group(1).strip() if m else ''
    m = re.search(r'Nenhum atendido inscrito', full)
    if m:
        out['inscritos'] = 0
    return out


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps([ler(p) for p in sys.argv[1:]], ensure_ascii=False, indent=1))
