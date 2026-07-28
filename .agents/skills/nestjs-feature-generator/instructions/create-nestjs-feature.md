# Instruction: Tạo Feature Backend NestJS Mới

## Mục tiêu
Hướng dẫn step-by-step tạo một NestJS feature module hoàn chỉnh trong `ehub-nestjs-be`.

---

## Bước 1: Tạo cấu trúc thư mục

```bash
mkdir -p src/features/<feature-name>/dtos
```

Tạo các file cốt lõi:
```
src/features/<feature-name>/
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.module.ts
├── <feature>.types.ts
├── <feature>.service.spec.ts
└── dtos/
    ├── create-<feature>.dto.ts
    ├── update-<feature>.dto.ts
    └── get-<feature>-query.dto.ts
```

---

## Bước 2: Kiểm tra Prisma Schema

Nếu feature cần model mới, thêm vào `prisma/schema.prisma`:

```prisma
model Feature {
  id          String   @id @default(uuid())
  name        String
  description String?
  status      FeatureStatus @default(DRAFT)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("features")
}

enum FeatureStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}
```

Chạy migration:
```bash
npx prisma migrate dev --name add-feature-table
npx prisma generate
```

---

## Bước 3: Định nghĩa Types (`<feature>.types.ts`)

> ⚠️ **TUYỆT ĐỐI KHÔNG dùng `any`**

Tham khảo [notification.types.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-nestjs-be/src/features/notifications/notification.types.ts):

```typescript
import { FeatureStatus, Prisma } from "@prisma/client";

// Re-export Prisma enums cho tiện
export { FeatureStatus };

// Prisma type có include relations
export type FeatureWithRelations = Prisma.FeatureGetPayload<{
	include: {
		category: true;
		createdBy: { select: { id: true; fullName: true } };
	};
}>;

// Payload types cho create/update
export interface CreateFeaturePayload {
	name: string;
	description?: string;
	categoryId: string;
}

export interface UpdateFeaturePayload {
	name?: string;
	description?: string;
	status?: FeatureStatus;
}

// Pagination result type
export interface PaginatedResult<T> {
	data: T[];
	totalItems: number;
	totalPages: number;
}
```

**Quy tắc:**
- Dùng `Prisma.ModelGetPayload<>` cho typed results
- Dùng Prisma enums (`@prisma/client`) thay vì hardcode string
- Dùng `Record<string, unknown>` thay vì `Record<string, any>`

---

## Bước 4: Tạo DTOs (`dtos/`)

### 4a. Query DTO (extends PageOptionInput)

Tham khảo [page-option.input.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-nestjs-be/src/shared/dtos/page-option.input.ts):

```typescript
// dtos/get-feature-query.dto.ts
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { FeatureStatus } from "@prisma/client";
import { PageOptionInput } from "../../../shared/dtos/page-option.input";

export class GetFeatureQueryDto extends PageOptionInput {
	@ApiPropertyOptional({
		description: "Filter by status",
		enum: FeatureStatus,
	})
	@IsEnum(FeatureStatus)
	@IsOptional()
	status?: FeatureStatus;

	@ApiPropertyOptional({ description: "Search by name" })
	@IsString()
	@IsOptional()
	search?: string;
}
```

### 4b. Create DTO

```typescript
// dtos/create-feature.dto.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateFeatureDto {
	@ApiProperty({ description: "Feature name", example: "My Feature" })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	name!: string;

	@ApiPropertyOptional({ description: "Feature description" })
	@IsString()
	@IsOptional()
	description?: string;

	@ApiProperty({ description: "Category ID" })
	@IsUUID()
	@IsNotEmpty()
	categoryId!: string;
}
```

### 4c. Update DTO

```typescript
// dtos/update-feature.dto.ts
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { FeatureStatus } from "@prisma/client";

export class UpdateFeatureDto {
	@ApiPropertyOptional({ description: "Feature name" })
	@IsString()
	@IsOptional()
	@MaxLength(255)
	name?: string;

	@ApiPropertyOptional({ description: "Feature description" })
	@IsString()
	@IsOptional()
	description?: string;

	@ApiPropertyOptional({
		description: "Feature status",
		enum: FeatureStatus,
	})
	@IsEnum(FeatureStatus)
	@IsOptional()
	status?: FeatureStatus;
}
```

**Quy tắc:**
- Luôn dùng `class-validator` decorators
- Luôn dùng `@ApiProperty()` / `@ApiPropertyOptional()` cho Swagger
- Paginated queries extend `PageOptionInput`
- Dùng `!` (definite assignment) cho required fields

---

## Bước 5: Tạo Service (`<feature>.service.ts`)

Tham khảo [pr-forms.service.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-nestjs-be/src/features/pr-forms/pr-forms.service.ts):

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import type { CreateFeaturePayload, FeatureWithRelations, PaginatedResult } from "./feature.types";

@Injectable()
export class FeatureService {
	constructor(private readonly prisma: PrismaService) {}

