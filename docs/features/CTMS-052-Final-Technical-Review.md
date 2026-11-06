**CTMS-52 — Final Technical Review & Readiness Assessment**  
Ngày: 06/11/2026 · Phạm vi: source hiện tại trong `D:\Capstone\CTMS`, repo spec và BR-229/230/365/428/212/213.  
**Verdict: NOT COMPLETE.**

Có một lỗi P1 được tái hiện bằng hai test chạy thật: feed hazard **tùy chọn đã hết hạn** vẫn có thể được ghi `NO_ACTIVE_ALERT` trong manifest. Đây là trách nhiệm CTMS-52. Ngoài ra, lượt chạy lại PostgreSQL integration và E2E đều bị `EACCES`; không được ghi PASS cho những lượt chạy này.

Theo tiêu chí nghiệm thu mới của yêu cầu review, CTMS-52 **có thể hoàn thành độc lập với implementation upstream/downstream**, khi contracts và fixture cùng migration/integration/E2E đã được chứng minh. Thiếu crawler chính phủ, UI Host verification, UI Admin applicability hoặc mobile downloader không tự động chặn nghiệm thu độc lập. Các phần đó vẫn chặn vận hành nguồn thật nếu chưa tích hợp. Kết luận hiện tại xuất phát từ lỗi thuộc generator và bằng chứng E2E còn thiếu, không xuất phát riêng từ việc upstream chưa triển khai.

**Quy ước bằng chứng**

- `PASS`: source/contract đã kiểm tra hoặc test được chạy thành công trong lượt review này; phạm vi được ghi rõ từng dòng.
- `FAIL`: có assertion thất bại thực tế, chỉ rõ expected/actual.
- `BLOCKED`: lượt chạy database/E2E hiện tại dừng trước setup vì môi trường. Source chứng minh implementation tồn tại nhưng không thay thế execution.
- Screenshot 14/14 PASS do người dùng cung cấp trước review là **bằng chứng lịch sử độc lập**, được giữ lại; không chuyển kết quả rerun `EACCES` thành PASS.
- `PROCESSING` trong câu hỏi tương ứng với **`GENERATING`** trong enum, SQL và spec hiện hành. Không có state tên `PROCESSING`; đây là mapping thuật ngữ, không phải thiếu bước xử lý.

**1. Source evidence index**

