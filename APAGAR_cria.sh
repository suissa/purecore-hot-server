#!/bin/bash

# Verifica se foram passados dois argumentos
if [ "$#" -ne 2 ]; then
    echo "Uso: $0 subdominio.com.br porta_servidor"
    exit 1
fi

SUBDOMAIN=$1
PORT=$2
CONFIG_FILE="/etc/nginx/sites-available/$SUBDOMAIN"
LINK_FILE="/etc/nginx/sites-enabled/$SUBDOMAIN"

# Cria o arquivo de configuração Nginx
cat <<EOF | sudo tee $CONFIG_FILE
server {
    listen 80;
    server_name $SUBDOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}

server {
    listen 80;
    server_name $SUBDOMAIN;

    return 301 https://\$host\$request_uri;
}
EOF

# Testa a configuração do Nginx
sudo nginx -t

# Se o teste for bem-sucedido, reinicia o Nginx e cria o link simbólico
if [ $? -eq 0 ]; then
    sudo ln -s $CONFIG_FILE $LINK_FILE
    sudo systemctl reload nginx

    # Emite o certificado SSL com o Certbot
    sudo certbot --nginx -d $SUBDOMAIN -v
else
    echo "Erro na configuração do Nginx. Verifique os logs."
    exit 1
fi