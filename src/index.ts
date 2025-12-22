#!/usr/bin/env node
// File: src/index.ts
import { HotServer } from './server';
import { configSchema } from './validator';
import path from 'node:path';

const args = process.argv.slice(2);

// Parsing manual simplificado de args (ex: --port=3000)
// Em um projeto maior, você escreveria um parser mais robusto no validator.ts
const getArg = (key: string, defaultVal: string) => {
    const arg = args.find(a => a.startsWith(`--${key}=`));
    const arg2 = args.find(a => a.startsWith(`-${key}=`));
    return arg 
        ? arg.split('=')[1] 
        : arg2 
            ? arg2.split('=')[1]
            : defaultVal;
};

// Se o primeiro argumento não tiver --, assumimos que é a pasta
const rootArg = args[0] && !args[0].startsWith('--') ? args[0] : '.';

const rawConfig = {
    port: parseInt(getArg('port', '9999')),
    root: path.resolve(process.cwd(), rootArg),
    open: getArg('open', 'true'), // 'true' por padrão
    spa: getArg('spa', 'false'), // 'false' por padrão
    https: getArg('https', 'false') // 'false' por padrão
};

try {
    // Validação "Zod-like"
    const config = configSchema.parse(rawConfig);
    
    const app = new HotServer(config);
    app.start();
} catch (error: any) {
    console.error('❌ Erro de configuração:', error.message);
    process.exit(1);
}