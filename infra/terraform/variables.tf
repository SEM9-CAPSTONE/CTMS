variable "project_id" {
  description = "The Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region for resources (e.g. asia-southeast1 for Singapore)"
  type        = string
  default     = "asia-southeast1"
}

variable "zone" {
  description = "Google Cloud zone for the VM"
  type        = string
  default     = "asia-southeast1-b"
}

variable "credentials_file" {
  description = "Local path to the GCP Service Account JSON key"
  type        = string
}

variable "domain_name" {
  description = "Public hostname served by the VM"
  type        = string
  default     = "ditrek.io.vn"
}

variable "dns_zone_name" {
  description = "DNS zone containing domain_name. Defaults to domain_name for an apex deployment."
  type        = string
  default     = null
}

variable "instance_status" {
  description = "Desired power state for the VM"
  type        = string
  default     = "TERMINATED"

  validation {
    condition     = contains(["RUNNING", "TERMINATED"], var.instance_status)
    error_message = "Set instance_status to RUNNING or TERMINATED."
  }
}

variable "machine_type" {
  description = "Compute Engine machine type (Gói A: e2-medium, Gói B: e2-standard-2)"
  type        = string
  default     = "e2-medium"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB (Balanced SSD)"
  type        = number
  default     = 30
}

variable "environment" {
  description = "Deployment environment tag"
  type        = string
  default     = "production"
}
