# Comparativo: Purecore Hot Server vs Live Server

Este documento analisa as diferenças técnicas e de funcionalidades entre a **Sua biblioteca (`purecore-hot-server`)** e a biblioteca padrão de mercado **[`live-server`](https://github.com/tapio/live-server)**.

## 📊 Visão Geral

| Feature | `live-server` (Tapio) | `purecore-hot-server` (Sua Lib) |
| :--- | :--- | :--- |
| **Dependências** | Múltiplas (`send`, `fsevents`, `opn`, `connect`...) | **Zero (0)** (Apenas nativas do Node.js) |
| **Linguagem** | JavaScript | **TypeScript** |
| **Hot Reload** | Full Page + **CSS Injection** (sem refresh) | Full Page Reload (Sempre) |
| **Watch System** | `chokidar` (geralmente) | `fs.watch` nativo (recursivo) |
| **SPA Support** | Sim (redireciona 404 para index.html) | Não (retorna 404) |
| **Directory Listing** | Sim (mostra arquivos se não houver index) | Não (retorna erro/404) |
| **HTTPS/Proxy** | Sim | Não |
| **Middleware** | Sim (baseado em Connect) | Não |

---

## ✅ O que a sua lib tem de Diferencial (Vantagens)

1. **Zero Dependencies (Zero Dependências)**:
    * **Segurança/Auditabilidade**: Ao não usar dependências de terceiros, você elimina riscos de *supply chain attacks* e bloatware.
    * **Instalação Instantânea**: `npm install` roda em milissegundos.
    * **Tamanho**: O projeto final é minúsculo comparado ao `live-server` e suas árvores de dependência.

2. **Base de Código Moderna (TypeScript + Node 20+)**:
    *   O código utiliza APIs modernas como `node:fs/promises`, `node:watch` (recursivo) e Typescript estrito.
    *   É muito mais fácil para um desenvolvedor TS ler, entender e modificar o seu código do que o código legado JS do `live-server`.

3. **Simplicidade Arquitetural**:
    *   Sua implementação de SSE (Server-Sent Events) é direta e transparente (`/_hot_server_sse`), sem dependência de bibliotecas complexas de socket.
    *   Validação "Zod-like" interna (`validator.ts`) demonstra como fazer type-safety sem bibliotecas pesadas.

---

## ❌ O que falta na sua lib (Gaps em relação ao `live-server`)

Para igualar a funcionalidade, você precisaria implementar:

### 1. Injeção de CSS (CSS Hot Loading)

* **O que é**: Quando um arquivo `.css` é salvo, o `live-server` atualiza apenas o estilo na página sem recarregar o navegador.
* **Seu estado atual**: A sua lib dispara `window.location.reload()` para *qualquer* mudança de arquivo.
* **Como implementar**: No script injetado, verificar se a mensagem do SSE é sobre um arquivo CSS e, nesse caso, buscar as tags `<link rel="stylesheet">` no DOM e forçar uma atualização do `href` (ex: `style.css?v=timestamp`) em vez de dar reload.

### 2. Suporte a SPA (Single Page Applications)

* **O que é**: Frameworks como React/Vue (via Router) precisam que qualquer rota desconhecida (ex: `/usuarios/1`) retorne o `index.html` para que o JS no front assuma o controle.
* **Seu estado atual**: Retorna 404 se o arquivo não existir.
* **Como implementar**: Adicionar uma flag (ex: `--spa`) que, ao dar 404 na busca estática, serve o `index.html` com status 200.

### 3. Mime-Types Robustos

* **O que falta**: Sua lista `MIME_TYPES` em `server.ts` é limitada. Arquivos como vídeos (`.mp4`), fontes (`.woff2`) ou manifestos podem não carregar corretamente.

### 4. CORS

* **O que falta**: Se o usuário tentar acessar seus arquivos de outro local (ex: um script em outro localhost tentando fazer fetch nos assets), falhará. Suas respostas de arquivos estáticos não enviam headers `Access-Control-Allow-Origin`.

### 5. Directory e Range Requests

* **O que falta**:
    * **Listagem de pasta**: O `live-server` gera uma interface HTML listando os arquivos se você abrir uma pasta. O seu tenta abrir `index.html` e falha se não existir.
    * **Range Requests**: Para fazer streaming de vídeo/áudio e permitir "pular" (seek) o vídeo, o servidor precisa suportar headers `Range` e `Content-Range`. O seu `createReadStream.pipe(res)` serve o arquivo inteiro, o que quebra alguns players de vídeo.

---

## 📝 Conclusão

Sua lib é excelente como uma **alternativa leve e moderna** para casos de uso simples (sites estáticos, prototipagem rápida, projetos vanilla). Ela ganha em performance de instalação e simplicidade de código.

Ela perde para o `live-server` em **complexidade e robustez** para cenários avançados (SPAs, mocks de API, streaming de mídia e assets CSS pesados que se beneficiam da injeção sem reload).
