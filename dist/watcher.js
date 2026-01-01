import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
export class Watcher extends EventEmitter {
    root;
    timeout = null;
    watcher = null;
    constructor(root) {
        super();
        this.root = path.resolve(root);
    }
    start() {
        if (!fs.existsSync(this.root)) {
            console.error(`❌ Diretório não encontrado: ${this.root}`);
            return;
        }
        console.log(`👀 Observando mudanças em: ${this.root}`);
        // Inicia o watcher de forma assíncrona para não bloquear a inicialização do servidor
        // Isso é crítico no WSL onde fs.watch recursivo pode demorar segundos
        setImmediate(() => {
            try {
                this.watcher = fs.watch(this.root, { recursive: true }, (eventType, filename) => {
                    if (filename && !this.isIgnored(filename.toString())) {
                        this.debounceChange(filename.toString());
                    }
                });
            }
            catch (err) {
                console.warn("⚠️ Fallback para watcher não recursivo.");
                this.watcher = fs.watch(this.root, (event, filename) => {
                    if (filename)
                        this.debounceChange(filename.toString());
                });
            }
        });
    }
    isIgnored(filename) {
        // Ignorar node_modules e arquivos ocultos (.git, etc)
        return (filename.includes("node_modules") ||
            filename.includes(".git") ||
            filename.endsWith(".tmp"));
    }
    debounceChange(filename) {
        // Evita múltiplos disparos (ex: salvar arquivo dispara 2 eventos 'change' e 'rename')
        if (this.timeout)
            clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            console.log(`🔄 Arquivo alterado: ${filename}`);
            this.emit("change", filename);
        }, 100); // 100ms debounce
    }
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}
