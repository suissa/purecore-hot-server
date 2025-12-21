# Release v0.2.0

### What's Changed
* ✨ Adicionada injeção de CSS (CSS Hot Loading) - mudanças em arquivos CSS agora atualizam sem recarregar a página
* ✨ Implementado suporte a SPA (Single Page Applications) com flag `--spa` - rotas inexistentes redirecionam para index.html
* ✨ Expandida lista de MIME types - suporte completo para vídeos, fontes, áudios, manifestos e outros tipos de arquivo
* ✨ Adicionados headers CORS - permite acesso cross-origin aos arquivos estáticos
* 🔧 Mantida arquitetura zero dependencies - todas as implementações usam apenas APIs nativas do Node.js
* 📝 Criado relatório detalhado em `/reports/21-12-2025_04-20.md`

### New Contributors
* [Jean Carlo](https://github.com/jeanCarloMachado) - Implementação das funcionalidades avançadas

---

# Release v0.1.0

### What's Changed
* ✨ Servidor HTTP básico com hot reload
* ✨ Watcher de arquivos usando fs.watch nativo
* ✨ Server-Sent Events para notificações em tempo real
* ✨ Injeção automática de script em arquivos HTML
* 🔧 Zero dependencies - apenas APIs nativas do Node.js
* 📝 TypeScript estrito com configuração moderna