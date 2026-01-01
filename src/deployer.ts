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
      `\n  ${bold(magenta("🚀 HOT-SERVER DEPLOYER"))} ${gray("v0.3.2")}`
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
          "(padrão 6000)"
        )}\n    ${green("❯")} `
      )) || "6000";

    const name = domain.split(".")[0];

    const pm2Command = `pm2 start dist/index.js --name "${domain}" -- --port=${port} --https=true --open=false`;

    console.log(`\n  ${bold("📦 Configuração Gerada:")}`);
    console.log(`  ${gray("────────────────────────")}`);
    console.log(`  ${bold("Dominio:")} ${cyan(domain)}`);
    console.log(`  ${bold("Porta:")}   ${cyan(port)}`);
    console.log(`  ${bold("PM2:")}     ${yellow(pm2Command)}`);
    console.log(`  ${gray("────────────────────────")}\n`);

    const confirm = await this.question(
      `  ${cyan("➜")} ${bold(
        "Deseja configurar Nginx + SSL (Certbot) agora?"
      )} ${gray("(s/n)")}\n    ${green("❯")} `
    );

    if (confirm.toLowerCase() === "s") {
      await this.setupNginx(domain, port);
    }

    console.log(`\n  ${bold(green("✨ Deploy concluído com sucesso!"))}`);
    console.log(`  ${gray("Próximo passo sugerido:")} ${yellow(pm2Command)}\n`);

    this.rl.close();
  }

  private async setupNginx(domain: string, port: string) {
    console.log(`\n  ${bold("🛠️  Iniciando configuração Nginx...")}`);

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

server {
    listen 80;
    server_name ${domain};

    return 301 https://$host$request_uri;
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

      console.log(`  ${gray("➜")} Criando link simbólico...`);
      await this.runCommand(`sudo ln -sf ${sitesAvailable} ${sitesEnabled}`);

      console.log(`  ${gray("➜")} Recarregando Nginx...`);
      await this.runCommand(`sudo systemctl reload nginx`);

      console.log(`  ${gray("➜")} Solicitando certificado SSL (Certbot)...`);
      console.log(`  ${yellow("⚠ Aguarde a interação do Certbot...")}`);
      // Usamos spawn ou deixamos o exec lidar, mas certbot é interativo
      // Para simplificar, usamos --nginx -n (non-interactive) ou deixamos o usuário ver
      await this.runCommand(
        `sudo certbot --nginx -d ${domain} --non-interactive --agree-tos -m admin@${domain
          .split(".")
          .slice(-2)
          .join(".")}`
      );

      console.log(`  ${green("✔")} Nginx e SSL configurados!`);
    } catch (error: any) {
      console.error(
        `\n  ${yellow("❌ Erro na configuração:")} ${error.message}`
      );
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
