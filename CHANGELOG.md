# Release v0.5.2

### What's Changed

- 🚑 Alterada porta padrão de `6000` para `8080` (fix ERR_UNSAFE_PORT em browsers)

---

# Release v0.5.1

### What's Changed

- 🐛 Correção no comando PM2 gerado para usar `npx one-server-4-all` em vez de caminho local

---

# Release v0.5.0

### What's Changed

- 🚀 Adicionado alias `hs` para execução rápida (`hs deploy` ou `hs`)
- 📦 Atualização de versão para publicação

---

# Release v0.4.0

### What's Changed

- ✨ Introduzido comando `deploy` interativo com UI premium
- 🔄 Geração automática de configuração Nginx e Certbot SSL
- 🐳 Geração de comando PM2 otimizado para produção
- 🗑️ Substituição do antigo script Shell `cria.sh` por implementação robusta em TypeScript

---

# Release v0.3.2

### What's Changed

- 🔧 Alterada porta padrão de `9999` para `6000`
- 📝 Atualizado relatório de modificações

---

# Release v0.3.1

### What's Changed

- 🎨 Refatoração do log de inicialização para estilo Vite (Premium Look)
- ⚡ Medição precisa do tempo de inicialização (Ready in X ms)
- 🌐 Detecção e exibição automática de URLs de rede (Network IPs)
- 🎨 Adição de cores ANSI para um visual moderno e "vibrante"
- 🔧 Melhoria no tratamento de portas em uso com feedback visual
- 📝 Atualização do `.gitignore` para incluir a pasta `dist`

---

# Release v0.3.0

### What's Changed

- 🔒 Adicionado suporte completo a HTTPS com certificados auto-assinados
- 🛠️ Criado sistema de geração automática de certificados SSL
- 🔓🔒 Adicionados emojis visuais de cadeado no terminal (aberto HTTP / fechado HTTPS)
- 📊 Implementados logs detalhados de arquivos servidos
- 🔍 Adicionado parsing e logging de recursos HTML (CSS, JS, imagens)
- 📄 Logs mostram tamanho dos arquivos e tipos MIME
- 🌐 Logs especiais para arquivos HTML injetados com hot-reload
- 📝 Scripts npm para gerenciamento de certificados (`certs:generate`, `certs:clean`, `certs:info`)
- 🔧 Arquivo `cert-generator.ts` para geração programática de certificados

### New Contributors

- [Jean Carlo Machado](https://github.com/jeanCarloMachado) - Implementação do suporte HTTPS e sistema de logs avançado

---

# Release v0.2.0

### What's Changed

- ✨ Adicionada injeção de CSS (CSS Hot Loading) - mudanças em arquivos CSS agora atualizam sem recarregar a página
- ✨ Implementado suporte a SPA (Single Page Applications) com flag `--spa` - rotas inexistentes redirecionam para index.html
- ✨ Expandida lista de MIME types - suporte completo para vídeos, fontes, áudios, manifestos e outros tipos de arquivo
- ✨ Adicionados headers CORS - permite acesso cross-origin aos arquivos estáticos
- 🔧 Mantida arquitetura zero dependencies - todas as implementações usam apenas APIs nativas do Node.js
- 📝 Criado relatório detalhado em `/reports/21-12-2025_04-20.md`

### New Contributors

- [Jean Carlo](https://github.com/jeanCarloMachado) - Implementação das funcionalidades avançadas

---

# Release v0.1.0

### What's Changed

- ✨ Servidor HTTP básico com hot reload
- ✨ Watcher de arquivos usando fs.watch nativo
- ✨ Server-Sent Events para notificações em tempo real
- ✨ Injeção automática de script em arquivos HTML
- 🔧 Zero dependencies - apenas APIs nativas do Node.js
- 📝 TypeScript estrito com configuração moderna