| ID | File / method thực tế | Điều được chứng minh |
| --- | --- | --- |
| E01 | [1794200000000-CreateOfflinePackages.ts](sandbox:/D:/Capstone/CTMS/services/api/src/migrations/1794200000000-CreateOfflinePackages.ts), `CreateOfflinePackages1794200000000.up()`, function `offline_package_on_publication` dòng 54, trigger dòng 62; `down()` | Trigger sau INSERT/UPDATE status `published`, request `initial` unique, cùng transaction; backfill; up/down. Unique version/generation key và trigger chặn UPDATE/DELETE READY. |
| E02 | [offline-packages.repository.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/offline-packages.repository.ts), `request()`, `claim()` dòng 38, `heartbeat()`, `assertLease()`, `complete()`, `fail()` dòng 97 | Chặn request khi Trip không published, claim SKIP LOCKED, lease token/expiry, retry tối đa 3, business BLOCKED, atomic READY và audit; `$3::varchar` đã sửa. |
| E03 | [offline-packages.worker.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/offline-packages.worker.ts), `onModuleInit()` dòng 21, `tick()`, `processOne()` dòng 52 | Worker tự khởi động ngoài test nếu enabled, polling, một tick đang chạy, heartbeat và chuyển failure sang repository. |
| E04 | [offline-packages.service.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/offline-packages.service.ts), `selection()` dòng 93, `generate()` dòng 105, `cleanupOrphans()` dòng 213 | REPEATABLE READ, validation, build, storage; final locked revalidation; reuse generation key; version allocation; commit metadata/job; orphan receipts. |
| E05 | [package-core.reader.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/package-core.reader.ts), `PackageCoreReader.read(manager, tripId, lock)` | Projection Route, tất cả checkpoints cùng route và waypoints của Trip; PostGIS GeoJSON; final SHARE table locks phủ INSERT/UPDATE/DELETE. |
| E06 | [package-policy.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/package-policy.ts), `TripSafetyContextResolver.resolve()` dòng 71, `EligibleHazardResolver.resolve()` dòng 110 | Evidence/UNKNOWN, cùng normalized shape cho government/field; kiểm tra spatial, expiry và Host decision; loại UNVERIFIED/REJECTED/REVOKED/HOST_DEFINED. |
| E07 | Cùng [package-policy.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/package-policy.ts), `ApprovedGuidanceSelector.select()` dòng 186, `PackageEligibilityValidator.validate()` dòng 264 | Published exact version, rights OFFLINE, READY chunks/checksum/page refs, approval/applicability, baseline/condition/hazard coverage, privacy và required feeds. |
| E08 | [package-artifact.builder.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/package-artifact.builder.ts), `build()`, `verify()`; source summary dòng 138, outcome dòng 146 | Sáu ZIP entries, explicit projections, source/version references, manifest và payload hashes; nơi tái hiện P1 freshness. |
| E09 | [package-artifact.storage.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/package-artifact.storage.ts), `PackageArtifactStorage`, `LocalPackageArtifactStorage.put()` dòng 31, `read()` dòng 74 | Storage port có thật; private root, exclusive no-replace copy, size/hash check, cleanup tệp tạm. |
| E10 | [offline-packages.types.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/offline-packages.types.ts), `NormalizedPackageHazard` dòng 108, `ApprovedGuidanceUnit` dòng 144, `ApprovedPackagePolicy` dòng 166, `OfflineSafetySources.read()` dòng 188, `PackageManifest` dòng 208, `ReadyPackageMetadata` dòng 249 | Các input/output contracts thực sự tồn tại. `read(EntityManager, PackageCore, lock)` là DB-only consistent-snapshot port, không phải API gọi provider trực tiếp. |
| E11 | [offline-packages.module.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/offline-packages.module.ts), bindings và exports; [app.module.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/app.module.ts); [offline-safety-sources.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/offline-safety-sources.ts), `UnavailableOfflineSafetySources.read()` | Module được đăng ký; production source binding hiện fail closed với ba blocker; service được export. |
| E12 | [offline-packages.service.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/offline-packages.service.ts), `requestImpact()` dòng 55, `getReadyMetadata()` dòng 63, `getManifest()`, `readArtifact()` dòng 82 | Contract cho 119 yêu cầu vN+1; metadata/manifest/verified Buffer cho downstream, không có public manual-create/download endpoint. |
| E13 | [offline-packages.integration-spec.ts](sandbox:/D:/Capstone/CTMS/services/api/test/offline-packages.integration-spec.ts), 14 cases, dòng 163–365 | Migration/rollback/concurrent generation/lease/retry/immutability/storage failure. Test setup dùng PostgreSQL/PostGIS và filesystem thật; upstream publications là fixture. |
| E14 | [package-readiness.spec.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/package-readiness.spec.ts), hai freshness cases và stored-artifact case; [offline-packages.e2e-spec.ts](sandbox:/D:/Capstone/CTMS/services/api/test/offline-packages.e2e-spec.ts), case dòng 121 | Regression tái hiện P1; kiểm tra actual ZIP độc lập; E2E mới qua Nest module và worker. |

