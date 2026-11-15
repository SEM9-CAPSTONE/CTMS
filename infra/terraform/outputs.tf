output "static_ip" {
  description = "Public Static IP address for the CTMS server. Point your DNS A record to this IP."
  value       = google_compute_address.static_ip.address
}

output "instance_name" {
  description = "The name of the VM instance"
  value       = google_compute_instance.server.name
}

output "instance_zone" {
  description = "The zone of the VM instance"
  value       = google_compute_instance.server.zone
}

output "domain_name" {
  description = "The configured domain name"
  value       = var.domain_name
}

output "dns_records_to_add" {
  description = "DNS records you need to add at your domain registrar (e.g. Cloudflare, Namecheap, etc.)"
  value = {
    record_root = "Type: A | Host: @ | Value: ${google_compute_address.static_ip.address}"
    record_www  = "Type: A | Host: www | Value: ${google_compute_address.static_ip.address}"
  }
}
