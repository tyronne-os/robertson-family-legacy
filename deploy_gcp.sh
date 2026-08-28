#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Robertson Photo Lab — GCP Spot VM provisioner
# Usage: bash deploy_gcp.sh [project-id] [zone]
# Defaults: project from gcloud config, zone us-central1-a
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="${1:-$(gcloud config get-value project)}"
ZONE="${2:-us-central1-a}"
INSTANCE="robertson-photo-lab"
MACHINE="n1-standard-4"
ACCELERATOR="type=nvidia-tesla-t4,count=1"
IMAGE_FAMILY="pytorch-2-2-cu121-ubuntu-2204-py310"
IMAGE_PROJECT="deeplearning-platform-release"

echo "▶ Creating Spot VM: $INSTANCE in $ZONE …"
gcloud compute instances create "$INSTANCE" \
  --project="$PROJECT" \
  --zone="$ZONE" \
  --machine-type="$MACHINE" \
  --accelerator="$ACCELERATOR" \
  --maintenance-policy=TERMINATE \
  --provisioning-model=SPOT \
  --instance-termination-action=STOP \
  --image-family="$IMAGE_FAMILY" \
  --image-project="$IMAGE_PROJECT" \
  --boot-disk-size=100GB \
  --boot-disk-type=pd-ssd \
  --metadata=startup-script='#!/bin/bash
set -e
cd /opt
git clone https://github.com/PLACEHOLDER/robertson-photo-lab || true
cd robertson-photo-lab

# Install Python deps
pip install -q fastapi uvicorn[standard] pillow \
  transformers accelerate bitsandbytes \
  "torch>=2.2" --extra-index-url https://download.pytorch.org/whl/cu121

# Install NVIDIA drivers if not present
nvidia-smi || (
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia.gpg
  apt-get update -q && apt-get install -y -q nvidia-driver-525
)

# Write systemd service
cat > /etc/systemd/system/photo-lab.service <<EOF
[Unit]
Description=Robertson Photo Lab API
After=network.target

[Service]
WorkingDirectory=/opt/robertson-photo-lab
ExecStart=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --workers 1
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable photo-lab
systemctl start photo-lab
echo "Photo Lab service started."
'

echo ""
echo "▶ Opening firewall port 8000 …"
gcloud compute firewall-rules create allow-photo-lab \
  --project="$PROJECT" \
  --allow=tcp:8000 \
  --target-tags=photo-lab \
  --description="Robertson Photo Lab API" 2>/dev/null || true

gcloud compute instances add-tags "$INSTANCE" \
  --project="$PROJECT" \
  --zone="$ZONE" \
  --tags=photo-lab

EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE" \
  --project="$PROJECT" \
  --zone="$ZONE" \
  --format="get(networkInterfaces[0].accessConfigs[0].natIP)")

echo ""
echo "✓ VM ready.  External IP: $EXTERNAL_IP"
echo "  Backend URL: http://$EXTERNAL_IP:8000"
echo "  Health check: curl http://$EXTERNAL_IP:8000/api/health"
echo ""
echo "  Set in your .env:"
echo "  VITE_GCP_BACKEND_URL=http://$EXTERNAL_IP:8000"
