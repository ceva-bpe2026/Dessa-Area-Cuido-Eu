/* URL do Web App do Apps Script (termina em /exec) — usada pelo formulário e pelo dashboard */
const API_URL = 'https://script.google.com/macros/s/AKfycbweFlf0_-9j93_twGOf966Rv9KTGFAHdHwqGjAVjs4Alc8BULktvvS5-kwClPCjW6wd/exec';

/**
 * fetch com tempo limite, mensagens de erro legíveis e novas tentativas.
 * O Apps Script às vezes demora ou devolve 404 (página do Google) quando recebe várias chamadas juntas;
 * nesses casos tenta de novo depois de uma pausa. Só use tentativas > 1 em chamadas que podem ser repetidas.
 */
async function buscarJson(url, opcoes, timeoutMs, tentativas = 2) {
  for (let n = 1; ; n++) {
    try {
      return await buscarJsonUmaVez(url, opcoes, timeoutMs);
    } catch (err) {
      if (n >= tentativas || err.definitivo) throw err;
      console.warn(`[API] tentativa ${n} falhou (${err.message}); tentando de novo...`);
      await new Promise(res => setTimeout(res, 1500 * n));
    }
  }
}

async function buscarJsonUmaVez(url, opcoes, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const inicio = performance.now();
  try {
    const r = await fetch(url, Object.assign({}, opcoes, { signal: ctrl.signal }));
    const texto = await r.text();
    console.log(`[API] ${r.status} em ${Math.round(performance.now() - inicio)} ms`, texto.slice(0, 200));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    try { return JSON.parse(texto); } catch (_) {
      const err = new Error('resposta não é JSON — verifique a URL e o acesso "Qualquer pessoa" da implantação');
      err.definitivo = true;
      throw err;
    }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`sem resposta em ${timeoutMs / 1000}s — verifique a internet`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Limita quantas tarefas assíncronas rodam ao mesmo tempo (o Apps Script fica lento com muitas simultâneas). */
function criarFila(max) {
  let ativos = 0;
  const espera = [];
  return function naFila(tarefa) {
    return new Promise((res, rej) => {
      const rodar = () => {
        ativos++;
        tarefa().then(res, rej).finally(() => {
          ativos--;
          if (espera.length) espera.shift()();
        });
      };
      ativos < max ? rodar() : espera.push(rodar);
    });
  };
}
