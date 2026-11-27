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

locals {
  dns_zone_name = coalesce(var.dns_zone_name, var.domain_name)
  dns_subdomain = trimsuffix(var.domain_name, ".${local.dns_zone_name}")
}

output "dns_records_to_add" {
  description = "A records to create at the authoritative DNS provider for the configured hostname"
  value = var.domain_name == local.dns_zone_name ? tomap({
    record_root = "Type: A | Host: @ | Value: ${google_compute_address.static_ip.address}"
    record_www  = "Type: A | Host: www | Value: ${google_compute_address.static_ip.address}"
    }) : tomap({
    record_subdomain = "Type: A | Host: ${local.dns_subdomain} | Value: ${google_compute_address.static_ip.address}"
  })

  precondition {
    condition     = var.domain_name == local.dns_zone_name || endswith(var.domain_name, ".${local.dns_zone_name}")
    error_message = "The hostname must be in the configured DNS zone."
  }
}
