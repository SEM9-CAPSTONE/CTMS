# Triển khai CTMS lên dev.ditrek.io.vn

Terraform quản lý VM Google Cloud và IP tĩnh. Docker Compose chạy CTMS trên VM với cơ sở dữ liệu riêng. Caddy cấp HTTPS và chuyển tiếp các yêu cầu đến Nginx.

## 1. Bật VM bằng Terraform

Chạy từ thư mục gốc của repo trên máy có `infra/terraform/terraform.tfvars` và state đang quản lý VM `ctms-server`. Tệp cấu hình dev dùng lại dự án và thông tin xác thực Google Cloud từ `terraform.tfvars`.

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

Nếu địa chỉ mong muốn là `dev.ditrekditrek.io.vn`, cần quyền quản lý tên miền `ditrekditrek.io.vn`. Khi có quyền, sửa `domain_name` và `dns_zone_name` trong một bản sao của `dev.tfvars.example`, dùng tệp đó với `-var-file` và đặt `CTMS_DEV_DOMAIN` tương ứng trên VM.

## 3. Chuẩn bị cấu hình trên VM

Trên VM, xác nhận cổng 80 và 443 có sẵn cho Caddy. Nếu đang thiết lập mới, tạo `~/ctms-dev/.env.dev` từ `.env.dev.example` với quyền đọc riêng. Điền tên miền dev, mật khẩu PostgreSQL riêng cho dev và `JWT_SECRET` riêng. Có thể dùng `openssl rand -hex 32` để tạo mỗi giá trị bí mật. Dùng thông tin tích hợp dành riêng cho dev nếu cần bật email, xác thực Google hoặc thanh toán.

```bash
cd ~/ctms-dev
(umask 077; cp -n .env.dev.example .env.dev)
```

Nếu kho image riêng tư, dùng `sudo docker login` trên VM với tài khoản có quyền pull. Job chạy qua tài khoản SSH có quyền đọc `~/ctms-dev/.env.dev` và chạy `sudo -n docker`.

## 4. Bật triển khai tự động

Trong **Settings → Secrets and variables → Actions** của repo GitHub, thiết lập các biến và secret sau.

| Tên | Loại | Giá trị |
| --- | --- | --- |
| `ENABLE_DEPLOY_DEV` | Variable | `true` |
| `DOCKERHUB_USERNAME` | Secret | Tên tài khoản Docker Hub dùng để push image |
| `DOCKERHUB_TOKEN` | Secret | Token Docker Hub có quyền push image |
| `DEV_VPS_HOST` | Secret | Địa chỉ SSH của VM, ví dụ `dev.ditrek.io.vn` khi DNS trỏ thẳng đến VM |
| `DEV_VPS_USER` | Secret | Tài khoản SSH sở hữu thư mục `~/ctms-dev`, ví dụ `dklinh05` |
| `DEV_VPS_SSH_PRIVATE_KEY` | Secret | Nội dung khóa riêng dành cho job deploy dev |
| `DEV_VPS_SSH_KNOWN_HOSTS` | Secret | Dòng `known_hosts` chứa khóa máy chủ đã xác minh |
| `DEV_VPS_SSH_PORT` | Variable | Đặt nếu cổng SSH khác `22` |
| `DEV_PUBLIC_URL` | Variable | Đặt nếu URL public khác `https://dev.ditrek.io.vn` |
| `MOBILE_GOOGLE_SERVER_CLIENT_ID` | Variable | Tùy chọn; đặt nếu muốn dùng Google OAuth client riêng cho Mobile PWA (mặc định dùng chung `VITE_GOOGLE_CLIENT_ID` nếu có) |

Tạo cặp khóa riêng cho job deploy. Trong PowerShell, chạy lệnh sau và nhấn Enter ở cả hai lần hỏi passphrase để runner có thể kết nối ở chế độ không tương tác.

