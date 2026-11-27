# Triển khai CTMS lên dev.ditrek.io.vn

Terraform quản lý VM Google Cloud và IP tĩnh. Docker Compose chạy CTMS trên VM với cơ sở dữ liệu riêng. Caddy cấp HTTPS và chuyển tiếp các yêu cầu đến Nginx.

## 1. Chuẩn bị VM dev

Môi trường dev dùng VM `ctms-server` trên Google Cloud. Có thể bật VM từ **Compute Engine → VM instances → ctms-server → Start**.

Nếu dùng Terraform, chạy từ thư mục gốc trên máy đang giữ state của VM và bộ cấu hình dev cục bộ gồm `infra/terraform/terraform.tfvars` và `infra/terraform/dev.tfvars.example`.

```powershell
terraform '-chdir=infra/terraform' init
terraform '-chdir=infra/terraform' state list
terraform '-chdir=infra/terraform' plan '-var-file=dev.tfvars.example'
terraform '-chdir=infra/terraform' apply '-var-file=dev.tfvars.example'
terraform '-chdir=infra/terraform' output dns_records_to_add
```

Với state hiện tại, kế hoạch dự kiến bật lại VM tại chỗ. Kiểm tra kế hoạch trước khi xác nhận `apply`. Sau đó đợi VM hoàn tất khởi động và kiểm tra `docker compose version` trên máy chủ. Cấu hình cần Docker Compose 2.24.4 trở lên.

## 2. Thêm bản ghi trên Cloudflare

`ditrek.io.vn` được mua qua Tenten và đang dùng nameserver của Cloudflare. Vào **Cloudflare → ditrek.io.vn → DNS → Records → Add record** và điền bản ghi sau. [Hướng dẫn Cloudflare](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-subdomain/)

| Trường | Giá trị |
| --- | --- |
| Type | `A` |
| Name | `dev` |
| IPv4 address | IP từ `terraform output -raw static_ip` trong `infra/terraform` |
| Proxy status | `DNS only` |
| TTL | `Auto` |

DNS trả về IP thật để Caddy xác thực quyền sở hữu tên miền qua cổng 80 hoặc 443. [Hướng dẫn HTTPS tự động của Caddy](https://caddyserver.com/docs/automatic-https)

```powershell
Resolve-DnsName dev.ditrek.io.vn -Type A
```

## 3. Triển khai ứng dụng trên VM

Khi cấu hình này đã có trên nhánh `develop`, bật biến GitHub Actions `ENABLE_DEPLOY_DEV=true` và thiết lập hai secret `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`. Workflow **Deploy Dev** chạy khi có push lên `develop` và xuất bốn image theo cùng mã commit. Dùng bản checkout đúng commit đã build trên VM. Nếu kho image riêng tư, đăng nhập Docker Hub bằng tài khoản có quyền pull.

Trên VM, xác nhận cổng 80 và 443 có sẵn cho Caddy. Trong thư mục gốc của checkout, tạo `.env.dev` từ `.env.dev.example` với quyền đọc riêng. Điền tên Docker Hub, thẻ `dev-<mã commit đầy đủ>` vào `CTMS_IMAGE_TAG`, mật khẩu PostgreSQL riêng cho dev và `JWT_SECRET` riêng. Có thể dùng `openssl rand -hex 32` để tạo mỗi giá trị bí mật. Dùng thông tin tích hợp dành riêng cho dev nếu cần bật email, xác thực Google hoặc thanh toán.

```bash
(umask 077; cp -n .env.dev.example .env.dev)
```

Sau khi điền `.env.dev`, chạy các lệnh sau trên VM.

```bash
ctms_dev() {
  docker compose -p ditrek-dev --env-file .env.dev \
    -f docker-compose.yml -f docker-compose.prod.yml \
    -f docker-compose.dev.yml -f docker-compose.registry.yml "$@"
}

ctms_dev config --quiet &&
  ctms_dev pull &&
  ctms_dev up -d --no-build --wait --wait-timeout 300
```

Kiểm tra web và API sau khi chứng chỉ được cấp.

```bash
curl --fail --silent --show-error --output /dev/null https://dev.ditrek.io.vn/
curl --fail --silent --show-error https://dev.ditrek.io.vn/api/health
```

Để cập nhật bản dev, chờ workflow build xong, cập nhật checkout và `CTMS_IMAGE_TAG` trên VM rồi chạy lại ba lệnh Compose. Nếu sửa các tệp cấu hình Nginx hoặc Caddy, chạy thêm `ctms_dev up -d --no-build --force-recreate --wait nginx caddy` để đọc cấu hình mới.
