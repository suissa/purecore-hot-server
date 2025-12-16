"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoServer = void 0;
const node_http_1 = __importDefault(require("node:http"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const watcher_1 = require("./watcher");
// Script injetado no HTML para ouvir mudanças
const INJECTED_SCRIPT = `
<!-- Code injected by auto-server -->
<script>
  (function() {
    console.log('[auto-server] Connected to hot reload');
    const evtSource = new EventSource('/_auto_server_sse');
    evtSource.onmessage = function(event) {
      if (event.data === 'reload') {
        console.log('[auto-server] Reloading...');
        window.location.reload();
      }
    };
    evtSource.onerror = function() {
      console.log('[auto-server] Disconnected. Retrying...');
    };
  })();
</script>
`;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm'
};
class AutoServer {
    config;
    clients = new Set();
    server;
    watcher;
    constructor(config) {
        this.config = config;
        this.watcher = new watcher_1.Watcher(config.root);
        this.server = node_http_1.default.createServer(this.handleRequest.bind(this));
    }
    async handleRequest(req, res) {
        // 1. Endpoint de Hot Reload (SSE)
        if (req.url === '/_auto_server_sse') {
            this.handleSSE(req, res);
            return;
        }
        // 2. Servir Arquivos Estáticos
        let filePath = node_path_1.default.join(this.config.root, req.url === '/' ? 'index.html' : req.url || 'index.html');
        // Remove query params
        filePath = filePath.split('?')[0];
        // Se for diretório, tenta index.html
        if ((0, node_fs_1.existsSync)(filePath) && (0, node_fs_1.statSync)(filePath).isDirectory()) {
            filePath = node_path_1.default.join(filePath, 'index.html');
        }
        if (!(0, node_fs_1.existsSync)(filePath)) {
            res.writeHead(404);
            res.end(`File not found: ${req.url}`);
            return;
        }
        const ext = node_path_1.default.extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        // 3. Injeção de Script (apenas HTML)
        if (ext === '.html') {
            try {
                let content = await promises_1.default.readFile(filePath, 'utf-8');
                // Injeta antes de </body> ou no final se não tiver body
                if (content.includes('</body>')) {
                    content = content.replace('</body>', `${INJECTED_SCRIPT}</body>`);
                }
                else {
                    content += INJECTED_SCRIPT;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            }
            catch (err) {
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        }
        else {
            // Stream para arquivos binários ou grandes
            res.writeHead(200, { 'Content-Type': mimeType });
            const stream = (0, node_fs_1.createReadStream)(filePath);
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
    notifyClients() {
        if (this.clients.size === 0)
            return;
        console.log(`📡 Notificando ${this.clients.size} clientes para recarregar...`);
        for (const client of this.clients) {
            client.write('data: reload\n\n');
        }
    }
    openBrowser() {
        const url = `http://localhost:${this.config.port}`;
        const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
        (0, node_child_process_1.exec)(`${start} ${url}`);
    }
    start() {
        // Inicia Watcher
        this.watcher.on('change', () => this.notifyClients());
        this.watcher.start();
        // Inicia HTTP Server
        this.server.listen(this.config.port, () => {
            console.log(`
🚀 Auto-Server rodando!
-----------------------------------
📂 Root:    ${this.config.root}
🔗 Local:   http://localhost:${this.config.port}
-----------------------------------
            `);
            if (this.config.open === 'true') {
                this.openBrowser();
            }
        });
    }
}
exports.AutoServer = AutoServer;