Các BR và phạm vi được đối chiếu với [ctms-52 spec](sandbox:/D:/Capstone/CTMS/file/spec/ctms-52-create-offline-package-for-each-trip.md), [upstream contracts](sandbox:/D:/Capstone/CTMS/file/spec/ctms-52-upstream-safety-contracts.md), [Route Safety v2](sandbox:/D:/Capstone/CTMS/docs/business-rules/route-safety-v2.md) và các amendment 050/051/053/054/055/119. `TripsService.review()` trong [trips.service.ts](sandbox:/D:/Capstone/CTMS/services/api/src/modules/trips/services/trips.service.ts) cập nhật `TripStatus.PUBLISHED` trong TypeORM transaction; trigger E01 là điểm tích hợp của 052. Không cần thêm business logic build package vào TripsService.

**2. Acceptance Criteria → Evidence → Result**

| AC / BR | Evidence và giới hạn | Result hiện tại |
| --- | --- | --- |
| Trip published tự tạo job — AC02, BR-229 | E01 có trigger và backfill; E13 case publication rollback/dedup, trước đây người dùng đã chạy PASS. Rerun hiện tại không vào được setup DB. | BLOCKED execution; implementation có |
| `PENDING → GENERATING → READY` khi inputs hợp lệ — AC02/16 | E02/E03/E04 có đủ transition. E13 trước đây gọi `claim()`/`generate()` trực tiếp. E2E E14 mới kiểm tra worker tự chạy và audit thật. | BLOCKED E2E |
| Trip draft/pending/ongoing bị chặn — AC01, BR-229 | E02 `request()` và E07; policy tests của ba trạng thái chạy PASS. | PASS unit/policy; DB rerun BLOCKED |
| Thiếu required checkpoints/waypoints hoặc cross-route/checkpoint — AC04, BR-365 | E05/E07; policy tests sparse/cross-reference PASS. E13 có test thiếu waypoint. | PASS unit; DB rerun BLOCKED |
| Official feed checked EMPTY không suy ra SAFE — AC05 | Policy/ZIP test với successful EMPTY PASS; manifest ghi `NO_ACTIVE_ALERT`, giữ checkedAt/validity. | PASS cho feed hợp lệ |
| Required hazard unavailable/expired và Guidance thiếu rights/approval/coverage bị chặn — AC06/11 | E07, production adapter E11; unit tests PASS cho thiếu policy, approval, OFFLINE rights, READY state, page refs và coverage. Durable `BLOCKED` cần DB case E13. | PASS policy; durable transition BLOCKED |
| Optional expired feed không bị biến thành no-alert — AC06, G03 | E08 outcome chỉ xem status AVAILABLE/EMPTY; E07 chỉ kiểm tra validity của required government feeds. E14 có hai assertion `UNKNOWN` nhưng nhận `NO_ACTIVE_ALERT`. | **FAIL — P1** |
| Government và valid Host-verified field được xét cùng contract — AC08 | E06/E10; Host decision/authorization/version/evidence/expiry guards; eligible field unit test PASS. Actual local ZIP E14 chứa cả hai source types. | PASS contract + local artifact |
| UNVERIFIED/REJECTED/REVOKED/HOST_DEFINED bị loại; resolved không phải verified — AC07/09 | E06 switch/decision checks; unit tests kiểm tra decision thiếu, unauthorized, rejected/revoked và HOST_DEFINED/FIELD_OBSERVATION. | PASS policy/code |
| Guidance đúng applicability, không suy forest/near-water thành diving/crossing — AC10/11 | E06/E07 evidence states và inclusion/exclusion; policy tests crossing UNKNOWN/CONFIRMED, diving, exclusions và rights/version PASS. | PASS |
| Route/Checkpoints/Waypoints/Hazard/Guidance được đóng gói đầy đủ — BR-229/365 | E08 explicit projection; actual stored ZIP E14 có route, 1 checkpoint, 2 waypoints, 2 hazards (government + field) và 1 complete guidance unit. | PASS local filesystem fixture; DB→worker E2E BLOCKED |
| Immutable snapshot, manifest, source refs, payload/whole-ZIP SHA-256 — BR-428, AC13/14 | E01/E04/E08/E09; actual file SHA-256 được tính lại bằng Node crypto và PowerShell, payload hashes khớp. Immutable DB trigger/v1 preservation nằm trong E13. | PASS file/integrity; DB immutability rerun BLOCKED |
| Retry/concurrent workers không tạo trùng — AC03/16 | E02 lease/SKIP LOCKED; E04 advisory lock và reuse; E01 UNIQUE constraints. E13 có concurrent claims + impacts, third-attempt crash và lease recovery. | BLOCKED DB rerun; prior 14/14 evidence retained |
| Source đổi trong lúc build không có mixed READY — AC12 | E04 re-read locked inputs/fingerprints/revision/selection; E13 source withdrawal/core edit cases. | BLOCKED DB rerun; source implementation có |
| Không đóng personal medical/actor IDs vào shared payload — BR-230, AC15 | E07 personal flags; E08 field allowlists và evidence fingerprint; privacy unit tests PASS. E2E mới bổ sung raw Host/report/evidence exclusion khi có field hazard. | PASS unit/projection; E2E BLOCKED |
| BR-212/213 spec và tests phản ánh đầy đủ acceptance | Spec/contracts có; phát hiện thêm hai negative tests FAIL và E2E chưa chạy thành công trong review. | FAIL để nghiệm thu cuối |

