/* Turmas do Instituto (2026). Usadas para popular o modo demonstração. A planilha recebe a mesma lista via apps-script/Code.gs. */
const TURMAS_INICIAIS = {
  ESPORTE: [
    ['Vôlei Feminino', 'Vôlei'], ['Vôlei OAB', 'Vôlei'], ['Vôlei VNI', 'Vôlei'],
    ['Futsal Lagoa Sub-9', 'Futsal'], ['Futsal Lagoa Sub-11', 'Futsal'], ['Futsal Lagoa Sub-13', 'Futsal'],
    ['Jiu-jitsu A', 'Jiu-jitsu'], ['Jiu-jitsu B', 'Jiu-jitsu'], ['Kickboxing A', 'Kickboxing'],
  ],
  MUSICA: [
    ['Orq. Desenvolvimento Jônice Tristão - C / Agudos 2026', 'Orquestra'],
    ['Orq. Desenvolvimento Jônice Tristão - C / Graves 2026', 'Orquestra'],
    ['Orq. Elementar Jônice Tristão - B / Agudos 2026', 'Orquestra'],
    ['Orq. Elementar Jônice Tristão - B / Graves 2026', 'Orquestra'],
    ['Orq. Fundamental Jônice Tristão - A 2026', 'Orquestra'],
    ['Orq. Fundamental Jônice Tristão - D 2026', 'Orquestra'],
    ['Coral Infantil A - Matutino - 2026', 'Coral'],
    ['Coral Infantil B - Vespertino - 2026', 'Coral'],
    ['Coral Infantil C - Vespertino - 2026', 'Coral'],
    ['Orquestra de Viola das Montanhas - Turma A', 'Viola caipira'],
    ['Orquestra de Viola das Montanhas - Turma B', 'Viola caipira'],
    ['Piano Turma A - Terça-feira - 2026', 'Piano'],
    ['Piano Turma B - Quinta-feira - 2026', 'Piano'],
    ['Sopros Matutino A', 'Sopros'],
    ['Sopros Vespertino B', 'Sopros'],
    ['Sopros Vespertino C', 'Sopros'],
  ],
};

function seedDemo() {
  const db = Demo.load();
  if (db.Turmas.length) return;
  Object.entries(TURMAS_INICIAIS).forEach(([area, lista]) => lista.forEach(([nome, modalidade]) => {
    db.Turmas.push({ id: uid(), area, nome, modalidade, professor: '', dias_horario: '', local: '', ativa: 'SIM', criado_em: todayISO() });
  }));
  Demo.store(db);
}
if (API.demo) seedDemo();
