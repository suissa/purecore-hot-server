#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
export class CertGenerator {
    static CERT_DIR = '.hot-server-certs';
    static KEY_FILE = 'localhost.key';
    static CERT_FILE = 'localhost.crt';
    static async generateCerts() {
        const certDir = path.join(process.cwd(), this.CERT_DIR);
        const keyPath = path.join(certDir, this.KEY_FILE);
        const certPath = path.join(certDir, this.CERT_FILE);
        try {
            // Verificar se certificados já existem
            try {
                await fs.access(keyPath);
                await fs.access(certPath);
                console.log('📋 Certificados já existem em:', certDir);
                return { keyPath, certPath };
            }
            catch {
                // Certificados não existem, vamos criar
            }
            // Criar diretório se não existir
            await fs.mkdir(certDir, { recursive: true });
            console.log('🔐 Gerando certificados auto-assinados...');
            // Observação importante:
            // Gerar um X509 "de verdade" apenas com node:crypto (sem libs externas) não é trivial.
            // Como este projeto roda no WSL, utilizamos o OpenSSL (toolchain padrão do Linux)
            // para gerar um par key/cert PEM válido e compatível com Bun/BoringSSL.
            await this.generateWithOpenSSL({ keyPath, certPath });
            // Validação do PEM (evita subir servidor com arquivo corrompido)
            const [keyPem, certPem] = await Promise.all([
                fs.readFile(keyPath, 'utf8'),
                fs.readFile(certPath, 'utf8')
            ]);
            this.validatePem({ keyPem, certPem, keyPath, certPath });
            this.validateX509(certPem, certPath);
            this.validateWithOpenSSL(certPath);
            console.log('✅ Certificados gerados com sucesso!');
            console.log('📁 Localização:', certDir);
            console.log('🔑 Chave privada:', keyPath);
            console.log('📄 Certificado:', certPath);
            console.log('');
            console.log('⚠️  AVISO: Estes são certificados auto-assinados para desenvolvimento local.');
            console.log('   Não use em produção!');
            return { keyPath, certPath };
        }
        catch (error) {
            console.error('❌ Erro ao gerar certificados:', error);
            throw error;
        }
    }
    static generateWithOpenSSL(params) {
        const { keyPath, certPath } = params;
        const subj = '/C=BR/ST=SP/L=Sao Paulo/O=Purecore/OU=Dev/CN=localhost';
        // Preferimos SAN para evitar problemas em clients modernos.
        // Nem todo OpenSSL antigo suporta -addext, então fazemos fallback.
        const baseArgs = ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-days', '365', '-nodes', '-subj', subj];
        try {
            execFileSync('openssl', [...baseArgs, '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'inherit' });
        }
        catch {
            execFileSync('openssl', baseArgs, { stdio: 'inherit' });
        }
    }
    static validatePem(params) {
        const { keyPem, certPem, keyPath, certPath } = params;
        const keyOk = keyPem.includes('-----BEGIN PRIVATE KEY-----') ||
            keyPem.includes('-----BEGIN RSA PRIVATE KEY-----');
        const certOk = certPem.includes('-----BEGIN CERTIFICATE-----');
        if (!keyOk || !certOk) {
            throw new Error(`PEM inválido gerado. ` +
                `keyOk=${keyOk} certOk=${certOk}. ` +
                `keyPath=${keyPath} certPath=${certPath}`);
        }
    }
    static validateX509(certPem, certPath) {
        try {
            // Node valida a estrutura do X509 e falha se base64/DER estiverem inválidos.
            // Isso é um bom "gate" antes de subir o https.createServer().
            // @ts-ignore - Bun/Node expõem X509Certificate em node:crypto
            const x509 = new crypto.X509Certificate(certPem);
            if (!x509.subject) {
                throw new Error('X509 sem subject');
            }
        }
        catch (error) {
            throw new Error(`Certificado X509 inválido em ${certPath}: ${error?.message || String(error)}`);
        }
    }
    static validateWithOpenSSL(certPath) {
        try {
            // OpenSSL é a validação "ground truth" no WSL.
            execFileSync('openssl', ['x509', '-in', certPath, '-noout'], { stdio: 'ignore' });
        }
        catch (error) {
            throw new Error(`OpenSSL não conseguiu ler o certificado (${certPath}).`);
        }
    }
    static async getCertPaths() {
        const certDir = path.join(process.cwd(), this.CERT_DIR);
        const keyPath = path.join(certDir, this.KEY_FILE);
        const certPath = path.join(certDir, this.CERT_FILE);
        try {
            await fs.access(keyPath);
            await fs.access(certPath);
            return { keyPath, certPath };
        }
        catch {
            return null;
        }
    }
    static async cleanCerts() {
        const certDir = path.join(process.cwd(), this.CERT_DIR);
        try {
            await fs.rm(certDir, { recursive: true, force: true });
            console.log('🗑️  Certificados removidos:', certDir);
        }
        catch (error) {
            console.error('❌ Erro ao remover certificados:', error);
        }
    }
}
// Executar se chamado diretamente
if (typeof require !== 'undefined' && require.main === module) {
    const command = process.argv[2];
    switch (command) {
        case 'generate':
        case undefined:
            CertGenerator.generateCerts().catch(console.error);
            break;
        case 'clean':
            CertGenerator.cleanCerts().catch(console.error);
            break;
        case 'info':
            CertGenerator.getCertPaths().then(paths => {
                if (paths) {
                    console.log('📋 Certificados encontrados:');
                    console.log('🔑 Chave:', paths.keyPath);
                    console.log('📄 Certificado:', paths.certPath);
                }
                else {
                    console.log('❌ Nenhum certificado encontrado');
                }
            }).catch(console.error);
            break;
        default:
            console.log('Uso: cert-generator [generate|clean|info]');
            console.log('  generate: Gera certificados auto-assinados (padrão)');
            console.log('  clean: Remove certificados existentes');
            console.log('  info: Mostra informações dos certificados');
    }
}
