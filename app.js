/* =====================================================================
 *  CONFIGURAÇÃO — cole aqui a URL do Web App do Apps Script (termina em /exec)
 * ===================================================================== */
const API_URL = 'https://script.google.com/macros/s/AKfycbweFlf0_-9j93_twGOf966Rv9KTGFAHdHwqGjAVjs4Alc8BULktvvS5-kwClPCjW6wd/exec';

// Compressão das fotos: lado maior até 1920 px, JPEG. Começa em qualidade 0.85
// e reduz até caber em ~700 KB (uma foto de celular de 4-8 MB vira ~300-600 KB).
const FOTO = { maxLado: 1920, qualidade: 0.85, qualidadeMin: 0.55, alvoBytes: 700 * 1024 };

const OPCOES_MATERIAIS = [
  'Em conformidade',
  'Documentações e/ou materiais de escritório fora de utilização expostos',
  'Itens de uso pessoal fora de utilização expostos'
];

// Os ids q1..q6 precisam ser os mesmos do Code.gs
const TOPICOS = [
  {
    id: 'q1',
    titulo: 'Existem apenas os materiais, ferramentas e equipamentos necessários na área de trabalho?',
    ajuda: '(verificar se há documentações fora de uso, copos, bolsas, guarda-chuvas, luvas, casacos ou outros pertences pessoais espalhados pela área)',
    img: 'img/q1.png',
    opcoes: OPCOES_MATERIAIS
  },
  {
    id: 'q2',
    titulo: 'Os itens e áreas estão devidamente identificados?',
    ajuda: '(gavetas, arquivos, materiais e objetos de uso comum)',
    img: 'img/q2.png',
    opcoes: OPCOES_MATERIAIS
  },
  {
    id: 'q3',
    titulo: 'A área está limpa (cantinho do café, mesas, piso, bancadas, equipamentos e estruturas livres de sujeira e resíduos)?',
    img: 'img/q3.png',
    opcoes: [
      'Em conformidade',
      'Cantinho do café com resíduos ou materiais que deveriam ser descartados',
      'Baias/carrinhos com resíduos ou materiais que deveriam ser descartados'
    ]
  },
  {
    id: 'q4',
    titulo: 'Os materiais de trabalho estão dentro do layout definido? (mesas de apoio, carrinhos hidráulicos, documentações, etiquetas)',
    img: 'img/q4.png',
    opcoes: [
      'Em conformidade',
      'Materiais não utilizados fora do layout',
      'Armazenamento de caixas sobre o armário'
    ]
  },
  {
    id: 'q5',
    titulo: 'Os coletores de resíduos estão sendo respeitados quanto aos limites de volume e tipo de descarte?',
    img: 'img/q5.png',
    opcoes: [
      'Em conformidade',
      'Descarte incorreto de resíduos',
      'Desrespeito ao limite do contentor de resíduos'
    ]
  },
  {
    id: 'q6',
    titulo: 'Os acessos e áreas de circulação de pessoas e equipamentos estão livres de obstruções?',
    img: 'img/q6.png',
    opcoes: [
      'Em conformidade',
      'Materiais na área de circulação',
      'Acesso ao extintor de incêndio obstruído'
    ]
  }
];

/* ===================================================================== */

const $ = (sel, el = document) => el.querySelector(sel);
const fotos = {};          // { q1: { base64, bytes, original } }
const LS_AUDITOR = 'dace_auditor';
const LS_SETORES = 'dace_setores';

const UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zm7-18l-5.5 5.5 1.41 1.41L11 5.83V16h2V5.83l3.09 3.08 1.41-1.41L12 2z"/></svg>';

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function radios(name, opcoes) {
  return '<div class="options">' + opcoes.map(o =>
    `<label class="option"><input type="radio" name="${name}" value="${esc(o)}"><span>${esc(o)}</span></label>`
  ).join('') + '</div>';
}

function card(name, titulo, corpo, ajuda) {
  return `<section class="card" data-field="${name}">
    <p class="q-title">${esc(titulo)}<span class="req">*</span></p>
    ${ajuda ? `<p class="q-help">${esc(ajuda)}</p>` : ''}
    ${corpo}
    <div class="err-msg">Esta pergunta é obrigatória</div>
  </section>`;
}

