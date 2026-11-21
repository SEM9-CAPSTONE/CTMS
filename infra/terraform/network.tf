# Custom VPC Network for CTMS
resource "google_compute_network" "vpc" {
  name                    = "ctms-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.compute]
}

# Subnet in Singapore region
resource "google_compute_subnetwork" "subnet" {
  name          = "ctms-subnet-${var.region}"
  ip_cidr_range = "10.10.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
}

# Static External Public IP for the server
resource "google_compute_address" "static_ip" {
  name         = "ctms-static-ip"
  region       = var.region
  address_type = "EXTERNAL"
  network_tier = "PREMIUM"
  depends_on   = [google_project_service.compute]
}

# Firewall rule: Allow HTTP (80) and HTTPS (443) from everywhere
resource "google_compute_firewall" "allow_web" {
  name    = "ctms-allow-web"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ctms-web-server"]
}

# Firewall rule: Allow SSH (22) for remote management
resource "google_compute_firewall" "allow_ssh" {
  name    = "ctms-allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ctms-web-server"]
}

# Firewall rule: Allow internal communication within the subnet
resource "google_compute_firewall" "allow_internal" {
  name    = "ctms-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "icmp"
  }

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  source_ranges = ["10.10.0.0/24"]
}
