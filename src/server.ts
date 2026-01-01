import http from "node:http";
import https from "node:https";
import fs from "node:fs/promises";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import os from "node:os";
import { Watcher } from "./watcher.js";
import { Config } from "./validator.js";
import { CertGenerator } from "./cert-generator.js";

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

const MIME_TYPES: Record<string, string> = {
  // Textos e documentos
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".md": "text/markdown",

  // Imagens
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",

  // Vídeos
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",

  // Áudios
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".oga": "audio/ogg",
  ".aac": "audio/aac",
  ".m4a": "audio/m4a",
  ".opus": "audio/opus",

  // Fontes
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",

  // Aplicações e manifestos
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gzip": "application/gzip",
  ".tar": "application/x-tar",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",

  // Outros tipos comuns
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
  ".toml": "application/toml",
};

export class HotServer {
  private clients: Set<http.ServerResponse> = new Set();
  private server!: http.Server | https.Server;
  private watcher: Watcher;
  private isHttps: boolean = false;
  private startTime: number = Date.now();

  constructor(private config: Config) {
    this.watcher = new Watcher(config.root);
    this.isHttps = config.https === "true";
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    // 1. Endpoint de Hot Reload (SSE)
    if (req.url === "/_hot_server_sse") {
      this.handleSSE(req, res);
      return;
    }

    // 2. Servir Arquivos Estáticos
    const urlRaw = req.url || "/";
    const urlPathOnly = urlRaw.split("?")[0];

    let filePath = path.join(
      this.config.root,
      urlPathOnly === "/" ? "index.html" : urlPathOnly
    );

    // Remove query params
    filePath = filePath.split("?")[0];

    // Se for diretório, tenta index.html
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      if (existsSync(indexPath)) {
        filePath = indexPath;
      } else {
        // Directory listing (UI preta com cards)
        await this.serveDirectoryListing({
          dirPath: filePath,
          requestPath: urlPathOnly,
          res,
        });
        return;
      }
    }

