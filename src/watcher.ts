import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

export class Watcher extends EventEmitter {
    private root: string;
    private timeout: NodeJS.Timeout | null = null;
    private watcher: fs.FSWatcher | null = null;

    constructor(root: string) {
        super();
        this.root = path.resolve(root);
    }

    start() {
        if (!fs.existsSync(this.root)) {
            console.error(`❌ Diretório não encontrado: ${this.root}`);
            return;
        }

        try {
            // Recursive watch é suportado na maioria dos OS modernos Node v20+
            // No Linux pode ter limitações dependendo do FS, mas para dev local funciona bem.
            this.watcher = fs.watch(this.root, { recursive: true }, (eventType, filename) => {
                if (filename && !this.isIgnored(filename.toString())) {
                    this.debounceChange(filename.toString());
                }
            });
            console.log(`👀 Observando mudanças em: ${this.root}`);
        } catch (err) {
            console.error("Erro ao iniciar watcher:", err);
            // Fallback para não-recursivo se falhar (ex: Linux kernels antigos)
            console.warn("⚠️ Fallback para watcher não recursivo.");
            this.watcher = fs.watch(this.root, (event, filename) => {
                if (filename) this.debounceChange(filename.toString());
            });
        }
    }

    private isIgnored(filename: string): boolean {
        // Ignorar node_modules e arquivos ocultos (.git, etc)
        return filename.includes('node_modules') || 
               filename.includes('.git') ||
               filename.endsWith('.tmp');
    }

    private debounceChange(filename: string) {
        // Evita múltiplos disparos (ex: salvar arquivo dispara 2 eventos 'change' e 'rename')
        if (this.timeout) clearTimeout(this.timeout);
        
        this.timeout = setTimeout(() => {
            console.log(`🔄 Arquivo alterado: ${filename}`);
            this.emit('change', filename);
        }, 100); // 100ms debounce
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}