"""
Lê o PDF "Relatório mensal de presenças" (sistema de chamada do CT das Montanhas)
e devolve JSON com professor, mês, datas e P/F por aluno.

As marcações são associadas à coluna de data pela posição horizontal na página,
porque o relatório deixa em branco os dias sem chamada registrada.

Uso: python tools/ler_relatorio_presencas.py "Relatório ... .pdf" [...]
"""
import json
import re
import sys

import pypdf

MESES = {'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4, 'maio': 5, 'junho': 6, 'julho': 7,
         'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12}


def corrigir(t):
    """Desfaz texto UTF-8 lido como cp1252 (ex.: 'RÃ‰BULI' -> 'RÉBULI')."""
    if 'Ã' not in t and 'Â' not in t:
        return t
    b = bytearray()
    for ch in t:
        o = ord(ch)
        if 0xDC80 <= o <= 0xDCFF:
            b.append(o - 0xDC00)
        elif o < 256:
            b.append(o)
        else:
            try:
                b.extend(ch.encode('cp1252'))
            except UnicodeEncodeError:
                return t
    try:
        return b.decode('utf-8')
    except UnicodeDecodeError:
        return t


def ler(path):
    out = {'arquivo': path, 'professor': '', 'mes': '', 'datas': [], 'alunos': []}
    for page in pypdf.PdfReader(path).pages:
        items = []

        def visit(text, cm, tm, fd, fs):
            t = corrigir(text.strip())
            if t:
                items.append((round(tm[5]), round(tm[4]), t))
        page.extract_text(visitor_text=visit)

        rows = {}
        for y, x, t in items:
            rows.setdefault(y, []).append((x, t))
            m = re.match(r'Educador\(es\):\s*(.+)', t)
            if m:
                out['professor'] = m.group(1).replace('*', '').strip()
            m = re.match(r'(\w+)\s*/\s*(\d{4})$', t)
            if m and m.group(1).lower() in MESES:
                out['mes'] = f"{m.group(2)}-{MESES[m.group(1).lower()]:02d}"

        # Linha de cabeçalho: contém "NOME" seguido dos dias
        header = None
        for y, cells in rows.items():
            if any(t == 'NOME' for _, t in cells):
                header = sorted((x, t) for x, t in cells if re.fullmatch(r'\d{1,2}', t))
        if not header or not out['mes']:
            continue
        colunas = [(x, f"{out['mes']}-{int(t):02d}") for x, t in header]
        for _, d in colunas:
            if d not in out['datas']:
                out['datas'].append(d)

        for y in sorted(rows, reverse=True):
            cells = sorted(rows[y])
            nome = next((t for x, t in cells if 20 < x < 400 and not re.fullmatch(r'\d+', t)), None)
            marcas = [(x, t) for x, t in cells if t in ('P', 'A', 'F', 'J', 'FJ') and x > 400]
            # nomes de alunos vêm em maiúsculas; descarta títulos e rodapés
            if not nome or nome == 'NOME' or not re.fullmatch(r"[A-ZÀ-ÖØ-Ý' .\-]+", nome):
                continue
            regs = {}
            # outras letras (ex.: C = aula cancelada/feriado) não contam como presença nem falta
            for x, t in cells:
                if x > 400 and re.fullmatch(r'[A-Z]{1,2}', t) and t not in ('P', 'A', 'F', 'J', 'FJ'):
                    col = min(colunas, key=lambda c: abs(c[0] - x))
                    out.setdefault('outras_marcas', {}).setdefault(col[1], set()).add(t)
            for x, t in marcas:
                col = min(colunas, key=lambda c: abs(c[0] - x))
                if abs(col[0] - x) <= 12:
                    regs[col[1]] = 'P' if t == 'P' else ('J' if t in ('J', 'FJ') else 'F')
            out['alunos'].append({'nome': nome, 'registros': regs})
    out['datas'].sort()
    out['outras_marcas'] = {d: sorted(v) for d, v in sorted(out.get('outras_marcas', {}).items())}
    out['datas_com_chamada'] = sorted({d for a in out['alunos'] for d in a['registros']})
    out['datas_sem_chamada'] = [d for d in out['datas'] if d not in out['datas_com_chamada'] and d not in out['outras_marcas']]
    return out


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps([ler(p) for p in sys.argv[1:]], ensure_ascii=False, indent=1))
