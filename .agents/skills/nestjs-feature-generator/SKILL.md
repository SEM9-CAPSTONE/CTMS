---
name: nestjs-feature-generator
description: >
  Generates a complete NestJS feature module with TypeScript for the ehub-nestjs-be app.
  Use when the user asks to create a new backend feature, API module, or CRUD endpoint.
  Produces: controller, service, module, DTOs, types, i18n, and unit tests
  following the project's patterns with Prisma, class-validator, nestjs-i18n, Swagger.
---

# NestJS Feature Generator Skill

## Purpose

Generate a complete, production-ready NestJS feature module that conforms to the ehub-nestjs-be
codebase conventions. The output must be immediately mergeable without additional refactoring.

## Trigger

Use this skill when:
- User asks to create a new backend feature, module, or API
- User asks to scaffold CRUD endpoints
- User asks to add a new NestJS resource

## Execution Steps

### Step 1 — Understand Requirements

1. Identify the feature name (use kebab-case for folders, PascalCase for classes).
2. Determine the Prisma model(s) involved.
3. Identify CRUD operations needed.
4. Determine auth requirements (public vs. authenticated, role-based).
5. Check if the Prisma schema needs a migration for new models.

### Step 2 — Generate Types (`<feature>.types.ts`)

Rules:
- ZERO `any` types
- Re-export Prisma-generated types where applicable
- Create domain-specific interfaces for payloads and contexts

```typescript
import { Prisma } from "@prisma/client";

// Re-export Prisma types for convenience
export type FeatureWithRelations = Prisma.FeatureGetPayload<{
  include: { relatedModel: true };
}>;

export interface CreateFeaturePayload {
  name: string;
  description: string;
  status: FeatureStatus;
}
```

### Step 3 — Generate DTOs (`dtos/`)

Rules:
- Use `class-validator` decorators for all validation
- Use `class-transformer` for type transformation
- Paginated queries extend `PageOptionInput`
- Use `@ApiProperty()` / `@ApiPropertyOptional()` for Swagger
- Group query params into DTO classes

```typescript
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PageOptionInput } from "../../../shared/dtos/page-option.input";

export class CreateFeatureDto {
  @ApiProperty({ description: "Feature name" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: "Feature description" })
  @IsString()
  @IsOptional()
  description?: string;
}

export class GetFeatureQueryDto extends PageOptionInput {
  @ApiPropertyOptional({ description: "Filter by status" })
  @IsEnum(FeatureStatus)
  @IsOptional()
  status?: FeatureStatus;
}
```

### Step 4 — Generate Service (`<feature>.service.ts`)

Rules:
- ALL business logic lives here
- Inject `PrismaService`
- Use Prisma-generated types — NEVER `any`
- Use `include` / `select` to shape queries
- Complex operations use `prisma.$transaction()`
- Methods are small and focused

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import type { CreateFeaturePayload, FeatureWithRelations } from "./feature.types";

@Injectable()
export class FeatureService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page: number, limit: number): Promise<{
    data: FeatureWithRelations[];
    totalItems: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.feature.findMany({
        skip,
        take: limit,
        include: { relatedModel: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.feature.count(),
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
      include: { relatedModel: true },
    });

    if (!feature) {
      throw new NotFoundException(`Feature with ID "${id}" not found`);
    }

    return feature;
  }

  async create(payload: CreateFeaturePayload): Promise<FeatureWithRelations> {
    return this.prisma.feature.create({
      data: payload,
      include: { relatedModel: true },
    });
  }
}
```

### Step 5 — Generate Controller (`<feature>.controller.ts`)

Rules:
- ONLY: receive request → validate DTO → call service → return `BaseResponse`
- Use `@CurrentUserContext()` for authenticated user
- Use `@UseGuards(AuthGuard)` for protected routes
- Use `@I18n() i18n: I18nContext` for translated messages
- Use `@ApiTags()`, `@ApiBearerAuth()`, `@ApiOperation()` for Swagger
- NEVER put business logic here

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
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
import { FeatureService } from "./feature.service";

@ApiTags("Feature")
@ApiBearerAuth()
@Controller({ path: "features", version: "1" })
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Get all features" })
  async findAll(
    @Query() query: GetFeatureQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const { page, limit } = query;
    const result = await this.featureService.findAll(page ?? 1, limit ?? 20);

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

  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Create a feature" })
  async create(
    @Body() dto: CreateFeatureDto,
    @CurrentUserContext() user: JwtPayload,
    @I18n() i18n: I18nContext,
  ) {
    const feature = await this.featureService.create(dto);
    return BaseResponse.ok(feature, i18n.t("feature.CREATED_SUCCESS"));
  }
}
```

### Step 6 — Generate Module (`<feature>.module.ts`)

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

- Register in `app.module.ts`.

### Step 7 — Generate i18n Files

Create translation files:
- `src/i18n/en/<feature-name>.json`
- `src/i18n/vi/<feature-name>.json`

```json
{
  "RETRIEVED_SUCCESS": "Features retrieved successfully",
  "CREATED_SUCCESS": "Feature created successfully",
  "UPDATED_SUCCESS": "Feature updated successfully",
  "DELETED_SUCCESS": "Feature deleted successfully",
  "NOT_FOUND": "Feature not found"
}
```

### Step 8 — Generate Unit Tests (`<feature>.service.spec.ts`)

Rules:
- Group by method using `describe()` blocks
- Mock PrismaService and other dependencies
- Test happy path and error cases

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { FeatureService } from "./feature.service";

describe("FeatureService", () => {
  let service: FeatureService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        {
          provide: PrismaService,
          useValue: {
            feature: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe("findAll", () => {
    it("should return paginated features", async () => {
      // test implementation
    });
  });

  describe("findById", () => {
    it("should return a feature by ID", async () => {
      // test implementation
    });

    it("should throw NotFoundException when feature not found", async () => {
      // test implementation
    });
  });
});
```

## Validation Checklist

Before completing, verify:
- [ ] Zero `any` types anywhere
- [ ] DTOs use class-validator decorators
- [ ] DTOs use @ApiProperty for Swagger
- [ ] Controller only delegates to service
- [ ] Service contains all business logic
- [ ] Auth uses @UseGuards(AuthGuard)
- [ ] Current user via @CurrentUserContext()
- [ ] Messages use i18n.t()
- [ ] i18n files created for en and vi
- [ ] Module registered in app.module.ts
- [ ] Responses use BaseResponse.ok()
- [ ] Prisma types used (not any)
- [ ] Query params grouped in DTOs
- [ ] Unit tests with describe() grouping
- [ ] No hardcoded strings/numbers
