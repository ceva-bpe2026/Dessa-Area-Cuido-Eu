/* Dashboard — lê ?action=dados e ?action=setores do Apps Script (API_URL em config.js) */

const CONFORME = 'Em conformidade';
const TURNOS = ['Administrativo', 'Manhã', 'Tarde', 'Noite'];
const SETORES = ['Operação', 'Administrativo'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const LS_DADOS = 'dace_dash';
const NAVY = '#0b1f4b';
const NAVY_HOVER = '#23407f';

const $ = s => document.querySelector(s);

let base = { topicos: [], linhas: [], areas: [] }; // linhas já convertidas em objetos
const graficos = {};

/* ------------------------------------------------------------ datas */

function pad(n) { return String(n).padStart(2, '0'); }

function semanaISO(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ano = t.getUTCFullYear();
  const sem = Math.ceil(((t - Date.UTC(ano, 0, 1)) / 86400000 + 1) / 7);
  return ano + '-' + pad(sem);
}

function rotuloSemana(chave) {
  const [ano, sem] = chave.split('-');
  return `Semana ${Number(sem)} / ${ano}`;
}

function rotuloMes(chave) {
  const [ano, mes] = chave.split('-');
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

function dataBR(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* ------------------------------------------------------------ dados */

function preparar(api, areas) {
  const linhas = api.linhas.map(r => {
    const data = new Date(r[0]); // "2026-10-05T14:32" = horário local
    return {
      data,
      dia: r[0].slice(0, 10),
      mes: r[0].slice(0, 7),
      semana: semanaISO(data),
      area: r[1],
      setor: r[2],
      turno: r[3],
      resp: r.slice(4)
    };
  });
  // Áreas da aba Setup (na ordem dela) + qualquer área antiga que só exista nas respostas
  const todas = areas.slice();
  linhas.forEach(l => { if (todas.indexOf(l.area) === -1) todas.push(l.area); });
  return { topicos: api.topicos, linhas, areas: todas };
}

async function carregar() {
  status('Atualizando...');
  try {
    const [dados, setores] = await Promise.all([
      buscarJson(API_URL + '?action=dados', {}, 60000),
      buscarJson(API_URL + '?action=setores', {}, 60000)
    ]);
    if (!dados.ok) throw new Error(dados.erro);
    if (!setores.ok) throw new Error(setores.erro);
    try { localStorage.setItem(LS_DADOS, JSON.stringify({ dados, setores: setores.setores, em: Date.now() })); } catch (_) {}
    base = preparar(dados, setores.setores);
    $('#atualizado').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    status('');
    montarFiltros();
    atualizar();
  } catch (err) {
    console.error(err);
    status('Não foi possível atualizar os dados (' + (err.message || err) + ').', true);
  }
}

function carregarCache() {
  try {
    const c = JSON.parse(localStorage.getItem(LS_DADOS));
    if (!c) return;
    base = preparar(c.dados, c.setores);
    $('#atualizado').textContent = 'Dados de ' + new Date(c.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + ' — atualizando...';
    montarFiltros();
    atualizar();
  } catch (_) {}
}

function status(msg, erro) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
  el.classList.toggle('erro', !!erro);
}

/* ---------------------------------------------------------- filtros */

function preencher(sel, opcoes, todos) {
  const atual = sel.value;
  sel.innerHTML = `<option value="">${todos}</option>` +
    opcoes.map(([v, t]) => `<option value="${v.replace(/"/g, '&quot;')}">${t.replace(/</g, '&lt;')}</option>`).join('');
  if (opcoes.some(([v]) => v === atual)) sel.value = atual;
}

function montarFiltros() {
  const unicos = campo => [...new Set(base.linhas.map(l => l[campo]))].sort().reverse();
  preencher($('#fArea'), base.areas.map(a => [a, a]), 'Todas');
  preencher($('#fSetor'), SETORES.map(s => [s, s]), 'Todos');
  preencher($('#fTurno'), TURNOS.map(t => [t, t]), 'Todos');
  preencher($('#fMes'), unicos('mes').map(m => [m, rotuloMes(m)]), 'Todos');
  preencher($('#fSemana'), unicos('semana').map(s => [s, rotuloSemana(s)]), 'Todas');
}

function filtrar() {
  const f = {
    area: $('#fArea').value, setor: $('#fSetor').value, turno: $('#fTurno').value,
    mes: $('#fMes').value, semana: $('#fSemana').value, de: $('#fDe').value, ate: $('#fAte').value
  };
  return base.linhas.filter(l =>
    (!f.area || l.area === f.area) &&
    (!f.setor || l.setor === f.setor) &&
    (!f.turno || l.turno === f.turno) &&
    (!f.mes || l.mes === f.mes) &&
    (!f.semana || l.semana === f.semana) &&
    (!f.de || l.dia >= f.de) &&
    (!f.ate || l.dia <= f.ate)
  );
}

/* ---------------------------------------------------------- gráficos */

// Escreve o valor na ponta de cada barra (em cor de texto, não na cor da série)
const rotulos = {
  id: 'rotulos',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const horiz = chart.options.indexAxis === 'y';
    const valores = chart.data.datasets[0].data;
    ctx.save();
    ctx.font = '500 12px Roboto, Arial, sans-serif';
    ctx.fillStyle = '#1f2430';
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      if (!valores[i]) return;
      if (horiz) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(valores[i], bar.x + 6, bar.y); }
      else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(valores[i], bar.x, bar.y - 4); }
    });
    ctx.restore();
  }
};