**3. Kết quả thực thi trong lượt review**

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| API typecheck `tsc --noEmit` | PASS, exit 0 |
| Typecheck cả source, integration, review regression và E2E mới | PASS, exit 0: `Source and review/E2E test typecheck passed` |
| Biome cho module/migration/integration/E2E/fixture | PASS: 18 files, no fixes ở checkpoint cuối |
| Unit + focused regression sau thêm review cases | **FAIL: 2 failed, 188 passed, 190 total; 1 failed / 8 passed suites**, 10.449s. Hai failure là P1 freshness; actual ZIP case PASS. |
| Rerun đúng 14 integration tests | **BLOCKED**: exit 1, `connect EACCES 127.0.0.1:55451`, trước global setup/migration. Không có migration statement nào được chứng minh chạy trong lần này. |
| E2E mới, DB publish → real Nest worker → persisted ZIP | **BLOCKED**: exit 1, cùng `EACCES 127.0.0.1:55451`, trước setup. Đã thử chạy cấu hình E2E thật; không ghi PASS. |
| Compose test config và `git diff --check` | PASS |
| Bằng chứng lịch sử do người dùng cung cấp | 14/14 integration PASS, 1 suite, 3.784s, sau sửa `$3::varchar`. Đây là lượt khác, chưa có E2E worker mới và chưa cover hai freshness cases. |

Nguyên nhân xác minh bị chặn hiện tại: runtime của agent bị từ chối mở kết nối TCP đến PostgreSQL test; stack dừng tại `TCPConnectWrap.afterConnect`. Không phải lỗi assertion của suite, và không chứng minh database trên máy người dùng đang hỏng. Chưa có bằng chứng xác định thành phần quyền/ACL cụ thể nào phát sinh `EACCES`; không tự suy ra nguyên nhân sâu hơn từ log này.