function render() {
  let html = '';

  html += card('auditor', 'Qual o auditor responsável?',
    `<input class="text-input" type="text" name="auditor" autocomplete="name" placeholder="Sua resposta" maxlength="80">`,
    'Preencher com nome e sobrenome:');

  html += card('area', 'Qual a área auditada?',
    `<div id="areas"><p class="loading-line">Carregando áreas...</p></div>`);

  html += card('setor', 'Qual o setor auditado?', radios('setor', ['Operação', 'Administrativo']));

  html += card('turno', 'Qual o turno?', radios('turno', ['Administrativo', 'Manhã', 'Tarde', 'Noite']),
    '(ADMINISTRATIVO Se aplica apenas para setores de turno único, como: Reversa, RH, QHSE e BPE)');

  TOPICOS.forEach(t => {
    html += card(t.id, t.titulo,
      `<img class="q-img" src="${t.img}" alt="" loading="lazy" onerror="this.remove()">` + radios(t.id, t.opcoes),
      t.ajuda);

    html += card('foto_' + t.id, 'Anexe fotos da área em conformidade ou da não conformidade, caso tenha sido observada alguma.',
      `<p class="upload-hint">Faça upload de 1 arquivo aceito: imagem. A foto é otimizada automaticamente antes do envio.</p>
       <input class="file-input" type="file" accept="image/*" id="file_${t.id}" data-q="${t.id}">
       <label class="btn-upload" for="file_${t.id}">${UPLOAD_ICON}<span>Adicionar arquivo</span></label>
       <div class="preview" id="prev_${t.id}">
         <img alt="">
         <div class="preview-info"><b></b><span></span></div>
         <button type="button" class="btn-remove" data-q="${t.id}" title="Remover">&times;</button>
       </div>`);
  });

  $('#perguntas').innerHTML = html;

  try { $('[name=auditor]').value = localStorage.getItem(LS_AUDITOR) || ''; } catch (_) {}
}

/* ---------------------------------------------------------- setores */

// Lista exibida na hora, antes da resposta do servidor (que leva 2-5 s).
// A aba Setup continua sendo a fonte oficial: a lista é atualizada em segundo plano.
const SETORES_PADRAO = [
  'Autometal', 'BPE / Facilities', 'CDC', 'Cross Docking', 'Monitoramento GM', 'Portão 08', 'Portão 15',
  'Programação', 'QHSE', 'RH', 'Reversa', 'Santos Brasil - SBC', 'Multimodal - Santos', 'GM Sorocaba'
];

function renderAreas(setores) {
  const marcado = valorRadio('area');
  $('#areas').innerHTML = radios('area', setores);
  const igual = [...document.querySelectorAll('[name=area]')].find(i => i.value === marcado);
  if (igual) igual.checked = true;
}

async function carregarSetores() {
  let atual = SETORES_PADRAO;
  try {
    const cache = JSON.parse(localStorage.getItem(LS_SETORES));
    if (Array.isArray(cache) && cache.length) atual = cache;
  } catch (_) {}
  renderAreas(atual);

  try {
    const data = await buscarJson(API_URL + '?action=setores', {}, 25000);
    if (!data.ok) throw new Error(data.erro);
    if (JSON.stringify(data.setores) !== JSON.stringify(atual)) renderAreas(data.setores);
    try { localStorage.setItem(LS_SETORES, JSON.stringify(data.setores)); } catch (_) {}
  } catch (err) {
    console.error(err); // a lista local continua na tela
  }
}

/** fetch com tempo limite e mensagens de erro legíveis */
async function buscarJson(url, opcoes, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const inicio = performance.now();
  try {
    const r = await fetch(url, Object.assign({}, opcoes, { signal: ctrl.signal }));
    const texto = await r.text();
    console.log(`[API] ${r.status} em ${Math.round(performance.now() - inicio)} ms`, texto.slice(0, 200));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    try { return JSON.parse(texto); } catch (_) { throw new Error('resposta não é JSON — verifique a URL e o acesso "Qualquer pessoa" da implantação'); }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`sem resposta em ${timeoutMs / 1000}s — rede/proxy bloqueando script.google.com?`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------- fotos */

function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Arquivo de imagem não suportado.')); };
    img.src = url; // navegadores atuais já aplicam a rotação EXIF do celular
  });
}

function canvasParaBlob(canvas, q) {
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
}

