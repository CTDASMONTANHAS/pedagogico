# Gestão Pedagógica — Instituto Cultural das Montanhas

Sistema web para a coordenação conferir o trabalho dos professores das turmas de **Música** e **Esporte**, acompanhar a frequência dos alunos e organizar eventos fora do município. Os dados ficam numa planilha do Google.

## Funcionalidades

| Tela | O que faz |
|---|---|
| **Painel** | Resumo: turmas por área, % da conferência do mês, alertas de faltas, assiduidade por turma, próximos eventos |
| **Turmas e alunos** | Turmas separadas em Música/Esporte, cadastro de alunos (individual ou em lote), desligamento e reativação |
| **Conferência mensal** | Checklist por turma/mês: plano de aula mensal, relatório de aulas, registro de chamada e fechamento mensal (Em dia / Parcial / Pendente) + histórico de 6 meses |
| **Frequência** | Importação do relatório de presenças (colar tabela), lançamento manual de chamada, gráficos de assiduidade por aluno e por aula, mapa de chamada editável |
| **Alertas de faltas** | Alunos com **2 faltas seguidas** (secretaria contata a família) e **3 ou mais** (aptos a desligamento), com registro dos contatos |
| **Eventos e viagens** | Cadastro de eventos em outros municípios, lista de alunos e controle de documentos (autorização, documento com foto, cartão SUS, termo de imagem, ficha de saúde) |
| **Relatórios PDF** | Todos na folha timbrada do Instituto: conferência mensal, frequência da turma, assiduidade geral, faltas consecutivas, participantes do evento, termos de autorização, turmas e alunos |

**Regra das faltas seguidas:** conta as faltas **não justificadas** consecutivas a partir da aula mais recente. Uma presença ou falta justificada (J) zera a sequência.

## Estrutura

```
index.html          interface (página única)
css/style.css       estilos (tema claro/escuro, responsivo)
js/config.js        URL do Apps Script
js/api.js           comunicação com a planilha (ou modo demonstração)
js/logic.js         regras: frequência, sequência de faltas, importação
js/seed.js          turmas iniciais de 2026
js/pdf.js           relatórios PDF com timbre
js/app.js           telas
apps-script/Code.gs backend que roda dentro da planilha
assets/logo.png     logo do Instituto
```

## Instalação da planilha (uma vez)

Feita pela conta **dona** da planilha:

1. Abra a planilha → **Extensões → Apps Script**. Apague o conteúdo de `Code.gs`, cole o arquivo [`apps-script/Code.gs`](apps-script/Code.gs) e salve.
2. Recarregue a planilha. Aparece o menu **Sistema Pedagógico**:
   - **Criar/atualizar abas** — cria as abas `Turmas`, `Alunos`, `Conferencias`, `Frequencia`, `Contatos`, `Eventos`, `EventoParticipantes` e cadastra as 25 turmas de 2026.
   - **Definir senha de acesso** — senha usada para entrar no sistema.
3. No Apps Script: **Implantar → Nova implantação → App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Copie a URL gerada (termina em `/exec`) e coloque em `js/config.js`:
   ```js
   window.APP_CONFIG = { API_URL: 'https://script.google.com/macros/s/.../exec' };
   ```

Sem a URL configurada o sistema abre em **modo demonstração** (dados só no navegador).

Ao alterar o `Code.gs` depois, use **Implantar → Gerenciar implantações → Editar → Nova versão** para manter a mesma URL.

## Importar o relatório de presenças

Em **Frequência → Importar relatório**, cole a tabela copiada do relatório:

```
Aluno            01/10   03/10   08/10
Maria da Silva   P       F       F
João Souza       P       J       P
```

Também aceita uma linha por registro (`Nome; Data; Status`). Valores: `P`/`C`/✓ = presente, `F` = falta, `J`/`FJ` = falta justificada. Os alunos que não estiverem cadastrados na turma são criados na hora. Importar de novo as mesmas datas substitui a chamada anterior, sem duplicar.

## Rodar localmente

```bash
python -m http.server 8771
```
