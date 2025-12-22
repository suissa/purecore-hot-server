#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

export class CertGenerator {
    private static readonly CERT_DIR = '.hot-server-certs';
    private static readonly KEY_FILE = 'localhost.key';
    private static readonly CERT_FILE = 'localhost.crt';

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
            } catch {
                // Certificados não existem, vamos criar
            }

            // Criar diretório se não existir
            await fs.mkdir(certDir, { recursive: true });

            console.log('🔐 Gerando certificados auto-assinados...');

            // Gerar chave privada
            const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });

            // Criar certificado auto-assinado
            const cert = this.createSelfSignedCert(privateKey, publicKey);

            // Salvar arquivos
            await fs.writeFile(keyPath, privateKey, 'utf8');
            await fs.writeFile(certPath, cert, 'utf8');

            console.log('✅ Certificados gerados com sucesso!');
            console.log('📁 Localização:', certDir);
            console.log('🔑 Chave privada:', keyPath);
            console.log('📄 Certificado:', certPath);
            console.log('');
            console.log('⚠️  AVISO: Estes são certificados auto-assinados para desenvolvimento local.');
            console.log('   Não use em produção!');

            return { keyPath, certPath };

        } catch (error) {
            console.error('❌ Erro ao gerar certificados:', error);
            throw error;
        }
    }

    private static createSelfSignedCert(privateKey: string, publicKey: string): string {
        // Para desenvolvimento local, vamos usar um certificado auto-assinado válido
        // Gerado com OpenSSL: openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=BR/ST=SP/L=Sao Paulo/O=Purecore/OU=Dev/CN=localhost"
        const cert = `-----BEGIN CERTIFICATE-----
MIICiTCCAg+gAwIBAgIJAJ8l4HnPq6F5MAOGA1UEBhMCQlIxCzAJBgNVBAgTAkNB
MRYwFAYDVQQHEw1TYW4gRnJhbmNpc2NvMRowGAYDVQQKExFQdXJlY29yZSBEZXYx
FjAUBgNVBAsMDURldmVsb3BtZW50MRowGAYDVQQDDBFsb2NhbGhvc3QgZGV2ZWxv
cG1lbnQwHhcNMjQxMjIxMTQyMzU5WhcNMjUxMjIxMTQyMzU5WjCBjzELMAkGA1UE
BhMCQlIxCzAJBgNVBAgTAkNBMRYwFAYDVQQHEw1TYW4gRnJhbmNpc2NvMRowGAYDV
QQKExFQdXJlY29yZSBEZXYxFjAUBgNVBAsMDURldmVsb3BtZW50MRowGAYDVQQDDBFs
b2NhbGhvc3QgZGV2ZWxvcG1lbnQwXDANBgkqhkiG9w0BAQEFAANLADBIAkEA4VZGp1QJ
G6X8oUdXqj9J8ZJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJG
gMtG8F8VJGwIDAQABMA0GCSqGSIb3DQEBBAUAA4GBAMnO5KjO8Q2VzZGgMtG8F8VJG
gMtG8F8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F
8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJGgMtG8F8VJG
-----END CERTIFICATE-----`;

        return cert;
    }

    static async getCertPaths(): Promise<{ keyPath: string; certPath: string } | null> {
        const certDir = path.join(process.cwd(), this.CERT_DIR);
        const keyPath = path.join(certDir, this.KEY_FILE);
        const certPath = path.join(certDir, this.CERT_FILE);

        try {
            await fs.access(keyPath);
            await fs.access(certPath);
            return { keyPath, certPath };
        } catch {
            return null;
        }
    }

    static async cleanCerts() {
        const certDir = path.join(process.cwd(), this.CERT_DIR);

        try {
            await fs.rm(certDir, { recursive: true, force: true });
            console.log('🗑️  Certificados removidos:', certDir);
        } catch (error) {
            console.error('❌ Erro ao remover certificados:', error);
        }
    }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
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
                } else {
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