/** Quebra rótulos longos em várias linhas (Chart.js aceita array de linhas). */
function quebrar(texto, max) {
  const linhas = [];
  let atual = '';
  String(texto).split(' ').forEach(p => {
    if ((atual + ' ' + p).trim().length > max && atual) { linhas.push(atual); atual = p; }
    else atual = (atual + ' ' + p).trim();
  });
  if (atual) linhas.push(atual);
  return linhas;
}

function grafico(id, horizontal) {
  const eixoValor = {
    beginAtZero: true,
    ticks: { precision: 0, color: '#5f6675', font: { size: 11 } },
    grid: { color: '#eceef2' },
    border: { display: false }
  };
  const eixoCategoria = {
    ticks: { color: '#1f2430', font: { size: 11 }, autoSkip: false },
    grid: { display: false },
    border: { color: '#c9ced8' }
  };
  graficos[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels: [], datasets: [{
      data: [],
      backgroundColor: NAVY,
      hoverBackgroundColor: NAVY_HOVER,
      borderRadius: 4,
      borderSkipped: 'start',
      maxBarThickness: horizontal ? 26 : 56
    }] },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      maintainAspectRatio: false,
      animation: { duration: 300 },
      layout: { padding: horizontal ? { right: 32 } : { top: 22 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f2430', padding: 10, cornerRadius: 6, displayColors: false,
          callbacks: {
            title: items => [].concat(items[0].label).join(' '),
            label: item => `${item.formattedValue}`
          }
        }
      },
      scales: horizontal ? { x: eixoValor, y: eixoCategoria } : { x: eixoCategoria, y: eixoValor }
    },
    plugins: [rotulos]
  });
}

function desenhar(id, labels, valores) {
  // Mostra só as categorias com valor (áreas/turnos/tópicos zerados ficam de fora)
  const manter = valores.map(v => v > 0);
  labels = labels.filter((_, i) => manter[i]);
  valores = valores.filter((_, i) => manter[i]);

  const g = graficos[id];
  g.data.labels = labels;
  g.data.datasets[0].data = valores;
  g.update();
  const box = g.canvas.parentNode;
  let vazio = box.querySelector('.vazio');
  if (!valores.some(v => v > 0)) {
    if (!vazio) { vazio = document.createElement('div'); vazio.className = 'vazio'; vazio.textContent = 'Sem dados no filtro'; box.appendChild(vazio); }
  } else if (vazio) vazio.remove();
}

function contar(lista, chaves) {
  const c = {};
  chaves.forEach(k => { c[k] = 0; });
  lista.forEach(k => { c[k] = (c[k] || 0) + 1; });
  return c;
}

/* ---------------------------------------------------------- atualizar */

