# NovaSEO production deployment

Every push to `main` is deployed by GitHub Actions to `/home/app/novaseo` on
the VPS. Runtime secrets live only in `/home/app/novaseo/.env`; the workflow
never uploads that file from the repository. Each release is unpacked into its
own directory and uses the fixed Compose project name `novaseo`, preserving the
existing database and Redis volumes without clearing the application directory.

## One-time VPS setup

1. Install Docker Engine with the Docker Compose plugin, Nginx, and `curl`.
2. Create the application directory and production environment file:

   ```bash
   mkdir -p /home/app/novaseo
   scp -P <ssh-port> deploy/production.env.example \
     <ssh-user>@<vps-host>:/home/app/novaseo/.env
   ssh -p <ssh-port> <ssh-user>@<vps-host> 'chmod 600 /home/app/novaseo/.env'
   ```

   Replace every placeholder before the first deploy. Generate `ENCRYPTION_KEY`
   with `openssl rand -hex 32`; it must be exactly 64 hexadecimal characters.
   Keep it stable and identical for the API and worker, or stored provider
   credentials cannot be decrypted. The deploy workflow quotes safe legacy
   values without changing their contents and rejects invalid encryption keys.
3. Point `novaseo.novatechhp.vn` to the VPS. On this VPS, Cloudflare redirects
   HTTP to HTTPS, so the ACME challenge must be reachable on both ports during
   certificate issuance. Install the temporary bootstrap vhost, which uses the
   existing Cloudflare Origin certificate only between Cloudflare and the VPS:

   ```bash
   install -d -m 755 /var/www/certbot
   install -m 644 deploy/nginx-novaseo-bootstrap.conf \
     /etc/nginx/sites-available/novaseo.novatechhp.vn
   ln -sfn /etc/nginx/sites-available/novaseo.novatechhp.vn \
     /etc/nginx/sites-enabled/novaseo.novatechhp.vn
   nginx -t && systemctl reload nginx
   certbot certonly --webroot -w /var/www/certbot \
     -d novaseo.novatechhp.vn --agree-tos --register-unsafely-without-email \
     --non-interactive
   ```

   The bootstrap certificate is not valid for direct browser access. Once
   Certbot succeeds, replace the bootstrap vhost with
   `deploy/nginx-novaseo.conf`. It retains the ACME challenge location on both
   ports because Cloudflare may redirect HTTP validation to HTTPS. Install the
   renewal hook and reload:

   ```bash
   install -m 644 deploy/nginx-novaseo.conf \
     /etc/nginx/sites-available/novaseo.novatechhp.vn
   install -D -m 755 deploy/certbot-reload-nginx.sh \
     /etc/letsencrypt/renewal-hooks/deploy/50-reload-nginx
   nginx -t && systemctl reload nginx
   ```

## GitHub environment secrets

Create the **`novaseo-production`** environment and add:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | SSH deployment user |
| `VPS_SSH_PORT` | SSH port |
| `VPS_SSH_KEY` | Private key for the deployment user |

## Deploy

Push to `main`. The workflow uploads a source archive to a run-specific release
directory, rebuilds the API, web, and worker images, runs migrations, installs
the matching Nginx vhost, reloads Nginx, and verifies the dashboard and API:

```text
https://novaseo.novatechhp.vn/
http://127.0.0.1:${API_PORT}/health
```

The deployment user must be allowed to run `install`, `cp`, `nginx -t`, and
`systemctl reload nginx` with `sudo -n` (without an interactive password).

## Provider Configuration

Content generation requires `LLM_API_URL`, `LLM_API_KEY`, and `LLM_MODEL` in
the runtime environment. The endpoint must implement the OpenAI-compatible
chat-completions JSON response format.

Keyword mining uses a configured adapter endpoint in the project's settings:
`platformSettings[platform].miningEndpoint`. It receives JSON with `platform`,
`seeds`, `locale`, `country`, and `limit`, and must return a `records` array
containing keyword records. Optional `apiKey` values are encrypted at rest.
No estimated volumes or synthetic suggestions are generated when a provider
is missing.

WordPress requires `siteUrl`, `username`, and `appPassword`. Shopify requires a
`*.myshopify.com` `storeUrl`, `accessToken`, `apiVersion`, `blogId`, and
`blogHandle`. Webhook publishing requires an HTTPS `url`; an optional `secret`
signs requests. TikTok and YouTube publishing currently fail explicitly until
their OAuth, media-upload, and platform approval flows are configured.

IndexNow requires `apiKey` and a same-host HTTPS `keyLocation`. Google
Indexing requires service-account `clientEmail` and `privateKey`. Outbound
provider URLs must use HTTPS and resolve only to public IP addresses.
