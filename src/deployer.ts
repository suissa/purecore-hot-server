import { exec } from "node:child_process";
import readline from "node:readline";
import path from "node:path";
import fs from "node:fs/promises";

const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
const gray = (text: string) => `\x1b[90m${text}\x1b[0m`;
const magenta = (text: string) => `\x1b[35m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;

export class Deployer {
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  private question(query: string): Promise<string> {
    return new Promise((resolve) => this.rl.question(query, resolve));
  }

  private printBanner() {
    console.log(
      `\n  ${bold(magenta("🚀 one-server-4-all DEPLOYER"))} ${gray("v0.4.0")}`
    );
    console.log(`  ${gray("─────────────────────────────────────────")}\n`);
  }

  public async start() {
    this.printBanner();

    const domain = await this.question(
      `  ${cyan("➜")} ${bold("Qual o domínio/subdomínio?")} ${gray(
        "(ex: app.meusite.com)"
      )}\n    ${green("❯")} `
    );

    if (!domain) {
      console.log(`\n  ${yellow("⚠")} Domínio é obrigatório. Cancelando...\n`);
      this.rl.close();
      return;
    }

    const port =
      (await this.question(
        `  ${cyan("➜")} ${bold("Qual a porta do servidor?")} ${gray(
          "(padrão 8080)"
        )}\n    ${green("❯")} `
      )) || "8080";

    const confirmNginx = await this.question(
      `  ${cyan("➜")} ${bold(
        "Deseja configurar Nginx + SSL (Certbot) agora?"
      )} ${gray("(s/n)")}\n    ${green("❯")} `
    );

    let certPaths = { key: "", cert: "" };

    if (confirmNginx.toLowerCase() === "s") {
      const success = await this.setupNginx(domain, port);
      if (success) {
        // Caminhos padrão do Certbot
        certPaths.key = `/etc/letsencrypt/live/${domain}/privkey.pem`;
        certPaths.cert = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
      }
    }

    const name = domain.split(".")[0];

    // Monta o comando PM2
    // Quando Nginx+Certbot está configurado, o Nginx faz terminação SSL
    // O server roda em HTTP simples (Nginx faz proxy_pass http://localhost:porta)
    // Argumentos devem estar DENTRO das aspas para PM2 processar corretamente

    let pm2Command: string;

    if (certPaths.key && certPaths.cert) {
      // Com Nginx+Certbot: server roda HTTP, Nginx cuida do SSL
      pm2Command = `pm2 start "npx vai-server --port=${port} --open=false" --name "${domain}"`;
    } else {
      // Sem Nginx: pode rodar HTTPS auto-assinado ou HTTP
      pm2Command = `pm2 start "npx vai-server --port=${port} --open=false" --name "${domain}"`;
    }

    console.log(`\n  ${bold("📦 Configuração Final:")}`);
    console.log(`  ${gray("────────────────────────")}`);
    console.log(`  ${bold("Dominio:")} ${cyan(domain)}`);
    console.log(`  ${bold("Porta:")}   ${cyan(port)}`);
    if (certPaths.key) {
      console.log(`  ${bold("SSL:")}     ${green("Configurado via Certbot")}`);
    }
    console.log(`  ${bold("PM2:")}     ${yellow(pm2Command)}`);
    console.log(`  ${gray("────────────────────────")}\n`);

    console.log(`  ${bold(green("✨ Deploy concluído com sucesso!"))}`);
    console.log(
      `  ${gray("Copie e execute o comando acima para iniciar o servidor.")}\n`
    );

    this.rl.close();
  }

  private async setupNginx(domain: string, port: string): Promise<boolean> {
    console.log(`\n  ${bold("🛠️  Iniciando configuração Nginx...")}`);

    // Configuração inicial HTTP para o Certbot validar
    const nginxConfig = `
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

    const tempFilePath = `/tmp/${domain}.conf`;
    const sitesAvailable = `/etc/nginx/sites-available/${domain}`;
    const sitesEnabled = `/etc/nginx/sites-enabled/${domain}`;

    try {
      console.log(`  ${gray("➜")} Criando arquivo temporário...`);
      await fs.writeFile(tempFilePath, nginxConfig);

      console.log(
        `  ${gray("➜")} Movendo para sites-available (requer sudo)...`
      );
      await this.runCommand(`sudo mv ${tempFilePath} ${sitesAvailable}`);

      console.log(`  ${gray("➜")} Testando configuração do Nginx...`);
      await this.runCommand(`sudo nginx -t`);

      console.log(`  ${gray("➜")} Ativando site...`);
      await this.runCommand(`sudo ln -sf ${sitesAvailable} ${sitesEnabled}`);

      console.log(`  ${gray("➜")} Recarregando Nginx...`);
      await this.runCommand(`sudo systemctl reload nginx`);

      console.log(`  ${gray("➜")} Executando Certbot...`);
      console.log(`  ${yellow("⚠ Aguarde...")}`);

      // Roda certbot e pede para ele configurar o redirect HTTPS no Nginx automaticamente
      await this.runCommand(
        `sudo certbot --nginx -d ${domain} --non-interactive --agree-tos --redirect -m admin@${domain
          .split(".")
          .slice(-2)
          .join(".")}`
      );

      console.log(`  ${green("✔")} Nginx e SSL configurados com sucesso!`);
      return true;
    } catch (error: any) {
      console.error(
        `\n  ${yellow("❌ Erro na configuração:")} ${error.message}`
      );
      console.log(
        `  ${gray("Continuando apenas com a geração do comando...")}`
      );
      return false;
    }
  }

  private runCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message));
          return;
        }
        resolve(stdout);
      });
    });
  }
}