    if (!existsSync(filePath)) {
      // Fallback: se URL não tem extensão, tenta .html e /index.html
      // Ex: /sobre -> /sobre.html, /sobre/index.html
      const hasExt = path.extname(urlPathOnly) !== "";
      if (!hasExt && urlPathOnly !== "/" && !urlPathOnly.endsWith("/")) {
        const htmlCandidate = path.join(
          this.config.root,
          `${urlPathOnly}.html`
        );
        const dirIndexCandidate = path.join(
          this.config.root,
          urlPathOnly,
          "index.html"
        );
        if (existsSync(htmlCandidate)) {
          filePath = htmlCandidate;
        } else if (existsSync(dirIndexCandidate)) {
          filePath = dirIndexCandidate;
        }
      }

      // Suporte SPA: se arquivo não existe, tenta servir index.html
      if (this.config.spa === "true") {
        const indexPath = path.join(this.config.root, "index.html");
        if (existsSync(indexPath)) {
          filePath = indexPath;
        } else {
          res.writeHead(404);
          res.end(`File not found: ${req.url}`);
          return;
        }
      } else {
        res.writeHead(404);
        res.end(`File not found: ${req.url}`);
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";

    // Log detalhado de arquivos servidos
    const relativePath = path.relative(this.config.root, filePath);
    const fileSize = (await fs.stat(filePath)).size;
    console.log(
      `📄 Servindo: ${relativePath} (${this.formatBytes(
        fileSize
      )}) [${mimeType}]`
    );

    // 3. Injeção de Script (apenas HTML)
    if (ext === ".html") {
      try {
        let content = await fs.readFile(filePath, "utf-8");

        // Analisar e logar recursos do HTML
        this.logHtmlResources(content, relativePath);

        // Injeta antes de </body> ou no final se não tiver body
        if (content.includes("</body>")) {
          content = content.replace("</body>", `${INJECTED_SCRIPT}</body>`);
        } else {
          content += INJECTED_SCRIPT;
        }

        res.writeHead(200, {
          "Content-Type": "text/html",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end(content);
        console.log(`🌐 HTML injetado com hot-reload: ${relativePath}`);
      } catch (err) {
        res.writeHead(500);
        res.end("Internal Server Error");
        console.error(`❌ Erro ao servir HTML ${relativePath}:`, err);
      }
    } else {
      // Stream para arquivos binários ou grandes
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      const stream = createReadStream(filePath);
      stream.pipe(res);
    }
  }

  private handleSSE(req: http.IncomingMessage, res: http.ServerResponse) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Mantém conexão viva
    res.write("data: connected\n\n");

    this.clients.add(res);

    req.on("close", () => {
      this.clients.delete(res);
    });
  }

  private notifyClients(changedFile?: string) {
    if (this.clients.size === 0) return;

    if (changedFile) {
      const ext = path.extname(changedFile).toLowerCase();
      if (ext === ".css") {
        console.log(
          `📡 Notificando ${this.clients.size} clientes sobre mudança CSS: ${changedFile}`
        );
        const data = JSON.stringify({ type: "css", file: changedFile });
        for (const client of this.clients) {
          client.write(`data: ${data}\n\n`);
        }
        return;
      }
    }

    // Fallback para reload completo
    console.log(
      `📡 Notificando ${this.clients.size} clientes para recarregar...`
    );
    for (const client of this.clients) {
      client.write("data: reload\n\n");
    }
  }

  private openBrowser() {
    const protocol = this.isHttps ? "https" : "http";
    const url = `${protocol}://localhost:${this.config.port}`;
    const start =
      process.platform == "darwin"
        ? "open"
        : process.platform == "win32"
        ? "start"
        : "xdg-open";
    exec(`${start} ${url}`);
  }

  public async start() {
    // Inicia Watcher
    this.watcher.on("change", (filePath: string) =>
      this.notifyClients(filePath)
    );
    this.watcher.start();

    // Criar servidor HTTP ou HTTPS
    if (this.isHttps) {
      const certs = await CertGenerator.getCertPaths();
      if (!certs) {
        console.log("🔐 Gerando certificados auto-assinados...");
        await CertGenerator.generateCerts();
      }
      const certPaths = await CertGenerator.getCertPaths();
      if (certPaths) {
        const options = {
          key: await fs.readFile(certPaths.keyPath),
          cert: await fs.readFile(certPaths.certPath),
        };
        this.server = https.createServer(
          options,
          this.handleRequest.bind(this)
        );
      } else {
        throw new Error("Não foi possível gerar certificados HTTPS");
      }
    } else {
      this.server = http.createServer(this.handleRequest.bind(this));
    }

    const tryListen = (port: number) => {
      const onError = (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.log(
            `\n  \x1b[33mPort ${port} is in use, trying another one...\x1b[0m`
          );
          // Garante que limpamos listeners antigos antes de tentar de novo
          this.server.removeListener("error", onError);
          this.server.close();
          tryListen(port + 1);
        } else {
          console.error("❌ Erro ao iniciar servidor:", err);
          process.exit(1);
        }
      };

      this.server.once("error", onError);

      this.server.listen(port, () => {
        this.server.removeListener("error", onError);
        this.config.port = port;

        const protocol = this.isHttps ? "https" : "http";
        const readyTime = Date.now() - this.startTime;

        const version = "0.2.0";

        const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;
        const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
        const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
        const gray = (text: string) => `\x1b[90m${text}\x1b[0m`;

        console.log(
          `\n  ${bold(cyan("HOT-SERVER"))} ${cyan("v" + version)}  ${gray(
            "ready in"
          )} ${bold(green(readyTime + " ms"))}\n`
        );
        console.log(
          `  ${green("➜")}  ${bold("Local")}:   ${cyan(
            `${protocol}://localhost:${this.config.port}/`
          )}`
        );

        const networks = this.getNetworkIPs();
        networks.forEach((ip) => {
          console.log(
            `  ${green("➜")}  ${bold("Network")}: ${cyan(
              `${protocol}://${ip}:${this.config.port}/`
            )}`
          );
        });

        console.log(
          `  ${green("➜")}  ${gray("press")} ${bold("h + enter")} ${gray(
            "to show help"
          )}\n`
        );

        if (this.config.open === "true") {
          this.openBrowser();
        }
      });
    };

    tryListen(this.config.port);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  private logHtmlResources(htmlContent: string, htmlPath: string) {
    const resources: Array<{ type: "CSS" | "JS" | "IMG"; path: string }> = [];

    // CSS links
    const cssMatches = htmlContent.match(
      /<link[^>]*href="([^"]*\.css[^"]*)"[^>]*>/gi
    );
    if (cssMatches) {
      cssMatches.forEach((match) => {
        const hrefMatch = match.match(/href="([^"]*\.css[^"]*)"/i);
        if (hrefMatch) {
          resources.push({ type: "CSS", path: hrefMatch[1] });
        }
      });
    }

    // JavaScript scripts
    const jsMatches = htmlContent.match(
      /<script[^>]*src="([^"]*\.js[^"]*)"[^>]*><\/script>/gi
    );
    if (jsMatches) {
      jsMatches.forEach((match) => {
        const srcMatch = match.match(/src="([^"]*\.js[^"]*)"/i);
        if (srcMatch) {
          resources.push({ type: "JS", path: srcMatch[1] });
        }
      });
    }

    // Images
    const imgMatches = htmlContent.match(/<img[^>]*src="([^"]*)"[^>]*>/gi);
    if (imgMatches) {
      imgMatches.forEach((match) => {
        const srcMatch = match.match(/src="([^"]*)"/i);
        if (srcMatch) {
          resources.push({ type: "IMG", path: srcMatch[1] });
        }
      });
    }

    if (resources.length > 0) {
      console.log(`🔍 Recursos encontrados em ${htmlPath}:`);
      resources.forEach((resource) => {
        console.log(
          `  ${
            resource.type === "CSS"
              ? "🎨"
              : resource.type === "JS"
              ? "📜"
              : "🖼️"
          } ${resource.path}`
        );
      });
    }
  }

  private async serveDirectoryListing(params: {
    dirPath: string;
    requestPath: string;
    res: http.ServerResponse;
  }) {
    const { dirPath, requestPath, res } = params;

    // Normaliza paths para links
    const basePath = requestPath.endsWith("/")
      ? requestPath
      : `${requestPath}/`;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items = entries
      .filter((e) => e.name !== ".DS_Store")
      .sort((a, b) => {
        // Pastas primeiro
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((e) => {
        const isDir = e.isDirectory();
        const name = e.name;
        const href = `${basePath}${encodeURIComponent(name)}${
          isDir ? "/" : ""
        }`;
        const icon = isDir ? "📁" : this.getFileIconByName(name);
        const type = isDir
          ? "Pasta"
          : path.extname(name).slice(1).toUpperCase() || "FILE";
        return { name, href, icon, type, isDir };
      });

    const parentHref = basePath !== "/" ? "../" : null;

    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Index of ${this.escapeHtml(requestPath)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #000;
        --card: #0b0b0b;
        --border: rgba(255,255,255,.10);
        --text: rgba(255,255,255,.92);
        --muted: rgba(255,255,255,.62);
        --hover: rgba(255,255,255,.06);
        --shadow: 0 10px 30px rgba(0,0,0,.45);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      .wrap {
        max-width: 1100px;
        margin: 0 auto;
        padding: 20px;
      }
      header {
        display: flex;
        gap: 12px;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      h1 {
        margin: 0;
        font-size: 18px;
        font-weight: 650;
        letter-spacing: .2px;
      }
      .path {
        color: var(--muted);
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 60vw;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
      }
      a.card {
        display: flex;
        gap: 12px;
        align-items: center;
        text-decoration: none;
        color: inherit;
        padding: 14px 14px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--card);
        box-shadow: var(--shadow);
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
        will-change: transform;
      }
      a.card:hover {
        transform: translateY(-2px);
        border-color: rgba(255,255,255,.22);
        background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      }
      .icon {
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,.03);
        flex: 0 0 auto;
        font-size: 18px;
      }
      .meta { min-width: 0; }
      .name {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.25;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }
      .type {
        margin-top: 3px;
        font-size: 12px;
        color: var(--muted);
      }
      .back {
        margin: 14px 0 0;
        font-size: 13px;
        color: var(--muted);
      }
      .back a { color: var(--text); text-decoration: none; border-bottom: 1px dotted rgba(255,255,255,.25); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <h1>Directory listing</h1>
        <div class="path">${this.escapeHtml(requestPath)}</div>
      </header>

      <div class="grid">
        ${
          parentHref
            ? `<a class="card" href="${parentHref}"><div class="icon">↩</div><div class="meta"><div class="name">..</div><div class="type">Voltar</div></div></a>`
            : ""
        }
        ${items
          .map((i) =>
            `
          <a class="card" href="${i.href}">
            <div class="icon">${i.icon}</div>
            <div class="meta">
              <div class="name">${this.escapeHtml(i.name)}${
              i.isDir ? "/" : ""
            }</div>
              <div class="type">${this.escapeHtml(i.type)}</div>
            </div>
          </a>
        `.trim()
          )
          .join("")}
      </div>

      <div class="back">
        Servido por <strong>purecore-hot-server</strong>
      </div>
    </div>
  </body>
</html>`;

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end(html);
    console.log(
      `📁 Directory listing: ${path.relative(this.config.root, dirPath)}`
    );
  }

  private getFileIconByName(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".html" || ext === ".htm") return "🌐";
    if (ext === ".css") return "🎨";
    if (ext === ".js" || ext === ".mjs" || ext === ".ts") return "📜";
    if (ext === ".json" || ext === ".yaml" || ext === ".yml" || ext === ".toml")
      return "🧩";
    if (ext === ".md" || ext === ".txt") return "📝";
    if (
      [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".webp",
        ".bmp",
        ".tif",
        ".tiff",
        ".ico",
      ].includes(ext)
    )
      return "🖼️";
    if (
      [
        ".mp4",
        ".webm",
        ".mov",
        ".avi",
        ".wmv",
        ".flv",
        ".mkv",
        ".ogg",
      ].includes(ext)
    )
      return "🎞️";
    if ([".mp3", ".wav", ".m4a", ".aac", ".opus", ".oga"].includes(ext))
      return "🎵";
    if ([".zip", ".tar", ".gz", ".gzip"].includes(ext)) return "🗜️";
    if (ext === ".pdf") return "📄";
    return "📄";
  }

  private escapeHtml(input: string): string {
    return input
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  private getNetworkIPs(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  }
}