function atualizar() {
  const linhas = filtrar();
  const nTop = base.topicos.length || 6;
  const itens = linhas.length * nTop;
  const apontamentos = [];
  const porTopico = new Array(nTop).fill(0);
  linhas.forEach(l => l.resp.forEach((r, i) => {
    if (r && r !== CONFORME) { apontamentos.push(r); porTopico[i]++; }
  }));

  // KPIs
  const areasFiltro = $('#fArea').value ? [$('#fArea').value] : base.areas;
  const auditadas = new Set(linhas.map(l => l.area));
  $('#kAud').textContent = linhas.length;
  $('#kAudSub').textContent = linhas.length ? `${itens} itens verificados` : 'nenhuma no filtro';
  $('#kApo').textContent = apontamentos.length;
  $('#kApoSub').textContent = linhas.length ? `${(apontamentos.length / linhas.length).toFixed(1).replace('.', ',')} por auditoria` : ' ';
  $('#kConf').textContent = itens ? Math.round(100 * (itens - apontamentos.length) / itens) + '%' : '–';
  $('#kConfSub').textContent = itens ? `${itens - apontamentos.length} de ${itens} itens` : ' ';
  $('#kAreas').textContent = auditadas.size;
  $('#kAreasSub').textContent = `de ${areasFiltro.length} área${areasFiltro.length > 1 ? 's' : ''}`;

  const porArea = contar(linhas.map(l => l.area), areasFiltro);
  desenhar('cArea', areasFiltro.map(a => quebrar(a, 14)), areasFiltro.map(a => porArea[a]));

  const porSetor = contar(linhas.map(l => l.setor), SETORES);
  desenhar('cSetor', SETORES, SETORES.map(s => porSetor[s]));

  const porTurno = contar(linhas.map(l => l.turno), TURNOS);
  desenhar('cTurno', TURNOS, TURNOS.map(t => porTurno[t]));

  desenhar('cTopico', base.topicos.map(t => quebrar(t, 24)), porTopico);

  // Detalhamento: cada tipo de não conformidade, do mais frequente para o menos
  const det = Object.entries(contar(apontamentos, [])).sort((a, b) => b[1] - a[1]);
  $('#boxDet').style.height = Math.max(260, det.length * 46) + 'px';
  graficos.cDet.resize();
  desenhar('cDet', det.map(([t]) => quebrar(t, 38)), det.map(([, n]) => n));

  // Tabela por área (só áreas com auditoria no filtro)
  const comDados = areasFiltro.filter(a => porArea[a] > 0);
  $('#tabela').innerHTML = !comDados.length
    ? '<tr class="zero"><td colspan="5">Nenhuma auditoria no filtro selecionado.</td></tr>'
    : comDados.map(a => {
    const la = linhas.filter(l => l.area === a);
    const apo = la.reduce((s, l) => s + l.resp.filter(r => r && r !== CONFORME).length, 0);
    const it = la.length * nTop;
    const ultima = la.reduce((m, l) => (!m || l.data > m ? l.data : m), null);
    return `<tr class="${la.length ? '' : 'zero'}">
      <td>${a.replace(/</g, '&lt;')}</td><td>${la.length}</td><td>${apo}</td>
      <td>${it ? Math.round(100 * (it - apo) / it) + '%' : '–'}</td>
      <td>${ultima ? dataBR(ultima) : '–'}</td></tr>`;
  }).join('');
}

/* ------------------------------------------------------------- init */

document.addEventListener('DOMContentLoaded', () => {
  if (window.Chart) {
    Chart.defaults.font.family = 'Roboto, Arial, sans-serif';
    ['cArea', 'cSetor', 'cTurno'].forEach(id => grafico(id, false));
    ['cTopico', 'cDet'].forEach(id => grafico(id, true));
  } else {
    status('Não foi possível carregar a biblioteca de gráficos (Chart.js). Verifique a internet.', true);
    return;
  }

  document.querySelectorAll('.filtros select, .filtros input').forEach(el => el.addEventListener('change', atualizar));
  $('#btnLimpar').addEventListener('click', () => {
    document.querySelectorAll('.filtros select, .filtros input').forEach(el => { el.value = ''; });
    atualizar();
  });
  $('#btnAtualizar').addEventListener('click', carregar);

  carregarCache();
  carregar();
});
