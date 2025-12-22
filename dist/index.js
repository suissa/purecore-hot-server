#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// File: src/index.ts
const server_1 = require("./server");
const validator_1 = require("./validator");
const node_path_1 = __importDefault(require("node:path"));
const args = process.argv.slice(2);
// Parsing manual simplificado de args (ex: --port=3000)
// Em um projeto maior, você escreveria um parser mais robusto no validator.ts
const getArg = (key, defaultVal) => {
    const arg = args.find(a => a.startsWith(`--${key}=`));
    return arg ? arg.split('=')[1] : defaultVal;
};
// Se o primeiro argumento não tiver --, assumimos que é a pasta
const rootArg = args[0] && !args[0].startsWith('--') ? args[0] : '.';
const rawConfig = {
    port: parseInt(getArg('port', '8080')),
    root: node_path_1.default.resolve(process.cwd(), rootArg), 
    open: getArg('open', 'true') // 'true' por padrão
};
try {
    // Validação "Zod-like"
    const config = validator_1.configSchema.parse(rawConfig);
    const app = new server_1.AutoServer(config);
    app.start();
}
catch (error) {
    console.error('❌ Erro de configuração:', error.message);
    process.exit(1);
}
