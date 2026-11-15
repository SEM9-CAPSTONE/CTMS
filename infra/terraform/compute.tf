# Compute Engine Instance for CTMS
resource "google_compute_instance" "server" {
  name           = "ctms-server"
  machine_type   = var.machine_type
  zone           = var.zone
  desired_status = "TERMINATED" # Dừng máy ảo để tiết kiệm chi phí qua đêm
  tags           = ["ctms-web-server"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.disk_size_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id
    access_config {
      nat_ip = google_compute_address.static_ip.address
    }
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    set -e

    # 1. Setup 4GB Swap file to prevent Out-Of-Memory (OOM) on e2-medium
    if [ ! -f /swapfile ]; then
        echo "Creating 4GB swapfile..."
        fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        sysctl vm.swappiness=10
        echo 'vm.swappiness=10' >> /etc/sysctl.conf
    fi

    # 2. Update and install packages
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release git htop jq

    # 3. Install Docker & Docker Compose Plugin
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl enable docker
    systemctl start docker

    # 4. Prepare deployment directory
    mkdir -p /opt/ctms
    chmod 755 /opt/ctms

    echo "Server initialization completed at $(date)" > /var/log/ctms-init.log
  EOF

  lifecycle {
    ignore_changes = [metadata_startup_script]
  }

  depends_on = [
    google_project_service.compute,
    google_compute_subnetwork.subnet,
    google_compute_address.static_ip
  ]
}
