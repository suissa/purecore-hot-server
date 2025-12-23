import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { Watcher } from './watcher';
import { CertGenerator } from './cert-generator';
// Script injetado no HTML para ouvir mudanças
const INJECTED_SCRIPT = `
<!-- Code injected by auto-server -->
<script>
  (function() {
    console.log('[hot-server] Connected to hot reload');
    const evtSource = new EventSource('/_hot_server_sse');
    evtSource.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'css') {
          console.log('[hot-server] CSS changed, injecting...');
          injectCSS(data.file);
        } else {
          console.log('[hot-server] Reloading...');
          window.location.reload();
        }
      } catch (e) {
        // Fallback para compatibilidade
        if (event.data === 'reload') {
          console.log('[hot-server] Reloading...');
          window.location.reload();
        }
      }
    };

    function injectCSS(filePath) {
      // Remove timestamp do cache dos links CSS
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      const timestamp = Date.now();

      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes(filePath)) {
          // Força reload do CSS adicionando/removendo timestamp
          const newHref = href.split('?')[0] + '?v=' + timestamp;
          link.setAttribute('href', newHref);
          console.log('[hot-server] CSS injected:', filePath);
        }
      });
    }

    evtSource.onerror = function() {
      console.log('[hot-server] Disconnected. Retrying...');
    };
  })();
</script>
`;
const MIME_TYPES = {
    // Textos e documentos
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    // Imagens
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    // Vídeos
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    // Áudios
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.oga': 'audio/ogg',
    '.aac': 'audio/aac',
    '.m4a': 'audio/m4a',
    '.opus': 'audio/opus',
    // Fontes
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    // Aplicações e manifestos
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.gzip': 'application/gzip',
    '.tar': 'application/x-tar',
    '.wasm': 'application/wasm',
    '.webmanifest': 'application/manifest+json',
    // Outros tipos comuns
    '.csv': 'text/csv',
    '.tsv': 'text/tab-separated-values',
    '.yaml': 'application/x-yaml',
    '.yml': 'application/x-yaml',
    '.toml': 'application/toml'
};
export class HotServer {
    config;
    clients = new Set();
    server;
    watcher;
    isHttps = false;
    constructor(config) {
        this.config = config;
        this.watcher = new Watcher(config.root);
        this.isHttps = config.https === 'true';
    }
    async handleRequest(req, res) {
        // 1. Endpoint de Hot Reload (SSE)
        if (req.url === '/_hot_server_sse') {
            this.handleSSE(req, res);
            return;
        }
        // 2. Servir Arquivos Estáticos
        let filePath = path.join(this.config.root, req.url === '/' ? 'index.html' : req.url || 'index.html');
        // Remove query params
        filePath = filePath.split('?')[0];
        // Se for diretório, tenta index.html
        if (existsSync(filePath) && statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }
        if (!existsSync(filePath)) {
            // Suporte SPA: se arquivo não existe, tenta servir index.html
            if (this.config.spa === 'true') {
                const indexPath = path.join(this.config.root, 'index.html');
                if (existsSync(indexPath)) {
                    filePath = indexPath;
                }
                else {
                    res.writeHead(404);
                    res.end(`File not found: ${req.url}`);
                    return;
                }
            }
            else {
                res.writeHead(404);
                res.end(`File not found: ${req.url}`);
                return;
            }
        }
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        // Log detalhado de arquivos servidos
        const relativePath = path.relative(this.config.root, filePath);
        const fileSize = (await fs.stat(filePath)).size;
        console.log(`📄 Servindo: ${relativePath} (${this.formatBytes(fileSize)}) [${mimeType}]`);
        // 3. Injeção de Script (apenas HTML)
        if (ext === '.html') {
            try {
                let content = await fs.readFile(filePath, 'utf-8');
                // Analisar e logar recursos do HTML
                this.logHtmlResources(content, relativePath);
                // Injeta antes de </body> ou no final se não tiver body
                if (content.includes('</body>')) {
                    content = content.replace('</body>', `${INJECTED_SCRIPT}</body>`);
                }
                else {
                    content += INJECTED_SCRIPT;
                }
                res.writeHead(200, {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                });
                res.end(content);
                console.log(`🌐 HTML injetado com hot-reload: ${relativePath}`);
            }
            catch (err) {
                res.writeHead(500);
                res.end('Internal Server Error');
                console.error(`❌ Erro ao servir HTML ${relativePath}:`, err);
            }
        }
        else {
            // Stream para arquivos binários ou grandes
            res.writeHead(200, {
                'Content-Type': mimeType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            const stream = createReadStream(filePath);
            stream.pipe(res);
        }
    }
    handleSSE(req, res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        // Mantém conexão viva
        res.write('data: connected\n\n');
        this.clients.add(res);
        req.on('close', () => {
            this.clients.delete(res);
        });
    }
    notifyClients(changedFile) {
        if (this.clients.size === 0)
            return;
        if (changedFile) {
            const ext = path.extname(changedFile).toLowerCase();
            if (ext === '.css') {
                console.log(`📡 Notificando ${this.clients.size} clientes sobre mudança CSS: ${changedFile}`);
                const data = JSON.stringify({ type: 'css', file: changedFile });
                for (const client of this.clients) {
                    client.write(`data: ${data}\n\n`);
                }
                return;
            }
        }
        // Fallback para reload completo
        console.log(`📡 Notificando ${this.clients.size} clientes para recarregar...`);
        for (const client of this.clients) {
            client.write('data: reload\n\n');
        }
    }
    openBrowser() {
        const protocol = this.isHttps ? 'https' : 'http';
        const url = `${protocol}://localhost:${this.config.port}`;
        const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
        exec(`${start} ${url}`);
    }
    async start() {
        // Inicia Watcher
        this.watcher.on('change', (filePath) => this.notifyClients(filePath));
        this.watcher.start();
        // Criar servidor HTTP ou HTTPS
        if (this.isHttps) {
            const certs = await CertGenerator.getCertPaths();
            if (!certs) {
                console.log('🔐 Gerando certificados auto-assinados...');
                await CertGenerator.generateCerts();
            }
            const certPaths = await CertGenerator.getCertPaths();
            if (certPaths) {
                const options = {
                    key: await fs.readFile(certPaths.keyPath),
                    cert: await fs.readFile(certPaths.certPath)
                };
                this.server = https.createServer(options, this.handleRequest.bind(this));
            }
            else {
                throw new Error('Não foi possível gerar certificados HTTPS');
            }
        }
        else {
            this.server = http.createServer(this.handleRequest.bind(this));
        }
        const tryListen = (port) => {
            const onError = (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`⚠️ Porta ${port} em uso, tentando ${port + 1}...`);
                    // Garante que limpamos listeners antigos antes de tentar de novo
                    this.server.removeListener('error', onError);
                    this.server.close();
                    tryListen(port + 1);
                }
                else {
                    console.error('❌ Erro ao iniciar servidor:', err);
                    process.exit(1);
                }
            };
            this.server.once('error', onError);
            this.server.listen(port, () => {
                this.server.removeListener('error', onError);
                this.config.port = port;
                const protocol = this.isHttps ? 'https' : 'http';
                const lockEmoji = this.isHttps ? '🔒' : '🔓';
                console.log(`
🔥 Hot-Server rodando!
-----------------------------------
📂 Root:    ${this.config.root}
${lockEmoji} Local:   ${protocol}://localhost:${this.config.port}
-----------------------------------
                `);
                if (this.config.open === 'true') {
                    this.openBrowser();
                }
            });
        };
        tryListen(this.config.port);
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    logHtmlResources(htmlContent, htmlPath) {
        const resources = [];
        // CSS links
        const cssMatches = htmlContent.match(/<link[^>]*href="([^"]*\.css[^"]*)"[^>]*>/gi);
        if (cssMatches) {
            cssMatches.forEach(match => {
                const hrefMatch = match.match(/href="([^"]*\.css[^"]*)"/i);
                if (hrefMatch) {
                    resources.push({ type: 'CSS', path: hrefMatch[1] });
                }
            });
        }
        // JavaScript scripts
        const jsMatches = htmlContent.match(/<script[^>]*src="([^"]*\.js[^"]*)"[^>]*><\/script>/gi);
        if (jsMatches) {
            jsMatches.forEach(match => {
                const srcMatch = match.match(/src="([^"]*\.js[^"]*)"/i);
                if (srcMatch) {
                    resources.push({ type: 'JS', path: srcMatch[1] });
                }
            });
        }
        // Images
        const imgMatches = htmlContent.match(/<img[^>]*src="([^"]*)"[^>]*>/gi);
        if (imgMatches) {
            imgMatches.forEach(match => {
                const srcMatch = match.match(/src="([^"]*)"/i);
                if (srcMatch) {
                    resources.push({ type: 'IMG', path: srcMatch[1] });
                }
            });
        }
        if (resources.length > 0) {
            console.log(`🔍 Recursos encontrados em ${htmlPath}:`);
            resources.forEach(resource => {
                console.log(`  ${resource.type === 'CSS' ? '🎨' : resource.type === 'JS' ? '📜' : '🖼️'} ${resource.path}`);
            });
        }
    }
}
