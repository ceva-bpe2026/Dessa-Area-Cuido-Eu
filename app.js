/* API_URL e buscarJson() ficam em config.js */

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
const fotos = {};             // { q1: { base64?, fileId?, nome, info, thumb } }
const uploads = new WeakMap(); // foto -> Promise do envio em andamento
const LS_AUDITOR = 'dace_auditor';
const LS_SETORES = 'dace_setores';

// "Tirar foto" só em celular/tablet (iPad se identifica como Macintosh com touch)
const EH_MOVEL = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const CAMERA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>';
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
      `<p class="upload-hint">Faça upload de 1 arquivo aceito: imagem. A foto é otimizada e enviada automaticamente.</p>
       <input class="file-input" type="file" accept="image/*" capture="environment" id="cam_${t.id}" data-q="${t.id}">
       <input class="file-input" type="file" accept="image/*" id="file_${t.id}" data-q="${t.id}">
       <div class="upload-btns">
         ${EH_MOVEL ? `<button type="button" class="btn-upload" data-camera="${t.id}">${CAMERA_ICON}<span>Tirar foto</span></button>` : ''}
         <label class="btn-upload" for="file_${t.id}">${UPLOAD_ICON}<span>Anexar arquivo</span></label>
       </div>
       <div class="preview" id="prev_${t.id}">
         <img alt="">
         <div class="preview-info"><b></b><span class="info"></span><span class="st"></span></div>
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

/** Redimensiona/comprime uma imagem ou um quadro de vídeo (sw × sh) para JPEG. */
async function comprimir(fonte, sw, sh) {
  const escala = Math.min(1, FOTO.maxLado / Math.max(sw, sh));
  const w = Math.round(sw * escala);
  const h = Math.round(sh * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';            // fundo branco para PNG com transparência
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fonte, 0, 0, w, h);

  let q = FOTO.qualidade;
  let blob = await canvasParaBlob(canvas, q);
  while (blob.size > FOTO.alvoBytes && q > FOTO.qualidadeMin) {
    q = Math.max(FOTO.qualidadeMin, q - 0.1);
    blob = await canvasParaBlob(canvas, q);
  }

  // Miniatura pequena para a pré-visualização (manter a foto inteira decodificada na tela gasta muita memória)
  const t = 160 / Math.max(w, h);
  const mini = document.createElement('canvas');
  mini.width = Math.round(w * t);
  mini.height = Math.round(h * t);
  mini.getContext('2d').drawImage(canvas, 0, 0, mini.width, mini.height);
  const thumb = mini.toDataURL('image/jpeg', 0.7);

  canvas.width = canvas.height = mini.width = mini.height = 0; // libera memória
  return { blob, w, h, thumb };
}

/** Comprime, mostra a miniatura e já começa a enviar a foto para o Drive. */
async function processarFoto(q, nome, bytesOriginais, gerar) {
  mostrarPreview(q, { nome, info: 'Otimizando...', thumb: '' });
  setStatus(q, '');
  try {
    const { blob, w, h, thumb } = await gerar();
    const f = {
      base64: await blobParaBase64(blob),
      nome,
      info: `${w}×${h} px · ${bytesOriginais ? kb(bytesOriginais) + ' → ' : ''}${kb(blob.size)}`,
      thumb
    };
    fotos[q] = f;
    mostrarPreview(q, f);
    marcarErro('foto_' + q, false);
    salvarRascunho();
    uploadFoto(f, q).catch(() => {}); // erro já aparece na miniatura; é reenviada no "Enviar"
  } catch (err) {
    delete fotos[q];
    $('#prev_' + q).classList.remove('show');
    alert(err.message || 'Não foi possível ler a imagem.');
  }
}

function onArquivo(input) {
  const q = input.dataset.q;
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  processarFoto(q, file.name, file.size, async () => {
    const img = await carregarImagem(file);
    const r = await comprimir(img, img.naturalWidth, img.naturalHeight);
    img.src = '';
    return r;
  });
}

function kb(bytes) {
  return bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

function mostrarPreview(q, f) {
  const prev = $('#prev_' + q);
  prev.classList.add('show');
  $('b', prev).textContent = f.nome;
  $('.info', prev).textContent = f.info;
  if (f.thumb) $('img', prev).src = f.thumb;
  else $('img', prev).removeAttribute('src');
  setStatus(q, f.fileId ? 'ok' : '');
}

function setStatus(q, st) {
  const el = $('#prev_' + q + ' .st');
  el.dataset.st = st;
  el.textContent = { enviando: 'Enviando...', ok: '✓ Foto enviada', erro: '⚠ Falha no envio — será reenviada ao clicar em Enviar' }[st] || '';
}

function removerFoto(q) {
  delete fotos[q];
  $('#prev_' + q).classList.remove('show');
  salvarRascunho();
}

/* ------------------------------------------------- envio das fotos */

/** Envia a foto para Imagens/_temp. A resposta final só move/renomeia, por isso o "Enviar" fica rápido. */
function uploadFoto(f, q) {
  if (f.fileId) return Promise.resolve();
  if (uploads.has(f)) return uploads.get(f);

  if (fotos[q] === f) setStatus(q, 'enviando');
  const p = buscarJson(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita o preflight de CORS
    body: JSON.stringify({ action: 'foto', base64: f.base64 })
  }, 120000)
    .then(res => {
      if (!res.ok) throw new Error(res.erro || 'Erro ao enviar a foto.');
      f.fileId = res.fileId;
      delete f.base64; // não precisa mais guardar a foto no aparelho
      if (fotos[q] === f) { setStatus(q, 'ok'); salvarRascunho(); }
    })
    .catch(err => {
      console.error(err);
      if (fotos[q] === f) setStatus(q, 'erro');
      throw err;
    })
    .finally(() => uploads.delete(f));
  uploads.set(f, p);
  return p;
}

/* ----------------------------------------------- câmera na página */
// Abrir o app de câmera do celular faz o Android fechar a aba do navegador quando falta memória.
// Com getUserMedia a câmera roda dentro da própria página, sem trocar de app.

let camStream = null;
let camQ = null;

async function abrirCamera(q) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('#cam_' + q).click(); // navegador antigo: usa o app de câmera
    return;
  }
  camQ = q;
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false
    });
  } catch (err) {
    console.warn(err);
    alert('Não foi possível abrir a câmera aqui (permissão negada?). Vamos usar o app de câmera do celular.');
    $('#cam_' + q).click();
    return;
  }
  const v = $('#camVideo');
  v.srcObject = camStream;
  $('#camera').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  try { await v.play(); } catch (_) {}
}

function fecharCamera() {
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  camStream = null;
  $('#camVideo').srcObject = null;
  $('#camera').classList.add('hidden');
  document.body.style.overflow = '';
}

function capturar() {
  const v = $('#camVideo');
  if (!v.videoWidth) return; // câmera ainda iniciando
  const q = camQ;
  const vw = v.videoWidth;
  const vh = v.videoHeight;

  // Copia o quadro antes de fechar a câmera
  const quadro = document.createElement('canvas');
  quadro.width = vw;
  quadro.height = vh;
  quadro.getContext('2d').drawImage(v, 0, 0, vw, vh);
  fecharCamera();

  const nome = 'Foto ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  processarFoto(q, nome, 0, async () => {
    const r = await comprimir(quadro, vw, vh);
    quadro.width = quadro.height = 0;
    return r;
  });
}

/* --------------------------------------------------------- rascunho */
// Respostas e fotos ficam salvas no aparelho (IndexedDB) até o envio.
// Se o navegador fechar a aba, o preenchimento é restaurado.

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((res, rej) => {
      const r = indexedDB.open('dace', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbPromise;
}

async function dbOp(modo, fn) {
  const banco = await db();
  return new Promise((res, rej) => {
    const tx = banco.transaction('kv', modo);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
  });
}

const CAMPOS_RADIO = ['area', 'setor', 'turno'].concat(TOPICOS.map(t => t.id));

async function salvarRascunho() {
  const campos = { auditor: $('[name=auditor]').value };
  CAMPOS_RADIO.forEach(n => { campos[n] = valorRadio(n); });
  const copia = {};
  Object.keys(fotos).forEach(q => { copia[q] = Object.assign({}, fotos[q]); });
  try { await dbOp('readwrite', s => s.put({ campos, fotos: copia, salvoEm: Date.now() }, 'rascunho')); }
  catch (err) { console.warn('Rascunho não salvo', err); }
}

async function apagarRascunho() {
  try { await dbOp('readwrite', s => s.delete('rascunho')); } catch (_) {}
}

async function restaurarRascunho() {
  let r;
  try { r = await dbOp('readonly', s => s.get('rascunho')); } catch (_) { return; }
  if (!r) return;

  if (r.campos.auditor) $('[name=auditor]').value = r.campos.auditor;
  CAMPOS_RADIO.forEach(n => {
    const el = [...document.querySelectorAll(`[name="${n}"]`)].find(i => i.value === r.campos[n]);
    if (el) el.checked = true;
  });
  Object.keys(r.fotos || {}).forEach(q => {
    fotos[q] = r.fotos[q];
    mostrarPreview(q, fotos[q]);
    if (!fotos[q].fileId) uploadFoto(fotos[q], q).catch(() => {});
  });

  const n = Object.keys(fotos).length;
  if (n || CAMPOS_RADIO.some(c => r.campos[c])) {
    const aviso = $('#aviso');
    aviso.textContent = `Preenchimento anterior recuperado${n ? ` (${n} foto${n > 1 ? 's' : ''})` : ''}.`;
    aviso.classList.remove('hidden');
    setTimeout(() => aviso.classList.add('hidden'), 6000);
  }
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
    respostas: {}
  };
  TOPICOS.forEach(t => { d.respostas[t.id] = valorRadio(t.id); });

  const erros = [];
  const checar = (field, ok) => { marcarErro(field, !ok); if (!ok) erros.push(field); };
  checar('auditor', auditor.split(' ').length >= 2);
  checar('area', !!d.area);
  checar('setor', !!d.setor);
  checar('turno', !!d.turno);
  TOPICOS.forEach(t => {
    checar(t.id, !!d.respostas[t.id]);
    checar('foto_' + t.id, !!fotos[t.id]);
  });

  if (erros.length) {
    document.querySelector(`[data-field="${erros[0]}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
    return null;
  }
  return d;
}

