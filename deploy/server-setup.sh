#!/usr/bin/env bash
set -euo pipefail

# One-time setup for a fresh Ubuntu EC2 instance.
# Run this ON THE SERVER, once, after cloning the repo.
#
# Usage:
#   ./deploy/server-setup.sh yukisacredspace.com
#   ./deploy/server-setup.sh yukisacredspace.com /home/ubuntu/yuki
#
# It is safe to re-run: every step is idempotent.
#
# After this finishes, get HTTPS with:
#   sudo certbot --nginx -d DOMAIN -d www.DOMAIN
# (certbot rewrites the nginx config in place to add the 443 block.)

# No domain yet? Pass nothing. nginx uses a catch-all server_name so the
# site answers on the bare public IP and the ec2-*.amazonaws.com hostname.
# Re-run with a real domain later to switch it over.
DOMAIN="${1:-_}"
REPO_ROOT="${2:-$HOME/yuki}"
WEB_ROOT="/var/www/yuki"

if [ ! -f "$REPO_ROOT/index.html" ] || [ ! -d "$REPO_ROOT/deploy" ]; then
  echo "That doesn't look like the site checkout: $REPO_ROOT" >&2
  echo "Expected index.html and deploy/ inside it." >&2
  exit 1
fi

echo "==> Domain:    $DOMAIN"
echo "==> Repo:      $REPO_ROOT"
echo "==> Web root:  $WEB_ROOT"
echo ""

echo "==> Installing packages"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  nginx certbot python3-certbot-nginx git rsync

echo "==> Firewall"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# --force stops ufw prompting and cutting the SSH session
sudo ufw --force enable
sudo ufw status

echo "==> Web root"
sudo mkdir -p "$WEB_ROOT"
sudo chown -R "$USER":www-data "$WEB_ROOT"
sudo chmod -R 755 "$WEB_ROOT"

echo "==> nginx snippets"
sudo mkdir -p /etc/nginx/snippets
sudo cp "$REPO_ROOT/deploy/security-headers.conf" \
        /etc/nginx/snippets/yuki-security-headers.conf
sudo cp "$REPO_ROOT/deploy/proxy.conf" \
        /etc/nginx/snippets/yuki-proxy.conf

# The admin is only exposed once there's a domain, because a domain is the
# prerequisite for a certificate and a login form on plain HTTP leaks the
# password to anyone on the network path. With no domain the snippet is
# removed and nginx's wildcard include simply matches nothing.
if [ "$DOMAIN" = "_" ]; then
  echo "==> No domain: admin routes will NOT be exposed (HTTP only)"
  sudo rm -f /etc/nginx/snippets/yuki-admin.conf
else
  echo "==> Domain set: exposing admin routes"
  sudo cp "$REPO_ROOT/deploy/nginx-admin.conf" \
          /etc/nginx/snippets/yuki-admin.conf
fi

echo "==> Uploads directory"
sudo mkdir -p /var/www/yuki-uploads
sudo chown -R "$USER":www-data /var/www/yuki-uploads
sudo chmod 755 /var/www/yuki-uploads

echo "==> Site config"
sudo cp "$REPO_ROOT/deploy/nginx-yuki.conf" /etc/nginx/sites-available/yuki
sudo sed -i "s/DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/yuki
sudo ln -sf /etc/nginx/sites-available/yuki /etc/nginx/sites-enabled/yuki

# The Ubuntu default site answers on port 80 and will shadow ours
if [ -e /etc/nginx/sites-enabled/default ]; then
  echo "==> Disabling the default nginx site"
  sudo rm -f /etc/nginx/sites-enabled/default
fi

# Copying nginx-yuki.conf over the live config throws away everything certbot
# wrote into it — the 443 block, the certificate paths and the HTTP->HTTPS
# redirect. Re-running this script after certbot therefore used to silently
# take the site off HTTPS while leaving the admin routes exposed on plain
# HTTP, which is the exact situation the admin gating exists to prevent.
#
# If a certificate already exists for this domain, put it straight back.
if [ "$DOMAIN" != "_" ] && sudo test -d "/etc/letsencrypt/live/$DOMAIN"; then
  echo "==> Existing certificate found — reinstalling TLS into the new config"

  # Run it plainly and check the exit status. An earlier version piped this
  # through grep, which meant the pipeline reported grep's status instead of
  # certbot's — so a failed TLS install printed a reassuring line and the
  # script carried on. The site stayed up only because nginx was still
  # running its last good config from memory; the file on disk was broken
  # and a reboot would have taken the whole thing down.
  if ! sudo certbot install --cert-name "$DOMAIN" --nginx --non-interactive --redirect; then
    echo "" >&2
    echo "CERTBOT FAILED TO INSTALL THE CERTIFICATE." >&2
    echo "The site is HTTP-only until this is fixed, which also means the" >&2
    echo "admin login would be exposed in the clear. Not continuing." >&2
    exit 1
  fi
fi

echo "==> Testing nginx config"
sudo nginx -t

echo "==> Reloading nginx"
sudo systemctl enable nginx
sudo systemctl reload nginx

echo ""
echo "==> Publishing the site for the first time"
"$REPO_ROOT/deploy/deploy.sh" "$REPO_ROOT"

echo ""
echo "────────────────────────────────────────────────────────────"
if [ "$DOMAIN" = "_" ]; then
  cat <<EOF
Server is up, serving on the public IP (no domain configured).

HTTPS is NOT set up, and can't be yet: Let's Encrypt will not issue
certificates for amazonaws.com hostnames. You need a real domain first.

Once a domain's A record points at this instance:

  ./deploy/server-setup.sh yourdomain.com
  sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
EOF
else
  cat <<EOF
Server is up.

  http://$DOMAIN        should now serve the site

Next, turn on HTTPS (free, auto-renewing):

  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN

Point the domain's A record at this instance's public IP BEFORE
running certbot — it validates over HTTP and will fail otherwise.
EOF
fi
cat <<EOF

Every future update, run here on the server:

  cd $REPO_ROOT && ./deploy/pull-and-deploy.sh
────────────────────────────────────────────────────────────
EOF
