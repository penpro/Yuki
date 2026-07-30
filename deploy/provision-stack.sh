#!/usr/bin/env bash
set -euo pipefail

# Provisions the application stack on the Ubuntu server: swap, MySQL, Node,
# PM2, and basic host hardening. Mirrors what WebDevClass runs so anything
# built later ports across without surprises.
#
# Run ON THE SERVER. Safe to re-run — every step checks before acting.
#
#   ./deploy/provision-stack.sh
#
# Nothing the static site serves today needs any of this. It's a foundation
# for adding a backend later.
#
# ── Why the memory tuning is not optional ────────────────────────────────
# This instance has ~900MB RAM and, out of the box, no swap. MySQL 8.4's
# defaults assume far more: the InnoDB buffer pool alone defaults to 128MB
# and performance_schema adds well over 100MB of fixed allocations. Install
# it untuned here and mysqld gets OOM-killed, usually days later under load
# rather than immediately, which makes it look like a mystery crash.
#
# So this script adds swap first and drops a low-memory config in before
# MySQL ever starts.

SWAP_SIZE="${SWAP_SIZE:-1536M}"     # 1.5G — disk here is only ~6.7G total
DB_NAME="${DB_NAME:-yuki}"

echo "==> Stack provisioning starting"
echo "    swap: $SWAP_SIZE   database: $DB_NAME"
echo ""

# ── 1. swap ──────────────────────────────────────────────────────────────
if [ -f /swapfile ] && swapon --show=NAME --noheadings | grep -q '/swapfile'; then
  echo "==> Swap already active, skipping"
else
  echo "==> Creating ${SWAP_SIZE} swap file"
  sudo fallocate -l "$SWAP_SIZE" /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  if ! grep -q '^/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
fi

# Prefer RAM, but use swap rather than dying. 10 = only swap under real pressure.
if [ ! -f /etc/sysctl.d/99-yuki-swap.conf ]; then
  printf 'vm.swappiness=10\nvm.vfs_cache_pressure=50\n' \
    | sudo tee /etc/sysctl.d/99-yuki-swap.conf >/dev/null
  sudo sysctl -q --system
fi
free -h | sed 's/^/    /'

# ── 2. MySQL, tuned before first start ───────────────────────────────────
if command -v mysql >/dev/null 2>&1; then
  echo "==> MySQL already installed, skipping install"
else
  echo "==> Pre-seeding low-memory MySQL config"
  sudo mkdir -p /etc/mysql/mysql.conf.d
  sudo tee /etc/mysql/mysql.conf.d/zz-low-memory.cnf >/dev/null <<'CNF'
# Tuning for a ~900MB instance. Written by deploy/provision-stack.sh.
# Raise these if the box is ever resized.
[mysqld]
innodb_buffer_pool_size  = 96M
innodb_log_buffer_size   = 4M
innodb_redo_log_capacity = 32M
key_buffer_size          = 8M
max_connections          = 30
table_open_cache         = 200
thread_cache_size        = 4
tmp_table_size           = 16M
max_heap_table_size      = 16M
# The single biggest saving on a small box: roughly 100MB+ of fixed
# allocation for instrumentation nobody is reading here.
performance_schema       = OFF
CNF

  echo "==> Installing MySQL"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server
fi

sudo systemctl enable --now mysql >/dev/null 2>&1 || true

# Ubuntu's packaging authenticates root over the unix socket, so `sudo mysql`
# works with no password. That's what WebDevClass's migrate.sh relies on, so
# it's kept rather than setting a root password.
if sudo mysql -Nse "SHOW DATABASES LIKE '$DB_NAME';" 2>/dev/null | grep -q "$DB_NAME"; then
  echo "==> Database '$DB_NAME' already exists"
else
  echo "==> Creating database '$DB_NAME'"
  sudo mysql -e "CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
fi

# ── 3. Node + npm ────────────────────────────────────────────────────────
# Ubuntu 26.04 ships Node 22 (LTS), so no third-party apt repo is needed.
if command -v node >/dev/null 2>&1; then
  echo "==> Node already installed: $(node --version)"
else
  echo "==> Installing Node + npm"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs npm
fi

# ── 4. PM2 ───────────────────────────────────────────────────────────────
if command -v pm2 >/dev/null 2>&1; then
  echo "==> PM2 already installed: $(pm2 --version 2>/dev/null)"
else
  echo "==> Installing PM2"
  sudo npm install -g pm2 --silent
fi

# Resurrect whatever PM2 was running after a reboot. Harmless with an empty
# process list, which is what it'll be until a backend actually exists.
if ! systemctl list-unit-files 2>/dev/null | grep -q '^pm2-ubuntu'; then
  echo "==> Enabling PM2 on boot"
  sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null
  pm2 save --force >/dev/null 2>&1 || true
fi

# ── 5. hardening ─────────────────────────────────────────────────────────
if ! command -v fail2ban-server >/dev/null 2>&1; then
  echo "==> Installing fail2ban"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban
fi

if [ ! -f /etc/fail2ban/jail.local ]; then
  echo "==> Configuring fail2ban (ssh)"
  sudo tee /etc/fail2ban/jail.local >/dev/null <<'JAIL'
# Written by deploy/provision-stack.sh
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
JAIL
fi
sudo systemctl enable --now fail2ban >/dev/null 2>&1 || true

echo "==> Unattended security upgrades"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'AUTO'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
AUTO

# ── report ───────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────────────────────"
echo "Stack provisioned."
printf "  %-12s %s\n" "swap"     "$(swapon --show=SIZE --noheadings | tr -d ' ' || echo none)"
printf "  %-12s %s\n" "mysql"    "$(mysql --version 2>/dev/null | awk '{print $3}')"
printf "  %-12s %s\n" "database" "$DB_NAME"
printf "  %-12s %s\n" "node"     "$(node --version 2>/dev/null)"
printf "  %-12s %s\n" "npm"      "$(npm --version 2>/dev/null)"
printf "  %-12s %s\n" "pm2"      "$(pm2 --version 2>/dev/null | tail -1)"
printf "  %-12s %s\n" "fail2ban" "$(systemctl is-active fail2ban 2>/dev/null)"
echo ""
free -h | sed 's/^/  /'
echo "────────────────────────────────────────────────────────────"