/* ------------------------------------------------------- progresso */
// A barra avança suavemente em direção ao "teto" da etapa atual e salta quando cada etapa termina.

const progresso = {
  val: 0, teto: 0, timer: null,
  iniciar(msg) {
    this.val = 0; this.teto = 0;
    $('#overlay').classList.remove('hidden');
    this.etapa(0, 5, msg);
    clearInterval(this.timer);
    this.timer = setInterval(() => { this.val += (this.teto - this.val) * 0.05; this.render(); }, 150);
  },
  etapa(min, teto, msg) {
    this.val = Math.max(this.val, min);
    this.teto = teto;
    if (msg) $('#overlayMsg').textContent = msg;
    this.render();
  },
  render() {
    $('#progFill').style.width = this.val.toFixed(1) + '%';
    $('#progPct').textContent = Math.floor(this.val) + '%';
  },
  fim(ok) {
    clearInterval(this.timer);
    if (ok) { this.val = 100; this.render(); }
    return new Promise(res => setTimeout(() => { $('#overlay').classList.add('hidden'); res(); }, ok ? 400 : 0));
  }
};

/* ------------------------------------------------------------- envio */

async function enviar(e) {
  e.preventDefault();
  const d = coletar();
  if (!d) return;

  $('#btnEnviar').disabled = true;
  const pendentes = TOPICOS.map(t => t.id).filter(q => !fotos[q].fileId);
  const fimFotos = pendentes.length ? 70 : 0; // fotos ocupam 0-70% da barra; o registro, o resto

  try {
    if (pendentes.length) {
      let prontas = 0;
      const msg = () => `Enviando fotos (${prontas} de ${pendentes.length})...`;
      progresso.iniciar(msg());
      progresso.etapa(0, fimFotos / pendentes.length, msg());
      await Promise.all(pendentes.map(q => {
        const f = fotos[q];
        return uploadFoto(f, q)
          .catch(() => uploadFoto(f, q)) // uma nova tentativa antes de desistir
          .then(() => {
            prontas++;
            const base = fimFotos * prontas / pendentes.length;
            progresso.etapa(base, Math.min(fimFotos, base + fimFotos / pendentes.length), msg());
          });
      }));
    } else {
      progresso.iniciar('Salvando resposta...');
    }

    progresso.etapa(fimFotos, 97, 'Salvando resposta e organizando as fotos...');
    d.fotos = {};
    TOPICOS.forEach(t => { d.fotos[t.id] = { fileId: fotos[t.id].fileId }; });

    const res = await buscarJson(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(d)
    }, 180000);
    if (!res.ok) throw new Error(res.erro || 'Erro desconhecido.');

    await progresso.fim(true);
    try { localStorage.setItem(LS_AUDITOR, d.auditor); } catch (_) {}
    await apagarRascunho();
    $('#form').classList.add('hidden');
    $('#sucessoId').textContent = 'Protocolo: ' + res.id;
    $('#sucesso').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    await progresso.fim(false);
    alert('Não foi possível enviar: ' + (err.message || err) + '\n\nSuas respostas e fotos continuam salvas. Verifique a internet e tente novamente.');
  } finally {
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
  salvarRascunho();
}

