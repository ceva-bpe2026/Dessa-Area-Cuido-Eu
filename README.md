# Dessa Área Cuido Eu - 5S

Formulário HTML (GitHub Pages) + back-end Google Apps Script que grava na planilha e salva as fotos no Google Drive.

```
GitHub Pages (index.html)  ──fetch──►  Apps Script Web App  ──►  Planilha (aba Respostas)
                                                            └──►  Drive / Imagens / Área / Auditor / Tópico / foto.jpg
```

**Não é preciso criar API key, OAuth Client ou Service Account.** O Web App roda com a sua conta Google,
então ele já tem acesso à planilha e à pasta. A única "autorização" é aceitar as permissões na primeira execução.

---

## 1. Apps Script (back-end)

> Use a mesma conta Google que é dona (ou editora) da planilha e da pasta `Imagens`.

1. Abra a planilha → **Extensões → Apps Script**.
2. Apague o conteúdo de `Código.gs` e cole o conteúdo de [`apps-script/Code.gs`](apps-script/Code.gs).
3. Em **Configurações do projeto** (engrenagem) → marque **"Mostrar arquivo de manifesto appsscript.json"**.
   Volte ao editor, abra `appsscript.json` e cole o conteúdo de [`apps-script/appsscript.json`](apps-script/appsscript.json).
4. Selecione a função **`testarConfiguracao`** e clique em **Executar**.
   - Vai aparecer "Autorização necessária" → **Revisar permissões** → escolha sua conta.
   - Se aparecer "O Google não verificou este app": **Avançado → Acessar (não seguro)**. É normal, o app é seu.
   - Aceite **Planilhas** e **Drive**.
   - No log devem aparecer os setores, o nome da pasta e a aba `Respostas` (criada automaticamente).
5. **Implantar → Nova implantação** → tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).

### Atualizando o script depois
**Implantar → Gerenciar implantações → lápis (editar) → Versão: Nova versão → Implantar.**
Assim a URL continua a mesma. ("Nova implantação" gera uma URL nova.)

## 2. Front-end

1. Em [`app.js`](app.js), troque `COLE_AQUI_A_URL_DO_WEB_APP` pela URL copiada.
2. Salve as imagens do Google Forms na pasta `img/` (abra o form, clique com o botão direito na imagem → *Salvar imagem como*):

   | Arquivo          | Imagem                         |
   |------------------|--------------------------------|
   | `img/banner.png` | cabeçalho azul CEVA            |
   | `img/q1.png`     | mesa (materiais necessários)   |
   | `img/q2.png`     | prateleira (identificação)     |
   | `img/q3.png`     | bancada (limpeza)              |
   | `img/q4.png`     | prateleira (layout)            |
   | `img/q5.png`     | lixeiras (coletores)           |
   | `img/q6.png`     | circulação                     |

   Se alguma imagem faltar, a página funciona normalmente sem ela.

## 3. GitHub Pages

1. Crie um repositório e envie `index.html`, `dashboard.html`, `config.js`, `app.js`, `dashboard.js`,
   `styles.css` e a pasta `img/` (a pasta `apps-script/` pode ir junto só como documentação).
   Ao alterar um `.js`/`.css`, aumente o `?v=` correspondente nos `.html` para os celulares baixarem a versão nova.
2. **Settings → Pages → Source: Deploy from a branch → main / (root) → Save.**
3. Em ~1 minuto o link fica disponível: `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

---

## Como os dados ficam organizados

**Drive** (`Imagens`, id `1tJNHV4KwDVoeVEYFLtlwMSCWs4Obgdqk`):

```
Imagens/
└── CDC/
    └── Helio Carmo/
        ├── 01 - Materiais Necessarios/
        │   └── 2026-10-05_14-32-07_CDC_Operacao_Manha_Helio-Carmo_Q1-Materiais.jpg
        ├── 02 - Identificacao/
        ├── 03 - Limpeza/
        ├── 04 - Layout/
        ├── 05 - Coletores de Residuos/
        └── 06 - Areas de Circulacao/
```

- O nome do auditor é padronizado ("hélio  CARMO" → "Hélio Carmo") e a pasta é reaproveitada mesmo com diferença de acento/maiúscula.
- Cada foto recebe uma descrição no Drive com ID, área, turno, auditor e resposta.

**Planilha** – aba `Respostas`: ID (protocolo), data/hora, auditor, área, setor, turno, e para cada tópico a resposta + link da foto, e o link da pasta do auditor.

**Áreas** – são lidas da aba `Setup`, coluna A a partir da linha 2. Para incluir/remover uma área, basta editar a planilha.

## Dashboard

`dashboard.html` lê a aba `Respostas` (via `?action=dados`, sem nome do auditor nem links das fotos) e mostra
realização por área, setor, turno, apontamentos por tópico e detalhamento, com filtros de área, setor, turno,
mês, semana e período.

## Fotos

Cada foto é enviada para `Imagens/_temp` assim que é tirada/anexada. No "Enviar", o script só move e renomeia
para a pasta definitiva. Fotos que ficarem em `_temp` (formulário abandonado ou foto trocada) vão para a
lixeira depois de 3 dias.

As fotos são otimizadas **no celular, antes do envio**: lado maior limitado a 1920 px, JPEG com qualidade 85%
(reduzida automaticamente até caber em ~700 KB). Uma foto de 4–8 MB vira tipicamente 300–600 KB, com qualidade
de sobra para evidência de auditoria. Ajuste em `FOTO` no início do `app.js` se quiser mais/menos resolução.

## Observações

- A URL do Web App é pública (qualquer um com o link consegue enviar). O script valida área, setor, turno,
  respostas e tamanho das fotos, mas não identifica quem enviou — diferente do Google Forms, que registrava o e-mail.
- Limite do Apps Script (conta gratuita): ~90 min de execução/dia e 20.000 chamadas/dia — muito acima do uso esperado.
