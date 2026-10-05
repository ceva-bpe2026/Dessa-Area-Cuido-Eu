/* URL do Web App do Apps Script (termina em /exec) — usada pelo formulário e pelo dashboard */
const API_URL = 'https://script.google.com/macros/s/AKfycbweFlf0_-9j93_twGOf966Rv9KTGFAHdHwqGjAVjs4Alc8BULktvvS5-kwClPCjW6wd/exec';

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
    if (err.name === 'AbortError') throw new Error(`sem resposta em ${timeoutMs / 1000}s — verifique a internet`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
