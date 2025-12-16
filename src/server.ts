import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { Watcher } from './watcher';
import { Config } from './validator';

// Script injetado no HTML para ouvir mudanças
const INJECTED_SCRIPT = `
<!-- Code injected by auto-server -->
<script>
  (function() {
    console.log('[hot-server] Connected to hot reload');
    const evtSource = new EventSource('/_hot_server_sse');
    evtSource.onmessage = function(event) {
      if (event.data === 'reload') {
        console.log('[hot-server] Reloading...');
        window.location.reload();
      }
    };
    evtSource.onerror = function() {
      console.log('[hot-server] Disconnected. Retrying...');
    };
  })();
</script>
`;

const MIME_TYPES: Record<string, string> = {
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

export class HotServer {
    private clients: Set<http.ServerResponse> = new Set();
    private server: http.Server;
    private watcher: Watcher;

    constructor(private config: Config) {
        this.watcher = new Watcher(config.root);
        this.server = http.createServer(this.handleRequest.bind(this));
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
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
            res.writeHead(404);
            res.end(`File not found: ${req.url}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        // 3. Injeção de Script (apenas HTML)
        if (ext === '.html') {
            try {
                let content = await fs.readFile(filePath, 'utf-8');
                // Injeta antes de </body> ou no final se não tiver body
                if (content.includes('</body>')) {
                    content = content.replace('</body>', `${INJECTED_SCRIPT}</body>`);
                } else {
                    content += INJECTED_SCRIPT;
                }
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            } catch (err) {
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        } else {
            // Stream para arquivos binários ou grandes
            res.writeHead(200, { 'Content-Type': mimeType });
            const stream = createReadStream(filePath);
            stream.pipe(res);
        }
    }

    private handleSSE(req: http.IncomingMessage, res: http.ServerResponse) {
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

    private notifyClients() {
        if (this.clients.size === 0) return;
        
        console.log(`📡 Notificando ${this.clients.size} clientes para recarregar...`);
        for (const client of this.clients) {
            client.write('data: reload\n\n');
        }
    }

    private openBrowser() {
        const url = `http://localhost:${this.config.port}`;
        const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
        exec(`${start} ${url}`);
    }

    public start() {
        // Inicia Watcher
        this.watcher.on('change', () => this.notifyClients());
        this.watcher.start();

        // Inicia HTTP Server
        this.server.listen(this.config.port, () => {
            console.log(`
🚀 Hot-Server rodando!
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