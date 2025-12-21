# Purecore Hot Server

Um servidor de desenvolvimento hot-reload moderno e leve, construído com TypeScript e **zero dependências externas**.

## ✨ Funcionalidades

- 🚀 **Hot Reload Inteligente**: CSS injection sem recarregar página + full reload para outros arquivos
- 🎯 **SPA Support**: Flag `--spa` para aplicações React/Vue/Angular
- 📁 **MIME Types Robustos**: Suporte completo para vídeos, fontes, manifestos e mais
- 🌐 **CORS Habilitado**: Acesso cross-origin para desenvolvimento
- 🔒 **HTTPS Support**: Modo HTTPS com certificados auto-assinados
- 📡 **Server-Sent Events**: Notificações em tempo real eficientes
- 🔍 **Logs Detalhados**: Visualização de arquivos servidos e recursos HTML
- 🔓🔒 **Indicadores Visuais**: Emojis de cadeado no terminal (aberto/fechado)

## 🚀 Instalação

```bash
npm install -g hot-server
# ou
bun install -g hot-server
```

## 🔒 Modo HTTPS

O Hot Server suporta HTTPS com certificados auto-assinados para desenvolvimento local.

### Ativar HTTPS
```bash
# Via linha de comando
hot-server --https=true

# Via npm scripts
npm run dev:https

# Via bun
bun run dev:https
```

### Gerenciamento de Certificados
```bash
# Gerar certificados auto-assinados
npm run certs:generate

# Ver informações dos certificados
npm run certs:info

# Limpar certificados existentes
npm run certs:clean
```

**Nota**: Os certificados são salvos em `.hot-server-certs/` no diretório do projeto.

## 📖 Uso Básico

```bash
# Na pasta do seu projeto
hot-server

# Com opções
hot-server --port=3000 --spa=true
```

## 🎯 Funcionalidades Avançadas

### CSS Hot Loading
Quando você modifica arquivos `.css`, apenas o estilo é atualizado sem recarregar a página inteira.

### SPA Support
```bash
hot-server --spa=true
```
Rotas inexistentes (como `/usuarios/1`) automaticamente servem `index.html`, permitindo que seu framework frontend assuma o roteamento.

### MIME Types Suportados
- **Vídeos**: MP4, WebM, OGG, AVI, MOV, WMV, FLV
- **Áudios**: MP3, WAV, OGG, AAC, M4A, Opus
- **Fontes**: WOFF, WOFF2, TTF, OTF, EOT
- **Imagens**: PNG, JPG, GIF, SVG, WebP, BMP, TIFF
- **Documentos**: PDF, CSV, YAML, TOML, TXT, MD
- **Web**: JSON, XML, Manifest, WASM

## 🔧 Opções de CLI

| Opção | Descrição | Padrão |
|-------|-----------|---------|
| `--port=<number>` | Porta do servidor | `9999` |
| `--root=<path>` | Diretório raiz | `.` (diretório atual) |
| `--open=<true/false>` | Abrir navegador automaticamente | `true` |
| `--spa=<true/false>` | Habilitar suporte SPA | `false` |
| `--https=<true/false>` | Habilitar modo HTTPS | `false` |

## 🏗️ Como foi feito

Este projeto foi desenvolvido seguindo uma arquitetura minimalista e moderna:

### Técnicas Utilizadas
1. **TypeScript Estrito**: Tipagem forte em todo o código
2. **APIs Nativas**: Uso exclusivo de módulos `node:*`
3. **Server-Sent Events**: Comunicação bidirecional eficiente
4. **File System Watch**: Monitoramento recursivo de mudanças
5. **Mini-Zod**: Validação type-safe sem dependências
6. **CSS Injection**: DOM manipulation para hot reload inteligente

### Arquitetura
```
src/
├── index.ts      # CLI e configuração
├── server.ts     # Servidor HTTP e lógica principal
├── watcher.ts    # Monitoramento de arquivos
└── validator.ts  # Validação type-safe
```

### Funcionamento
1. **Watcher** monitora mudanças recursivamente usando `fs.watch`
2. **Server** serve arquivos estáticos com MIME types corretos
3. **SSE** notifica clientes sobre mudanças em tempo real
4. **CSS Injection** atualiza estilos sem recarregar página
5. **SPA Fallback** redireciona 404 para index.html quando habilitado

## 🧪 Como testar

### Teste CSS Injection
1. Inicie o servidor: `hot-server`
2. Modifique qualquer arquivo `.css`
3. Observe que apenas o CSS é atualizado, sem reload da página

### Teste SPA Support
1. Inicie com SPA: `hot-server --spa=true`
2. Acesse `/qualquer-rota-inexistente`
3. Deve carregar `index.html` em vez de 404

### Teste MIME Types
1. Adicione arquivos de vídeo/fonte no seu projeto
2. Eles serão servidos com headers corretos

### Teste CORS
1. Acesse arquivos de outro domínio/origin
2. Deve funcionar sem erros de CORS

### Teste HTTPS
1. Execute: `hot-server --https=true`
2. Observe o emoji 🔒 no log do terminal
3. Acesse https://localhost:9999
4. Aceite o aviso de certificado auto-assinado

### Teste Logs Detalhados
1. Abra uma página HTML
2. Observe no terminal:
   - 📄 Arquivos servidos com tamanho e tipo MIME
   - 🔍 Recursos encontrados no HTML (CSS, JS, imagens)
   - 🌐 Confirmação de injeção do hot-reload

## 📊 Comparação com Live Server

| Feature | Live Server | Purecore Hot Server |
|---------|-------------|-------------------|
| **Dependencies** | Múltiplas | ❌ Zero |
| **Language** | JavaScript | ✅ TypeScript |
| **CSS Injection** | ✅ Sim | ✅ Sim |
| **SPA Support** | ✅ Sim | ✅ Sim |
| **MIME Types** | Básicos | ✅ Robustos |
| **CORS** | ❌ Não | ✅ Sim |
| **Installation** | Lento | ✅ Instantâneo |

## 📝 Changelog

Veja todas as mudanças em [CHANGELOG.md](CHANGELOG.md)

## 🤝 Contribuição

Contribuições são bem-vindas! Este projeto segue uma filosofia de **zero dependencies** e simplicidade arquitetural.

## 📄 Licença

MIT