	async findAll(
		page: number,
		limit: number,
		status?: FeatureStatus,
	): Promise<PaginatedResult<FeatureWithRelations>> {
		const skip = (page - 1) * limit;

		const where = status ? { status } : {};

		const [data, totalItems] = await this.prisma.$transaction([
			this.prisma.feature.findMany({
				where,
				skip,
				take: limit,
				include: {
					category: true,
					createdBy: { select: { id: true, fullName: true } },
				},
				orderBy: { createdAt: "desc" },
			}),
			this.prisma.feature.count({ where }),
		]);

		return {
			data,
			totalItems,
			totalPages: Math.ceil(totalItems / limit),
		};
	}

	async findById(id: string): Promise<FeatureWithRelations> {
		const feature = await this.prisma.feature.findUnique({
			where: { id },
			include: {
				category: true,
				createdBy: { select: { id: true, fullName: true } },
			},
		});

		if (!feature) {
			throw new NotFoundException(`Feature with ID "${id}" not found`);
		}

		return feature;
	}

	async create(
		payload: CreateFeaturePayload,
		userId: string,
	): Promise<FeatureWithRelations> {
		return this.prisma.feature.create({
			data: {
				...payload,
				createdById: userId,
			},
			include: {
				category: true,
				createdBy: { select: { id: true, fullName: true } },
			},
		});
	}

	async update(
		id: string,
		payload: UpdateFeaturePayload,
	): Promise<FeatureWithRelations> {
		// Verify exists first
		await this.findById(id);

		return this.prisma.feature.update({
			where: { id },
			data: payload,
			include: {
				category: true,
				createdBy: { select: { id: true, fullName: true } },
			},
		});
	}

	async delete(id: string): Promise<void> {
		await this.findById(id);
		await this.prisma.feature.delete({ where: { id } });
	}
}
```

**Quy tắc:**
- ALL business logic ở đây, KHÔNG ở controller
- Dùng `Prisma.ModelGetPayload<>` types, KHÔNG dùng `any`
- Dùng `include` / `select` để shape queries
- Complex operations dùng `prisma.$transaction()`
- Inject `PrismaService`

---

## Bước 6: Tạo Controller (`<feature>.controller.ts`)

Tham khảo [pr-forms.controller.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-nestjs-be/src/features/pr-forms/pr-forms.controller.ts):

```typescript
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { I18n, I18nContext } from "nestjs-i18n";
import { CurrentUserContext } from "../../shared/decorators/current-user.decorator";
import { BaseResponse } from "../../shared/dtos/base-response.dto";
import type { JwtPayload } from "../../shared/interfaces/jwt-payload.interface";
import { AuthGuard } from "../auth/guards/auth.guard";
import { CreateFeatureDto } from "./dtos/create-feature.dto";
import { GetFeatureQueryDto } from "./dtos/get-feature-query.dto";
import { UpdateFeatureDto } from "./dtos/update-feature.dto";
import { FeatureService } from "./feature.service";

@ApiTags("Features")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: "features", version: "1" })
export class FeatureController {
	constructor(private readonly featureService: FeatureService) {}

	@Get()
	@ApiOperation({ summary: "Get all features with pagination" })
	async findAll(
		@Query() query: GetFeatureQueryDto,
		@I18n() i18n: I18nContext,
	) {
		const { page, limit, status } = query;
		const result = await this.featureService.findAll(
			page ?? 1,
			limit ?? 20,
			status,
		);

		return BaseResponse.ok(
			result.data,
			i18n.t("feature.RETRIEVED_SUCCESS"),
			{
				page,
				limit,
				totalItems: result.totalItems,
				totalPages: result.totalPages,
			},
		);
	}

	@Get(":id")
	@ApiOperation({ summary: "Get feature by ID" })
	async findById(
		@Param("id") id: string,
		@I18n() i18n: I18nContext,
	) {
		const feature = await this.featureService.findById(id);
		return BaseResponse.ok(feature, i18n.t("feature.RETRIEVED_SUCCESS"));
	}

	@Post()
	@ApiOperation({ summary: "Create a new feature" })
	async create(
		@Body() dto: CreateFeatureDto,
		@CurrentUserContext() user: JwtPayload,
		@I18n() i18n: I18nContext,
	) {
		const feature = await this.featureService.create(dto, user.sub);
		return BaseResponse.ok(feature, i18n.t("feature.CREATED_SUCCESS"));
	}

	@Patch(":id")
	@ApiOperation({ summary: "Update a feature" })
	async update(
		@Param("id") id: string,
		@Body() dto: UpdateFeatureDto,
		@I18n() i18n: I18nContext,
	) {
		const feature = await this.featureService.update(id, dto);
		return BaseResponse.ok(feature, i18n.t("feature.UPDATED_SUCCESS"));
	}