Các lệnh đã chạy, từ `D:\Capstone\CTMS`:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://ctms:ctms@127.0.0.1:55451/ctms_test'
node services/api/node_modules/jest/bin/jest.js --config services/api/test/jest-integration.json --runInBand --cacheDirectory D:/Capstone/CTMS/services/api/test-results/ctms52-jest-cache --testPathPattern offline-packages.integration-spec
node services/api/node_modules/jest/bin/jest.js --config services/api/test/jest-e2e.json --runInBand --cacheDirectory D:/Capstone/CTMS/services/api/test-results/ctms52-jest-cache --testPathPattern offline-packages.e2e-spec
```

```text
Error: connect EACCES 127.0.0.1:55451
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1611:16)
```

```powershell
node services/api/node_modules/jest/bin/jest.js --config services/api/jest.config.js --runInBand --cacheDirectory D:/Capstone/CTMS/services/api/test-results/ctms52-jest-cache --testPathPattern 'offline-packages|source-policy.spec|knowledge-chunks.policy.spec|trips.di.spec|trips.service.spec|route-safety.service.spec' --json --outputFile services/api/test-results/ctms52-final-review-unit.json
```

**Actual artifact evidence — PASS ở phạm vi filesystem**

- [Fixture ZIP đã lưu](sandbox:/D:/Capstone/CTMS/services/api/test-results/ctms52-final-review-artifact/3e92dd83cada6a53b80ee98340e2c052ebc5316dcfcfd355a2331ea010dd09c8.zip): **5908 bytes**.
- SHA-256: `3e92dd83cada6a53b80ee98340e2c052ebc5316dcfcfd355a2331ea010dd09c8`.
- Đọc lại bằng `fs.readFile`, tính `createHash("sha256")` độc lập và đối chiếu từng payload. PowerShell `Get-FileHash -Algorithm SHA256` trả cùng digest.
- [evidence.json](sandbox:/D:/Capstone/CTMS/services/api/test-results/ctms52-final-review-artifact/evidence.json) lưu exact path/size/digests, `fixtureOnly: true`, `databaseUsed: false`.
- Đây là artifact thật trên filesystem với nội dung thử nghiệm; **không phải** bằng chứng database→worker E2E hay nguồn safety thật đã được tích hợp.

E2E mới không gọi trực tiếp `service.generate()`/`repo.complete()`: cập nhật Trip published trong PostgreSQL, kiểm tra request PENDING từ trigger, khởi tạo `OfflinePackagesModule` với worker enabled, chờ READY, kiểm tra audit GENERATING/READY, đọc actual ZIP và tính lại hashes. Chỉ thay binding `OfflineSafetySources` bằng fixture được lưu/khóa trong PostgreSQL. Test dùng minimal core tables tương ứng các cột generator đọc; không kiểm tra HTTP/auth của CTMS-023, provider ingestion hay mobile, vốn nằm ngoài boundary của 052. Chưa thể thực thi thành công E2E này trong runtime hiện tại.

**4. Extensibility & architecture assessment**

| Câu hỏi | Đánh giá có điều kiện và bằng chứng |
| --- | --- |
| Government và field dùng chung Hazard Contract? | Có: E10 `NormalizedPackageHazard.sourceType`, `hostDecision`, `PackageSafetyInputs.hazards`; E06 dùng chung `resolve()`, riêng source/verification checks. Không cần viết lại ZIP builder để thêm field feed đúng contract. |
| Admin applicability có thể nối sau? | Có: E10 `ApprovedGuidanceUnit.approval/applicableConditions/excludedConditions`, policy và evidence; E07 selector đã tiêu thụ. Producer phải cung cấp exact published version, OFFLINE rights, READY chunk set và source revision locking; có typed shape không có nghĩa approval workflow đã tồn tại. |
| Generator có phụ thuộc cứng provider/database? | **Không gắn cứng NCHMF/VNDMS/LLM**, nhưng **có phụ thuộc PostgreSQL/TypeORM/PostGIS và core schema**: E04/E05/E02 dùng SQL và E10 nhận `EntityManager`. Đây là lựa chọn stack đã thống nhất, không phải storage/provider-agnostic engine. Provider mới phải publish normalized records trước khi adapter đọc trong transaction; không gọi HTTP trong `read()`. |
| Nối source mới thay đổi phần nào? | Implement `OfflineSafetySources.read(manager, core, lock)`, thay binding E11 `useClass`; giữ contract revision/read lock với writers. Không phải sửa policy/build nếu input phù hợp source types và applicability hiện tại. |
| CTMS-119 tái dùng build cho v2? | Có: E12 `requestImpact(tripId,impactId)` → same durable queue → E04 `generate()`. Impact IDs idempotent; unique generation key/version và immutable prior version. 119 vẫn phải tự làm impact detection/publication policy. Current gate chỉ cho Trip `published`. |
| CTMS-53/54/55 có thể tiêu thụ artifact? | Có contract kỹ thuật: E12 metadata/manifest/verified Buffer, E10 schema 1, E08 sáu entries, SHA-256 ngoài ZIP. Chưa có chứng cứ Flutter download/decode/render thực tế; các task đó phải implement auth/transport/schema validation/activation. |
| Có thể đổi private storage? | Có E09 abstract storage port và E11 binding. Hiện implementation là local filesystem; nhiều process phải dùng cùng storage root. Object-store adapter chưa có, và yêu cầu cleanup/immutability vẫn phải giữ. |
| Snapshot chống đổi nguồn có thật hay giả định? | E04 thực sự kiểm tra fingerprints + scope revision + selection tại final transaction. Protocol khóa source writers là nghĩa vụ của adapter contract E10 và upstream spec; fixture DB có khóa row. Chưa có real upstream adapter nên không khẳng định writers thật đã tuân thủ. |

**5. Scope & dependency audit**

Trong cột “Có block CTMS-52?”, xét **nghiệm thu độc lập theo yêu cầu review này**; khi khác với readiness chạy dữ liệu thật, ghi rõ.

| Chức năng | Đã triển khai? | Task chịu trách nhiệm | Có block CTMS-52 không? | Bằng chứng |
| --- | --- | --- | --- | --- |
| Trigger publish/backfill, durable job và gates | Có | 052 tích hợp publication của 023 | Không thiếu implementation; rerun DB hiện BLOCKED | E01–E04, E13 |
| Core snapshot và đầy đủ payload | Có | 052 | Không thiếu implementation; nonempty artifact local PASS | E04/E05/E08, E14 |
| Manifest freshness cho optional expired feed | **Sai behavior** | **052** | **Có — P1** | E08:146; hai FAIL tại E14 |
| Immutable version, private storage, hash, retry/lease/idempotency | Có | 052 | Cần hoàn tất xác minh hiện tại; prior integration evidence có | E01/E02/E04/E09/E13 |
| E2E tự động qua worker và actual ZIP hash | Test đã bổ sung; chưa chạy được DB | 052 | Có — thiếu bằng chứng E2E cuối | E14 E2E, actual EACCES |
| Government ingestion/crawler/normalized complete feed runs | Chưa có production adapter cho package | 010/safety-source infrastructure | Không nếu consumer contract/fixtures được nghiệm thu; chặn nguồn thật | E10/E11; upstream contracts |
| Host verification và promote field report | Chưa có producer thật | Task mới cạnh 086 + promotion task | Không; field path bổ sung sau, government-only có thể hợp lệ theo policy | E06/E10; upstream contracts |
| Mở quyền Camper report | Không triển khai trong 052 | 049 extension được duyệt | Không, ngoài scope | ctms-49 dependency amendment |
| Admin approve complete GuidanceUnit/applicability/coverage policy | Có consumer, chưa có approval producer | Proposed 050/051 extension/task mới | Không nếu fixture contract đạt; chặn guidance thật | E07/E10/E11; ctms-50/51 amendments |
| PDF upload/parser/chunking/embedding | Tái dùng contracts/rights, không viết lại | 050/051 | Không phải feature còn thiếu của 052 | E07 import source-policy/ChunkSetStatus |
| Phát hiện source change và quyết định publication v2 | Chỉ có internal request consumer | 119 | Không, triển khai sau | E12; ctms-119 amendment |
| Download, participant authorization và truyền bytes | Chỉ có trusted read contract | 053 | Không, ngoài scope | E12; ctms-53 amendment |
| Verify/activate trên thiết bị | Có digest/schema output; chưa có client | 054 | Không, ngoài scope | E08/E10; ctms-54 amendment |
| Offline render/basemap | Có data payload; chưa có client | 055 và map task tương ứng | Không, ngoài scope | E08; ctms-55 amendment |
| Outdated/revoked warning và ongoing-version lock | Chưa có consumer workflow | 057/119 | Không, ngoài scope | Downstream spec handoff; không đổi artifact vN |
| GPS hotspot analytics/live weather engine | Không thêm implementation | 116–118, 015/020 và task liên quan | Không, ngoài scope | Repo scope amendment của 052 |
| Consent medical cá nhân | Shared payload loại bỏ personal data; obligations khác giữ nguyên | 052 projection + các consent consumers hiện có | Không thiếu medical section; không được thêm để đáp ứng 052 | E07/E08, BR-230 |

**6. Findings, blockers và hướng sửa đúng task**

| ID / mức | Phát hiện / file | Ảnh hưởng | Hướng xử lý |
| --- | --- | --- | --- |
| F01 — **P1** | [package-artifact.builder.ts:138/146](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/package-artifact.builder.ts) chỉ dựa raw `feed.status`; [package-policy.ts:360](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/package-policy.ts) chỉ gate expiry của required feeds. | Optional AVAILABLE/EMPTY với `validUntil` đã qua vẫn build được manifest `NO_ACTIVE_ALERT`. Không thể chuyển trách nhiệm sửa sang ingestion/057 vì chính generator đang ghi kết luận sai cho input mà contract có thể biểu diễn. | Sửa trong **052**: đánh giá effective availability/freshness cho mọi feed tại thời điểm snapshot/validation; expired optional feed ghi UNKNOWN với hạn chế/validity rõ, required feed vẫn BLOCKED. Giữ nguyên provider expiry và không suy TTL từ fetchedAt. Reuse kết quả cho summary/gates; chạy xanh hai regression cases và thêm DB/E2E scenario phù hợp. |
| F02 — **P2** | [package-policy.ts:364](sandbox:/D:/Capstone/CTMS/services/api/src/modules/offline-packages/package-policy.ts): raw status STALE rơi vào `HAZARD_FEED_UNAVAILABLE`, trong khi enum đã có `HAZARD_FEED_STALE`. | Fail closed đúng, nhưng reason chưa phân biệt stale/unavailable chính xác như yêu cầu vận hành. Không phải false READY. | Trong **052**, map STALE thành reason STALE; bổ sung expectation cho precise reason. Không cần upstream UI/API mới. |
| V01 — **BLOCKED verification**, không gán lỗi code | Integration rerun và E2E command đều EACCES trước setup. | Không chứng minh được migration/concurrency/E2E tại lượt review này. Screenshot cũ không chứng minh E2E mới hoặc cover F01. | Chạy lại trên terminal có quyền kết nối test instance 55451, ghi kết quả hiện tại và artifact evidence E2E; không dùng mock thay PostgreSQL. |

Không phát hiện P0 trong phạm vi đã kiểm tra. SHARE table locks ở E05 là tradeoff hiệu năng đã được ghi trong thiết kế: chặn ngắn các core writes trên toàn bảng. Không coi đó là một dependency chức năng còn thiếu; tối ưu về scoped revision fencing phải có writer protocol tương ứng, không bỏ lock để làm test nhanh hơn.

Hai regression tests đang đỏ được giữ lại để mô tả expected behavior, không sửa expectation theo behavior sai. Trong lượt review chỉ bổ sung tests/fixture và báo cáo, chưa sửa production policy/builder cho F01/F02.

Điều kiện đóng phần kỹ thuật 052: sửa F01, làm rõ F02 theo mức ưu tiên đã thống nhất, chạy xanh review regression và thực thi được 14 integration tests + E2E worker mới. Upstream/downstream có thể tiếp tục theo ownership ở trên; không cần nhồi những chức năng đó vào generator để khép scope độc lập.