/* ------------------------------------------------------------- init */

document.addEventListener('DOMContentLoaded', () => {
  render();
  carregarSetores();      // a lista de áreas é desenhada na hora, antes do primeiro await
  restaurarRascunho();

  const form = $('#form');
  form.addEventListener('submit', enviar);
  form.addEventListener('change', e => {
    if (e.target.matches('.file-input')) return onArquivo(e.target);
    if (e.target.name) marcarErro(e.target.name, false);
    salvarRascunho();
  });
  let timerAuditor;
  form.addEventListener('input', e => {
    if (e.target.name !== 'auditor') return;
    marcarErro('auditor', false);
    clearTimeout(timerAuditor);
    timerAuditor = setTimeout(salvarRascunho, 500);
  });
  form.addEventListener('click', e => {
    const rem = e.target.closest('.btn-remove');
    if (rem) removerFoto(rem.dataset.q);
    const cam = e.target.closest('[data-camera]');
    if (cam) abrirCamera(cam.dataset.camera);
  });

  // Atalho escondido: dois cliques/toques no banner abrem o dashboard
  let ultimoToque = 0;
  $('#banner').addEventListener('click', () => {
    const agora = Date.now();
    if (agora - ultimoToque < 400) location.href = 'dashboard.html';
    ultimoToque = agora;
  });

  $('#camCapturar').addEventListener('click', capturar);
  $('#camCancelar').addEventListener('click', fecharCamera);

  $('#btnLimpar').addEventListener('click', () => limpar(true));
  $('#btnNova').addEventListener('click', () => {
    limpar(false);
    $('#sucesso').classList.add('hidden');
    form.classList.remove('hidden');
    window.scrollTo({ top: 0 });
  });
});