```powershell
$ctmsSshDirectory = Join-Path $env:USERPROFILE '.ssh'
New-Item -ItemType Directory -Path $ctmsSshDirectory -Force | Out-Null
ssh-keygen -t ed25519 -C 'ctms-dev-github-actions' -f (Join-Path $ctmsSshDirectory 'ctms-dev-github-actions')
```

Cấp khóa `.pub` cho tài khoản `DEV_VPS_USER` theo cách VM đang quản lý SSH. Lưu nội dung file khóa riêng vào `DEV_VPS_SSH_PRIVATE_KEY`.

Trong phiên SSH VM đã xác minh, lấy nội dung cho `DEV_VPS_SSH_KNOWN_HOSTS` bằng lệnh sau. Dùng tên host đúng với `DEV_VPS_HOST`. Nếu dùng cổng khác `22`, phần đầu dòng có dạng `[host]:cổng`.

```bash
printf 'dev.ditrek.io.vn %s\n' "$(sudo cat /etc/ssh/ssh_host_ed25519_key.pub)"
test -r "$HOME/ctms-dev/.env.dev" && sudo -n docker compose version
```

Khi cấu hình đã vào `develop`, mỗi lần push hoặc merge vào nhánh này sẽ chạy **Deploy Dev**. Hai job **Build Dev Images** (4 image Docker) và **Build Dev Mobile PWA** (`flutter build web --release --base-href /mobile/ --dart-define=API_BASE_URL=${DEV_PUBLIC_URL}/api`) chạy song song. Khi cả hai hoàn tất, job **Deploy to Dev VM** đóng gói cấu hình và bản build `mobile-web` vào `~/.ctms-dev-ci/releases/`, dùng thẻ `dev-<SHA>` và cập nhật project Compose `ditrek-dev` với `.env.dev` trên VM. Nginx phục vụ Mobile PWA tại `/mobile/` với header `Cache-Control: no-cache` để trình duyệt và PWA cài trên màn hình chính iPhone luôn kiểm tra bản mới mỗi lần tải. Workflow tự kiểm tra `/`, `/api/health`, `/mobile/`, header cache và `/mobile/version.json` qua HTTPS sau khi nạp lại Nginx.

## 5. Triển khai thủ công

Để triển khai trực tiếp trên VM, checkout đúng SHA đã build trong `~/ctms-dev`, đặt bản build Flutter Web (`apps/mobile/build/web`) vào `~/ctms-dev/mobile-web` (hoặc đặt `CTMS_MOBILE_WEB_DIR` trong `.env.dev`), rồi đặt `CTMS_IMAGE_NAMESPACE` và `CTMS_IMAGE_TAG=dev-<SHA đầy đủ>` trong `.env.dev`. Chạy các lệnh sau trong thư mục này.

```bash
ctms_dev() {
  sudo docker compose -p ditrek-dev --env-file .env.dev \
    -f docker-compose.yml -f docker-compose.prod.yml \
    -f docker-compose.dev.yml -f docker-compose.registry.yml "$@"
}

ctms_dev config --quiet &&
  ctms_dev pull &&
  ctms_dev up -d --no-build --wait --wait-timeout 300 &&
  ctms_dev exec -T nginx nginx -t &&
  ctms_dev exec -T nginx nginx -s reload
```

Nếu checkout thay đổi cấu hình Nginx hoặc Caddy, chạy `ctms_dev up -d --no-build --force-recreate --wait nginx caddy` để cập nhật các tệp gắn vào container.

Kiểm tra web, API và Mobile PWA sau khi chứng chỉ được cấp.

```bash
curl --fail --silent --show-error --output /dev/null https://dev.ditrek.io.vn/
curl --fail --silent --show-error https://dev.ditrek.io.vn/api/health
curl --fail --silent --show-error --head https://dev.ditrek.io.vn/mobile/
curl --fail --silent --show-error https://dev.ditrek.io.vn/mobile/version.json
```