	@Delete(":id")
	@ApiOperation({ summary: "Delete a feature" })
	async delete(
		@Param("id") id: string,
		@I18n() i18n: I18nContext,
	) {
		await this.featureService.delete(id);
		return BaseResponse.ok(null, i18n.t("feature.DELETED_SUCCESS"));
	}
}
```

**Quy tắc:**
- Controller CHỈ: nhận request → validate DTO → gọi service → trả `BaseResponse`
- KHÔNG đặt business logic trong controller
- Query params gom vào DTO (KHÔNG nhiều `@Query()` riêng lẻ)
- `@CurrentUserContext()` cho current user (KHÔNG `@Req()`)
- `@I18n() i18n: I18nContext` cho messages
- `@ApiTags()`, `@ApiBearerAuth()`, `@ApiOperation()` cho Swagger
- `BaseResponse.ok()` cho tất cả responses

---

## Bước 7: Tạo Module (`<feature>.module.ts`)

```typescript
import { Module } from "@nestjs/common";
import { FeatureController } from "./feature.controller";
import { FeatureService } from "./feature.service";

@Module({
	controllers: [FeatureController],
	providers: [FeatureService],
	exports: [FeatureService],
})
export class FeatureModule {}
```

**Đăng ký trong** [app.module.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-nestjs-be/src/app.module.ts):

```typescript
import { FeatureModule } from "./features/feature/feature.module";

@Module({
	imports: [
		// ... existing modules
		FeatureModule,
	],
})
export class AppModule {}
```

---

## Bước 8: Tạo i18n Files

`src/i18n/en/feature.json`:
```json
{
	"RETRIEVED_SUCCESS": "Features retrieved successfully",
	"CREATED_SUCCESS": "Feature created successfully",
	"UPDATED_SUCCESS": "Feature updated successfully",
	"DELETED_SUCCESS": "Feature deleted successfully",
	"NOT_FOUND": "Feature not found"
}
```

`src/i18n/vi/feature.json`:
```json
{
	"RETRIEVED_SUCCESS": "Lấy danh sách thành công",
	"CREATED_SUCCESS": "Tạo thành công",
	"UPDATED_SUCCESS": "Cập nhật thành công",
	"DELETED_SUCCESS": "Xóa thành công",
	"NOT_FOUND": "Không tìm thấy"
}
```

---

## Bước 9: Tạo Unit Tests (`<feature>.service.spec.ts`)

```typescript
import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { FeatureService } from "./feature.service";

describe("FeatureService", () => {
	let service: FeatureService;
	let prisma: PrismaService;

	const mockPrismaService = {
		feature: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		$transaction: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FeatureService,
				{ provide: PrismaService, useValue: mockPrismaService },
			],
		}).compile();

		service = module.get<FeatureService>(FeatureService);
		prisma = module.get<PrismaService>(PrismaService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("findAll", () => {
		it("should return paginated features", async () => {
			const mockFeatures = [{ id: "1", name: "Test" }];
			mockPrismaService.$transaction.mockResolvedValue([mockFeatures, 1]);

			const result = await service.findAll(1, 20);

			expect(result.data).toEqual(mockFeatures);
			expect(result.totalItems).toBe(1);
			expect(result.totalPages).toBe(1);
		});

		it("should return empty array when no features exist", async () => {
			mockPrismaService.$transaction.mockResolvedValue([[], 0]);

			const result = await service.findAll(1, 20);

			expect(result.data).toEqual([]);
			expect(result.totalItems).toBe(0);
		});
	});

	describe("findById", () => {
		it("should return a feature by ID", async () => {
			const mockFeature = { id: "1", name: "Test" };
			mockPrismaService.feature.findUnique.mockResolvedValue(mockFeature);

			const result = await service.findById("1");

			expect(result).toEqual(mockFeature);
		});

		it("should throw NotFoundException when feature not found", async () => {
			mockPrismaService.feature.findUnique.mockResolvedValue(null);

			await expect(service.findById("nonexistent")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("create", () => {
		it("should create and return a new feature", async () => {
			const payload = { name: "New Feature", categoryId: "cat-1" };
			const mockCreated = { id: "1", ...payload };
			mockPrismaService.feature.create.mockResolvedValue(mockCreated);

			const result = await service.create(payload, "user-1");

			expect(result).toEqual(mockCreated);
			expect(mockPrismaService.feature.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ name: "New Feature" }),
				}),
			);
		});
	});
});
```

**Quy tắc:**
- `describe()` theo từng method
- Mock PrismaService và dependencies
- Test happy path + error cases
- `afterEach(() => jest.clearAllMocks())`

---

## Checklist Cuối

- [ ] Prisma schema cập nhật + migration chạy
- [ ] Types dùng `Prisma.ModelGetPayload<>`, không `any`
- [ ] DTOs dùng `class-validator` + `@ApiProperty()`
- [ ] Query params gom vào DTO (extends `PageOptionInput`)
- [ ] Controller thin: chỉ delegate → service → `BaseResponse.ok()`
- [ ] Service chứa ALL business logic
- [ ] Auth dùng `@UseGuards(AuthGuard)`
- [ ] Current user dùng `@CurrentUserContext()`
- [ ] Messages dùng `i18n.t()`
- [ ] i18n files cho cả `en` và `vi`
- [ ] Module đăng ký trong `app.module.ts`
- [ ] Swagger decorators: `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`
- [ ] Unit tests với `describe()` grouping
- [ ] Không hardcode strings, numbers
- [ ] `switch/case` thay vì long `if/else if`