function blobParaBase64(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

async function comprimir(file) {
  const img = await carregarImagem(file);
  const escala = Math.min(1, FOTO.maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * escala);
  const h = Math.round(img.naturalHeight * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';            // fundo branco para PNG com transparência
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  let q = FOTO.qualidade;
  let blob = await canvasParaBlob(canvas, q);
  while (blob.size > FOTO.alvoBytes && q > FOTO.qualidadeMin) {
    q = Math.max(FOTO.qualidadeMin, q - 0.1);
    blob = await canvasParaBlob(canvas, q);
  }
  return { blob, w, h };
}

function kb(bytes) {
  return bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

async function onFoto(input) {
  const q = input.dataset.q;
  const file = input.files[0];
  input.value = '';
  if (!file) return;

  const prev = $('#prev_' + q);
  prev.classList.add('show');
  $('b', prev).textContent = file.name;
  $('span', prev).textContent = 'Otimizando...';
  $('img', prev).removeAttribute('src');

  try {
    const { blob, w, h } = await comprimir(file);
    fotos[q] = { base64: await blobParaBase64(blob) };
    $('img', prev).src = URL.createObjectURL(blob);
    $('span', prev).textContent = `${w}×${h} px · ${kb(file.size)} → ${kb(blob.size)}`;
    marcarErro('foto_' + q, false);
  } catch (err) {
    delete fotos[q];
    prev.classList.remove('show');
    alert(err.message || 'Não foi possível ler a imagem.');
  }
}

function removerFoto(q) {
  delete fotos[q];
  $('#prev_' + q).classList.remove('show');
}

/* -------------------------------------------------------- validação */

function marcarErro(field, on) {
  const el = document.querySelector(`[data-field="${field}"]`);
  if (el) el.classList.toggle('invalid', on);
}

function valorRadio(name) {
  const el = document.querySelector(`[name="${name}"]:checked`);
  return el ? el.value : '';
}

function coletar() {
  const auditor = $('[name=auditor]').value.trim().replace(/\s+/g, ' ');
  const d = {
    auditor,
    area: valorRadio('area'),
    setor: valorRadio('setor'),
    turno: valorRadio('turno'),
    respostas: {},
    fotos: {}
  };
  TOPICOS.forEach(t => {
    d.respostas[t.id] = valorRadio(t.id);
    if (fotos[t.id]) d.fotos[t.id] = { base64: fotos[t.id].base64 };
  });

  const erros = [];
  const checar = (field, ok) => { marcarErro(field, !ok); if (!ok) erros.push(field); };
  checar('auditor', auditor.split(' ').length >= 2);
  checar('area', !!d.area);
  checar('setor', !!d.setor);
  checar('turno', !!d.turno);
  TOPICOS.forEach(t => {
    checar(t.id, !!d.respostas[t.id]);
    checar('foto_' + t.id, !!d.fotos[t.id]);
  });

  if (erros.length) {
    document.querySelector(`[data-field="${erros[0]}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
    return null;
  }
  return d;
}

/* ------------------------------------------------------------- envio */

function overlay(on, msg) {
  $('#overlay').classList.toggle('hidden', !on);
  if (msg) $('#overlayMsg').textContent = msg;
}

async function enviar(e) {
  e.preventDefault();
  const d = coletar();
  if (!d) return;

  $('#btnEnviar').disabled = true;
  overlay(true, 'Enviando respostas e fotos...');
  try {
    // text/plain evita o "preflight" de CORS, que o Apps Script não suporta
    const res = await buscarJson(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(d)
    }, 180000);
    if (!res.ok) throw new Error(res.erro || 'Erro desconhecido.');

    try { localStorage.setItem(LS_AUDITOR, d.auditor); } catch (_) {}
    $('#form').classList.add('hidden');
    $('#sucessoId').textContent = 'Protocolo: ' + res.id;
    $('#sucesso').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    alert('Não foi possível enviar: ' + (err.message || err) + '\n\nVerifique a internet e tente novamente.');
  } finally {
    overlay(false);
    $('#btnEnviar').disabled = false;
  }
}

function limpar(perguntar) {
  if (perguntar && !confirm('Limpar todas as respostas do formulário?')) return;
  const auditor = $('[name=auditor]').value;
  $('#form').reset();
  $('[name=auditor]').value = auditor;
  Object.keys(fotos).forEach(removerFoto);
  document.querySelectorAll('.card.invalid').forEach(c => c.classList.remove('invalid'));
}

/* ------------------------------------------------------------- init */

document.addEventListener('DOMContentLoaded', () => {
  render();
  carregarSetores();

  const form = $('#form');
  form.addEventListener('submit', enviar);
  form.addEventListener('change', e => {
    if (e.target.matches('.file-input')) return onFoto(e.target);
    if (e.target.name) marcarErro(e.target.name, false);
  });
  form.addEventListener('input', e => { if (e.target.name === 'auditor') marcarErro('auditor', false); });
  form.addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove');
    if (btn) removerFoto(btn.dataset.q);
  });

  $('#btnLimpar').addEventListener('click', () => limpar(true));
  $('#btnNova').addEventListener('click', () => {
    limpar(false);
    $('#sucesso').classList.add('hidden');
    form.classList.remove('hidden');
    window.scrollTo({ top: 0 });
  });
});
