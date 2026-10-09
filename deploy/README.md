# NovaSEO production deployment

Every push to `main` is deployed by GitHub Actions to `/home/app/novaseo` on
the VPS. Runtime secrets live only in `/home/app/novaseo/.env`; the workflow
preserves that file across releases and never uploads it from the repository.

## One-time VPS setup

1. Install Docker Engine with the Docker Compose plugin, Nginx, and `curl`.
2. Create the application directory and production environment file:

   ```bash
   mkdir -p /home/app/novaseo
   scp -P <ssh-port> deploy/production.env.example \
     <ssh-user>@<vps-host>:/home/app/novaseo/.env
   ssh -p <ssh-port> <ssh-user>@<vps-host> 'chmod 600 /home/app/novaseo/.env'
   ```

   Replace every placeholder before the first deploy.
3. Copy `deploy/nginx-novaseo.conf` to `/etc/nginx/conf.d/novaseo.conf`,
   replace `novaseo.example.com` and `127.0.0.1:3009` (must match `API_PORT`
   in `.env`), then reload:

   ```bash
   nginx -t && systemctl reload nginx
   ```

   Point the domain's DNS A record to the VPS IP. Configure TLS separately
   (for example, with Certbot).

## GitHub environment secrets

Create the **`novaseo-production`** environment and add:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | SSH deployment user |
| `VPS_SSH_PORT` | SSH port |
| `VPS_SSH_KEY` | Private key for the deployment user |

## Deploy

Push to `main`. The workflow uploads a source archive, rebuilds the API and
worker images, runs migrations, and verifies:

```text
http://127.0.0.1:${API_PORT}/health
```

Nginx is not managed by CI; it keeps proxying to the API container.
