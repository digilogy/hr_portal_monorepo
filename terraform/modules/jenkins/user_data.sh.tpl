#!/bin/bash
# Jenkins CI/CD host bootstrap — Ubuntu 24.04
# Installs: JDK 21, Jenkins LTS, Docker, AWS CLI v2, Node 22, nginx + certbot.
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg unzip git nginx apt-transport-https \
  fontconfig openjdk-21-jre-headless snapd

# ---- Timezone: IST for host and Jenkins JVM ----
timedatectl set-timezone Asia/Kolkata
mkdir -p /etc/systemd/system/jenkins.service.d
cat > /etc/systemd/system/jenkins.service.d/timezone.conf <<'TZCONF'
[Service]
Environment="JAVA_OPTS=-Djava.awt.headless=true -Duser.timezone=Asia/Kolkata -Dorg.apache.commons.jelly.tags.fmt.timeZone=Asia/Kolkata"
TZCONF

# ---- Jenkins LTS ----
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key \
  -o /usr/share/keyrings/jenkins-keyring.asc
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  > /etc/apt/sources.list.d/jenkins.list
apt-get update
apt-get install -y jenkins

# ---- Docker ----
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker jenkins

# ---- AWS CLI v2 ----
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/aws /tmp/awscliv2.zip

# ---- Node 22 (for running tests on the Jenkins host) ----
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# ---- nginx reverse proxy for Jenkins ----
cat > /etc/nginx/sites-available/jenkins <<'NGINX'
server {
    listen 80;
    server_name ${jenkins_domain};

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/jenkins /etc/nginx/sites-enabled/jenkins
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---- certbot (Let's Encrypt) ----
snap install core && snap refresh core
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot

# Issue the certificate once DNS resolves to this instance; retry via cron
# until it succeeds (Route 53 record is created by Terraform in parallel).
cat > /usr/local/bin/issue-jenkins-cert.sh <<'CERT'
#!/bin/bash
if [ -d "/etc/letsencrypt/live/${jenkins_domain}" ]; then exit 0; fi
certbot --nginx --non-interactive --agree-tos \
  -m ${letsencrypt_email} -d ${jenkins_domain} --redirect && \
  (crontab -l 2>/dev/null | grep -v issue-jenkins-cert || true) | crontab -
CERT
chmod +x /usr/local/bin/issue-jenkins-cert.sh
(crontab -l 2>/dev/null; echo "*/10 * * * * /usr/local/bin/issue-jenkins-cert.sh >> /var/log/issue-jenkins-cert.log 2>&1") | crontab -

systemctl enable --now jenkins docker nginx
echo "Jenkins bootstrap complete. Initial admin password: /var/lib/jenkins/secrets/initialAdminPassword"
