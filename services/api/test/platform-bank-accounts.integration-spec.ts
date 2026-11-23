import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

interface SavedRow {
	bank_name: string;
	account_number: string;
	account_holder_name: string;
	updated_by: string | null;
}

describe("Platform bank account for weather penalties (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	let original: SavedRow | null = null;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = moduleRef.createNestApplication();
		app.setGlobalPrefix("api");
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				exceptionFactory: validationExceptionFactory,
			})
		);
		await app.init();
		dataSource = moduleRef.get(DataSource);
		jwtService = moduleRef.get(JwtService);
		await assertSafeTestDatabase(dataSource);
		// The account is one shared row: keep whatever was there and put it back afterwards.
		const rows = (await dataSource.query(
			`SELECT "bank_name", "account_number", "account_holder_name", "updated_by"
			 FROM "platform_bank_accounts" WHERE "purpose" = 'weather_penalty'`
		)) as SavedRow[];
		original = rows[0] ?? null;
		await dataSource.query(
			`DELETE FROM "platform_bank_accounts" WHERE "purpose" = 'weather_penalty'`
		);
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query(
				`DELETE FROM "platform_bank_accounts" WHERE "purpose" = 'weather_penalty'`
			);
			if (original) {
				await dataSource.query(
					`INSERT INTO "platform_bank_accounts"
					   ("purpose", "bank_name", "account_number", "account_holder_name", "updated_by")
					 VALUES ('weather_penalty', $1, $2, $3, $4)`,
					[
						original.bank_name,
						original.account_number,
						original.account_holder_name,
						original.updated_by,
					]
				);
			}
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		await app?.close();
	});

	async function createAccount(role: UserRole, fullName: string): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, $5)`,
			[id, `platform-bank-${role}-${id}@example.com`, role, UserStatus.ACTIVE, fullName]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	const api = () => request(app.getHttpServer());
	const getAccount = (account: Account) =>
		api()
			.get("/api/admin/platform-bank-account")
			.set("Authorization", `Bearer ${account.accessToken}`);
	const putAccount = (account: Account, body: Record<string, unknown>) =>
		api()
			.put("/api/admin/platform-bank-account")
			.set("Authorization", `Bearer ${account.accessToken}`)
			.send(body);

	it("lets an Admin set and change the account, audits both values and shows it to Hosts", async () => {
		const admin = await createAccount(UserRole.ADMIN, "Lê Minh Tuấn");
		const host = await createAccount(UserRole.HOST, "Nguyễn Thị Ban Mai");

		expect((await getAccount(admin).expect(200)).body).toEqual({ account: null });
		const hostView = await api()
			.get("/api/me/weather-penalties")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);
		expect(hostView.body.paymentAccount).toBeNull();

		const first = await putAccount(admin, {
			bankName: "Vietcombank",
			accountNumber: " 1028374659 ",
			accountHolderName: "CONG TY TNHH CTMS VIET NAM",
		}).expect(200);
		expect(first.body).toMatchObject({
			purpose: "weather_penalty",
			bankName: "Vietcombank",
			accountNumber: "1028374659",
			accountHolderName: "CONG TY TNHH CTMS VIET NAM",
			updatedByName: "Lê Minh Tuấn",
		});

		await putAccount(admin, {
			bankName: "BIDV",
			accountNumber: "31410001234567",
			accountHolderName: "CONG TY TNHH CTMS VIET NAM",
		}).expect(200);
		expect((await getAccount(admin).expect(200)).body.account).toMatchObject({
			bankName: "BIDV",
			accountNumber: "31410001234567",
		});
		const rows = await dataSource.query(
			`SELECT COUNT(*)::int AS "count" FROM "platform_bank_accounts" WHERE "purpose" = 'weather_penalty'`
		);
		expect(rows).toEqual([{ count: 1 }]);

		const audits = await dataSource.query(
			`SELECT "before", "after" FROM "audit_logs"
			 WHERE "actor_id" = $1 AND "action" = 'platform.bank_account_updated' ORDER BY "created_at"`,
			[admin.id]
		);
		expect(audits).toHaveLength(2);
		expect(audits[0].before).toBeNull();
		expect(audits[1]).toMatchObject({
			before: expect.objectContaining({ bankName: "Vietcombank", accountNumber: "1028374659" }),
			after: expect.objectContaining({ bankName: "BIDV", accountNumber: "31410001234567" }),
		});

		const shown = await api()
			.get("/api/me/weather-penalties")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);
		expect(shown.body.paymentAccount).toEqual({
			bankName: "BIDV",
			accountNumber: "31410001234567",
			accountHolderName: "CONG TY TNHH CTMS VIET NAM",
		});
	});

	it("refuses non-Admins and invalid account details", async () => {
		const admin = await createAccount(UserRole.ADMIN, "Trần Quốc Bảo");
		const host = await createAccount(UserRole.HOST, "Phan Văn Lộc");
		const valid = {
			bankName: "Techcombank",
			accountNumber: "19036482751014",
			accountHolderName: "CONG TY TNHH CTMS VIET NAM",
		};
		await getAccount(host).expect(403);
		await putAccount(host, valid).expect(403);
		await putAccount(admin, { ...valid, accountNumber: "12345" }).expect(422);
		await putAccount(admin, { ...valid, accountNumber: "1903-6482-7510" }).expect(422);
		await putAccount(admin, { ...valid, bankName: "  " }).expect(422);
		await putAccount(admin, { ...valid, accountHolderName: "A" }).expect(422);
		await putAccount(admin, { ...valid, purpose: "other" }).expect(422);
	});
});
