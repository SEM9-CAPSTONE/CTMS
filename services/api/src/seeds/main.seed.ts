/**
 * CTMS MASTER DATABASE SEED SCRIPT
 *
 * Consolidates all seed scenarios into a single idempotent script:
 * 1. Admin & Porter Accounts & Qualifications
 * 2. Host & Baseline Trekking Route
 * 3. Trips, Campsites, Routes, Equipment Catalog, Campers & Bookings
 * 4. Weather Risk Assessment Scenarios (Green & Red routes)
 * 5. Camper Refund & Dispute Scenarios (Pre-trip cancellation, Post-completion complaint, Already refunded)
 * 6. Settlements, Host Wallets & Payout Requests
 * 7. User Bank Accounts (Host & Camper)
 * 8. Offline Device Telemetry & Sync Scenarios (CTMS-067)
 * 9. Content Moderation Reports
 */
import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { hash } from "bcrypt";
import type { DataSource, EntityManager } from "typeorm";
import {
	DEFAULT_CANCELLATION_POLICY,
	minorToMoney,
	moneyToMinor,
	parseCancellationPolicy,
} from "../modules/bookings/cancellation-policy";
import { InAppNotificationType } from "../modules/in-app-notifications/in-app-notification.entity";
import { InAppNotificationsService } from "../modules/in-app-notifications/in-app-notifications.service";
import dataSource from "../shared/database/data-source";

import { randomUUID } from "node:crypto";
import { CheckpointArrivalsRepository } from "../modules/checkpoint-arrivals/checkpoint-arrivals.repository";
import type {
	PackageCore,
	PackageMetadata,
	PackageSafetyInputs,
} from "../modules/offline-packages/offline-packages.types";
import { PackageArtifactBuilder } from "../modules/offline-packages/package-artifact.builder";
import { LocalPackageArtifactStorage } from "../modules/offline-packages/package-artifact.storage";
import { PackageCoreReader } from "../modules/offline-packages/package-core.reader";
import {
	TripSafetyContextResolver,
	canonical,
	digest,
	sourceFingerprint,
} from "../modules/offline-packages/package-policy";
import { readVerifiedPackageRoute } from "../modules/offline-packages/package-route.reader";
import { CheckpointType } from "../modules/trekking-routes/entities/checkpoint.entity";
import { WaypointType } from "../modules/trips/entities/trip-waypoint.entity";
import { TripStatus, TripType } from "../modules/trips/entities/trip.entity";
import { AUTO_CANCEL_WEATHER_REASON } from "../modules/trips/weather-decisions/trip-weather-decision.service";

import { BookingsRepository } from "../modules/bookings/bookings.repository";
import { FinancialAdjustment } from "../modules/bookings/entities/financial-adjustment.entity";
import { Payment } from "../modules/bookings/entities/payment.entity";
import { WalletTransactionType } from "../modules/bookings/entities/wallet-transaction.entity";
import { PaymentsRepository } from "../modules/bookings/payments.repository";
import { RefundOrigin } from "../modules/bookings/refund-policy";
import { RefundsService } from "../modules/bookings/refunds.service";
import { Booking } from "../modules/profiles/entities/booking.entity";
import { ROUTE_DEVIATION_ANALYSIS_VERSION } from "../modules/route-deviation-analysis/route-deviation-analysis.constants";
import { HotspotReviewService } from "../modules/safety-hotspots/hotspot-review.service";
import { SafetyHotspotStatus } from "../modules/safety-hotspots/safety-hotspots.enums";
import { SafetyHotspotsRepository } from "../modules/safety-hotspots/safety-hotspots.repository";
import { SafetyHotspotsService } from "../modules/safety-hotspots/safety-hotspots.service";
import { UserRole } from "../modules/users/entities/user.entity";

// ==========================================================================
// consolidate-financial-hosts.ts (consolidated into the master seed)
// ==========================================================================

interface WalletRow {
	id: string;
	balance: string;
}
interface LegacyHost {
	id: string;
	fullName: string;
}

/** Retire only the four accounts created by the former financial fixture seed. */
export async function consolidateFinancialHosts(
	manager: EntityManager,
	hostId: string,
	adminId: string,
	fixtureId: (group: number, index: number) => string
): Promise<string> {
	await manager.query(
		"INSERT INTO host_wallets (host_id, balance) VALUES ($1, '0.00') ON CONFLICT (host_id) DO NOTHING",
		[hostId]
	);
	const wallets: WalletRow[] = await manager.query(
		"SELECT id, balance FROM host_wallets WHERE host_id = $1 FOR UPDATE",
		[hostId]
	);
	const wallet = wallets[0];
	let balanceMinor = moneyToMinor(wallet.balance);
	for (let index = 1; index <= 4; index++) {
		const hosts: LegacyHost[] = await manager.query(
			`SELECT id, full_name AS "fullName" FROM users
			 WHERE id = $1 AND email = $2 AND status <> 'deleted' FOR UPDATE`,
			[fixtureId(1, index), `host.adjustment.${index}@ctms.local`]
		);
		const legacy = hosts[0];
		if (!legacy) continue;
		const oldWallets: WalletRow[] = await manager.query(
			"SELECT id, balance FROM host_wallets WHERE host_id = $1 FOR UPDATE",
			[legacy.id]
		);
		const oldWallet = oldWallets[0];
		const transferredMinor = oldWallet ? moneyToMinor(oldWallet.balance) : 0n;
		const previousBalance = minorToMoney(balanceMinor);
		if (oldWallet && transferredMinor > 0n) {
			balanceMinor += transferredMinor;
			await manager.query(
				"UPDATE host_wallets SET balance = '0.00', updated_at = now() WHERE id = $1",
				[oldWallet.id]
			);
			await manager.query(
				`INSERT INTO wallet_transactions (id, wallet_id, type, net_amount, balance_after, description, created_at)
				 VALUES ($1, $2, $3, $4, '0.00', 'Chuyển số dư về ví chính', clock_timestamp()),
				 ($5, $6, $7, $8, $9, 'Tiếp nhận số dư vào ví chính', clock_timestamp())`,
				[
					fixtureId(8, 1000 + index),
					oldWallet.id,
					WalletTransactionType.WALLET_TRANSFER_DEBIT,
					minorToMoney(-transferredMinor),
					fixtureId(8, 2000 + index),
					wallet.id,
					WalletTransactionType.WALLET_TRANSFER_CREDIT,
					minorToMoney(transferredMinor),
					minorToMoney(balanceMinor),
				]
			);
		}
		// Keep original ledger entries, bank references and audit snapshots in place.
		for (const table of [
			"trekking_routes",
			"trips",
			"settlements",
			"financial_adjustments",
			"payouts",
		]) {
			await manager.query(`UPDATE "${table}" SET host_id = $1 WHERE host_id = $2`, [
				hostId,
				legacy.id,
			]);
		}
		await manager.query(
			"UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1",
			[legacy.id]
		);
		await manager.query("UPDATE users SET status = 'deleted', updated_at = now() WHERE id = $1", [
			legacy.id,
		]);
		await manager.query(
			`INSERT INTO audit_logs (actor_id, action, target_type, target_id, before, after, reason)
			 VALUES ($1, 'financial.host_account_consolidated', 'host_wallet', $2, $3::jsonb, $4::jsonb,
			 'Chuyển số dư và dữ liệu người tổ chức về tài khoản chính.')`,
			[
				adminId,
				wallet.id,
				JSON.stringify({
					sourceHostId: legacy.id,
					sourceHostName: legacy.fullName,
					walletBalance: previousBalance,
				}),
				JSON.stringify({
					hostId,
					transferredAmount: minorToMoney(transferredMinor),
					walletBalance: minorToMoney(balanceMinor),
				}),
			]
		);
	}
	if (minorToMoney(balanceMinor) !== wallet.balance) {
		await manager.query("UPDATE host_wallets SET balance = $1, updated_at = now() WHERE id = $2", [
			minorToMoney(balanceMinor),
			wallet.id,
		]);
	}
	return wallet.id;
}

// ==========================================================================
// financial-adjustments.seed.ts (consolidated into the master seed)
// ==========================================================================

const FINANCIAL_ADJUSTMENT_SCENARIOS = [
	{
		index: 1,
		title: "Cắm trại suối Lương – Chân đèo Hải Vân",
		previousTitle: "Trekking vườn quốc gia Bạch Mã",
		description:
			"Cắm trại bên dòng suối Lương dưới chân đèo Hải Vân, tắm suối và nướng cá buổi tối.",
		previousDescription:
			"Khám phá các cung đường rừng và điểm ngắm cảnh tại vườn quốc gia Bạch Mã.",
		path: "108.1290 16.1405,108.1262 16.1428,108.1243 16.1449",
		notes: "Khoản thu thừa đã được xác minh và chuyển xử lý hoàn tiền sau quyết toán.",
		amount: 600000,
		bookings: 1,
		paidOut: false,
		reason: "Khách đã thanh toán thừa, cần hoàn lại sau khi chuyến đi đã quyết toán.",
	},
	{
		index: 2,
		previousTitle: null,
		title: "Khám phá bán đảo Sơn Trà",
		description:
			"Đi bộ khám phá bán đảo Sơn Trà, ngắm biển và tìm hiểu hệ sinh thái rừng ven biển.",
		previousDescription: null,
		path: "108.2700 16.1000,108.2780 16.1110,108.2870 16.1180",
		notes: "Đã xác định khoản cần thu hồi từ người tổ chức để xử lý yêu cầu hoàn tiền cho khách.",
		amount: 900000,
		bookings: 1,
		paidOut: true,
		reason: "Cần hoàn tiền cho khách nhưng chủ chuyến đã rút tiền, đang chờ thu hồi thủ công.",
	},
	{
		index: 3,
		previousTitle: null,
		title: "Chinh phục đèo Hải Vân",
		description:
			"Chuyến đi trong ngày qua cung đường đèo Hải Vân, dừng ngắm cảnh vịnh Đà Nẵng và Lăng Cô.",
		previousDescription: null,
		path: "108.1280 16.1580,108.1270 16.1800,108.1325 16.1945",
		notes: "Khoản thu thừa đã được đối chiếu và khấu trừ từ số dư ví người tổ chức.",
		amount: 250000,
		bookings: 2,
		paidOut: false,
		reason: "Hoàn lại khoản thu thừa cho khách sau quyết toán, ví chủ chuyến còn đủ số dư.",
	},
	{
		index: 4,
		title: "Săn mây đỉnh Bàn Cờ – Sơn Trà",
		previousTitle: "Săn mây trên đỉnh Langbiang",
		description:
			"Leo đỉnh Bàn Cờ trước bình minh, ngắm mây phủ bán đảo Sơn Trà và toàn cảnh vịnh Đà Nẵng.",
		previousDescription: "Hành trình lên đỉnh Langbiang, ngắm biển mây và toàn cảnh cao nguyên.",
		path: "108.2560 16.1110,108.2610 16.1145,108.2650 16.1170",
		notes: null,
		amount: 450000,
		bookings: 2,
		paidOut: false,
		reason: null,
	},
] as const;

// Identify old fixture annotations without touching administrator-authored notes.
const LEGACY_ADJUSTMENT_NOTE = "Dữ liệu mẫu CTMS-114 để thử trên giao diện.";
const LEGACY_TRIP_DESCRIPTION = "Dữ liệu mẫu CTMS-114 để thử quản lý khoản hoàn và thu hồi.";
const LEGACY_ROUTE_DESCRIPTION = "Tuyến mẫu để xem và thử xử lý điều chỉnh tài chính.";

function fixtureId(group: number, index: number): string {
	return `d1140000-${String(group).padStart(4, "0")}-4114-8114-${String(index).padStart(12, "0")}`;
}

/** Adds isolated demo financial chains; reruns preserve all existing records and UI actions. */
export async function seedFinancialAdjustments(): Promise<void> {
	if (!dataSource.isInitialized) await dataSource.initialize();
	const users: Array<{ id: string; email: string; fullName: string }> = await dataSource.query(
		'SELECT id, email, full_name AS "fullName" FROM users WHERE email = ANY($1)',
		[["admin@ctms.local", "host@ctms.local", "camper@ctms.local"]]
	);
	const admin = users.find((user) => user.email === "admin@ctms.local");
	const host = users.find((user) => user.email === "host@ctms.local");
	const camper = users.find((user) => user.email === "camper@ctms.local");
	if (!admin || !host || !camper) {
		throw new Error(
			"Cần có các tài khoản mẫu admin, host và camper trước khi thêm dữ liệu điều chỉnh."
		);
	}

	await dataSource.transaction(async (manager) => {
		const walletId = await consolidateFinancialHosts(manager, host.id, admin.id, fixtureId);
		await manager.query("UPDATE users SET full_name = $1 WHERE id = $2 AND full_name = $3", [
			"Nguyễn Văn An",
			camper.id,
			"Camper Nguyễn Văn An",
		]);
		await manager.query(
			"UPDATE user_bank_accounts SET account_holder_name = $1 WHERE user_id = $2 AND account_holder_name = $3",
			["NGUYEN VAN AN", camper.id, "CAMPER NGUYEN VAN AN"]
		);
		for (const scenario of FINANCIAL_ADJUSTMENT_SCENARIOS) {
			const { index, amount, bookings, paidOut } = scenario;
			const hostId = host.id;
			const routeId = fixtureId(2, index);
			const tripId = fixtureId(3, index);
			const settlementId = fixtureId(6, index);
			const gross = amount * bookings;
			const fee = gross * 0.05;
			const net = gross - fee;
			await manager.query(
				`INSERT INTO trekking_routes
				 (id, host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
				 VALUES ($1, $2, $3, $4,
				 ST_GeogFromText($5), 3000, 'moderate', 240, 'active')
				 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, route_geom = EXCLUDED.route_geom`,
				[
					routeId,
					hostId,
					scenario.title,
					scenario.description,
					`SRID=4326;LINESTRING(${scenario.path})`,
				]
			);
			await manager.query(
				`INSERT INTO trips (id, host_id, route_id, title, description, trip_type, duration_nights,
				 starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max, seats_taken,
				 price_per_person, status)
				 VALUES ($1, $2, $3, $4, $7, 'day_trip', 0,
				 now() - interval '8 days', now() - interval '7 days',
				 ST_GeogFromText($8), now() - interval '9 days', 1, 10, $5, $6, 'completed')
				 ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, meeting_point = EXCLUDED.meeting_point`,
				[
					tripId,
					hostId,
					routeId,
					scenario.title,
					bookings,
					amount.toFixed(2),
					scenario.description,
					`SRID=4326;POINT(${scenario.path.split(",")[0]})`,
				]
			);
			// Replace only text this seed wrote earlier; descriptions a Host edited stay as they are.
			const replaceableDescriptions = [
				LEGACY_TRIP_DESCRIPTION,
				LEGACY_ROUTE_DESCRIPTION,
				scenario.previousDescription,
			].filter((text): text is string => Boolean(text));
			await manager.query(
				"UPDATE trips SET description = $1 WHERE id = $2 AND description = ANY($3)",
				[scenario.description, tripId, replaceableDescriptions]
			);
			await manager.query(
				"UPDATE trekking_routes SET description = $1 WHERE id = $2 AND description = ANY($3)",
				[scenario.description, routeId, replaceableDescriptions]
			);
			if (scenario.notes) {
				await manager.query(
					`UPDATE financial_adjustments SET notes = replace(notes, $1, $2)
					 WHERE booking_id = $3 AND strpos(notes, $1) > 0`,
					[LEGACY_ADJUSTMENT_NOTE, scenario.notes, fixtureId(4, index)]
				);
			}
			for (let bookingIndex = 0; bookingIndex < bookings; bookingIndex++) {
				const bookingId = fixtureId(4, index + bookingIndex * 100);
				const paymentId = fixtureId(5, index + bookingIndex * 100);
				await manager.query(
					`INSERT INTO bookings (id, trip_id, user_id, num_people, status, payment_status,
					 trip_starts_at_snapshot, trip_ends_at_snapshot, base_price, total_amount, completed_at)
					 SELECT $1, id, $2, 1, 'completed', 'paid', starts_at, ends_at, $3, $3, ends_at
					 FROM trips WHERE id = $4 ON CONFLICT (id) DO NOTHING`,
					[bookingId, camper.id, amount.toFixed(2), tripId]
				);
				await manager.query(
					`INSERT INTO payments (id, booking_id, amount, type, status, idempotency_key, request_fingerprint, provider_reference)
					 VALUES ($1, $2, $3, 'charge', 'succeeded', $4, $4, $4) ON CONFLICT (id) DO NOTHING`,
					[paymentId, bookingId, amount.toFixed(2), `seed-ctms114-charge-${index}-${bookingIndex}`]
				);
			}
			await manager.query(
				`INSERT INTO settlements (id, trip_id, host_id, settlement_base, commission_rate, platform_fee, net_amount, settled_at)
				 VALUES ($1, $2, $3, $4, '0.0500', $5, $6, now() - ($7 * interval '1 day')) ON CONFLICT (id) DO NOTHING`,
				[
					settlementId,
					tripId,
					hostId,
					gross.toFixed(2),
					fee.toFixed(2),
					net.toFixed(2),
					paidOut ? 5 : 3,
				]
			);
			const priorCredits: Array<{ id: string }> = await manager.query(
				"SELECT id FROM wallet_transactions WHERE id = $1",
				[fixtureId(8, index)]
			);
			if (priorCredits.length === 0) {
				const credited: Array<{ balance: string }> = await manager.query(
					"UPDATE host_wallets SET balance = balance + $1, updated_at = now() WHERE id = $2 RETURNING balance",
					[net.toFixed(2), walletId]
				);
				await manager.query(
					`INSERT INTO wallet_transactions (id, wallet_id, settlement_id, trip_id, type,
				 base_amount, fee_amount, net_amount, balance_after, description, created_at)
				 VALUES ($1, $2, $3, $4, 'settlement_credit', $5, $6, $7, $9, $8, now() - ($10 * interval '1 day'))
				 ON CONFLICT (id) DO NOTHING`,
					[
						fixtureId(8, index),
						walletId,
						settlementId,
						tripId,
						gross.toFixed(2),
						fee.toFixed(2),
						net.toFixed(2),
						scenario.title,
						credited[0].balance,
						paidOut ? 5 : 3,
					]
				);
			}
			// Wallet entries written by older versions of this seed carried the former Trip name or a
			// "[Mẫu] …" fixture label. Rename only that seed-written text; amounts stay untouched.
			await manager.query(
				`UPDATE wallet_transactions SET description = $1
				 WHERE id = $2 AND (description = $3 OR description LIKE '[Mẫu]%')`,
				[scenario.title, fixtureId(8, index), scenario.previousTitle ?? scenario.title]
			);
			await manager.query(
				`UPDATE wallet_transactions SET description = 'Rút tiền về tài khoản ngân hàng'
				 WHERE id = $1 AND description = 'Rút toàn bộ số dư ví mẫu'`,
				[fixtureId(8, index + 100)]
			);
			if (paidOut) {
				const payoutId = fixtureId(9, index);
				const priorPayouts: Array<{ id: string }> = await manager.query(
					"SELECT id FROM payouts WHERE id = $1",
					[payoutId]
				);
				if (priorPayouts.length === 0) {
					await manager.query(
						`INSERT INTO payouts (id, host_id, wallet_id, amount, status, bank_name, account_number,
					 account_holder_name, transaction_ref, created_at)
					 VALUES ($1, $2, $3, $4, 'succeeded', 'MB Bank', '0987612345', $5, 'FT261111428731',
					 now() - interval '4 days') ON CONFLICT (id) DO NOTHING`,
						[payoutId, hostId, walletId, net.toFixed(2), host.fullName]
					);
					const debited: Array<{ balance: string }> = await manager.query(
						"UPDATE host_wallets SET balance = balance - $1, updated_at = now() WHERE id = $2 RETURNING balance",
						[net.toFixed(2), walletId]
					);
					await manager.query(
						`INSERT INTO wallet_transactions (id, wallet_id, payout_id, trip_id, type,
					 net_amount, balance_after, description, created_at)
					 VALUES ($1, $2, $3, $4, 'payout_debit', $5, $6, 'Rút tiền về tài khoản ngân hàng',
					 now() - interval '4 days') ON CONFLICT (id) DO NOTHING`,
						[
							fixtureId(8, index + 100),
							walletId,
							payoutId,
							tripId,
							(-net).toFixed(2),
							debited[0].balance,
						]
					);
				}
			}
		}
	});

	const paymentsRepository = new PaymentsRepository(Payment, dataSource.manager);
	const service = new RefundsService(
		dataSource,
		paymentsRepository,
		new BookingsRepository(Booking, dataSource.manager)
	);
	for (const scenario of FINANCIAL_ADJUSTMENT_SCENARIOS) {
		const bookingId = fixtureId(4, scenario.index);
		if (
			scenario.reason &&
			!(await dataSource.getRepository(FinancialAdjustment).existsBy({ bookingId }))
		) {
			const request = await service.processRefund(
				camper.id,
				bookingId,
				`financial-refund-${scenario.index}`,
				{
					origin: RefundOrigin.CAMPER_COMPLAINT,
					reason: scenario.reason,
					bankName: "Vietcombank",
					accountNumber: "1012345678",
					accountHolderName: "NGUYEN VAN AN",
				},
				{ userRoles: [UserRole.CAMPER] }
			);
			await service.approveRefund(admin.id, request.refundId, { note: scenario.reason });
		}
		console.log(`${scenario.title} — ${host.fullName} (${host.email})`);
	}
	console.log(
		"Mở Quản lý tài chính → Hoàn tiền sau quyết toán, tìm theo tên chuyến đi hoặc người tổ chức."
	);
}

// ==========================================================================
// revenue-analytics.seed.ts (consolidated into the master seed)
// ==========================================================================

/**
 * CTMS-110 seed: area snapshots for existing Trips plus settled revenue history for
 * host@ctms.local in every inhabited Đà Nẵng district (Hoàng Sa is an offshore island district
 * with no trekking, so it has no Trip).
 *
 * Rules (AGENTS.md):
 * - Reuses host@ctms.local and camper@ctms.local; never creates accounts.
 * - Places, routes and coordinates are real locations in Đà Nẵng. No cover images are seeded:
 *   stock photos would not show the actual place, so the Host uploads real ones.
 * - Area backfill only fills Trips whose `area_code` is still empty; areas a Host already chose
 *   are left alone. No keys, statuses or money values of existing rows are changed.
 * - Ledger rows use fixed ids and `ON CONFLICT DO NOTHING`, so a re-run never rewrites a
 *   payment, refund or settlement. Only the descriptive fields of these seed Trips are refreshed.
 */

/** Title/route keywords → area. The first match wins; title is checked before route name. */
const AREA_KEYWORDS: Array<{ code: string; keywords: string[] }> = [
	{
		code: "DNG-HOA-VANG",
		keywords: [
			"bà nà",
			"núi chúa",
			"hòa bắc",
			"khe ram",
			"suối mơ",
			"hòa trung",
			"hòa vang",
			"hòa phú",
			"tà lang",
			"giàn bí",
			"cu đê",
		],
	},
	{ code: "DNG-LIEN-CHIEU", keywords: ["hải vân", "làng vân", "nam ô", "suối lương"] },
	{ code: "DNG-NGU-HANH-SON", keywords: ["ngũ hành sơn", "non nước", "huyền không", "thủy sơn"] },
	{ code: "DNG-HAI-CHAU", keywords: ["sông hàn", "cầu rồng"] },
	{ code: "DNG-THANH-KHE", keywords: ["thanh bình", "thanh khê"] },
	{ code: "DNG-CAM-LE", keywords: ["cẩm lệ", "la hường"] },
	{
		code: "DNG-SON-TRA",
		keywords: ["sơn trà", "voọc", "bàn cờ", "điệp sơn", "mũi nghê", "bãi bụt", "chùa linh ứng"],
	},
];

/**
 * Older performance-report seed Trips that were set outside Đà Nẵng, moved to real Đà Nẵng places.
 * `from` is the former title so existing databases are renamed in place.
 */
export const DA_NANG_TRIP_MOVES = [
	{
		from: "Trekking Tà Năng - Phan Dũng (Lâm Đồng)",
		title: "Trekking Tà Lang – Giàn Bí, bản làng Cơ Tu Hòa Bắc",
		description:
			"Băng rừng Hòa Bắc vào thôn Tà Lang, Giàn Bí, ngủ nhà sàn và nghe già làng Cơ Tu kể chuyện bản.",
		routeName: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
	},
	{
		from: "Khám phá Rừng Tràm Trà Sư (An Giang)",
		title: "Chèo kayak sông Cu Đê – Hòa Bắc",
		description:
			"Chèo kayak xuôi dòng Cu Đê giữa hai bờ núi Hòa Bắc, dừng tắm suối và ăn trưa bên bãi sỏi.",
		routeName: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
	},
	{
		from: "Chinh phục đỉnh Bidoup Núi Bà (Lâm Đồng)",
		title: "Xuyên rừng Bà Nà – Chinh phục đỉnh Núi Chúa",
		description:
			"Leo xuyên rừng nguyên sinh Bà Nà, cắm trại trên sườn núi và đón bình minh trên đỉnh Núi Chúa.",
		routeName: "Rừng Nguyên Sinh Bà Nà - Núi Chúa",
	},
	{
		from: "Khám phá VQG Cát Tiên (Đồng Nai)",
		title: "Ngắm voọc chà vá chân nâu – Rừng Sơn Trà",
		description:
			"Đi bộ nhẹ trong rừng Sơn Trà buổi sáng sớm, quan sát đàn voọc chà vá chân nâu kiếm ăn trên tán cây.",
		routeName: "Bán Đảo Sơn Trà Discovery",
	},
] as const;

/** Renames existing rows in place: only title, description and route change; ledger rows stay. */
async function moveLegacyTripsToDaNang(ds: DataSource, hostId: string): Promise<void> {
	for (const move of DA_NANG_TRIP_MOVES) {
		await ds.query(
			`UPDATE "trips" t
			 SET "title" = $2, "description" = $3,
				"route_id" = COALESCE(
					(SELECT r."id" FROM "trekking_routes" r WHERE r."name" = $4 ORDER BY r."created_at" LIMIT 1),
					t."route_id"
				)
			 WHERE t."host_id" = $5 AND t."title" = $1`,
			[move.from, move.title, move.description, move.routeName, hostId]
		);
	}
}

interface SeedRoute {
	id: string;
	name: string;
	description: string;
	/** Real path as [longitude, latitude] pairs. */
	path: Array<[number, number]>;
	lengthMeters: number;
	difficulty: "easy" | "moderate";
	durationMinutes: number;
}

const ROUTES: SeedRoute[] = [
	{
		id: "e1100000-0000-4000-8110-000000000401",
		name: "Thủy Sơn – Ngũ Hành Sơn",
		description:
			"Leo bậc đá Thủy Sơn qua chùa Linh Ứng, động Huyền Không, động Tàng Chơn lên đài Vọng Giang.",
		path: [
			[108.2629, 16.0041],
			[108.2637, 16.0034],
			[108.2644, 16.0027],
			[108.2649, 16.0021],
		],
		lengthMeters: 1600,
		difficulty: "easy",
		durationMinutes: 180,
	},
	{
		id: "e1100000-0000-4000-8110-000000000402",
		name: "Ven sông Hàn – Cầu Sông Hàn đến cầu Trần Thị Lý",
		description: "Đi bộ dọc đường Bạch Đằng bên bờ tây sông Hàn, qua chân cầu Rồng.",
		path: [
			[108.2236, 16.0716],
			[108.2253, 16.0661],
			[108.2264, 16.0612],
			[108.2279, 16.0532],
			[108.2286, 16.0489],
		],
		lengthMeters: 2700,
		difficulty: "easy",
		durationMinutes: 150,
	},
	{
		id: "e1100000-0000-4000-8110-000000000403",
		name: "Biển Thanh Bình – Làng chài Thanh Khê",
		description: "Đi bộ trên bãi biển Thanh Bình về phía xóm chài, xem thuyền thúng vào bờ.",
		path: [
			[108.2143, 16.0812],
			[108.2156, 16.0827],
			[108.2171, 16.0839],
			[108.219, 16.0848],
		],
		lengthMeters: 1300,
		difficulty: "easy",
		durationMinutes: 120,
	},
	{
		id: "e1100000-0000-4000-8110-000000000404",
		name: "Ven sông Cẩm Lệ – Làng rau La Hường",
		description: "Đi bộ từ cầu Cẩm Lệ dọc bờ sông về làng rau La Hường, phường Hòa Xuân.",
		path: [
			[108.2083, 16.0086],
			[108.2121, 16.0047],
			[108.2158, 16.0011],
			[108.2189, 15.9974],
		],
		lengthMeters: 2900,
		difficulty: "easy",
		durationMinutes: 180,
	},
];

interface HistoryTrip {
	id: string;
	bookingId: string;
	chargeId: string;
	/** Seeded route id, or the name of an existing host@ route. */
	route: { id: string } | { name: string };
	title: string;
	description: string;
	areaCode: string;
	tripType: "day_trip" | "overnight";
	startsAt: string;
	endsAt: string;
	numPeople: number;
	pricePerPerson: number;
	paidAt: string;
	refund?: { id: string; amount: number; succeededAt: string; reason: string };
	settledAt: string;
}

const HISTORY_TRIPS: HistoryTrip[] = [
	{
		id: "e1100000-0000-4000-8110-000000000001",
		bookingId: "e1100000-0000-4000-8110-000000000101",
		chargeId: "e1100000-0000-4000-8110-000000000201",
		route: { id: ROUTES[0].id },
		title: "Leo núi Ngũ Hành Sơn – Động Huyền Không",
		description:
			"Leo Thủy Sơn qua các hang động, chùa cổ và ngắm toàn cảnh biển Non Nước lúc bình minh.",
		areaCode: "DNG-NGU-HANH-SON",
		tripType: "day_trip",
		startsAt: "2026-08-15T22:30:00Z",
		endsAt: "2026-08-16T05:00:00Z",
		numPeople: 6,
		pricePerPerson: 650000,
		paidAt: "2026-08-08T09:12:00Z",
		settledAt: "2026-08-20T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000002",
		bookingId: "e1100000-0000-4000-8110-000000000102",
		chargeId: "e1100000-0000-4000-8110-000000000202",
		route: { name: "Rừng Nguyên Sinh Bà Nà - Núi Chúa" },
		title: "Trekking suối Hoa – Hòa Phú Thành",
		description: "Băng rừng dọc suối Hoa, tắm thác và cắm trại một đêm bên bờ suối ở Hòa Vang.",
		areaCode: "DNG-HOA-VANG",
		tripType: "overnight",
		startsAt: "2026-09-12T23:00:00Z",
		endsAt: "2026-09-13T09:00:00Z",
		numPeople: 8,
		pricePerPerson: 750000,
		paidAt: "2026-09-03T14:40:00Z",
		refund: {
			id: "e1100000-0000-4000-8110-000000000302",
			amount: 750000,
			succeededAt: "2026-09-09T03:15:00Z",
			reason: "Một thành viên trong nhóm báo bận việc gia đình trước ngày khởi hành.",
		},
		settledAt: "2026-09-17T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000003",
		bookingId: "e1100000-0000-4000-8110-000000000103",
		chargeId: "e1100000-0000-4000-8110-000000000203",
		route: { name: "Hải Vân Pass - Nam Hải Vân Trail" },
		title: "Cắm trại rạn Nam Ô – Ngắm hoàng hôn",
		description: "Đi bộ dọc ghềnh đá Nam Ô, dựng lều bên bờ biển và thưởng thức gỏi cá làng chài.",
		areaCode: "DNG-LIEN-CHIEU",
		tripType: "overnight",
		startsAt: "2026-10-17T08:00:00Z",
		endsAt: "2026-10-18T02:00:00Z",
		numPeople: 10,
		pricePerPerson: 550000,
		paidAt: "2026-10-06T11:05:00Z",
		settledAt: "2026-10-22T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000004",
		bookingId: "e1100000-0000-4000-8110-000000000104",
		chargeId: "e1100000-0000-4000-8110-000000000204",
		route: { id: ROUTES[1].id },
		title: "Đi bộ đêm ven sông Hàn – Xem cầu Rồng phun lửa",
		description:
			"Dạo bộ đường Bạch Đằng lúc lên đèn, dừng ở chân cầu Rồng xem phun lửa, phun nước lúc 21 giờ tối thứ Bảy.",
		areaCode: "DNG-HAI-CHAU",
		tripType: "day_trip",
		startsAt: "2026-10-24T12:30:00Z",
		endsAt: "2026-10-24T15:00:00Z",
		numPeople: 6,
		pricePerPerson: 350000,
		paidAt: "2026-10-18T08:20:00Z",
		settledAt: "2026-10-28T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000005",
		bookingId: "e1100000-0000-4000-8110-000000000105",
		chargeId: "e1100000-0000-4000-8110-000000000205",
		route: { id: ROUTES[2].id },
		title: "Bình minh biển Thanh Bình – Làng chài Thanh Khê",
		description:
			"Đón bình minh trên bãi Thanh Bình, xem ngư dân kéo thuyền thúng vào bờ và ăn sáng ở chợ cá.",
		areaCode: "DNG-THANH-KHE",
		tripType: "day_trip",
		startsAt: "2026-10-30T22:00:00Z",
		endsAt: "2026-10-31T01:30:00Z",
		numPeople: 8,
		pricePerPerson: 250000,
		paidAt: "2026-10-22T13:45:00Z",
		refund: {
			id: "e1100000-0000-4000-8110-000000000305",
			amount: 250000,
			succeededAt: "2026-10-28T04:10:00Z",
			reason: "Một khách đổi lịch công tác nên hủy trước ngày đi.",
		},
		settledAt: "2026-11-04T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000006",
		bookingId: "e1100000-0000-4000-8110-000000000106",
		chargeId: "e1100000-0000-4000-8110-000000000206",
		route: { id: ROUTES[3].id },
		title: "Đi bộ ven sông Cẩm Lệ – Làng rau La Hường",
		description:
			"Đi bộ sáng sớm dọc sông Cẩm Lệ, thăm vườn rau La Hường và tự tay hái rau nấu bữa trưa.",
		areaCode: "DNG-CAM-LE",
		tripType: "day_trip",
		startsAt: "2026-10-31T23:00:00Z",
		endsAt: "2026-11-01T04:00:00Z",
		numPeople: 10,
		pricePerPerson: 300000,
		paidAt: "2026-10-24T10:30:00Z",
		settledAt: "2026-11-05T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000007",
		bookingId: "e1100000-0000-4000-8110-000000000107",
		chargeId: "e1100000-0000-4000-8110-000000000207",
		route: { id: ROUTES[0].id },
		title: "Leo núi Thủy Sơn – Ngắm bình minh Non Nước",
		description:
			"Leo Thủy Sơn trước khi trời sáng, đón bình minh trên đài Vọng Giang rồi xuống làng đá Non Nước.",
		areaCode: "DNG-NGU-HANH-SON",
		tripType: "day_trip",
		startsAt: "2026-11-06T22:00:00Z",
		endsAt: "2026-11-07T02:30:00Z",
		numPeople: 7,
		pricePerPerson: 400000,
		paidAt: "2026-10-30T09:05:00Z",
		settledAt: "2026-11-11T02:00:00Z",
	},
];

const COMMISSION_RATE_BPS = 500n; // 5.00%, the rate in force when these Trips were settled.

function minorOf(vnd: number): bigint {
	return BigInt(Math.round(vnd)) * 100n;
}

function money(minor: bigint): string {
	return `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
}

function providerRef(prefix: string, at: string): string {
	return `${prefix}${at.replace(/\D/g, "").slice(0, 12)}`;
}

export async function backfillTripAreaSnapshots(ds: DataSource): Promise<number> {
	let updated = 0;
	for (const field of ["title", "route"] as const) {
		for (const { code, keywords } of AREA_KEYWORDS) {
			const patterns = keywords.map((keyword) => `%${keyword}%`);
			const column = field === "title" ? `t."title"` : `r."name"`;
			const rows = (await ds.query(
				`UPDATE "trips" t
				 SET "area_code" = ga."code", "area_name" = ga."name",
					"province_code" = ga."province_code", "province_name" = ga."province_name"
				 FROM "geo_areas" ga, "trekking_routes" r
				 WHERE ga."code" = $1 AND r."id" = t."route_id"
					AND t."area_code" IS NULL
					AND lower(${column}) LIKE ANY($2::text[])
				 RETURNING t."id"`,
				[code, patterns]
			)) as [unknown[], number] | unknown[];
			updated += Array.isArray(rows[0]) ? (rows[0] as unknown[]).length : rows.length;
		}
	}
	return updated;
}

async function ensureRoutes(ds: DataSource, hostId: string): Promise<void> {
	for (const route of ROUTES) {
		const lineString = `SRID=4326;LINESTRING(${route.path.map(([lon, lat]) => `${lon} ${lat}`).join(", ")})`;
		await ds.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "description", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, $3, $4, ST_GeomFromEWKT($5), $6, $7, $8, 'active')
			 ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description"`,
			[
				route.id,
				hostId,
				route.name,
				route.description,
				lineString,
				route.lengthMeters,
				route.difficulty,
				route.durationMinutes,
			]
		);
	}
}

async function resolveRouteId(
	ds: DataSource,
	hostId: string,
	route: HistoryTrip["route"]
): Promise<string | null> {
	if ("id" in route) return route.id;
	const rows = (await ds.query(
		`SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1
		 ORDER BY ("name" = $2) DESC, "created_at" ASC LIMIT 1`,
		[hostId, route.name]
	)) as Array<{ id: string }>;
	return rows[0]?.id ?? null;
}

export async function seedRevenueAnalyticsScenarios(ds: DataSource): Promise<void> {
	if (!ds.isInitialized) await ds.initialize();
	console.log("[seed:revenue-analytics] Seeding CTMS-110 revenue history and area snapshots...");

	const [host] = (await ds.query(
		`SELECT "id" FROM "users" WHERE "email" = 'host@ctms.local'`
	)) as Array<{ id: string }>;
	const [camper] = (await ds.query(
		`SELECT "id" FROM "users" WHERE "email" = 'camper@ctms.local'`
	)) as Array<{ id: string }>;
	if (!host || !camper) {
		console.warn("[seed:revenue-analytics] host@ctms.local or camper@ctms.local missing; skipped.");
		return;
	}

	await ensureRoutes(ds, host.id);
	await moveLegacyTripsToDaNang(ds, host.id);

	for (const trip of HISTORY_TRIPS) {
		const routeId = await resolveRouteId(ds, host.id, trip.route);
		if (!routeId) {
			console.warn(`[seed:revenue-analytics] No route for "${trip.title}"; skipped.`);
			continue;
		}
		const firstPoint =
			"id" in trip.route ? ROUTES.find((route) => route.id === routeId)?.path[0] : undefined;
		const meetingPoint = JSON.stringify({
			type: "Point",
			coordinates: firstPoint ?? [108.2022, 16.0544],
		});
		const durationNights = trip.tripType === "day_trip" ? 0 : 1;

		const totalMinor = minorOf(trip.numPeople * trip.pricePerPerson);
		const refundMinor = trip.refund ? minorOf(trip.refund.amount) : 0n;
		const baseMinor = totalMinor - refundMinor;
		const feeMinor = (baseMinor * COMMISSION_RATE_BPS) / 10000n;
		const netMinor = baseMinor - feeMinor;

		await ds.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "description", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "meeting_at", "booking_deadline", "capacity_min", "capacity_max",
				"seats_taken", "price_per_person", "status", "created_at",
				"area_code", "area_name", "province_code", "province_name")
			 SELECT $1::uuid, $2::uuid, $3::uuid, $4::varchar, $5::text, $12::trip_type, $13::int,
				$6::timestamptz, $7::timestamptz,
				ST_SetSRID(ST_GeomFromGeoJSON($8), 4326)::geography, $6::timestamptz - interval '30 minutes',
				$6::timestamptz - interval '2 days', 4, 12, $9::int, $10::numeric, 'completed',
				$6::timestamptz - interval '21 days',
				ga."code", ga."name", ga."province_code", ga."province_name"
			 FROM "geo_areas" ga WHERE ga."code" = $11
			 ON CONFLICT ("id") DO UPDATE SET
				"title" = EXCLUDED."title", "description" = EXCLUDED."description",
				"route_id" = EXCLUDED."route_id", "meeting_point" = EXCLUDED."meeting_point",
				"trip_type" = EXCLUDED."trip_type", "duration_nights" = EXCLUDED."duration_nights"`,
			[
				trip.id,
				host.id,
				routeId,
				trip.title,
				trip.description,
				trip.startsAt,
				trip.endsAt,
				meetingPoint,
				trip.numPeople,
				trip.pricePerPerson,
				trip.areaCode,
				trip.tripType,
				durationNights,
			]
		);

		await ds.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "status", "payment_status", "total_amount", "created_at")
			 VALUES ($1, $2, $3, $4, 'completed', 'paid', $5, $6::timestamptz - interval '10 minutes')
			 ON CONFLICT ("id") DO NOTHING`,
			[trip.bookingId, trip.id, camper.id, trip.numPeople, money(totalMinor), trip.paidAt]
		);

		const chargeRef = providerRef("VNP", trip.paidAt);
		await ds.query(
			`INSERT INTO "payments" ("id", "booking_id", "amount", "type", "status", "provider_reference", "succeeded_at", "created_at", "updated_at")
			 VALUES ($1, $2, $3, 'charge', 'succeeded', $4, $5, $5, $5)
			 ON CONFLICT ("id") DO NOTHING`,
			[trip.chargeId, trip.bookingId, money(totalMinor), chargeRef, trip.paidAt]
		);
		await ds.query(
			`INSERT INTO "payment_transactions" ("payment_id", "transaction_ref", "status", "created_at")
			 SELECT $1, $2, 'succeeded', $3
			 WHERE NOT EXISTS (SELECT 1 FROM "payment_transactions" WHERE "payment_id" = $1)`,
			[trip.chargeId, chargeRef, trip.paidAt]
		);

		if (trip.refund) {
			await ds.query(
				`INSERT INTO "payments" ("id", "booking_id", "amount", "type", "status", "review_status", "parent_payment_id", "succeeded_at", "created_at", "updated_at")
				 VALUES ($1, $2, $3, 'refund', 'succeeded', 'approved', $4, $5, $5::timestamptz - interval '1 day', $5)
				 ON CONFLICT ("id") DO NOTHING`,
				[trip.refund.id, trip.bookingId, money(refundMinor), trip.chargeId, trip.refund.succeededAt]
			);
			await ds.query(
				`INSERT INTO "payment_transactions" ("payment_id", "transaction_ref", "status", "raw_payload", "created_at")
				 SELECT $1, $2, 'succeeded', $3::jsonb, $4
				 WHERE NOT EXISTS (SELECT 1 FROM "payment_transactions" WHERE "payment_id" = $1)`,
				[
					trip.refund.id,
					providerRef("RF", trip.refund.succeededAt),
					JSON.stringify({ reason: trip.refund.reason }),
					trip.refund.succeededAt,
				]
			);
		}

		await ds.query(
			`INSERT INTO "settlements" ("trip_id", "host_id", "settlement_base", "commission_rate", "platform_fee", "net_amount", "settled_at", "created_at", "updated_at")
			 VALUES ($1, $2, $3, '0.0500', $4, $5, $6, $6, $6)
			 ON CONFLICT ("trip_id") DO NOTHING`,
			[trip.id, host.id, money(baseMinor), money(feeMinor), money(netMinor), trip.settledAt]
		);
	}

	const areaCount = await backfillTripAreaSnapshots(ds);
	console.log(
		`[seed:revenue-analytics] ${HISTORY_TRIPS.length} settled Trips ensured; ${areaCount} Trips received an area snapshot.`
	);
}

// ==========================================================================
// safety-hotspots.seed.ts (consolidated into the master seed)
// ==========================================================================

/**
 * CTMS-116/117/118 seed: route-deviation evidence on host@ctms.local's Sơn Trà route, the
 * hotspots the real CTMS-116 detector finds in it, and a review state for each, so the Admin
 * "Điểm nóng an toàn" page has new detections, pending reviews and confirmed evidence.
 *
 * Rules (AGENTS.md):
 * - Reuses host@ctms.local, admin@ctms.local and the members already booked on completed Trips;
 *   never creates accounts, Routes or Trips.
 * - Deviation events sit at separate places along the route and carry fixed GPS-log ids,
 *   so a re-run inserts nothing new.
 * - Hotspots come from SafetyHotspotsService.detect (BR-417 criteria), not hand-written rows.
 * - Only newly detected fixtures receive their initial review through the real review service.
 *   Existing Admin decisions and notes are preserved on re-runs.
 */

const ROUTE_NAME = "Bán Đảo Sơn Trà Discovery";
const HOST_EMAIL = "host@ctms.local";
const ADMIN_EMAIL = "admin@ctms.local";
const METERS_PER_DEGREE_LAT = 111_320;

interface Spot {
	/** Fixed prefix of the GPS-log ids, keeps every event unique and re-runs idempotent. */
	key: string;
	lng: number;
	lat: number;
	routeFraction: number;
	reviewStatus: "UNDER_REVIEW" | "CONFIRMED";
	reviewNote?: string;
}

/** Separate places on the route where several groups left the trail in the last weeks. */
const SPOTS: Spot[] = [
	{
		key: "a1180000-0000-4000-8118-0000000001",
		lng: 108.2899,
		lat: 16.1154,
		routeFraction: 0.74,
		reviewStatus: "CONFIRMED",
		reviewNote:
			"Đối chiếu nhật ký của Host: sau mưa các đoàn tránh đoạn dốc trơn bằng lối mòn sát mép vực ở Dốc Vọng Cảnh. Xác nhận là điểm nguy hiểm cần cập nhật hướng dẫn.",
	},
	{
		key: "a1180000-0000-4000-8118-0000000002",
		lng: 108.2803,
		lat: 16.1207,
		routeFraction: 0.5,
		reviewStatus: "UNDER_REVIEW",
		reviewNote:
			"Đang hỏi Host về việc đoàn rẽ xuống suối lấy nước tại Trạm Suối Đá; cần xác minh lối xuống suối có an toàn không.",
	},
	{
		key: "a1180000-0000-4000-8118-0000000003",
		lng: 108.2678,
		lat: 16.1147,
		routeFraction: 0.2,
		reviewStatus: "UNDER_REVIEW",
		reviewNote:
			"Các đoàn cùng rẽ vào lối mòn phía trên ngã ba. Đang đối chiếu với Host về biển chỉ hướng bị cây che khuất sau mưa.",
	},
	{
		key: "a1180000-0000-4000-8118-0000000004",
		lng: 108.2758,
		lat: 16.1187,
		routeFraction: 0.4,
		reviewStatus: "UNDER_REVIEW",
		reviewNote:
			"Nhiều đoàn đi vòng qua đoạn đường có đá rơi. Đang xác minh độ ổn định của sườn dốc trước khi bổ sung cảnh báo.",
	},
	{
		key: "a1180000-0000-4000-8118-0000000005",
		lng: 108.2942,
		lat: 16.1137,
		routeFraction: 0.85,
		reviewStatus: "UNDER_REVIEW",
	},
];

/** Offsets in metres (north, east) of each event's start from the spot; all within 25 m. */
const OFFSETS: Array<[number, number]> = [
	[0, 0],
	[8, -6],
	[-10, 4],
	[14, 9],
	[-6, -12],
	[4, 15],
];

interface Participant {
	tripId: string;
	userId: string;
	startsAt: Date;
}

export async function seedSafetyHotspotScenarios(ds: DataSource): Promise<void> {
	const [route] = (await ds.query(
		`SELECT r."id", md5(ST_AsBinary(r."route_geom")) AS "routeVersion"
		 FROM "trekking_routes" r JOIN "users" u ON u."id" = r."host_id"
		 WHERE u."email" = $1 AND r."name" = $2`,
		[HOST_EMAIL, ROUTE_NAME]
	)) as Array<{ id: string; routeVersion: string }>;
	const [admin] = (await ds.query(`SELECT "id" FROM "users" WHERE "email" = $1`, [
		ADMIN_EMAIL,
	])) as Array<{
		id: string;
	}>;
	if (!route || !admin) {
		console.log(`   ⚠️  Bỏ qua: chưa có tuyến "${ROUTE_NAME}" hoặc tài khoản ${ADMIN_EMAIL}.`);
		return;
	}

	// Two members from each of the three completed Trips with the most joined members.
	const participants = (await ds.query(
		`WITH members AS (
		   SELECT t."id" AS "tripId", bm."user_id" AS "userId", t."starts_at" AS "startsAt",
		          row_number() OVER (PARTITION BY t."id" ORDER BY bm."user_id") AS rn,
		          count(*) OVER (PARTITION BY t."id") AS total
		   FROM "trips" t
		   JOIN "bookings" b ON b."trip_id" = t."id" AND b."status" IN ('completed', 'confirmed')
		   JOIN "booking_members" bm ON bm."booking_id" = b."id" AND bm."user_id" IS NOT NULL
		   WHERE t."route_id" = $1 AND t."status" = 'completed'
		     AND t."starts_at" > now() - interval '28 days'
		 ), trips AS (
		   SELECT "tripId" FROM members GROUP BY "tripId" ORDER BY max(total) DESC, "tripId" LIMIT 3
		 )
		 SELECT "tripId", "userId", "startsAt" FROM members
		 WHERE "tripId" IN (SELECT "tripId" FROM trips) AND rn <= 2
		 ORDER BY "tripId", "userId"`,
		[route.id]
	)) as Participant[];
	const tripCount = new Set(participants.map((p) => p.tripId)).size;
	const memberCount = new Set(participants.map((p) => p.userId)).size;
	if (tripCount < 3 || memberCount < 3 || participants.length < 5) {
		console.log(
			"   ⚠️  Bỏ qua: tuyến Sơn Trà cần ít nhất 3 chuyến đã hoàn thành trong 28 ngày qua có thành viên tham gia."
		);
		return;
	}

	await ds.transaction(async (manager) => {
		const analysisIds = new Map<string, string>();
		for (const tripId of new Set(participants.map((p) => p.tripId))) {
			await manager.query(
				`INSERT INTO "route_deviation_trip_analyses"
				   ("trip_id", "analysis_version", "route_id", "route_version", "runtime_context",
				    "participants", "samples_total", "samples_used", "episodes", "analyzed_at")
				 SELECT $1, $2, $3, $4, '{}'::jsonb, $5, 0, 0, 0, t."ends_at" + interval '1 hour'
				 FROM "trips" t WHERE t."id" = $1
				 ON CONFLICT ("trip_id", "analysis_version") DO NOTHING`,
				[
					tripId,
					ROUTE_DEVIATION_ANALYSIS_VERSION,
					route.id,
					route.routeVersion,
					participants.filter((p) => p.tripId === tripId).length,
				]
			);
			const [row] = (await manager.query(
				`SELECT "id" FROM "route_deviation_trip_analyses" WHERE "trip_id" = $1 AND "analysis_version" = $2`,
				[tripId, ROUTE_DEVIATION_ANALYSIS_VERSION]
			)) as Array<{ id: string }>;
			analysisIds.set(tripId, row.id);
		}

		for (const spot of SPOTS) {
			for (const [index, participant] of participants.entries()) {
				const [north, east] = OFFSETS[index % OFFSETS.length];
				const lat = spot.lat + north / METERS_PER_DEGREE_LAT;
				const lng =
					spot.lng + east / (METERS_PER_DEGREE_LAT * Math.cos((spot.lat * Math.PI) / 180));
				const suffix = String(index).padStart(2, "0");
				// Events start 2–4 hours into the Trip, a few minutes apart per member.
				const startedAt = new Date(
					new Date(participant.startsAt).getTime() + (2 * 60 + index * 7) * 60_000
				);
				await manager.query(
					`INSERT INTO "route_deviation_events"
					   ("analysis_id", "analysis_version", "config_version", "trip_id", "route_id", "route_version",
					    "package_version", "user_id", "participant_role", "started_at", "confirmed_at", "ended_at",
					    "end_reason", "sample_count", "valid_sample_count", "max_distance_meters", "avg_distance_meters",
					    "start_location", "max_distance_location", "start_route_fraction", "start_gps_log_id",
					    "end_gps_log_id", "runtime_context", "authoritative", "context_issues")
					 VALUES ($1, $2, 'v3', $3, $4, $5, '1', $6, 'camper', $7,
					   $7::timestamptz + interval '1 minute', $7::timestamptz + interval '9 minutes', 'RECOVERED',
					   18, 16, $8, $9,
					   ST_SetSRID(ST_MakePoint($10, $11), 4326)::geography,
					   ST_SetSRID(ST_MakePoint($10, $11 + 0.0006), 4326)::geography,
					   $12, $13, $14, '{}'::jsonb, true, '{}'::text[])
					 ON CONFLICT ("analysis_version", "start_gps_log_id") DO NOTHING`,
					[
						analysisIds.get(participant.tripId),
						ROUTE_DEVIATION_ANALYSIS_VERSION,
						participant.tripId,
						route.id,
						route.routeVersion,
						participant.userId,
						startedAt,
						72 + index * 6,
						58 + index * 4,
						lng,
						lat,
						spot.routeFraction,
						`${spot.key}${suffix}`,
						`${spot.key.slice(0, -2)}99${suffix}`,
					]
				);
			}
		}
	});

	// Real CTMS-116 detection over the evidence; idempotent, it skips places already covered.
	const detection = await new SafetyHotspotsService(new SafetyHotspotsRepository(ds)).detect(
		admin.id
	);
	console.log(
		`   • Phát hiện điểm nóng: ${detection.candidatesCreated} mới từ ${detection.eventsConsidered} lần lệch tuyến.`
	);

	// Initialize only candidates created in this run; never undo a user's review.
	const reviews = new HotspotReviewService(ds);
	for (const spot of SPOTS) {
		if (spot.reviewStatus === "UNDER_REVIEW" || !spot.reviewNote) continue;
		const candidates = (await ds.query(
			`SELECT "id" FROM "potential_safety_hotspots"
			 WHERE "route_id" = $1 AND "route_version" = $2 AND "status" = 'UNDER_REVIEW'
			   AND "id" = ANY($5::uuid[])
			   AND ST_DWithin("center", ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 60)`,
			[route.id, route.routeVersion, spot.lng, spot.lat, detection.createdHotspotIds]
		)) as Array<{ id: string }>;
		for (const { id } of candidates) {
			await reviews.review(admin.id, id, {
				status: SafetyHotspotStatus.CONFIRMED,
				reason: spot.reviewNote,
			});
		}
	}

	const summary = (await ds.query(
		`SELECT "status", count(*)::int AS "count" FROM "potential_safety_hotspots"
		 WHERE "route_id" = $1 GROUP BY "status" ORDER BY "status"`,
		[route.id]
	)) as Array<{ status: string; count: number }>;
	console.log(
		`   • Điểm nóng trên tuyến ${ROUTE_NAME}: ${summary.map((row) => `${row.status} ${row.count}`).join(", ")}`
	);
}

const BCRYPT_COST_FACTOR = 10;
export const DEMO_SYNC_TRIP_ID = "a1736fee-62be-4991-9478-a62288e9b80a";
export const DEMO_OFFLINE_BUFFER_TRIP_ID = "c3958000-0064-4064-8064-000000000064";

// ==========================================================================
// PORTER SEED FIXTURES & DATA DEFINITIONS
// ==========================================================================

export const PORTER_SEED_ROUTE_NAMES = [
	"Bán Đảo Sơn Trà Discovery",
	"Hải Vân Pass - Nam Hải Vân Trail",
	"Rừng Nguyên Sinh Bà Nà - Núi Chúa",
	"Khe Ram - Suối Mơ - Rừng Hòa Bắc",
] as const;

export type PorterSeedRouteName = (typeof PORTER_SEED_ROUTE_NAMES)[number];
export type PorterSeedAvailability = "available" | "unavailable";
export type PorterSeedProficiency = "learning" | "proficient" | "expert";
export type PorterSeedUserStatus = "active" | "suspended";

export interface PorterSeedFixture {
	key: string;
	email: string;
	phone: string;
	fullName: string;
	userStatus: PorterSeedUserStatus;
	profile: {
		experienceYears: number;
		availabilityStatus: PorterSeedAvailability;
		ratingAvg: number;
		completedTrips: number;
		languages: string[];
	} | null;
	qualification: {
		proficiency: PorterSeedProficiency;
		timesLed: number;
		routeNames: readonly PorterSeedRouteName[];
	} | null;
	conflictingTripTitle?: string;
}

export interface PorterSeedTripScenario {
	title: string;
	window: {
		startsAfterDays: number;
		startHour: number;
		endsAfterDays: number;
		endHour: number;
	};
}

export const PORTER_CONFLICT_TARGET_TRIP: PorterSeedTripScenario = {
	title: "[CTMS-024] Trekking Khe Ram - Rừng Hòa Bắc (Sắp hết hạn - Còn 8h)",
	window: { startsAfterDays: 2, startHour: 6, endsAfterDays: 3, endHour: 17 },
};

export const PORTER_NON_CONFLICT_TARGET_TRIP: PorterSeedTripScenario = {
	title: "[CTMS-024] Khám Phá Bán Đảo Sơn Trà (Bình thường - Còn 12 chỗ)",
	window: { startsAfterDays: 4, startHour: 7, endsAfterDays: 4, endHour: 16 },
};

export const PORTER_CONFLICT_ASSIGNMENT_TRIP: PorterSeedTripScenario = {
	title: "[H-09] Chuyến phân công Porter trùng lịch Khe Ram",
	window: { startsAfterDays: 2, startHour: 12, endsAfterDays: 2, endHour: 16 },
};

export const PORTER_CONFLICT_TRIP_TITLE = PORTER_CONFLICT_ASSIGNMENT_TRIP.title;

export function porterSeedTripWindowsOverlap(
	left: PorterSeedTripScenario["window"],
	right: PorterSeedTripScenario["window"]
): boolean {
	const leftStart = left.startsAfterDays * 24 + left.startHour;
	const leftEnd = left.endsAfterDays * 24 + left.endHour;
	const rightStart = right.startsAfterDays * 24 + right.startHour;
	const rightEnd = right.endsAfterDays * 24 + right.endHour;
	return leftStart < rightEnd && leftEnd > rightStart;
}

export const PORTER_SEED_FIXTURES: readonly PorterSeedFixture[] = [
	{
		key: "expert-lead",
		email: "porter@ctms.local",
		phone: "0900000001",
		fullName: "Nguyễn Minh Sơn",
		userStatus: "active",
		profile: {
			experienceYears: 5,
			availabilityStatus: "available",
			ratingAvg: 4.95,
			completedTrips: 42,
			languages: ["Tiếng Việt", "Tiếng Anh"],
		},
		qualification: {
			proficiency: "expert",
			timesLed: 28,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "proficient-lead",
		email: "porter.proficient@ctms.local",
		phone: "0900000021",
		fullName: "Trần Hoàng An",
		userStatus: "active",
		profile: {
			experienceYears: 4,
			availabilityStatus: "available",
			ratingAvg: 4.7,
			completedTrips: 24,
			languages: ["Tiếng Việt"],
		},
		qualification: {
			proficiency: "proficient",
			timesLed: 9,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "learning-support",
		email: "porter.learning@ctms.local",
		phone: "0900000022",
		fullName: "Lê Thị Mai",
		userStatus: "active",
		profile: {
			experienceYears: 1,
			availabilityStatus: "available",
			ratingAvg: 4.2,
			completedTrips: 5,
			languages: ["Tiếng Việt"],
		},
		qualification: {
			proficiency: "learning",
			timesLed: 0,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "support-no-qualification",
		email: "porter.support@ctms.local",
		phone: "0900000023",
		fullName: "Phạm Quốc Bảo",
		userStatus: "active",
		profile: {
			experienceYears: 2,
			availabilityStatus: "available",
			ratingAvg: 4.4,
			completedTrips: 11,
			languages: ["Tiếng Việt"],
		},
		qualification: null,
	},
	{
		key: "second-expert-lead",
		email: "porter.expert@ctms.local",
		phone: "0900000024",
		fullName: "Đỗ Thanh Tùng",
		userStatus: "active",
		profile: {
			experienceYears: 8,
			availabilityStatus: "available",
			ratingAvg: 4.85,
			completedTrips: 67,
			languages: ["Tiếng Việt", "Tiếng Anh"],
		},
		qualification: {
			proficiency: "expert",
			timesLed: 41,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "unavailable",
		email: "porter.unavailable@ctms.local",
		phone: "0900000025",
		fullName: "Võ Ngọc Hà",
		userStatus: "active",
		profile: {
			experienceYears: 6,
			availabilityStatus: "unavailable",
			ratingAvg: 4.6,
			completedTrips: 31,
			languages: ["Tiếng Việt"],
		},
		qualification: {
			proficiency: "expert",
			timesLed: 17,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
	},
	{
		key: "inactive-account",
		email: "porter.inactive@ctms.local",
		phone: "0900000026",
		fullName: "Bùi Đức Long",
		userStatus: "suspended",
		profile: {
			experienceYears: 7,
			availabilityStatus: "available",
			ratingAvg: 4.8,
			completedTrips: 38,
			languages: ["Tiếng Việt"],
		},
		qualification: null,
	},
	{
		key: "missing-profile",
		email: "porter.no-profile@ctms.local",
		phone: "0900000027",
		fullName: "Ngô Hải Nam",
		userStatus: "active",
		profile: null,
		qualification: null,
	},
	{
		key: "schedule-conflict",
		email: "porter.conflict@ctms.local",
		phone: "0900000028",
		fullName: "Hoàng Gia Huy",
		userStatus: "active",
		profile: {
			experienceYears: 3,
			availabilityStatus: "available",
			ratingAvg: 4.5,
			completedTrips: 16,
			languages: ["Tiếng Việt"],
		},
		qualification: {
			proficiency: "proficient",
			timesLed: 6,
			routeNames: PORTER_SEED_ROUTE_NAMES,
		},
		conflictingTripTitle: PORTER_CONFLICT_TRIP_TITLE,
	},
];

// ==========================================================================
// REPAIR DEMO BOOKING CANCELLATION HELPER
// ==========================================================================

export interface DemoBooking {
	id: string;
	status: string;
	paymentStatus: string;
	email: string;
	title: string;
	totalAmount: string;
	policy: unknown;
	snapshot: unknown;
	idempotencyKey: string | null;
	fingerprint: string | null;
}

export const DEMO_EMAILS = new Set([
	"camper@ctms.local",
	"camper.lan@ctms.local",
	"camper.nam@ctms.local",
	"camper.tuan@ctms.local",
	"camper.nhu@ctms.local",
]);

/** Repair synthetic seed data only. Never call from a booking/payment request. */
export async function repairDemoBookingCancellation(
	dataSource: DataSource,
	bookingId: string
): Promise<{ policyRepaired: boolean; chargeCreated: boolean }> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("Demo repair is disabled in production");
	}
	return dataSource.transaction(async (manager) => {
		const rows: DemoBooking[] = await manager.query(
			`SELECT b.id,b.status,b.payment_status AS "paymentStatus",u.email,t.title,b.total_amount AS "totalAmount",t.cancellation_policy AS policy,b.cancellation_policy_snapshot AS snapshot,b.idempotency_key AS "idempotencyKey",b.request_fingerprint AS fingerprint
   FROM bookings b JOIN users u ON u.id=b.user_id JOIN trips t ON t.id=b.trip_id WHERE b.id=$1 FOR UPDATE OF b,t`,
			[bookingId]
		);
		const booking = rows[0];
		if (
			!booking ||
			!DEMO_EMAILS.has(booking.email) ||
			!booking.title.startsWith("[CTMS-024]") ||
			booking.idempotencyKey ||
			booking.fingerprint
		) {
			throw new Error("Refusing to repair a non-seed Booking");
		}
		if (booking.status !== "confirmed" || booking.paymentStatus !== "paid") {
			return { policyRepaired: false, chargeCreated: false };
		}
		const policy = parseCancellationPolicy(booking.policy);
		let policyRepaired = false;
		if (booking.snapshot === null) {
			await manager.query(
				"UPDATE bookings SET cancellation_policy_snapshot=$2::jsonb WHERE id=$1",
				[bookingId, JSON.stringify(policy)]
			);
			policyRepaired = true;
		}
		const payments: { id: string }[] = await manager.query(
			"SELECT id FROM payments WHERE booking_id=$1",
			[bookingId]
		);
		let chargeCreated = false;
		if (!payments.length && Number(booking.totalAmount) > 0) {
			const key = `demo-seed:charge:${bookingId}`;
			const charge: { id: string }[] = await manager.query(
				`INSERT INTO payments (booking_id,type,status,amount,idempotency_key,request_fingerprint,provider_reference) VALUES ($1,'charge','succeeded',$2,$3,$4,'DEMO-SEED-NO-REAL-PAYMENT') RETURNING id`,
				[bookingId, booking.totalAmount, key, createHash("sha256").update(key).digest("hex")]
			);
			await manager.query(
				`INSERT INTO payment_transactions (payment_id,status,raw_payload) VALUES ($1,'succeeded',$2::jsonb)`,
				[charge[0].id, JSON.stringify({ source: "demo-seed-repair", simulated: true })]
			);
			chargeCreated = true;
		}
		if (policyRepaired || chargeCreated) {
			await manager.query(
				`INSERT INTO audit_logs (actor_id,action,target_type,target_id,before,after,reason) SELECT user_id,'demo.booking_repaired','booking',id,$2::jsonb,$3::jsonb,'Repair synthetic seed policy/payment evidence; no real payment' FROM bookings WHERE id=$1`,
				[
					bookingId,
					JSON.stringify({ policySnapshot: booking.snapshot, paymentCount: payments.length }),
					JSON.stringify({ policyRepaired, chargeCreated }),
				]
			);
		}
		return { policyRepaired, chargeCreated };
	});
}

// ==========================================================================
// [0/9] CLEAN / WIPE DATABASE (FRESH SEED)
// ==========================================================================
export async function cleanDatabase(ds = dataSource): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[cleanDatabase] Refusing to truncate database in production!");
	}
	if (!ds.isInitialized) {
		await ds.initialize();
	}

	const tablesRes: Array<{ tablenames: string }> = await ds.query(`
		SELECT string_agg(quote_ident(tablename), ', ') as tablenames
		FROM pg_tables
		WHERE schemaname = 'public' 
		  AND tablename NOT IN ('migrations', 'spatial_ref_sys')
	`);

	if (tablesRes.length > 0 && tablesRes[0]?.tablenames) {
		const tableList = tablesRes[0].tablenames;
		console.log("[cleanDatabase] 🧹 Truncating all user tables with CASCADE...");
		await ds.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
		console.log(
			`[cleanDatabase] ✅ Successfully wiped ${tableList.split(",").length} tables clean (RESTART IDENTITY CASCADE).\n`
		);
	}
}

// ==========================================================================
// [1/6] ADMIN & PORTER ACCOUNTS
// ==========================================================================
interface SeedAccount {
	label: string;
	email: string;
	phone: string;
	password: string;
	role: "admin" | "porter" | "camper" | "host";
	fullName?: string;
	avatarUrl?: string;
	dateOfBirth?: string;
	address?: string;
	gender?: "male" | "female" | "other";
}

const SEED_ACCOUNTS: SeedAccount[] = [
	{
		label: "admin",
		email: "admin@ctms.local",
		phone: "0900000000",
		password: "Admin@123",
		role: "admin",
		fullName: "Quản trị viên hệ thống",
	},
	{
		label: "host",
		email: "host@ctms.local",
		phone: "0900000002",
		password: "Host@123",
		role: "host",
		fullName: "Host Ban Mai",
	},
	{
		label: "porter",
		email: "porter@ctms.local",
		phone: "0900000001",
		password: "Porter@123",
		role: "porter",
		fullName: "Porter Chuyên Nghiệp",
		avatarUrl: "https://i.pravatar.cc/160?img=12",
	},
	{
		label: "porter2",
		email: "porter2@ctms.local",
		phone: "0900000004",
		password: "Porter2@123",
		role: "porter",
		fullName: "Porter 2",
		avatarUrl: "https://i.pravatar.cc/160?img=68",
	},
	{
		label: "camper",
		email: "camper@ctms.local",
		phone: "0900000003",
		password: "Camper@123",
		role: "camper",
		fullName: "Nguyễn Văn An",
		dateOfBirth: "1998-10-20",
		gender: "male",
		address: "Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
	},
];

export async function seedDevAdmin(): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[seed:dev-admin] Refusing to run with NODE_ENV=production.");
	}

	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}

	for (const account of SEED_ACCOUNTS) {
		await seedAccount(account);
	}
}

async function seedAccount(account: SeedAccount): Promise<void> {
	const existing: Array<{ id: string; email: string | null }> = await dataSource.query(
		'SELECT "id", "email" FROM "users" WHERE "email" = $1 OR "phone" = $2',
		[account.email, account.phone]
	);

	if (existing.length > 0) {
		await grantRole(existing[0].id, account.role);
		await dataSource.query(
			`UPDATE "users" 
			 SET "full_name" = COALESCE("full_name", $2), 
			     "avatar_url" = COALESCE("avatar_url", $3),
			     "date_of_birth" = COALESCE($4, "date_of_birth"),
			     "address" = COALESCE($5, "address"),
			     "gender" = COALESCE($6, "gender")
			 WHERE "id" = $1`,
			[
				existing[0].id,
				account.fullName ?? account.label,
				account.avatarUrl ?? null,
				account.dateOfBirth ?? null,
				account.address ?? null,
				account.gender ?? null,
			]
		);
		console.log(
			`[seed:dev-admin] ${account.label} already exists (id=${existing[0].id}, email=${existing[0].email}) — ensured role=${account.role}.`
		);
		return;
	}

	const passwordHash = await hash(account.password, BCRYPT_COST_FACTOR);

	const inserted: Array<{ id: string }> = await dataSource.query(
		`INSERT INTO "users" (email, phone, password_hash, role, status, full_name, avatar_url, date_of_birth, address, gender)
				 VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9)
			 ON CONFLICT (email) DO NOTHING
			 RETURNING id`,
		[
			account.email,
			account.phone,
			passwordHash,
			account.role,
			account.fullName ?? account.label,
			account.avatarUrl ?? null,
			account.dateOfBirth ?? null,
			account.address ?? null,
			account.gender ?? null,
		]
	);

	if (inserted.length === 0) {
		const concurrentExisting: Array<{ id: string; email: string | null }> = await dataSource.query(
			'SELECT "id", "email" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[account.email, account.phone]
		);
		if (concurrentExisting.length > 0) {
			await grantRole(concurrentExisting[0].id, account.role);
		}
		console.log(
			`[seed:dev-admin] ${account.label} insert skipped by ON CONFLICT — ensured role if row now exists.`
		);
		return;
	}

	await grantRole(inserted[0].id, account.role);
	console.log(
		`[seed:dev-admin] Created dev ${account.label} account (id=${inserted[0].id}, email=${account.email}).`
	);
}

async function grantRole(userId: string, role: SeedAccount["role"]): Promise<void> {
	await dataSource.query(
		`INSERT INTO "user_roles" ("user_id", "role")
		 VALUES ($1, $2)
		 ON CONFLICT ("user_id", "role") DO NOTHING`,
		[userId, role]
	);
}

// ==========================================================================
// [2/6] HOST & BASELINE TREKKING ROUTE
// ==========================================================================
export async function seedDevHostAndRoute(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:dev-host] Database initialized.");

	// 1. Create Host user
	const hostEmail = "host@ctms.local";
	const hostPhone = "0900000002";
	const hostPassword = "Host@123";

	const existingUser: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
		[hostEmail, hostPhone]
	);

	let hostId = "";
	if (existingUser.length > 0) {
		hostId = existingUser[0].id;
		const passwordHash = await hash(hostPassword, BCRYPT_COST_FACTOR);
		await dataSource.query('UPDATE "users" SET password_hash = $1 WHERE id = $2', [
			passwordHash,
			hostId,
		]);
		console.log(`[seed:dev-host] Host already exists with ID: ${hostId}`);
	} else {
		const passwordHash = await hash(hostPassword, BCRYPT_COST_FACTOR);
		const insertedUser: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "users" (email, phone, password_hash, role, status, full_name)
			 VALUES ($1, $2, $3, 'host', 'active', 'Host Ban Mai')
			 RETURNING id`,
			[hostEmail, hostPhone, passwordHash]
		);
		hostId = insertedUser[0].id;
		await dataSource.query(
			`INSERT INTO "user_roles" (user_id, role) VALUES ($1, 'host') ON CONFLICT DO NOTHING`,
			[hostId]
		);
		console.log(`[seed:dev-host] Created Host user with ID: ${hostId}`);
	}

	// 2. Create active Trekking Route
	const routeName = "Đỉnh Núi Bidoup Trail";
	const existingRoute: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1 AND "name" = $2',
		[hostId, routeName]
	);

	if (existingRoute.length > 0) {
		console.log(`[seed:dev-host] Route already exists with ID: ${existingRoute[0].id}`);
	} else {
		const insertedRoute: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, $2, 'Cung đường trekking chinh phục đỉnh núi Bidoup', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.47 11.95)'), 2500, 'moderate', 180, 'active')
			 RETURNING id`,
			[hostId, routeName]
		);
		console.log(`[seed:dev-host] Created active Trekking Route with ID: ${insertedRoute[0].id}`);
	}

	console.log("[seed:dev-host] Seeding completed successfully!");
}

// ==========================================================================
// [3/6] FULL TRIPS ECOSYSTEM (EQUIPMENT, ROUTES, CAMPSITES, CAMPERS, TRIPS)
// ==========================================================================
export async function seedDevTrips(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:dev-trips] Database initialized.");

	try {
		// 1. Ensure Host user
		const hostEmail = "host@ctms.local";
		const hostPhone = "0900000002";
		const hostPassword = "Host@123";

		const existingUser: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[hostEmail, hostPhone]
		);

		let hostId = "";
		if (existingUser.length > 0) {
			hostId = existingUser[0].id;
		} else {
			const passwordHash = await hash(hostPassword, BCRYPT_COST_FACTOR);
			const insertedUser: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "users" (email, phone, password_hash, role, status, full_name)
				 VALUES ($1, $2, $3, 'host', 'active', 'Host Ban Mai')
				 RETURNING id`,
				[hostEmail, hostPhone, passwordHash]
			);
			hostId = insertedUser[0].id;
			await dataSource.query(
				`INSERT INTO "user_roles" (user_id, role) VALUES ($1, 'host') ON CONFLICT DO NOTHING`,
				[hostId]
			);
			console.log(`[seed:dev-trips] Created Host user: ${hostId}`);
		}

		// 2. Ensure Equipment Catalog Items for Host
		const equipmentData = [
			{
				name: "Lều cắm trại 2 người Naturehike chống nước",
				category: "Lều bạt",
				quantityTotal: 15,
				rentalPricePerDay: 80000,
				maintenanceSchedule: "Kiểm tra khung nhôm và vải lều sau mỗi chuyến đi",
			},
			{
				name: "Lều cắm trại 4 người Coleman cao cấp",
				category: "Lều bạt",
				quantityTotal: 10,
				rentalPricePerDay: 140000,
				maintenanceSchedule: "Vệ sinh, phơi khô và kiểm tra cọc ghim định kỳ",
			},
			{
				name: "Túi ngủ dã ngoại du lịch (10°C - 15°C)",
				category: "Túi & đệm ngủ",
				quantityTotal: 25,
				rentalPricePerDay: 40000,
				maintenanceSchedule: "Giặt sấy tiệt trùng sau mỗi lần sử dụng",
			},
			{
				name: "Đệm hơi cách nhiệt dã ngoại xếp gọn",
				category: "Túi & đệm ngủ",
				quantityTotal: 20,
				rentalPricePerDay: 35000,
				maintenanceSchedule: "Kiểm tra van khí và áp lực giữ hơi",
			},
			{
				name: "Balo trekking trợ lực 50L Deuter",
				category: "Balo & túi",
				quantityTotal: 12,
				rentalPricePerDay: 70000,
				maintenanceSchedule: "Kiểm tra hệ thống đai hông, khóa cài và khóa kéo",
			},
			{
				name: "Gậy leo núi Carbon siêu nhẹ (Cặp)",
				category: "Trang bị dã ngoại",
				quantityTotal: 30,
				rentalPricePerDay: 30000,
				maintenanceSchedule: "Kiểm tra khớp vặn khóa và đầu bọc cao su",
			},
			{
				name: "Đèn pin đội đầu chống nước IPX8 Black Diamond",
				category: "Đèn & chiếu sáng",
				quantityTotal: 25,
				rentalPricePerDay: 35000,
				maintenanceSchedule: "Sạc đầy pin lithium và kiểm tra roong chống nước",
			},
			{
				name: "Bếp ga dã ngoại mini và bộ nồi nhôm xếp gọn",
				category: "Dụng cụ nấu nướng",
				quantityTotal: 10,
				rentalPricePerDay: 65000,
				maintenanceSchedule: "Kiểm tra van ngắt an toàn và vệ sinh đầu đốt",
			},
			{
				name: "Bộ sơ cứu y tế sinh tồn Trekking",
				category: "An toàn & y tế",
				quantityTotal: 20,
				rentalPricePerDay: 25000,
				maintenanceSchedule: "Bổ sung gạc y tế và kiểm tra hạn thuốc sát khuẩn",
			},
		];

		for (const eq of equipmentData) {
			const existingEq: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "equipment_catalog_items" WHERE "host_id" = $1 AND "name" = $2',
				[hostId, eq.name]
			);
			if (existingEq.length > 0) {
				await dataSource.query(
					`UPDATE "equipment_catalog_items" SET
						category = $2,
						quantity_total = $3,
						rental_price_per_day = $4,
						status = 'active',
						maintenance_schedule = $5,
						updated_at = NOW()
					WHERE id = $1`,
					[
						existingEq[0].id,
						eq.category,
						eq.quantityTotal,
						eq.rentalPricePerDay,
						eq.maintenanceSchedule,
					]
				);
			} else {
				await dataSource.query(
					`INSERT INTO "equipment_catalog_items" (
						host_id, name, category, quantity_total, rental_price_per_day, status, maintenance_schedule
					) VALUES ($1, $2, $3, $4, $5, 'active', $6)`,
					[
						hostId,
						eq.name,
						eq.category,
						eq.quantityTotal,
						eq.rentalPricePerDay,
						eq.maintenanceSchedule,
					]
				);
				console.log(`[seed:dev-trips] Created equipment item: ${eq.name}`);
			}
		}

		// 3. Ensure active Trekking Routes around Da Nang
		const routesData = [
			{
				name: "Bán Đảo Sơn Trà Discovery",
				legacyNames: ["Bán Đảo Sơn Trà Discovery"],
				description:
					"Cung đường ven biển và rừng nguyên sinh Sơn Trà, khám phá Đỉnh Bàn Cờ và Mũi Nghê, thích hợp cho người mới bắt đầu.",
				lengthMeters: 5200,
				difficulty: "easy",
				durationMinutes: 240,
				geom: "SRID=4326;LINESTRING(108.260 16.110, 108.280 16.120, 108.300 16.110)",
			},
			{
				name: "Hải Vân Pass - Nam Hải Vân Trail",
				legacyNames: ["Đỉnh Núi Bidoup Trail", "Hải Vân Pass - Nam Hải Vân Trail"],
				description:
					"Tuyến trekking dọc sườn núi Hải Vân hùng vĩ, ngắm trọn vịnh Làng Vân hoang sơ và biển Đà Nẵng từ trên cao.",
				lengthMeters: 9500,
				difficulty: "moderate",
				durationMinutes: 360,
				geom: "SRID=4326;LINESTRING(108.130 16.185, 108.138 16.195, 108.145 16.205, 108.150 16.210)",
			},
			{
				name: "Rừng Nguyên Sinh Bà Nà - Núi Chúa",
				legacyNames: ["Bạch Mộc Lương Tử Expedition", "Rừng Nguyên Sinh Bà Nà - Núi Chúa"],
				description:
					"Hành trình thám hiểm lõi rừng nguyên sinh Bà Nà - Núi Chúa, chinh phục các dốc đá và hệ sinh thái nhiệt đới đặc sắc.",
				lengthMeters: 16000,
				difficulty: "hard",
				durationMinutes: 720,
				geom: "SRID=4326;LINESTRING(108.010 15.990, 108.018 16.002, 108.025 16.015, 108.030 16.025)",
			},
			{
				name: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
				legacyNames: [
					"Tà Năng - Phan Dũng Cung Đường Huyền Thoại",
					"Khe Ram - Suối Mơ - Rừng Hòa Bắc",
				],
				description:
					"Cung đường trekking lội suối, vượt ghềnh đá Khe Ram, xuyên rừng đại ngàn thung lũng sông Cu Đê xã Hòa Bắc.",
				lengthMeters: 22000,
				difficulty: "expert",
				durationMinutes: 1080,
				geom: "SRID=4326;LINESTRING(108.020 16.090, 108.035 16.105, 108.050 16.120, 108.065 16.135)",
			},
		];

		const routeIds: Record<string, string> = {};

		for (const r of routesData) {
			const existing: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "trekking_routes" WHERE "name" = ANY($1)',
				[r.legacyNames]
			);
			if (existing.length > 0) {
				const existingId = existing[0].id;
				await dataSource.query(
					`UPDATE "trekking_routes" SET
						name = $2,
						description = $3,
						route_geom = ST_GeogFromText($4),
						length_meters = $5,
						difficulty = $6,
						expected_duration_minutes = $7,
						status = 'active',
						updated_at = NOW()
					WHERE id = $1`,
					[
						existingId,
						r.name,
						r.description,
						r.geom,
						r.lengthMeters,
						r.difficulty,
						r.durationMinutes,
					]
				);
				routeIds[r.name] = existingId;
				console.log(`[seed:dev-trips] Updated route: ${r.name} (${existingId})`);
			} else {
				const inserted: Array<{ id: string }> = await dataSource.query(
					`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
					 VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7, 'active')
					 RETURNING id`,
					[hostId, r.name, r.description, r.geom, r.lengthMeters, r.difficulty, r.durationMinutes]
				);
				routeIds[r.name] = inserted[0].id;
				console.log(`[seed:dev-trips] Created route: ${r.name} (${inserted[0].id})`);
			}
		}

		// 4. Ensure weather risk assessments for all Da Nang routes
		const existingRules: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "weather_risk_rules" ORDER BY "created_at" DESC LIMIT 1'
		);
		let ruleVersionId = "";
		if (existingRules.length > 0) {
			ruleVersionId = existingRules[0].id;
		} else {
			const insertedRule: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "weather_risk_rules" (
					"rainfall_yellow_threshold", "rainfall_red_threshold",
					"wind_yellow_threshold", "wind_red_threshold",
					"temp_low_yellow", "temp_low_red", "temp_high_yellow", "temp_high_red",
					"visibility_yellow_threshold", "visibility_red_threshold",
					"thunderstorm_yellow", "thunderstorm_red",
					"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight", "thunderstorm_weight",
					"green_max_score", "yellow_max_score",
					"is_active", "created_by"
				) VALUES (
					10.0, 50.0,
					40.0, 70.0,
					5.0, 0.0, 38.0, 42.0,
					5000.0, 1000.0,
					true, true,
					0.30, 0.25, 0.15, 0.15, 0.15,
					0.5, 1.2,
					true, $1
				) RETURNING id`,
				[hostId]
			);
			ruleVersionId = insertedRule[0].id;
		}

		const weatherRisks = [
			{
				routeName: "Bán Đảo Sơn Trà Discovery",
				riskLevel: "green",
				score: 0.15,
			},
			{
				routeName: "Hải Vân Pass - Nam Hải Vân Trail",
				riskLevel: "yellow",
				score: 0.45,
			},
			{
				routeName: "Rừng Nguyên Sinh Bà Nà - Núi Chúa",
				riskLevel: "green",
				score: 0.2,
			},
			{
				routeName: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
				riskLevel: "red",
				score: 0.78,
			},
		];

		for (const wr of weatherRisks) {
			const rId = routeIds[wr.routeName];
			if (!rId) continue;
			const existing = await dataSource.query(
				'SELECT "id" FROM "weather_risk_assessments" WHERE "route_id" = $1',
				[rId]
			);
			if (existing.length === 0) {
				const snapshotRes: Array<{ id: string }> = await dataSource.query(
					`INSERT INTO "weather_snapshots" (route_id, status, observed_at, rainfall_mm, wind_kph, temperature_c, visibility_m, thunderstorm)
					 VALUES ($1, 'success', NOW(), $2, $3, $4, $5, $6)
					 RETURNING id`,
					[
						rId,
						wr.riskLevel === "red" ? 150 : wr.riskLevel === "yellow" ? 30 : 0,
						wr.riskLevel === "red" ? 65 : wr.riskLevel === "yellow" ? 35 : 10,
						24,
						10000,
						wr.riskLevel === "red",
					]
				);
				const snapshotId = snapshotRes[0].id;
				await dataSource.query(
					`INSERT INTO "weather_risk_assessments" (route_id, snapshot_id, rule_version_id, risk_level, composite_score, criteria_scores, created_by)
					 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
					[
						rId,
						snapshotId,
						ruleVersionId,
						wr.riskLevel,
						wr.score,
						JSON.stringify({
							rainfall: {
								value: 0,
								level: wr.riskLevel,
								weight: 0.3,
								score: 0,
							},
							wind: { value: 10, level: wr.riskLevel, weight: 0.25, score: 0 },
							temperature: {
								value: 24,
								level: wr.riskLevel,
								weight: 0.15,
								score: 0,
							},
							visibility: {
								value: 10000,
								level: wr.riskLevel,
								weight: 0.15,
								score: 0,
							},
							thunderstorm: {
								value: wr.riskLevel === "red",
								level: wr.riskLevel,
								weight: 0.15,
								score: 0,
							},
						}),
						hostId,
					]
				);
				console.log(
					`[seed:dev-trips] Created weather risk assessment for ${wr.routeName}: ${wr.riskLevel}`
				);
			}
		}

		// 5. Clean up obsolete legacy trips
		await dataSource.query(
			`UPDATE "trips"
			 SET "status" = 'cancelled'
			 WHERE "title" IN (
				'Khám Phá Sơn Trà Xanh Trong Ngày',
				'Chinh Phục Đỉnh Núi Bidoup - 2 Ngày 1 Đêm',
				'Tà Năng - Phan Dũng: Thử Thách Băng Rừng Đồi Cỏ',
				'Bạch Mộc Lương Tử - Săn Mây Đại Ngàn (Đã Hết Chỗ)'
			 )`
		);

		// 6. Seed published Trips with fresh dates calculated from NOW (Da Nang locations only)
		const now = new Date();
		const inDays = (d: number, hours = 7) => {
			const date = new Date(now.getTime() + d * 86400000);
			date.setHours(hours, 0, 0, 0);
			return date.toISOString();
		};
		const inHours = (h: number) => {
			const date = new Date(now.getTime() + h * 3600000);
			return date.toISOString();
		};

		const sampleTrips = [
			// Scenario 1: Normal capacity (12 seats remaining)
			{
				title: "[CTMS-024] Khám Phá Bán Đảo Sơn Trà (Bình thường - Còn 12 chỗ)",
				legacyTitles: [
					"[CTMS-024] Khám Phá Sơn Trà (Bình thường - Còn 12 chỗ)",
					"[CTMS-024] Khám Phá Bán Đảo Sơn Trà (Bình thường - Còn 12 chỗ)",
				],
				routeName: "Bán Đảo Sơn Trà Discovery",
				description:
					"Chuyến đi bộ dã ngoại trong ngày ngắm voọc chà vá chân nâu và Đỉnh Bàn Cờ tại bán đảo Sơn Trà, Đà Nẵng. Trạng thái bình thường, còn nhiều chỗ trống.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
				tripType: "day_trip",
				durationNights: 0,
				startsAt: inDays(4, 7),
				endsAt: inDays(4, 16),
				meetingPointGeom: "SRID=4326;POINT(108.260 16.110)",
				meetingAt: inDays(4, 6),
				bookingDeadline: inDays(3, 18),
				capacityMin: 5,
				capacityMax: 20,
				seatsTaken: 8,
				pricePerPerson: "450000",
				itinerary: {
					summary:
						"06:30 tập trung Chùa Linh Ứng, 07:00 bắt đầu trekking, 11:30 picnic trưa Bãi Rạng, 16:00 kết thúc.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Chùa Linh Ứng - Sơn Trà",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
					{
						name: "Trạm quan sát Đỉnh Bàn Cờ",
						type: "checkpoint",
						day: 1,
						seq: 2,
						duration: 60,
						geom: "SRID=4326;POINT(108.280 16.120)",
					},
					{
						name: "Bãi Rạng - Nghỉ chân & Ăn trưa",
						type: "meal",
						day: 1,
						seq: 3,
						duration: 90,
						geom: "SRID=4326;POINT(108.290 16.115)",
					},
					{
						name: "Về lại chân núi Sơn Trà",
						type: "finish",
						day: 1,
						seq: 4,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
				],
			},
			// Scenario 2: Low capacity urgency (<= 3 seats remaining -> exactly 2 remaining)
			{
				title: "[CTMS-024] Hải Vân Quan - Vịnh Làng Vân (Khẩn cấp: Chỉ còn 2 chỗ)",
				legacyTitles: [
					"[CTMS-024] Đỉnh Núi Bidoup Trail (Khẩn cấp: Chỉ còn 2 chỗ)",
					"[CTMS-024] Hải Vân Quan - Vịnh Làng Vân (Khẩn cấp: Chỉ còn 2 chỗ)",
				],
				routeName: "Hải Vân Pass - Nam Hải Vân Trail",
				description:
					"Hành trình trekking 2N1Đ vượt sườn đèo Hải Vân và cắm trại vịnh biển Làng Vân hoang sơ dưới chân đèo. Số lượng chỗ sắp hết, chỉ còn 2 vé cuối cùng!",
				coverImageUrl:
					"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 1,
				startsAt: inDays(6, 6),
				endsAt: inDays(7, 16),
				meetingPointGeom: "SRID=4326;POINT(108.130 16.185)",
				meetingAt: inDays(6, 5),
				bookingDeadline: inDays(4, 23),
				capacityMin: 5,
				capacityMax: 10,
				seatsTaken: 8,
				pricePerPerson: "1650000",
				itinerary: {
					summary:
						"Ngày 1: Chân đèo Hải Vân - Cửa Rừng Nam Hải Vân - Hạ trại Bãi Biển Làng Vân. Ngày 2: Đón bình minh biển - Lên đồn Nhất Hải Vân Quan - Kết thúc.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Chân đèo Hải Vân - Hòa Hiệp Bắc",
						type: "start",
						day: 1,
						seq: 1,
						duration: 45,
						geom: "SRID=4326;POINT(108.130 16.185)",
					},
					{
						name: "Rừng dẻ Nam Hải Vân",
						type: "rest",
						day: 1,
						seq: 2,
						duration: 30,
						geom: "SRID=4326;POINT(108.138 16.195)",
					},
					{
						name: "Bãi biển Làng Vân - Cắm trại đêm",
						type: "overnight",
						day: 1,
						seq: 3,
						duration: 600,
						geom: "SRID=4326;POINT(108.145 16.205)",
					},
					{
						name: "Đỉnh Hải Vân Quan lịch sử",
						type: "activity",
						day: 2,
						seq: 4,
						duration: 90,
						geom: "SRID=4326;POINT(108.132 16.198)",
					},
					{
						name: "Xuống chân đèo - Kết thúc hành trình",
						type: "finish",
						day: 2,
						seq: 5,
						duration: 60,
						geom: "SRID=4326;POINT(108.130 16.185)",
					},
				],
			},
			// Scenario 3: Completely Sold Out (seatsTaken == capacityMax -> 0 seats)
			{
				title: "[CTMS-024] Thám Hiểm Rừng Bà Nà - Núi Chúa (Đã Hết Chỗ - 0 chỗ)",
				legacyTitles: [
					"[CTMS-024] Bạch Mộc Lương Tử Expedition (Đã Hết Chỗ - 0 chỗ)",
					"[CTMS-024] Thám Hiểm Rừng Bà Nà - Núi Chúa (Đã Hết Chỗ - 0 chỗ)",
				],
				routeName: "Rừng Nguyên Sinh Bà Nà - Núi Chúa",
				description:
					"Cung trekking thám hiểm lõi rừng nguyên sinh Bà Nà - Núi Chúa tại huyện Hòa Vang, Đà Nẵng. Đã đủ 10/10 khách tham gia, toàn bộ chỗ đã được đặt kín.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 1,
				startsAt: inDays(8, 6),
				endsAt: inDays(9, 17),
				meetingPointGeom: "SRID=4326;POINT(108.010 15.990)",
				meetingAt: inDays(8, 5),
				bookingDeadline: inDays(6, 18),
				capacityMin: 6,
				capacityMax: 10,
				seatsTaken: 10,
				pricePerPerson: "2200000",
				itinerary: {
					summary:
						"Ngày 1: Trạm Kiểm lâm Hòa Ninh - Lán Thác Tóc Tiên - Cắm trại đêm. Ngày 2: Chinh phục đỉnh Núi Chúa 1.487m - Xuống núi.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Trạm Kiểm lâm Hòa Ninh - Hòa Vang",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.010 15.990)",
					},
					{
						name: "Thung lũng Rừng Mơ",
						type: "checkpoint",
						day: 1,
						seq: 2,
						duration: 45,
						geom: "SRID=4326;POINT(108.018 16.002)",
					},
					{
						name: "Lán cắm trại Thác Tóc Tiên",
						type: "overnight",
						day: 1,
						seq: 3,
						duration: 600,
						geom: "SRID=4326;POINT(108.025 16.015)",
					},
					{
						name: "Đỉnh Núi Chúa 1.487m",
						type: "activity",
						day: 2,
						seq: 4,
						duration: 120,
						geom: "SRID=4326;POINT(108.030 16.025)",
					},
					{
						name: "Về lại Trạm Kiểm lâm",
						type: "finish",
						day: 2,
						seq: 5,
						duration: 60,
						geom: "SRID=4326;POINT(108.010 15.990)",
					},
				],
			},
			// Scenario 4: Deadline approaching soon (< 24 hours -> 8 hours left)
			{
				title: "[CTMS-024] Trekking Khe Ram - Rừng Hòa Bắc (Sắp hết hạn - Còn 8h)",
				legacyTitles: [
					"[CTMS-024] Tà Năng - Phan Dũng (Sắp hết hạn đặt chỗ - Còn 8h)",
					"[CTMS-024] Trekking Khe Ram - Rừng Hòa Bắc (Sắp hết hạn - Còn 8h)",
				],
				routeName: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
				description:
					"Cung trekking băng rừng thung lũng sông Cu Đê, vượt suối ghềnh đá Khe Ram tại Hòa Bắc, Đà Nẵng. Hạn chốt danh sách người tham gia sẽ đóng trong 8 giờ tới.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 1,
				startsAt: inDays(2, 6),
				endsAt: inDays(3, 17),
				meetingPointGeom: "SRID=4326;POINT(108.020 16.090)",
				meetingAt: inDays(2, 5),
				bookingDeadline: inHours(8),
				capacityMin: 6,
				capacityMax: 15,
				seatsTaken: 5,
				pricePerPerson: "1850000",
				itinerary: {
					summary:
						"Ngày 1: Thôn Tà Lang - Lội suối Khe Ram - Cắm trại bãi cỏ Thác Mơ. Ngày 2: Khám phá Vách Đá Trắng - Trở về trạm sinh thái Hòa Bắc.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Nhà Gươl Thôn Tà Lang - Hòa Bắc",
						type: "start",
						day: 1,
						seq: 1,
						duration: 40,
						geom: "SRID=4326;POINT(108.020 16.090)",
					},
					{
						name: "Ghềnh đá Khe Ram",
						type: "checkpoint",
						day: 1,
						seq: 2,
						duration: 60,
						geom: "SRID=4326;POINT(108.035 16.105)",
					},
					{
						name: "Bãi cỏ Thác Mơ - Cắm trại đêm",
						type: "overnight",
						day: 1,
						seq: 3,
						duration: 600,
						geom: "SRID=4326;POINT(108.050 16.120)",
					},
					{
						name: "Vách Đá Trắng Hoang Sơ",
						type: "activity",
						day: 2,
						seq: 4,
						duration: 90,
						geom: "SRID=4326;POINT(108.065 16.135)",
					},
					{
						name: "Trạm Sinh Thái Hòa Bắc - Kết thúc",
						type: "finish",
						day: 2,
						seq: 5,
						duration: 45,
						geom: "SRID=4326;POINT(108.020 16.090)",
					},
				],
			},
			// Scenario 5: Past booking deadline (Deadline was 2 hours ago -> booking closed)
			{
				title: "[CTMS-024] Sơn Trà Sunset Trekking Mũi Nghê (Đã Hết Hạn Đặt Vé)",
				legacyTitles: [
					"[CTMS-024] Sơn Trà Sunset Trek (Đã Hết Hạn Đặt Vé)",
					"[CTMS-024] Sơn Trà Sunset Trekking Mũi Nghê (Đã Hết Hạn Đặt Vé)",
				],
				routeName: "Bán Đảo Sơn Trà Discovery",
				description:
					"Chuyến đi bộ ngắm hoàng hôn rực rỡ tại Mũi Nghê Sơn Trà đã qua hạn chốt danh sách người tham gia (đóng từ 2 giờ trước). Không thể đăng ký thêm.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",
				tripType: "day_trip",
				durationNights: 0,
				startsAt: inDays(2, 14),
				endsAt: inDays(2, 18),
				meetingPointGeom: "SRID=4326;POINT(108.260 16.110)",
				meetingAt: inDays(2, 13),
				bookingDeadline: inHours(-2),
				capacityMin: 4,
				capacityMax: 12,
				seatsTaken: 4,
				pricePerPerson: "350000",
				itinerary: {
					summary:
						"14:00 tập kết Bãi Trẹm, 15:00 trekking ngắm hoàng hôn Mũi Nghê, 18:00 kết thúc.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Bãi Trẹm - Sơn Trà",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
					{
						name: "Mũi Nghê ngắm hoàng hôn vịnh biển",
						type: "activity",
						day: 1,
						seq: 2,
						duration: 90,
						geom: "SRID=4326;POINT(108.280 16.120)",
					},
					{
						name: "Kết thúc hành trình tại Bãi Trẹm",
						type: "finish",
						day: 1,
						seq: 3,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
				],
			},
			// Scenario 6: December 2026 Trekking & Equipment Rental Test (Overnight 2D1N)
			{
				title: "[Tháng 12] Cắm Trại Đêm Vịnh Làng Vân & Trekking Đèo Hải Vân",
				legacyTitles: ["[Tháng 12] Cắm Trại Đêm Vịnh Làng Vân & Trekking Đèo Hải Vân"],
				routeName: "Hải Vân Pass - Nam Hải Vân Trail",
				description:
					"Chuyến đi trekking khám phá đèo Hải Vân và cắm trại đêm tại bãi biển hoang sơ Vịnh Làng Vân vào tháng 12/2026. Thích hợp thuê lều, túi ngủ, đèn pin dã ngoại và test thanh toán trực tuyến.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 1,
				startsAt: "2026-12-19T06:00:00.000Z",
				endsAt: "2026-12-20T17:00:00.000Z",
				meetingPointGeom: "SRID=4326;POINT(108.130 16.185)",
				meetingAt: "2026-12-19T05:30:00.000Z",
				bookingDeadline: "2026-12-18T18:00:00.000Z",
				capacityMin: 4,
				capacityMax: 20,
				seatsTaken: 2,
				pricePerPerson: "1200000",
				itinerary: {
					summary:
						"Ngày 1: Tập kết chân đèo Hải Vân, trekking xuyên rừng dẻ xuống Vịnh Làng Vân, dựng trại và tiệc BBQ bãi biển. Ngày 2: Đón bình minh, khám phá Hải Vân Quan, kết thúc hành trình.",
					images: [
						"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80",
					],
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Chân đèo Hải Vân",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.130 16.185)",
					},
					{
						name: "Bãi biển Làng Vân - Hạ trại & BBQ",
						type: "overnight",
						day: 1,
						seq: 2,
						duration: 600,
						geom: "SRID=4326;POINT(108.145 16.205)",
					},
					{
						name: "Di tích Hải Vân Quan",
						type: "activity",
						day: 2,
						seq: 3,
						duration: 90,
						geom: "SRID=4326;POINT(108.132 16.198)",
					},
					{
						name: "Về lại chân đèo Hải Vân",
						type: "finish",
						day: 2,
						seq: 4,
						duration: 45,
						geom: "SRID=4326;POINT(108.130 16.185)",
					},
				],
			},
			// Scenario 7: December 2026 Day Trip Test
			{
				title: "[Tháng 12] Khám Phá Rừng Nguyên Sinh Sơn Trà - Đỉnh Bàn Cờ",
				legacyTitles: ["[Tháng 12] Khám Phá Rừng Nguyên Sinh Sơn Trà - Đỉnh Bàn Cờ"],
				routeName: "Bán Đảo Sơn Trà Discovery",
				description:
					"Trekking khám phá thảm thực vật bán đảo Sơn Trà trong tiết trời dịu mát của tháng 12/2026. Lộ trình nhẹ nhàng, dễ đi, có sẵn nhiều thiết bị hỗ trợ trợ lực gậy trekking, balo cho thuê.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
				tripType: "day_trip",
				durationNights: 0,
				startsAt: "2026-12-12T07:00:00.000Z",
				endsAt: "2026-12-12T16:00:00.000Z",
				meetingPointGeom: "SRID=4326;POINT(108.260 16.110)",
				meetingAt: "2026-12-12T06:30:00.000Z",
				bookingDeadline: "2026-12-11T18:00:00.000Z",
				capacityMin: 2,
				capacityMax: 25,
				seatsTaken: 5,
				pricePerPerson: "450000",
				itinerary: {
					summary:
						"06:30 tập trung Chùa Linh Ứng, 07:00 trekking đường mòn râm mát, 11:30 ngắm vịnh Đà Nẵng tại Đỉnh Bàn Cờ và ăn trưa picnic, 16:00 kết thúc.",
					images: [
						"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80",
					],
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Chùa Linh Ứng",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
					{
						name: "Đỉnh Bàn Cờ - Ngắm toàn cảnh",
						type: "checkpoint",
						day: 1,
						seq: 2,
						duration: 60,
						geom: "SRID=4326;POINT(108.280 16.120)",
					},
					{
						name: "Khu vực Bãi Rạng - Nghỉ trưa",
						type: "meal",
						day: 1,
						seq: 3,
						duration: 90,
						geom: "SRID=4326;POINT(108.290 16.115)",
					},
					{
						name: "Về lại điểm xuất phát",
						type: "finish",
						day: 1,
						seq: 4,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
				],
			},
		];

		for (const st of sampleTrips) {
			const routeId = routeIds[st.routeName];
			if (!routeId) {
				console.warn(`[seed:dev-trips] Route not found for ${st.routeName}`);
				continue;
			}

			const existingTrip: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "trips" WHERE "title" = ANY($1)',
				[st.legacyTitles]
			);

			let tripId = "";
			if (existingTrip.length > 0) {
				tripId = existingTrip[0].id;
				await dataSource.query(
					`UPDATE "trips" SET
						route_id = $2,
						title = $3,
						description = $4,
						cover_image_url = $5,
						trip_type = $6,
						duration_nights = $7,
						starts_at = $8,
						ends_at = $9,
						meeting_point = ST_GeogFromText($10),
						meeting_at = $11,
						booking_deadline = $12,
						capacity_min = $13,
						capacity_max = $14,
						seats_taken = GREATEST($15, (
							SELECT COALESCE(SUM(b.num_people), 0)
							FROM bookings b
							WHERE b.trip_id = $1 AND b.status IN ('confirmed', 'pending_payment')
						)),
						price_per_person = $16,
						itinerary = $17::jsonb,
						includes = $18::jsonb,
						excludes = $19::jsonb,
						cancellation_policy = $20::jsonb,
						status = 'published',
						updated_at = NOW()
					WHERE id = $1`,
					[
						tripId,
						routeId,
						st.title,
						st.description,
						st.coverImageUrl,
						st.tripType,
						st.durationNights,
						st.startsAt,
						st.endsAt,
						st.meetingPointGeom,
						st.meetingAt,
						st.bookingDeadline,
						st.capacityMin,
						st.capacityMax,
						st.seatsTaken,
						st.pricePerPerson,
						JSON.stringify(st.itinerary),
						st.includes ? JSON.stringify(st.includes) : null,
						st.excludes ? JSON.stringify(st.excludes) : null,
						JSON.stringify(st.cancellationPolicy),
					]
				);
				console.log(`[seed:dev-trips] Updated trip for scenario: ${st.title} (${tripId})`);
			} else {
				const insertedTrip: Array<{ id: string }> = await dataSource.query(
					`INSERT INTO "trips" (
						host_id, route_id, title, description, cover_image_url,
						trip_type, duration_nights, starts_at, ends_at,
						meeting_point, meeting_at, booking_deadline,
						capacity_min, capacity_max, seats_taken, price_per_person,
						itinerary, includes, excludes, cancellation_policy, status
					) VALUES (
						$1, $2, $3, $4, $5,
						$6, $7, $8, $9,
						ST_GeogFromText($10), $11, $12,
						$13, $14, $15, $16,
						$17, $18, $19, $20, 'published'
					) RETURNING id`,
					[
						hostId,
						routeId,
						st.title,
						st.description,
						st.coverImageUrl,
						st.tripType,
						st.durationNights,
						st.startsAt,
						st.endsAt,
						st.meetingPointGeom,
						st.meetingAt,
						st.bookingDeadline,
						st.capacityMin,
						st.capacityMax,
						st.seatsTaken,
						st.pricePerPerson,
						JSON.stringify(st.itinerary),
						st.includes ? JSON.stringify(st.includes) : null,
						st.excludes ? JSON.stringify(st.excludes) : null,
						JSON.stringify(st.cancellationPolicy),
					]
				);
				tripId = insertedTrip[0].id;
				console.log(`[seed:dev-trips] Created published trip: ${st.title} (${tripId})`);
			}

			// Refresh waypoints for the trip
			await dataSource.query('DELETE FROM "trip_waypoints" WHERE "trip_id" = $1', [tripId]);
			for (const wp of st.waypoints) {
				await dataSource.query(
					`INSERT INTO "trip_waypoints" (
						trip_id, type, name, location, day_number, sequence_order, duration_minutes
					) VALUES (
						$1, $2, $3, ST_GeogFromText($4), $5, $6, $7
					)`,
					[tripId, wp.type, wp.name, wp.geom, wp.day, wp.seq, wp.duration]
				);
			}
		}

		// Ensure completed demo trips (e.g. Trekking Sơn Trà Hoàn Thành - Demo Khiếu Nại) have cover images
		await dataSource.query(`
			UPDATE "trips"
			SET "cover_image_url" = COALESCE("cover_image_url", 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80')
			WHERE "title" ILIKE '%Khiếu Nại%' OR "id" IN (
				'01e326fb-b463-4e36-88aa-265320888f4e',
				'476e6c30-2e43-4db4-863f-e593be61939b'
			)
		`);

		// Seed Route Checkpoints & Danger Zones
		await seedRouteCheckpointsAndDangerZones(routeIds);

		// Seed Diverse Trip & Route Statuses (Pending Approval, Draft, Cancelled, Closed)
		await seedDiverseTripAndRouteStatuses(hostId, routeIds);

		// Seed Porter Profiles, Qualifications & Assignments
		await seedPorterProfileAndAssignments(routeIds);

		// Seed Camper Health Profiles & Emergency Contacts
		await seedCamperHealthAndContacts();

		// Seed extra members for check-in testing (present/absent)
		await seedDemoBookingMembers();

		// Seed multi-person bookings with equipment rentals for host@ctms.local
		await seedHostGroupBookingsWithEquipment();

		console.log("[seed:dev-trips] Seeding completed successfully!");
	} catch (error) {
		console.error("[seed:dev-trips] Error seeding trips:", error);
	}
}

async function seedDemoBookingMembers(): Promise<void> {
	const demoCampers = [
		{
			email: "camper.lan@ctms.local",
			phone: "0900000011",
			name: "Trần Thị Lan",
		},
		{
			email: "camper.nam@ctms.local",
			phone: "0900000012",
			name: "Lê Hoàng Nam",
		},
		{
			email: "camper.tuan@ctms.local",
			phone: "0900000013",
			name: "Phạm Minh Tuấn",
		},
		{
			email: "camper.nhu@ctms.local",
			phone: "0900000014",
			name: "Võ Quỳnh Như",
		},
	];

	const passwordHash = await hash("Camper@123", BCRYPT_COST_FACTOR);
	const userMap = new Map<string, string>();

	for (const c of demoCampers) {
		const existing: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[c.email, c.phone]
		);
		let userId = "";
		if (existing.length > 0) {
			userId = existing[0].id;
			await dataSource.query(
				'UPDATE "users" SET "full_name" = $2, "role" = \'camper\', "status" = \'active\' WHERE "id" = $1',
				[userId, c.name]
			);
		} else {
			const inserted: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "users" (email, phone, password_hash, role, status, full_name)
				 VALUES ($1, $2, $3, 'camper', 'active', $4) RETURNING id`,
				[c.email, c.phone, passwordHash, c.name]
			);
			userId = inserted[0].id;
		}
		await dataSource.query(
			`INSERT INTO "user_roles" (user_id, role) VALUES ($1, 'camper') ON CONFLICT DO NOTHING`,
			[userId]
		);
		userMap.set(c.email, userId);
	}

	// Target trip: [CTMS-024] Hải Vân Quan - Vịnh Làng Vân (Khẩn cấp: Chỉ còn 2 chỗ)
	const tripRows: Array<{
		id: string;
		starts_at: Date;
		ends_at: Date;
		price_per_person: string | number;
	}> = await dataSource.query(
		'SELECT "id", "starts_at", "ends_at", "price_per_person" FROM "trips" WHERE "id" = $1 OR "title" ILIKE \'%Chỉ còn 2 chỗ%\' LIMIT 1',
		["467797d6-3ae5-43aa-9849-c65701680b32"]
	);
	if (tripRows.length === 0) return;
	const trip = tripRows[0];
	const tripId = trip.id;

	// Primary Demo Camper: camper@ctms.local (Nguyễn Văn An)
	const mainCamperRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	const mainCamperId = mainCamperRows.length > 0 ? mainCamperRows[0].id : null;

	if (mainCamperId) {
		await ensureBookingWithMembers(tripId, mainCamperId, trip, [
			{ userId: mainCamperId, isPrimary: true },
		]);
	}

	// Booking 1: Lan (Single member)
	const lanId = userMap.get("camper.lan@ctms.local");
	if (lanId) {
		await ensureBookingWithMembers(tripId, lanId, trip, [{ userId: lanId, isPrimary: true }]);
	}

	// Booking 2: Nam (Single member)
	const namId = userMap.get("camper.nam@ctms.local");
	if (namId) {
		await ensureBookingWithMembers(tripId, namId, trip, [{ userId: namId, isPrimary: true }]);
	}

	// Booking 3: Tuấn + Như (Group 2 members)
	const tuanId = userMap.get("camper.tuan@ctms.local");
	const nhuId = userMap.get("camper.nhu@ctms.local");
	if (tuanId && nhuId) {
		await ensureBookingWithMembers(tripId, tuanId, trip, [
			{ userId: tuanId, isPrimary: true },
			{ userId: nhuId, isPrimary: false },
		]);
	}

	// Reset all members of this trip back to 'registered' so test is fresh
	await dataSource.query(
		`UPDATE "booking_members"
		 SET "member_status" = 'registered', "checked_in_at" = NULL, "no_show_at" = NULL, "left_at" = NULL
		 WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = $1)`,
		[tripId]
	);

	await dataSource.query(
		`UPDATE "bookings"
		 SET "status" = 'confirmed'
		 WHERE "trip_id" = $1 AND "status" != 'cancelled'`,
		[tripId]
	);

	console.log(`[seed:dev-trips] Seeded demo check-in roster members for trip: ${tripId}`);

	// Also seed for ongoing trip (Sơn Trà Sunset)
	// Sets starts_at = NOW() - interval '2 hours' so [Không tham gia] (no_show) can be tested directly
	await dataSource.query(`
		UPDATE "trips"
		SET "status" = 'ongoing',
		    "booking_deadline" = NOW() - interval '1 day',
		    "meeting_at" = NOW() - interval '3 hours',
		    "starts_at" = NOW() - interval '2 hours',
		    "ends_at" = NOW() + interval '4 hours'
		WHERE "title" ILIKE '%Sơn Trà Sunset%' OR "title" ILIKE '%Hết Hạn Đặt Vé%'
	`);

	const ongoingTripRows: Array<{
		id: string;
		starts_at: Date;
		ends_at: Date;
		price_per_person: string | number;
	}> = await dataSource.query(`
		SELECT "id", "starts_at", "ends_at", "price_per_person"
		FROM "trips"
		WHERE "title" ILIKE '%Sơn Trà Sunset%' OR "title" ILIKE '%Hết Hạn Đặt Vé%'
		LIMIT 1
	`);

	if (ongoingTripRows.length > 0) {
		const ongoingTrip = ongoingTripRows[0];
		if (mainCamperId) {
			await ensureBookingWithMembers(ongoingTrip.id, mainCamperId, ongoingTrip, [
				{ userId: mainCamperId, isPrimary: true },
			]);
		}
		if (lanId) {
			await ensureBookingWithMembers(ongoingTrip.id, lanId, ongoingTrip, [
				{ userId: lanId, isPrimary: true },
			]);
		}
		if (namId) {
			await ensureBookingWithMembers(ongoingTrip.id, namId, ongoingTrip, [
				{ userId: namId, isPrimary: true },
			]);
		}
		if (tuanId && nhuId) {
			await ensureBookingWithMembers(ongoingTrip.id, tuanId, ongoingTrip, [
				{ userId: tuanId, isPrimary: true },
				{ userId: nhuId, isPrimary: false },
			]);
		}
		await dataSource.query(
			`UPDATE "booking_members"
			 SET "member_status" = 'registered', "checked_in_at" = NULL, "no_show_at" = NULL, "left_at" = NULL
			 WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = $1)`,
			[ongoingTrip.id]
		);
		await dataSource.query(
			`UPDATE "bookings"
			 SET "status" = 'confirmed'
			 WHERE "trip_id" = $1 AND "status" != 'cancelled'`,
			[ongoingTrip.id]
		);
		console.log(`[seed:dev-trips] Seeded ongoing demo trip for no-show testing: ${ongoingTrip.id}`);
	}
}

async function ensureBookingWithMembers(
	tripId: string,
	ownerId: string,
	trip: { starts_at: Date; ends_at: Date; price_per_person: string | number },
	members: Array<{ userId: string; isPrimary: boolean }>
): Promise<void> {
	const existingBooking: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "bookings" WHERE "trip_id" = $1 AND "user_id" = $2',
		[tripId, ownerId]
	);

	let bookingId = "";
	if (existingBooking.length > 0) {
		bookingId = existingBooking[0].id;
		await dataSource.query(
			`UPDATE "bookings"
			 SET "status" = 'confirmed', "payment_status" = 'paid', "num_people" = $2
			 WHERE "id" = $1`,
			[bookingId, members.length]
		);
	} else {
		const price = Number(trip.price_per_person) || 1650000;
		const total = price * members.length;
		const inserted: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "bookings" (
				trip_id, user_id, num_people, status, payment_status,
				trip_starts_at_snapshot, trip_ends_at_snapshot, base_price, total_amount
			) VALUES (
				$1, $2, $3, 'confirmed', 'paid',
				$4, $5, $6, $7
			) RETURNING id`,
			[tripId, ownerId, members.length, trip.starts_at, trip.ends_at, price, total]
		);
		bookingId = inserted[0].id;
	}

	await repairDemoBookingCancellation(dataSource, bookingId);

	for (const m of members) {
		const existingMember: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "booking_members" WHERE "booking_id" = $1 AND "user_id" = $2',
			[bookingId, m.userId]
		);
		if (existingMember.length > 0) {
			await dataSource.query(
				`UPDATE "booking_members"
				 SET "member_status" = 'registered', "is_primary" = $2, "checked_in_at" = NULL, "no_show_at" = NULL, "left_at" = NULL
				 WHERE "id" = $1`,
				[existingMember[0].id, m.isPrimary]
			);
		} else {
			await dataSource.query(
				`INSERT INTO "booking_members" (
					booking_id, user_id, is_primary, member_status
				) VALUES ($1, $2, $3, 'registered')`,
				[bookingId, m.userId, m.isPrimary]
			);
		}
	}
}

// --------------------------------------------------------------------------
// Helper: Seed Multi-person Bookings with Equipment Rentals for host@ctms.local
// --------------------------------------------------------------------------
export async function seedHostGroupBookingsWithEquipment(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log(
		"[seed:group-bookings] Seeding multi-person bookings with equipment rentals for host@ctms.local..."
	);

	const hostRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["host@ctms.local"]
	);
	if (hostRows.length === 0) {
		console.warn("[seed:group-bookings] Host host@ctms.local not found, skipping.");
		return;
	}
	const hostId = hostRows[0].id;

	// 1. Ensure all demo campers exist with full profiles
	const demoCampers: Array<{
		email: string;
		phone: string;
		name: string;
		dateOfBirth: string;
		gender: "male" | "female" | "other";
		address: string;
	}> = [
		{
			email: "camper.lan@ctms.local",
			phone: "0900000011",
			name: "Trần Thị Lan",
			dateOfBirth: "1999-05-15",
			gender: "female",
			address: "Số 45 Lê Duẩn, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.nam@ctms.local",
			phone: "0900000012",
			name: "Lê Hoàng Nam",
			dateOfBirth: "1997-08-22",
			gender: "male",
			address: "Số 88 Hùng Vương, Quận Thanh Khê, TP. Đà Nẵng",
		},
		{
			email: "camper.tuan@ctms.local",
			phone: "0900000013",
			name: "Phạm Minh Tuấn",
			dateOfBirth: "1995-12-03",
			gender: "male",
			address: "Số 12 Quang Trung, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.nhu@ctms.local",
			phone: "0900000014",
			name: "Võ Quỳnh Như",
			dateOfBirth: "2000-03-18",
			gender: "female",
			address: "Số 32 Nguyễn Văn Linh, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.long@ctms.local",
			phone: "0900000021",
			name: "Đỗ Hoàng Long",
			dateOfBirth: "1996-07-09",
			gender: "male",
			address: "Số 56 Bạch Đằng, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.maianh@ctms.local",
			phone: "0900000022",
			name: "Ngô Mai Anh",
			dateOfBirth: "1998-11-25",
			gender: "female",
			address: "Số 102 Trần Phú, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.bao@ctms.local",
			phone: "0900000023",
			name: "Trịnh Quốc Bảo",
			dateOfBirth: "1994-01-30",
			gender: "male",
			address: "Số 77 Điện Biên Phủ, Quận Thanh Khê, TP. Đà Nẵng",
		},
		{
			email: "camper.thao@ctms.local",
			phone: "0900000024",
			name: "Đinh Thu Thảo",
			dateOfBirth: "2001-09-14",
			gender: "female",
			address: "Số 204 Nguyễn Tri Phương, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.linh@ctms.local",
			phone: "0900000025",
			name: "Bùi Phương Linh",
			dateOfBirth: "1997-04-12",
			gender: "female",
			address: "Số 33 Phan Châu Trinh, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.dung@ctms.local",
			phone: "0900000026",
			name: "Lý Thế Dũng",
			dateOfBirth: "1995-10-05",
			gender: "male",
			address: "Số 91 Hoàng Diệu, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.kien@ctms.local",
			phone: "0900000027",
			name: "Trần Hữu Kiên",
			dateOfBirth: "1993-06-19",
			gender: "male",
			address: "Số 15 Võ Văn Kiệt, Quận Sơn Trà, TP. Đà Nẵng",
		},
		{
			email: "camper.yen@ctms.local",
			phone: "0900000028",
			name: "Nguyễn Hoàng Yến",
			dateOfBirth: "1999-02-28",
			gender: "female",
			address: "Số 48 Ngô Quyền, Quận Sơn Trà, TP. Đà Nẵng",
		},
		{
			email: "camper.huy@ctms.local",
			phone: "0900000029",
			name: "Vũ Đức Huy",
			dateOfBirth: "1996-12-11",
			gender: "male",
			address: "Số 64 Tôn Đức Thắng, Quận Liên Chiểu, TP. Đà Nẵng",
		},
	];

	const defaultPasswordHash = await hash("Camper@123", BCRYPT_COST_FACTOR);
	const userMap = new Map<string, string>();

	// Add main camper
	const mainCamperRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	if (mainCamperRows.length > 0) {
		userMap.set("camper@ctms.local", mainCamperRows[0].id);
	}

	for (const c of demoCampers) {
		const existing: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[c.email, c.phone]
		);
		let userId = "";
		if (existing.length > 0) {
			userId = existing[0].id;
			await dataSource.query(
				`UPDATE "users" 
				 SET "full_name" = $2, "role" = 'camper', "status" = 'active',
				     "date_of_birth" = $3, "address" = $4, "gender" = $5
				 WHERE "id" = $1`,
				[userId, c.name, c.dateOfBirth, c.address, c.gender]
			);
		} else {
			const inserted: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "users" (email, phone, password_hash, role, status, full_name, date_of_birth, address, gender)
				 VALUES ($1, $2, $3, 'camper', 'active', $4, $5, $6, $7) RETURNING id`,
				[c.email, c.phone, defaultPasswordHash, c.name, c.dateOfBirth, c.address, c.gender]
			);
			userId = inserted[0].id;
		}
		await dataSource.query(
			`INSERT INTO "user_roles" (user_id, role) VALUES ($1, 'camper') ON CONFLICT DO NOTHING`,
			[userId]
		);
		userMap.set(c.email, userId);
	}

	// 2. Specifications for group bookings (1 booker + 2-3 companions, 2-3 equipment items)
	interface GroupBookingSpec {
		tripTitlePattern: string;
		bookerEmail: string;
		companionEmails: string[];
		equipment: Array<{ name: string; quantity: number }>;
	}

	const bookingSpecs: GroupBookingSpec[] = [
		// 1. Chuyến Sơn Trà: Đỗ Hoàng Long đặt cho mình + Mai Anh + Quốc Bảo (Tổng 3 người, thuê 3 món)
		{
			tripTitlePattern: "%Khám Phá Bán Đảo Sơn Trà (Bình thường%",
			bookerEmail: "camper.long@ctms.local",
			companionEmails: ["camper.maianh@ctms.local", "camper.bao@ctms.local"],
			equipment: [
				{ name: "Balo trekking trợ lực 50L Deuter", quantity: 2 },
				{ name: "Gậy leo núi Carbon siêu nhẹ (Cặp)", quantity: 2 },
				{ name: "Đèn pin đội đầu chống nước IPX8 Black Diamond", quantity: 3 },
			],
		},
		// 2. Chuyến Sơn Trà: Camper Nguyễn Văn An đặt cho mình + Lan + Nam + Thu Thảo (Tổng 4 người, thuê 3 món)
		{
			tripTitlePattern: "%Khám Phá Bán Đảo Sơn Trà (Bình thường%",
			bookerEmail: "camper@ctms.local",
			companionEmails: ["camper.lan@ctms.local", "camper.nam@ctms.local", "camper.thao@ctms.local"],
			equipment: [
				{ name: "Lều cắm trại 4 người Coleman cao cấp", quantity: 1 },
				{ name: "Đệm hơi cách nhiệt dã ngoại xếp gọn", quantity: 4 },
				{ name: "Bộ sơ cứu y tế sinh tồn Trekking", quantity: 1 },
			],
		},
		// 3. Chuyến Làng Vân Tháng 12: Phạm Minh Tuấn đặt cho mình + Quỳnh Như + Đức Huy (Tổng 3 người, thuê 3 món)
		{
			tripTitlePattern: "%Cắm Trại Đêm Vịnh Làng Vân & Trekking Đèo Hải Vân%",
			bookerEmail: "camper.tuan@ctms.local",
			companionEmails: ["camper.nhu@ctms.local", "camper.huy@ctms.local"],
			equipment: [
				{ name: "Lều cắm trại 2 người Naturehike chống nước", quantity: 2 },
				{ name: "Túi ngủ dã ngoại du lịch (10°C - 15°C)", quantity: 3 },
				{ name: "Bếp ga dã ngoại mini và bộ nồi nhôm xếp gọn", quantity: 1 },
			],
		},
		// 4. Chuyến Làng Vân Tháng 12: Bùi Phương Linh đặt cho mình + Thế Dũng + Hữu Kiên + Hoàng Yến (Tổng 4 người, thuê 3 món)
		{
			tripTitlePattern: "%Cắm Trại Đêm Vịnh Làng Vân & Trekking Đèo Hải Vân%",
			bookerEmail: "camper.linh@ctms.local",
			companionEmails: [
				"camper.dung@ctms.local",
				"camper.kien@ctms.local",
				"camper.yen@ctms.local",
			],
			equipment: [
				{ name: "Lều cắm trại 4 người Coleman cao cấp", quantity: 1 },
				{ name: "Đệm hơi cách nhiệt dã ngoại xếp gọn", quantity: 4 },
				{ name: "Đèn pin đội đầu chống nước IPX8 Black Diamond", quantity: 4 },
			],
		},
		// 5. Chuyến Khe Ram Hòa Bắc: Trần Thị Lan đặt cho mình + Hoàng Nam + Hoàng Long (Tổng 3 người, thuê 2 món)
		{
			tripTitlePattern: "%Trekking Khe Ram - Rừng Hòa Bắc (Sắp hết hạn%",
			bookerEmail: "camper.lan@ctms.local",
			companionEmails: ["camper.nam@ctms.local", "camper.long@ctms.local"],
			equipment: [
				{ name: "Túi ngủ dã ngoại du lịch (10°C - 15°C)", quantity: 3 },
				{ name: "Gậy leo núi Carbon siêu nhẹ (Cặp)", quantity: 3 },
			],
		},
		// 6. Chuyến Rừng Sơn Trà Tháng 12: Vũ Đức Huy đặt cho mình + Mai Anh + Quốc Bảo + Thu Thảo (Tổng 4 người, thuê 2 món)
		{
			tripTitlePattern: "%Khám Phá Rừng Nguyên Sinh Sơn Trà - Đỉnh Bàn Cờ%",
			bookerEmail: "camper.huy@ctms.local",
			companionEmails: [
				"camper.maianh@ctms.local",
				"camper.bao@ctms.local",
				"camper.thao@ctms.local",
			],
			equipment: [
				{ name: "Balo trekking trợ lực 50L Deuter", quantity: 2 },
				{ name: "Gậy leo núi Carbon siêu nhẹ (Cặp)", quantity: 4 },
			],
		},
	];

	for (const spec of bookingSpecs) {
		const tripRows: Array<{
			id: string;
			starts_at: Date;
			ends_at: Date;
			price_per_person: string | number;
			title: string;
		}> = await dataSource.query(
			'SELECT "id", "starts_at", "ends_at", "price_per_person", "title" FROM "trips" WHERE "host_id" = $1 AND "title" ILIKE $2 LIMIT 1',
			[hostId, spec.tripTitlePattern]
		);
		if (tripRows.length === 0) {
			console.warn(
				`[seed:group-bookings] Trip matching pattern "${spec.tripTitlePattern}" not found.`
			);
			continue;
		}
		const trip = tripRows[0];
		const tripId = trip.id;

		const bookerId = userMap.get(spec.bookerEmail);
		if (!bookerId) continue;

		const companionIds = spec.companionEmails
			.map((e) => userMap.get(e))
			.filter(Boolean) as string[];
		const allMembers = [
			{ userId: bookerId, isPrimary: true },
			...companionIds.map((id) => ({ userId: id, isPrimary: false })),
		];

		const diffMs = new Date(trip.ends_at).getTime() - new Date(trip.starts_at).getTime();
		const rentalDays = Math.max(1, Math.ceil(diffMs / 86400000));
		const rentalStartDate = new Date(trip.starts_at).toISOString().slice(0, 10);
		const rentalEndDate = new Date(trip.ends_at).toISOString().slice(0, 10);

		const pricePerPerson = Number(trip.price_per_person) || 450000;
		const basePrice = pricePerPerson * allMembers.length;

		// 2.1 Upsert Booking
		const existingBooking: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "bookings" WHERE "trip_id" = $1 AND "user_id" = $2',
			[tripId, bookerId]
		);

		let bookingId = "";
		if (existingBooking.length > 0) {
			bookingId = existingBooking[0].id;
			await dataSource.query(
				`UPDATE "bookings"
				 SET "num_people" = $2, "status" = 'confirmed', "payment_status" = 'paid',
				     "trip_starts_at_snapshot" = $3, "trip_ends_at_snapshot" = $4,
				     "base_price" = $5, "total_amount" = $5
				 WHERE "id" = $1`,
				[bookingId, allMembers.length, trip.starts_at, trip.ends_at, basePrice.toFixed(2)]
			);
		} else {
			const insertedBooking: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "bookings" (
					trip_id, user_id, num_people, status, payment_status,
					trip_starts_at_snapshot, trip_ends_at_snapshot, base_price, total_amount
				) VALUES (
					$1, $2, $3, 'confirmed', 'paid',
					$4, $5, $6, $7
				) RETURNING id`,
				[
					tripId,
					bookerId,
					allMembers.length,
					trip.starts_at,
					trip.ends_at,
					basePrice.toFixed(2),
					basePrice.toFixed(2),
				]
			);
			bookingId = insertedBooking[0].id;
		}

		// Seeded group bookings retain the policy used by ordinary cancellation.
		await dataSource.query(
			`UPDATE bookings booking SET cancellation_policy_snapshot = COALESCE(booking.cancellation_policy_snapshot, trip.cancellation_policy)
             FROM trips trip WHERE booking.trip_id = trip.id AND booking.id = $1`,
			[bookingId]
		);

		// 2.2 Upsert Booking Members
		for (const m of allMembers) {
			const existingMember: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "booking_members" WHERE "booking_id" = $1 AND "user_id" = $2',
				[bookingId, m.userId]
			);
			if (existingMember.length > 0) {
				await dataSource.query(
					`UPDATE "booking_members"
					 SET "member_status" = 'registered', "is_primary" = $2, "checked_in_at" = NULL, "no_show_at" = NULL, "left_at" = NULL
					 WHERE "id" = $1`,
					[existingMember[0].id, m.isPrimary]
				);
			} else {
				await dataSource.query(
					`INSERT INTO "booking_members" (booking_id, user_id, is_primary, member_status)
					 VALUES ($1, $2, $3, 'registered')`,
					[bookingId, m.userId, m.isPrimary]
				);
			}
		}
		await dataSource.query(
			'DELETE FROM "booking_members" WHERE "booking_id" = $1 AND "user_id" NOT IN (SELECT UNNEST($2::uuid[]))',
			[bookingId, allMembers.map((m) => m.userId)]
		);

		// 2.3 Clean old equipment items & reservations for idempotent seed
		await dataSource.query(
			'DELETE FROM "equipment_reservations" WHERE "booking_item_id" IN (SELECT "id" FROM "booking_items" WHERE "booking_id" = $1)',
			[bookingId]
		);
		await dataSource.query('DELETE FROM "booking_items" WHERE "booking_id" = $1', [bookingId]);

		// 2.4 Insert Equipment Items & Reservations
		let equipmentTotal = 0;
		for (const eqItem of spec.equipment) {
			const eqRows: Array<{ id: string; rental_price_per_day: string | number }> =
				await dataSource.query(
					'SELECT "id", "rental_price_per_day" FROM "equipment_catalog_items" WHERE "host_id" = $1 AND "name" = $2 LIMIT 1',
					[hostId, eqItem.name]
				);
			if (eqRows.length === 0) {
				console.warn(`[seed:group-bookings] Equipment item "${eqItem.name}" not found for host.`);
				continue;
			}
			const eq = eqRows[0];
			const unitPrice = Number(eq.rental_price_per_day);
			const itemTotal = unitPrice * eqItem.quantity * rentalDays;
			equipmentTotal += itemTotal;

			const insertedItem: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "booking_items" (
					"booking_id", "item_type", "equipment_catalog_item_id", "quantity", "unit_price", "rental_days", "total_price"
				) VALUES ($1, 'equipment', $2, $3, $4, $5, $6)
				RETURNING "id"`,
				[bookingId, eq.id, eqItem.quantity, unitPrice.toFixed(2), rentalDays, itemTotal.toFixed(2)]
			);
			const bookingItemId = insertedItem[0].id;

			await dataSource.query(
				`INSERT INTO "equipment_reservations" (
					"booking_item_id", "equipment_catalog_item_id", "quantity", "rental_start_date", "rental_end_date", "status"
				) VALUES ($1, $2, $3, $4, $5, 'active')`,
				[bookingItemId, eq.id, eqItem.quantity, rentalStartDate, rentalEndDate]
			);
		}

		// 2.5 Update Booking total amount with equipment
		const finalTotal = basePrice + equipmentTotal;
		await dataSource.query(
			'UPDATE "bookings" SET "base_price" = $2, "total_amount" = $3 WHERE "id" = $1',
			[bookingId, basePrice.toFixed(2), finalTotal.toFixed(2)]
		);

		// 2.6 Ensure Payment & Transaction
		const paymentRows: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "payments" WHERE "booking_id" = $1 LIMIT 1',
			[bookingId]
		);
		let paymentId = "";
		if (paymentRows.length > 0) {
			paymentId = paymentRows[0].id;
			await dataSource.query(
				'UPDATE "payments" SET "amount" = $2, "status" = \'succeeded\' WHERE "id" = $1',
				[paymentId, finalTotal.toFixed(2)]
			);
		} else {
			const insertedPayment: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "payments" (
					"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
				) VALUES ($1, 'charge', 'succeeded', $2, $3, 'seed-fingerprint', 'PAYOS-DEMO-REF')
				RETURNING "id"`,
				[bookingId, finalTotal.toFixed(2), `charge-group-${bookingId}`]
			);
			paymentId = insertedPayment[0].id;
		}

		await dataSource.query(
			`INSERT INTO "payment_transactions" ("payment_id", "status")
			 SELECT $1, 'succeeded'
			 WHERE NOT EXISTS (SELECT 1 FROM "payment_transactions" WHERE "payment_id" = $1 AND "status" = 'succeeded')`,
			[paymentId]
		);

		console.log(
			`[seed:group-bookings] ✅ Seeded booking for ${spec.bookerEmail} on "${trip.title}": ${allMembers.length} members, ${spec.equipment.length} equipment items, total=${finalTotal.toLocaleString("vi-VN")} VND.`
		);
	}

	// 3. Sync seats_taken across all Host trips
	await dataSource.query(
		`UPDATE "trips" t
		 SET "seats_taken" = (
			SELECT COALESCE(SUM(b."num_people"), 0)
			FROM "bookings" b
			WHERE b."trip_id" = t."id" AND b."status" IN ('confirmed', 'pending_payment')
		 )
		 WHERE t."host_id" = $1`,
		[hostId]
	);

	console.log("[seed:group-bookings] ✅ All group bookings with equipment seeded successfully.");
}

// --------------------------------------------------------------------------
// Helper: Seed Route Checkpoints & Danger Zones (checkpoints, route_danger_zones)
// --------------------------------------------------------------------------
async function seedRouteCheckpointsAndDangerZones(routeIds: Record<string, string>): Promise<void> {
	console.log("[seed:dev-trips] Seeding route checkpoints & danger zones...");
	const sonTraId = routeIds["Bán Đảo Sơn Trà Discovery"];
	if (sonTraId) {
		await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = $1', [sonTraId]);

		const sonTraCheckpoints = [
			{
				name: "Điểm xuất phát Chùa Linh Ứng",
				geom: "SRID=4326;POINT(108.260 16.110)",
				radiusMeters: 50,
				type: "start",
				offset: 0,
				instructions: "Tập trung tại cổng phụ Chùa Linh Ứng, kiểm tra trang bị và điểm danh",
				waterOrShelter: true,
				routePosition: 0.0,
			},
			{
				name: "Trạm quan sát Cây Đa Ngàn Năm",
				geom: "SRID=4326;POINT(108.272 16.116)",
				radiusMeters: 40,
				type: "rest",
				offset: 60,
				instructions: "Nghỉ ngơi 15 phút, quan sát đàn voọc chà vá chân nâu, bổ sung nước",
				waterOrShelter: true,
				routePosition: 0.25,
			},
			{
				name: "Trạm tiếp nước & Trú ẩn Suối Đá",
				geom: "SRID=4326;POINT(108.280 16.120)",
				radiusMeters: 50,
				type: "water",
				offset: 120,
				instructions: "Trạm tiếp nước ngọt tự nhiên và chòi trú ẩn kiên cố phòng dông lốc",
				waterOrShelter: true,
				routePosition: 0.5,
			},
			{
				name: "Dốc Vọng Cảnh - Vách đá trơn trượt",
				geom: "SRID=4326;POINT(108.290 16.115)",
				radiusMeters: 30,
				type: "dangerous",
				offset: 180,
				instructions: "Đoạn dốc đứng trơn trợt, cần bám dây an toàn và đi chậm theo hướng dẫn",
				waterOrShelter: false,
				routePosition: 0.75,
			},
			{
				name: "Đích đến - Trạm Hải Đăng Sơn Trà",
				geom: "SRID=4326;POINT(108.300 16.110)",
				radiusMeters: 60,
				type: "finish",
				offset: 240,
				instructions:
					"Kết thúc hành trình tại Trạm Hải Đăng Sơn Trà, thu gom rác và bàn giao thiết bị",
				waterOrShelter: true,
				routePosition: 1.0,
			},
		];

		for (const cp of sonTraCheckpoints) {
			await dataSource.query(
				`INSERT INTO "checkpoints" (
					route_id, name, location, radius_m, type, expected_arrival_offset, instructions, nearby_water_or_shelter, route_position
				) VALUES (
					$1, $2, ST_GeogFromText($3), $4, $5, $6, $7, $8, $9
				)`,
				[
					sonTraId,
					cp.name,
					cp.geom,
					cp.radiusMeters,
					cp.type,
					cp.offset,
					cp.instructions,
					cp.waterOrShelter,
					cp.routePosition,
				]
			);
		}

		await dataSource.query('DELETE FROM "route_danger_zones" WHERE "route_id" = $1', [sonTraId]);
		await dataSource.query(
			`INSERT INTO "route_danger_zones" (route_id, geom, radius_m, description, severity)
			 VALUES 
			 ($1, ST_GeogFromText('SRID=4326;POINT(108.292 16.114)'), 80, 'Vách đá trơn trượt Mũi Nghê - Nguy cơ trượt ngã khi trời mưa ẩm', 'high'),
			 ($1, ST_GeogFromText('SRID=4326;POINT(108.275 16.118)'), 50, 'Đoạn dốc sạt lở đất đá mùa mưa bão', 'medium')`,
			[sonTraId]
		);
	}

	const haiVanId = routeIds["Hải Vân Pass - Nam Hải Vân Trail"];
	if (haiVanId) {
		await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = $1', [haiVanId]);
		const haiVanCheckpoints = [
			{
				name: "Điểm xuất phát Chân Đèo Hải Vân",
				geom: "SRID=4326;POINT(108.130 16.185)",
				radiusMeters: 50,
				type: "start",
				offset: 0,
				instructions: "Tập kết chân đèo phía Đà Nẵng, kiểm tra dây đai và phổ biến an toàn",
				waterOrShelter: true,
				routePosition: 0.0,
			},
			{
				name: "Trạm dừng chân Lưng Đèo",
				geom: "SRID=4326;POINT(108.138 16.195)",
				radiusMeters: 40,
				type: "rest",
				offset: 120,
				instructions: "Điểm dừng chân nghỉ ngơi, view toàn cảnh vịnh Làng Vân từ trên cao",
				waterOrShelter: false,
				routePosition: 0.33,
			},
			{
				name: "Điểm trú bão & Sơ cứu Hải Vân Quan",
				geom: "SRID=4326;POINT(108.145 16.205)",
				radiusMeters: 50,
				type: "emergency_shelter",
				offset: 240,
				instructions: "Công trình kiên cố di tích Hải Vân Quan, trang bị tủ thuốc sơ cứu và nước",
				waterOrShelter: true,
				routePosition: 0.67,
			},
			{
				name: "Bãi Cắm Trại Vịnh Làng Vân (Đích đến)",
				geom: "SRID=4326;POINT(108.150 16.210)",
				radiusMeters: 60,
				type: "finish",
				offset: 360,
				instructions: "Bãi biển hoang sơ Làng Vân, hạ lều cắm trại và chuẩn bị lửa trại",
				waterOrShelter: true,
				routePosition: 1.0,
			},
		];
		for (const cp of haiVanCheckpoints) {
			await dataSource.query(
				`INSERT INTO "checkpoints" (
					route_id, name, location, radius_m, type, expected_arrival_offset, instructions, nearby_water_or_shelter, route_position
				) VALUES (
					$1, $2, ST_GeogFromText($3), $4, $5, $6, $7, $8, $9
				)`,
				[
					haiVanId,
					cp.name,
					cp.geom,
					cp.radiusMeters,
					cp.type,
					cp.offset,
					cp.instructions,
					cp.waterOrShelter,
					cp.routePosition,
				]
			);
		}
	}

	const kheRamId = routeIds["Khe Ram - Suối Mơ - Rừng Hòa Bắc"];
	if (kheRamId) {
		await dataSource.query('DELETE FROM "route_danger_zones" WHERE "route_id" = $1', [kheRamId]);
		await dataSource.query(
			`INSERT INTO "route_danger_zones" (route_id, geom, radius_m, description, severity)
			 VALUES ($1, ST_GeogFromText('SRID=4326;POINT(108.050 16.120)'), 200, 'Khu vực lòng suối nước xiết - Nguy cơ lũ quét cực cao khi có mưa lớn ở thượng nguồn', 'high')`,
			[kheRamId]
		);
	}
}

// --------------------------------------------------------------------------
// Helper: Seed Diverse Trip & Route Statuses (Pending Approval, Draft, Cancelled, Closed)
// --------------------------------------------------------------------------
async function seedDiverseTripAndRouteStatuses(
	hostId: string,
	routeIds: Record<string, string>
): Promise<void> {
	console.log("[seed:dev-trips] Seeding diverse route and trip lifecycle statuses...");
	const now = new Date();
	const inDays = (d: number, hours = 7) => {
		const date = new Date(now.getTime() + d * 86400000);
		date.setHours(hours, 0, 0, 0);
		return date.toISOString();
	};

	// 1. Route Pending Approval
	const pendingRouteName = "Đồi Dương - Suối Lương Trail (Chờ Duyệt)";
	const existingPendingRoute: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trekking_routes" WHERE "name" = $1',
		[pendingRouteName]
	);
	let pendingRouteId = "";
	if (existingPendingRoute.length > 0) {
		pendingRouteId = existingPendingRoute[0].id;
		await dataSource.query(
			'UPDATE "trekking_routes" SET "status" = \'pending_approval\' WHERE "id" = $1',
			[pendingRouteId]
		);
	} else {
		const res: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "trekking_routes" (
				host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status
			) VALUES (
				$1, $2, 'Cung đường ven suối râm mát, đang được Host đề xuất chờ Admin phê duyệt',
				ST_GeogFromText('SRID=4326;LINESTRING(108.120 16.170, 108.125 16.175, 108.130 16.180)'),
				3800, 'easy', 150, 'pending_approval'
			) RETURNING id`,
			[hostId, pendingRouteName]
		);
		pendingRouteId = res[0].id;
	}
	routeIds[pendingRouteName] = pendingRouteId;

	// 2. Route Closed (do sạt lở)
	const closedRouteName = "Đỉnh Mẹ Suốt Cung Sạt Lở (Tạm Đóng)";
	const existingClosedRoute: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trekking_routes" WHERE "name" = $1',
		[closedRouteName]
	);
	if (existingClosedRoute.length > 0) {
		await dataSource.query('UPDATE "trekking_routes" SET "status" = \'closed\' WHERE "id" = $1', [
			existingClosedRoute[0].id,
		]);
	} else {
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status
			) VALUES (
				$1, $2, 'Cung đường đang tạm đóng do ảnh hưởng sạt lở sau bão, không mở nhận chuyến',
				ST_GeogFromText('SRID=4326;LINESTRING(108.110 16.160, 108.115 16.165)'),
				2800, 'hard', 180, 'closed'
			)`,
			[hostId, closedRouteName]
		);
	}

	// 3. Trips with diverse statuses
	const sonTraId = routeIds["Bán Đảo Sơn Trà Discovery"];
	if (!sonTraId) return;

	// Trip: Pending Approval (Chờ Admin duyệt)
	const pendingTripTitle = "[CTMS-024] Thám Hiểm Rừng Hòa Bắc (Chờ Admin phê duyệt)";
	const existingPendingTrip: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trips" WHERE "title" = $1',
		[pendingTripTitle]
	);
	if (existingPendingTrip.length === 0) {
		await dataSource.query(
			`INSERT INTO "trips" (
				host_id, route_id, title, description, cover_image_url,
				trip_type, duration_nights, starts_at, ends_at,
				meeting_point, meeting_at, booking_deadline,
				capacity_min, capacity_max, seats_taken, price_per_person,
				itinerary, includes, excludes, cancellation_policy, status
			) VALUES (
				$1, $2, $3, 'Chuyến thám hiểm mới được Host tạo, đang trong hàng đợi chờ Admin kiểm tra và phê duyệt xuất bản.',
				'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
				'day_trip', 0, $4, $5,
				ST_GeogFromText('SRID=4326;POINT(108.020 16.090)'), $6, $7,
				6, 15, 0, '650000',
				'{"summary": "07:00 xuất phát, 16:30 hoàn thành."}'::jsonb,
				NULL,
				NULL,
				$8::jsonb,
				'pending_approval'
			)`,
			[
				hostId,
				sonTraId,
				pendingTripTitle,
				inDays(10, 7),
				inDays(10, 17),
				inDays(10, 6),
				inDays(8, 18),
				JSON.stringify(DEFAULT_CANCELLATION_POLICY),
			]
		);
	}

	// Trip: Draft (Host đang lưu nháp)
	const draftTripTitle = "[CTMS-024] Trekking Suối Mơ Hòa Vang (Bản nháp của Host)";
	const existingDraftTrip: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trips" WHERE "title" = $1',
		[draftTripTitle]
	);
	if (existingDraftTrip.length === 0) {
		await dataSource.query(
			`INSERT INTO "trips" (
				host_id, route_id, title, description, cover_image_url,
				trip_type, duration_nights, starts_at, ends_at,
				meeting_point, meeting_at, booking_deadline,
				capacity_min, capacity_max, seats_taken, price_per_person,
				itinerary, includes, excludes, cancellation_policy, status
			) VALUES (
				$1, $2, $3, 'Bản phác thảo kế hoạch chuyến đi chưa gửi duyệt của Host.',
				'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80',
				'day_trip', 0, $4, $5,
				ST_GeogFromText('SRID=4326;POINT(108.030 16.100)'), $6, $7,
				5, 20, 0, '350000',
				'{"summary": "Đang cập nhật lịch trình."}'::jsonb,
				NULL,
				NULL,
				$8::jsonb,
				'draft'
			)`,
			[
				hostId,
				sonTraId,
				draftTripTitle,
				inDays(14, 8),
				inDays(14, 16),
				inDays(14, 7),
				inDays(12, 18),
				JSON.stringify(DEFAULT_CANCELLATION_POLICY),
			]
		);
	}

	// Trip: Cancelled (Đã hủy do thiếu người sau hạn chót đặt chỗ)
	const cancelledTripTitle = "[CTMS-024] Chinh Phục Đỉnh Núi Chúa (Đã hủy do thiếu người)";
	const existingCancelledTrip: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trips" WHERE "title" = $1',
		[cancelledTripTitle]
	);
	if (existingCancelledTrip.length === 0) {
		await dataSource.query(
			`INSERT INTO "trips" (
				host_id, route_id, title, description, cover_image_url,
				trip_type, duration_nights, starts_at, ends_at,
				meeting_point, meeting_at, booking_deadline,
				capacity_min, capacity_max, seats_taken, price_per_person,
				itinerary, includes, excludes, cancellation_policy, status
			) VALUES (
				$1, $2, $3, 'Chuyến đi tự động bị hủy do đến hạn chót đặt vé mà số lượng người đăng ký không đạt mức tối thiểu (capacity_min).',
				'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
				'day_trip', 0, $4, $5,
				ST_GeogFromText('SRID=4326;POINT(108.010 15.990)'), $6, $7,
				10, 25, 2, '550000',
				'{"summary": "Chuyến đi đã bị hủy theo quy chế capacity_min."}'::jsonb,
				NULL,
				NULL,
				$8::jsonb,
				'cancelled'
			)`,
			[
				hostId,
				sonTraId,
				cancelledTripTitle,
				inDays(2, 7),
				inDays(2, 17),
				inDays(2, 6),
				inDays(1, 18),
				JSON.stringify(DEFAULT_CANCELLATION_POLICY),
			]
		);
	}
}

/** Readable display names for the explicitly selected development fixtures only. */
export function readableDemoTripTitle(title: string): string {
	return title
		.replace(/^\[(?:DEMO CTMS-306|CTMS-024|UI TEST CTMS-308)\]\s*/u, "")
		.replace(
			/\s*\((?:Bình thường|Khẩn cấp|Đã Hết Chỗ|Đã Hết Hạn|Sắp hết hạn|Chờ Admin|Bản nháp|Đã hủy)[^)]*\)\s*$/iu,
			""
		)
		.replace(/Sơn Trà - Xem dữ liệu ngoại tuyến/u, "Sơn Trà – Hành trình ven biển")
		.trim();
}

/** One-time opt-in cleanup; no Trip status, package, role or review outcome changes. */
export async function tidyDemoCopyForReview(ds: DataSource = dataSource) {
	if (process.env.NODE_ENV === "production" || process.env.CTMS138_DEMO_SEED !== "1")
		throw new Error("Demo cleanup requires CTMS138_DEMO_SEED=1 outside production.");
	return ds.transaction(async (manager) => {
		const trips: Array<{ id: string; title: string }> = await manager.query(
			`SELECT t.id,t.title FROM trips t JOIN users u ON u.id=t.host_id WHERE u.email='host@ctms.local' AND (t.title LIKE '[DEMO CTMS-306]%' OR t.title LIKE '[CTMS-024]%' OR t.title LIKE '[UI TEST CTMS-308]%') FOR UPDATE OF t`
		);
		for (const trip of trips)
			await manager.query("UPDATE trips SET title=$2 WHERE id=$1 AND title=$3", [
				trip.id,
				readableDemoTripTitle(trip.title),
				trip.title,
			]);
		const decisions: Array<{ id: string }> = await manager.query(
			`WITH updated AS (UPDATE porter_level_decisions d SET reason=$1 FROM users u,trekking_routes r WHERE d.porter_id=u.id AND d.route_id=r.id AND u.email='porter.expert@ctms.local' AND r.name='Bán Đảo Sơn Trà Discovery' AND d.source='direct' AND d.outcome='rejected' AND d.reason=$2 RETURNING d.id) SELECT id FROM updated`,
			[
				"Chưa có minh chứng chứng chỉ phù hợp để công nhận cấp đề xuất.",
				"Kiểm thử CTMS-138: chưa có minh chứng chứng chỉ phù hợp, không công nhận cấp đề xuất; giữ nguyên cấp hiện tại.",
			]
		);
		return { tripsRenamed: trips.length, decisionNotesUpdated: decisions.length };
	});
}

export const PORTER_LEVEL_DEMO_COPY = {
	reason:
		"Tôi đã hỗ trợ nhiều đoàn trên tuyến này và muốn đăng ký lên cấp Thành thạo. Tôi có thể bổ sung nhật ký chuyến đi và giấy tờ cần thiết.",
	responsibilities: "Chưa cấu hình phạm vi phụ trách.",
	additionalInfo: "Vui lòng bổ sung thông tin về các chuyến đã tham gia và minh chứng liên quan.",
	cancelled: "Tôi xin rút yêu cầu để bổ sung hồ sơ trước khi gửi lại.",
} as const;

/** Demonstration criteria only, not production qualification standards. */
export const PORTER_LEVEL_DEMO_CRITERIA = {
	learning: {
		name: "Học việc",
		minExperienceYears: 0,
		minTimesLed: 0,
		requiredSkills: ["Chuẩn bị hành trang", "Đi theo đoàn"],
		requiredCertifications: [],
		responsibilities: "Hỗ trợ chuẩn bị và theo đoàn dưới sự hướng dẫn của người hỗ trợ phụ trách.",
	},
	proficient: {
		name: "Thành thạo",
		minExperienceYears: 2,
		minTimesLed: 10,
		requiredSkills: ["Định hướng trên tuyến", "Sơ cứu cơ bản"],
		requiredCertifications: ["Sơ cứu cơ bản"],
		responsibilities: "Hỗ trợ điều phối đoàn, kiểm tra trang bị và xử lý tình huống thông thường.",
	},
	expert: {
		name: "Chuyên gia",
		minExperienceYears: 5,
		minTimesLed: 25,
		requiredSkills: ["Lập kế hoạch hành trình", "Điều phối cứu hộ", "Sơ cứu cơ bản"],
		requiredCertifications: ["Sơ cứu cơ bản", "Cứu hộ địa hình"],
		responsibilities: "Phụ trách tuyến và phối hợp xử lý tình huống khẩn cấp.",
	},
} as const;

/** Opt-in refresh limited to untouched demonstration policies. */
export async function refreshPorterLevelDemoCriteria(ds: DataSource = dataSource) {
	if (process.env.NODE_ENV === "production" || process.env.CTMS138_DEMO_SEED !== "1")
		throw new Error("Demo refresh requires CTMS138_DEMO_SEED=1 outside production.");
	return ds.transaction(async (manager) => {
		let policiesUpdated = 0;
		for (const [level, definition] of Object.entries(PORTER_LEVEL_DEMO_CRITERIA)) {
			const rows: Array<{ level: string }> = await manager.query(
				`WITH updated AS (UPDATE porter_level_policies SET definition=$2::jsonb,version=version+1,updated_at=now()
    WHERE level=$1 AND version<=2 AND definition->>'responsibilities'=$3
    AND (definition->>'minExperienceYears') IS NULL AND (definition->>'minTimesLed') IS NULL
    AND definition->'requiredSkills'='[]'::jsonb AND definition->'requiredCertifications'='[]'::jsonb RETURNING level) SELECT level FROM updated`,
				[level, JSON.stringify(definition), PORTER_LEVEL_DEMO_COPY.responsibilities]
			);
			policiesUpdated += rows.length;
		}
		const previousReason =
			"Tôi muốn được xét lên cấp Thành thạo trên tuyến này. Nhờ quản trị viên xem xét hồ sơ và kinh nghiệm đã khai báo.";
		const requests: Array<{ id: string }> = await manager.query(
			`WITH updated AS (UPDATE porter_level_requests r SET reason=$2,submission_hash=$3,version=version+1
   WHERE r.id IN ('c1380000-0000-4000-8000-000000000001','c1380000-0000-4000-8000-000000000002','c1380000-0000-4000-8000-000000000003')
   AND r.reason=$1 AND r.porter_id=(SELECT id FROM users WHERE email='porter.learning@ctms.local')
   AND NOT EXISTS(SELECT 1 FROM porter_level_decisions WHERE request_id=r.id)
   AND NOT EXISTS(SELECT 1 FROM porter_level_request_evidence WHERE request_id=r.id) RETURNING id) SELECT id FROM updated`,
			[
				previousReason,
				PORTER_LEVEL_DEMO_COPY.reason,
				createHash("sha256").update(PORTER_LEVEL_DEMO_COPY.reason).digest("hex"),
			]
		);
		return { policiesUpdated, requestsUpdated: requests.length };
	});
}

/** Explicit non-production maintenance for untouched, deterministic demo rows only. */
export async function refreshPorterLevelDemoCopy(ds: DataSource = dataSource) {
	if (process.env.NODE_ENV === "production")
		throw new Error("Demo copy refresh must not run in production.");
	return ds.transaction(async (manager) => {
		let requestsUpdated = 0;
		const statuses = ["pending", "needs_info", "cancelled"] as const;
		for (const [index, status] of statuses.entries()) {
			const id = `c1380000-0000-4000-8000-00000000000${index + 1}`;
			const oldReason = `[DEMO CTMS-138] Yêu cầu minh họa ${status}; người test tự tải minh chứng nếu cần.`;
			const rows: Array<{ id: string }> = await manager.query(
				`WITH updated AS (UPDATE porter_level_requests r
				SET reason=$2, submission_hash=$3, version=version+1,
				decision_reason=CASE WHEN status='needs_info' THEN $7 ELSE decision_reason END
				WHERE r.id=$1 AND r.reason=$4 AND r.status=$5 AND r.version=$6
				AND r.porter_id=(SELECT id FROM users WHERE email='porter.learning@ctms.local')
				AND (SELECT count(*) FROM porter_level_request_events WHERE request_id=r.id)=$8
				AND NOT EXISTS(SELECT 1 FROM porter_level_decisions WHERE request_id=r.id)
				AND NOT EXISTS(SELECT 1 FROM porter_level_request_evidence WHERE request_id=r.id)
				RETURNING r.id) SELECT id FROM updated`,
				[
					id,
					PORTER_LEVEL_DEMO_COPY.reason,
					createHash("sha256").update(PORTER_LEVEL_DEMO_COPY.reason).digest("hex"),
					oldReason,
					status,
					status === "pending" ? 1 : 2,
					PORTER_LEVEL_DEMO_COPY.additionalInfo,
					status === "pending" ? 1 : 2,
				]
			);
			if (!rows.length) continue;
			requestsUpdated += rows.length;
			// These are original generated demo events, not decisions or user-entered history.
			await manager.query(
				`UPDATE porter_level_request_events SET reason=$3::text,
				snapshot=jsonb_set(snapshot,'{reason}',to_jsonb($3::text))
				WHERE request_id=$1 AND action='created' AND reason=$2`,
				[id, oldReason, PORTER_LEVEL_DEMO_COPY.reason]
			);
			await manager.query(
				`UPDATE porter_level_request_events SET reason=$2,
				snapshot=jsonb_set(snapshot,'{reason}',to_jsonb($3::text))
				WHERE request_id=$1 AND reason LIKE '[DEMO]%'`,
				[
					id,
					status === "needs_info"
						? PORTER_LEVEL_DEMO_COPY.additionalInfo
						: PORTER_LEVEL_DEMO_COPY.cancelled,
					PORTER_LEVEL_DEMO_COPY.reason,
				]
			);
		}
		const policies: Array<{ level: string }> = await manager.query(
			`WITH updated AS (UPDATE porter_level_policies
			SET definition=jsonb_set(definition,'{responsibilities}',to_jsonb($1::text)),version=version+1
			WHERE version=1 AND definition->>'responsibilities'=$2 RETURNING level) SELECT level FROM updated`,
			[
				PORTER_LEVEL_DEMO_COPY.responsibilities,
				"[DEMO CTMS-138] Nội dung minh họa để test UI. Admin cần cấu hình tiêu chí thực tế; chưa quy định ngưỡng nghiệp vụ.",
			]
		);
		return { requestsUpdated, policiesUpdated: policies.length };
	});
}

/** Optional demo records only; never overwrite an Admin policy or reviewed qualification. */
export async function seedPorterLevelDemo(ds: DataSource = dataSource): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("CTMS-138 demo seed must not run in production.");
	}
	await ds.transaction(async (manager) => {
		const accounts: Array<{ id: string; email: string }> = await manager.query(
			"SELECT id,email FROM users WHERE email IN ('admin@ctms.local','porter.learning@ctms.local')"
		);
		const admin = accounts.find((account) => account.email === "admin@ctms.local");
		const porter = accounts.find((account) => account.email === "porter.learning@ctms.local");
		if (!admin || !porter)
			throw new Error("CTMS-138 demo requires existing Admin and learning Porter.");
		for (const [level] of [
			["learning", "Học việc"],
			["proficient", "Thành thạo"],
			["expert", "Chuyên gia"],
		]) {
			await manager.query(
				`INSERT INTO porter_level_policies(level,definition,version,updated_by)
				 VALUES($1,$2::jsonb,1,$3) ON CONFLICT(level) DO NOTHING`,
				[
					level,
					JSON.stringify(
						PORTER_LEVEL_DEMO_CRITERIA[level as keyof typeof PORTER_LEVEL_DEMO_CRITERIA]
					),
					admin.id,
				]
			);
		}
		await manager.query(
			`INSERT INTO porter_profiles(porter_id,experience_years,certifications,languages)
			 VALUES($1,0,'{}','{}') ON CONFLICT(porter_id) DO NOTHING`,
			[porter.id]
		);
		await manager.query(
			`INSERT INTO porter_verifications(porter_id,status,submitted_at,reviewed_at)
			 VALUES($1,'approved',now(),now()) ON CONFLICT(porter_id) DO NOTHING`,
			[porter.id]
		);
		const statuses = ["pending", "needs_info", "cancelled"] as const;
		for (const [index, routeName] of PORTER_SEED_ROUTE_NAMES.entries()) {
			const routes: Array<{ id: string }> = await manager.query(
				"SELECT id FROM trekking_routes WHERE name=$1",
				[routeName]
			);
			if (!routes[0]) throw new Error(`CTMS-138 demo Route missing: ${routeName}`);
			await manager.query(
				`INSERT INTO porter_route_qualifications(porter_id,route_id,proficiency,times_led)
				 VALUES($1,$2,'learning',0) ON CONFLICT(porter_id,route_id) DO NOTHING`,
				[porter.id, routes[0].id]
			);
			// Leave the fourth Route free so Porter can test creating a new request.
			const status = statuses[index];
			if (!status) continue;
			const qualifications: Array<{ id: string; proficiency: string; verified: boolean }> =
				await manager.query(
					`SELECT id,proficiency,verified_by IS NOT NULL AS verified FROM porter_route_qualifications
				 WHERE porter_id=$1 AND route_id=$2 FOR UPDATE`,
					[porter.id, routes[0].id]
				);
			const qualification = qualifications[0];
			if (qualification.proficiency !== "learning") continue;
			// Stable IDs prevent reseeding a request after a tester completes or cancels it.
			const id = `c1380000-0000-4000-8000-00000000000${index + 1}`;
			const reason = PORTER_LEVEL_DEMO_COPY.reason;
			const inserted: Array<{ id: string }> = await manager.query(
				`INSERT INTO porter_level_requests(id,qualification_id,porter_id,route_id,current_level,current_verified,
				 target_level,reason,status,submission_hash)
				 SELECT $1,$2,$3,$4,'learning',$5,'proficient',$6,'pending',$7
				 WHERE NOT EXISTS(SELECT 1 FROM porter_level_requests WHERE porter_id=$3 AND route_id=$4 AND status IN ('pending','needs_info'))
				 ON CONFLICT DO NOTHING RETURNING id`,
				[
					id,
					qualification.id,
					porter.id,
					routes[0].id,
					qualification.verified,
					reason,
					createHash("sha256").update(reason).digest("hex"),
				]
			);
			if (!inserted.length) continue;
			await manager.query(
				`INSERT INTO porter_level_request_events(request_id,actor_id,action,from_status,to_status,reason,snapshot)
				 VALUES($1,$2,'created',NULL,'pending',$3,$4::jsonb)`,
				[
					id,
					porter.id,
					reason,
					JSON.stringify({ version: 1, reason, targetLevel: "proficient", evidence: [] }),
				]
			);
			if (status === "pending") continue;
			const feedback =
				status === "needs_info"
					? PORTER_LEVEL_DEMO_COPY.additionalInfo
					: PORTER_LEVEL_DEMO_COPY.cancelled;
			await manager.query(
				`UPDATE porter_level_requests SET status=$2::varchar,version=2,decision_reason=$3,
				 decided_by=CASE WHEN $2::varchar='needs_info' THEN $4::uuid END,
				 decided_at=CASE WHEN $2::varchar='needs_info' THEN now() END WHERE id=$1`,
				[id, status, status === "needs_info" ? feedback : null, admin.id]
			);
			await manager.query(
				`INSERT INTO porter_level_request_events(request_id,actor_id,action,from_status,to_status,reason,snapshot)
				 VALUES($1,$2,$3,'pending',$4,$5,$6::jsonb)`,
				[
					id,
					status === "needs_info" ? admin.id : porter.id,
					status === "needs_info" ? "needs_info" : "cancelled",
					status,
					feedback,
					JSON.stringify({ version: 2, reason, targetLevel: "proficient", evidence: [] }),
				]
			);
		}
	});
	console.log(
		"[CTMS-138] Demo: porter.learning@ctms.local / Porter@123; pending, needs_info, cancelled; fourth Route free."
	);
}

// --------------------------------------------------------------------------
// Helper: Seed Porter Profile, Route Qualifications & Assignments
// --------------------------------------------------------------------------
async function seedPorterProfileAndAssignments(routeIds: Record<string, string>): Promise<void> {
	console.log("[seed:dev-trips] Seeding Porter profiles, qualifications and trip assignments...");
	const adminRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["admin@ctms.local"]
	);
	const adminId = adminRows.length > 0 ? adminRows[0].id : null;
	if (!adminId) {
		throw new Error("[seed:dev-trips] Admin account is required to verify Porter qualifications.");
	}

	for (const fixture of PORTER_SEED_FIXTURES) {
		await seedAccount({
			label: fixture.key,
			email: fixture.email,
			phone: fixture.phone,
			password: "Porter@123",
			role: "porter",
			fullName: fixture.fullName,
		});

		const porterRows: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "users" WHERE "email" = $1',
			[fixture.email]
		);
		const porterId = porterRows[0]?.id;
		if (!porterId) {
			throw new Error(`[seed:dev-trips] Porter account was not created: ${fixture.email}`);
		}

		await dataSource.query(
			`UPDATE "users"
			 SET "status" = $2, "full_name" = $3, "updated_at" = NOW()
			 WHERE "id" = $1`,
			[porterId, fixture.userStatus, fixture.fullName]
		);
		await grantRole(porterId, "porter");

		await dataSource.query('DELETE FROM "trip_porters" WHERE "porter_id" = $1', [porterId]);
		// Preserve qualification identity, reviewed ranks and request/history foreign keys on reruns.

		if (!fixture.profile) {
			await dataSource.query('DELETE FROM "porter_profiles" WHERE "porter_id" = $1', [porterId]);
			continue;
		}

		await dataSource.query(
			`INSERT INTO "porter_profiles" (
				porter_id, experience_years, certifications, languages,
				availability_status, rating_avg, completed_trips
			) VALUES ($1, $2, '{}', $3, $4, $5, $6)
			ON CONFLICT (porter_id) DO UPDATE SET
				experience_years = EXCLUDED.experience_years,
				certifications = EXCLUDED.certifications,
				languages = EXCLUDED.languages,
				availability_status = EXCLUDED.availability_status,
				rating_avg = EXCLUDED.rating_avg,
				completed_trips = EXCLUDED.completed_trips,
				updated_at = NOW()`,
			[
				porterId,
				fixture.profile.experienceYears,
				fixture.profile.languages,
				fixture.profile.availabilityStatus,
				fixture.profile.ratingAvg,
				fixture.profile.completedTrips,
			]
		);

		if (fixture.key === "expert-lead") {
			await dataSource.query(
				`INSERT INTO "porter_verifications" (porter_id, status, submitted_at, reviewed_at)
				 VALUES ($1, 'approved', now(), now())
				 ON CONFLICT (porter_id) DO UPDATE SET
					status = 'approved',
					reviewed_at = COALESCE("porter_verifications".reviewed_at, now()),
					rejection_reason = NULL`,
				[porterId]
			);
		}

		if (fixture.qualification) {
			for (const routeName of fixture.qualification.routeNames) {
				const routeId = routeIds[routeName];
				if (!routeId) {
					throw new Error(`[seed:dev-trips] Missing Route for Porter qualification: ${routeName}`);
				}
				await dataSource.query(
					`INSERT INTO "porter_route_qualifications" (
						porter_id, route_id, proficiency, times_led, verified_by, verified_at
					) VALUES ($1, $2, $3, $4, $5, NOW())
					ON CONFLICT (porter_id, route_id) DO NOTHING`,
					[
						porterId,
						routeId,
						fixture.qualification.proficiency,
						fixture.qualification.timesLed,
						adminId,
					]
				);
			}
		}

		if (fixture.conflictingTripTitle) {
			const tripRows: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "trips" WHERE "title" = $1',
				[fixture.conflictingTripTitle]
			);
			const tripId = tripRows[0]?.id;
			if (!tripId) {
				throw new Error(
					`[seed:dev-trips] Missing Trip for Porter conflict fixture: ${fixture.conflictingTripTitle}`
				);
			}
			await dataSource.query(
				`INSERT INTO "trip_porters" (trip_id, porter_id, status)
				 VALUES ($1, $2, 'assigned')
				 ON CONFLICT (trip_id, porter_id) DO UPDATE SET status = 'assigned'`,
				[tripId, porterId]
			);
		}
	}
}

// --------------------------------------------------------------------------
// Helper: Seed Camper Health Profiles & Emergency Contacts
// --------------------------------------------------------------------------
async function seedCamperHealthAndContacts(): Promise<void> {
	console.log("[seed:dev-trips] Seeding Camper health profiles & emergency contacts...");
	const camperRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	if (camperRows.length === 0) return;
	const camperId = camperRows[0].id;

	// Camper basic profile information (DOB, address, gender)
	await dataSource.query(
		`UPDATE "users"
		 SET "date_of_birth" = '1998-10-20',
		     "address" = 'Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
		     "gender" = 'male'
		 WHERE "id" = $1`,
		[camperId]
	);

	// Emergency contact
	await dataSource.query('DELETE FROM "emergency_contacts" WHERE "user_id" = $1', [camperId]);
	await dataSource.query(
		`INSERT INTO "emergency_contacts" (user_id, name, relationship, phone, email)
		 VALUES ($1, 'Nguyễn Văn Hùng', 'Bố', '0912345678', 'hung.nguyen@gmail.com')`,
		[camperId]
	);

	// Health profile
	await dataSource.query(
		`INSERT INTO "health_profiles" (
			user_id, blood_type, physical_fitness_level, dietary_restrictions, emergency_notes,
			allergies, medical_conditions, is_consent_granted, consent_granted_at
		) VALUES (
			$1, 'O+', 'INTERMEDIATE', 'Ăn chay bán phần', 'Có tiền sử hạ đường huyết nhẹ khi vận động cường độ cao liên tục',
			'["Dị ứng phấn hoa dại"]'::jsonb, '[]'::jsonb, true, NOW()
		) ON CONFLICT (user_id) DO UPDATE SET
			blood_type = EXCLUDED.blood_type,
			physical_fitness_level = EXCLUDED.physical_fitness_level,
			dietary_restrictions = EXCLUDED.dietary_restrictions,
			emergency_notes = EXCLUDED.emergency_notes,
			allergies = EXCLUDED.allergies,
			is_consent_granted = EXCLUDED.is_consent_granted`,
		[camperId]
	);
}

/**
 * CTMS-106. Trip preferences for the main Camper so "Gợi ý cho bạn" ranks by preferences and the
 * booking history already seeded. Existing preferences are kept: a Camper's own choice wins.
 */
export async function seedCamperTripPreferences(ds: DataSource = dataSource): Promise<void> {
	const [camper]: Array<{ id: string }> = await ds.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	if (!camper) return;
	await ds.query(
		`INSERT INTO "camper_trip_preferences"
			("user_id", "trip_types", "difficulties", "regions", "min_price", "max_price")
		 VALUES ($1, ARRAY['overnight']::text[], ARRAY['moderate', 'hard']::text[],
			ARRAY['ba_na_hoa_vang', 'son_tra']::text[], 500000, 2500000)
		 ON CONFLICT ("user_id") DO NOTHING`,
		[camper.id]
	);
	// Profile experience, only where the Camper has not written their own.
	await ds.query(
		`UPDATE "users" SET
			"camping_experience_years" = COALESCE("camping_experience_years", 3),
			"trekking_experience_details" = COALESCE("trekking_experience_details", $2)
		 WHERE "id" = $1`,
		[camper.id, "Đã trekking bán đảo Sơn Trà, đèo Hải Vân và cắm trại qua đêm ở Bà Nà hai lần."]
	);
}

// ==========================================================================
// [4/6] WEATHER RISK SCENARIOS (GREEN & RED ROUTES)
// ==========================================================================
export async function seedWeatherRiskScenarios(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:weather-scenarios] Database initialized.");

	try {
		// 1. Host User
		const hostEmail = "host@ctms.local";
		const hostPhone = "0900000002";
		const hostPassword = "Host@123";

		const existingUser: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[hostEmail, hostPhone]
		);

		let hostId = "";
		if (existingUser.length > 0) {
			hostId = existingUser[0].id;
		} else {
			const passwordHash = await hash(hostPassword, BCRYPT_COST_FACTOR);
			const insertedUser: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "users" (email, phone, password_hash, role, status, full_name)
				 VALUES ($1, $2, $3, 'host', 'active', 'Host Ban Mai')
				 RETURNING id`,
				[hostEmail, hostPhone, passwordHash]
			);
			hostId = insertedUser[0].id;
			await dataSource.query(
				`INSERT INTO "user_roles" (user_id, role) VALUES ($1, 'host') ON CONFLICT DO NOTHING`,
				[hostId]
			);
		}

		// 2. Ensure a weather_risk_rule exists
		const existingRules: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "weather_risk_rules" ORDER BY "created_at" DESC LIMIT 1'
		);
		let ruleVersionId = "";
		if (existingRules.length > 0) {
			ruleVersionId = existingRules[0].id;
		} else {
			const insertedRule: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "weather_risk_rules" (
					"rainfall_yellow_threshold", "rainfall_red_threshold",
					"wind_yellow_threshold", "wind_red_threshold",
					"temp_low_yellow", "temp_low_red", "temp_high_yellow", "temp_high_red",
					"visibility_yellow_threshold", "visibility_red_threshold",
					"thunderstorm_yellow", "thunderstorm_red",
					"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight", "thunderstorm_weight",
					"green_max_score", "yellow_max_score",
					"is_active", "created_by"
				) VALUES (
					10.0, 50.0,
					40.0, 70.0,
					5.0, 0.0, 38.0, 42.0,
					5000.0, 1000.0,
					true, true,
					0.30, 0.25, 0.15, 0.15, 0.15,
					0.5, 1.2,
					true, $1
				) RETURNING id`,
				[hostId]
			);
			ruleVersionId = insertedRule[0].id;
		}

		// 3. Scenario 1: GREEN Risk Route (Allowed)
		const greenRouteName = "Cung Đường An Toàn (Mức Xanh)";
		const existingGreenRoute: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1 AND "name" = $2',
			[hostId, greenRouteName]
		);

		let greenRouteId = "";
		if (existingGreenRoute.length > 0) {
			greenRouteId = existingGreenRoute[0].id;
		} else {
			const res: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
				 VALUES ($1, $2, 'Tuyến trekking thời tiết đẹp, đủ điều kiện an toàn đăng ký', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.47 11.95)'), 2000, 'easy', 120, 'active')
				 RETURNING id`,
				[hostId, greenRouteName]
			);
			greenRouteId = res[0].id;
		}

		// Insert Snapshot & Assessment for Green
		const greenSnapshot: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "weather_snapshots" (route_id, status, observed_at, rainfall_mm, wind_kph, temperature_c, visibility_m, thunderstorm)
			 VALUES ($1, 'success', NOW(), 0, 10, 24, 10000, false)
			 RETURNING id`,
			[greenRouteId]
		);
		await dataSource.query(
			`INSERT INTO "weather_risk_assessments" (route_id, snapshot_id, rule_version_id, risk_level, composite_score, criteria_scores, created_by)
			 VALUES ($1, $2, $3, 'green', 0.00, $4, $5)`,
			[
				greenRouteId,
				greenSnapshot[0].id,
				ruleVersionId,
				JSON.stringify({
					rainfall: { value: 0, level: "green", weight: 0.3, score: 0 },
					wind: { value: 10, level: "green", weight: 0.25, score: 0 },
					temperature: { value: 24, level: "green", weight: 0.15, score: 0 },
					visibility: { value: 10000, level: "green", weight: 0.15, score: 0 },
					thunderstorm: {
						value: false,
						level: "green",
						weight: 0.15,
						score: 0,
					},
				}),
				hostId,
			]
		);

		// 4. Scenario 2: RED Risk Route (Blocked)
		const redRouteName = "Cung Đường Bão Nguy Hiểm (Mức Đỏ)";
		const existingRedRoute: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1 AND "name" = $2',
			[hostId, redRouteName]
		);

		let redRouteId = "";
		if (existingRedRoute.length > 0) {
			redRouteId = existingRedRoute[0].id;
		} else {
			const res: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
				 VALUES ($1, $2, 'Tuyến đường rủi ro thời tiết MỨC ĐỎ - Tạm dừng nhận đăng ký mới', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.48 11.96)'), 3500, 'hard', 240, 'active')
				 RETURNING id`,
				[hostId, redRouteName]
			);
			redRouteId = res[0].id;
		}

		// Insert Snapshot & Assessment for Red
		const redSnapshot: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "weather_snapshots" (route_id, status, observed_at, rainfall_mm, wind_kph, temperature_c, visibility_m, thunderstorm)
			 VALUES ($1, 'success', NOW(), 85.5, 75.0, 4.0, 500, true)
			 RETURNING id`,
			[redRouteId]
		);
		await dataSource.query(
			`INSERT INTO "weather_risk_assessments" (route_id, snapshot_id, rule_version_id, risk_level, composite_score, criteria_scores, created_by)
			 VALUES ($1, $2, $3, 'red', 1.50, $4, $5)`,
			[
				redRouteId,
				redSnapshot[0].id,
				ruleVersionId,
				JSON.stringify({
					rainfall: { value: 85.5, level: "red", weight: 0.3, score: 2 },
					wind: { value: 75.0, level: "red", weight: 0.25, score: 2 },
					temperature: { value: 4.0, level: "red", weight: 0.15, score: 2 },
					visibility: { value: 500, level: "red", weight: 0.15, score: 2 },
					thunderstorm: { value: true, level: "red", weight: 0.15, score: 2 },
				}),
				hostId,
			]
		);

		// Seed Weather Advice (LLM advice text & actionable recommendations)
		await seedWeatherAdvice(hostId);

		console.log("\n========================================================");
		console.log(" [seed:weather-scenarios] SUCCESS!");
		console.log(" - Host Login: host@ctms.local / Host@123");
		console.log(` - Scenario 1 (Green / Allowed Route ID): ${greenRouteId}`);
		console.log(` - Scenario 2 (Red / Blocked Route ID): ${redRouteId}`);
		console.log("========================================================\n");
	} catch (error) {
		console.error("[seed:weather-scenarios] Error seeding data:", error);
		throw error;
	}
}

// --------------------------------------------------------------------------
// Helper: Seed Weather Advice for Assessments (weather_advice table)
// --------------------------------------------------------------------------
async function seedWeatherAdvice(hostId: string): Promise<void> {
	console.log("[seed:weather-scenarios] Seeding weather advice for assessments...");
	const assessments: Array<{ id: string; risk_level: string }> = await dataSource.query(`
		SELECT "id", "risk_level" FROM "weather_risk_assessments" ORDER BY "created_at" DESC
	`);

	for (const a of assessments) {
		const isRed = a.risk_level === "red";
		const adviceText = isRed
			? "CẢNH BÁO NGUY HIỂM: Tuyến đường chịu ảnh hưởng áp thấp nhiệt đới gây mưa dông lớn và gió giật mạnh cấp 8. Tầm nhìn giảm dưới 500m, nguy cơ sạt lở đất và lũ quét rất cao. Đề nghị tạm hoãn mọi hoạt động xuất phát."
			: "Thời tiết rất thuận lợi cho hoạt động dã ngoại và trekking. Trời quang đãng, khô ráo, gió nhẹ 10 km/h và tầm nhìn xa trên 10km. Đủ điều kiện an toàn tuyệt đối để khởi hành.";
		const actions = isRed
			? [
					"Tạm ngưng tiếp nhận khách đăng ký mới",
					"Thông báo các đoàn trên tuyến di chuyển về trạm trú ẩn khẩn cấp",
					"Kích hoạt phương án cứu hộ dự phòng",
				]
			: [
					"Khởi hành đúng theo lịch trình quy định",
					"Bổ sung tối thiểu 1.5L nước cho mỗi thành viên",
					"Tuân thủ nghiêm ngặt lộ trình của Porter trưởng",
				];

		await dataSource.query(
			`INSERT INTO "weather_advice" (assessment_id, advice_text, actions, created_by)
			 VALUES ($1, $2, $3::jsonb, $4)
			 ON CONFLICT (assessment_id) DO UPDATE SET
				advice_text = EXCLUDED.advice_text,
				actions = EXCLUDED.actions`,
			[a.id, adviceText, JSON.stringify(actions), hostId]
		);
	}
}

// ==========================================================================
// [5/6] CAMPER REFUND & DISPUTE SCENARIOS
// ==========================================================================
export async function seedCamperRefunds(): Promise<{
	preTripBookingId: string;
	completedBookingId: string;
	alreadyRefundedBookingId: string;
}> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:camper-refunds] Database initialized.");

	// 1. Get camper@ctms.local user
	const camperRows = (await dataSource.query('SELECT "id" FROM "users" WHERE "email" = $1', [
		"camper@ctms.local",
	])) as Array<{ id: string }>;
	if (camperRows.length === 0) {
		throw new Error("User camper@ctms.local not found. Please ensure accounts are seeded.");
	}
	const camperId = camperRows[0].id;

	// 2. Get host and route
	const tripRows = (await dataSource.query(
		`SELECT t.id, t.title, t.route_id, t.host_id, t.price_per_person
		 FROM trips t
		 WHERE t.status = 'published'
		 LIMIT 3`
	)) as Array<{
		id: string;
		title: string;
		route_id: string;
		host_id: string;
		price_per_person: string;
	}>;

	if (tripRows.length === 0) {
		throw new Error("No published trips found. Run seed:dev-trips first.");
	}

	const trip1 = tripRows[0];
	const trip2Source = tripRows[1] ?? tripRows[0];
	const trip3 = tripRows[2] ?? tripRows[0];

	// Create a completed trip for Scenario 2 (ended 3 hours ago)
	const meetingPoint = { type: "Point", coordinates: [108.2022, 16.0544] };
	const completedTripRows = (await dataSource.query(
		`INSERT INTO "trips" (
			"id", "host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, $3, 'Trekking Sơn Trà Hoàn Thành - Demo Khiếu Nại', 'Chuyến đi vừa hoàn thành cách đây 3 giờ', 'day_trip', 0,
			now() - interval '10 hours', now() - interval '3 hours',
			ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography, now() - interval '1 day',
			1, 10, '850000.00', 'completed',
			$5::jsonb
		 ) ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "status" = 'completed' RETURNING "id"`,
		[
			DEMO_SYNC_TRIP_ID,
			trip2Source.host_id,
			trip2Source.route_id,
			JSON.stringify(meetingPoint),
			JSON.stringify(DEFAULT_CANCELLATION_POLICY),
		]
	)) as Array<{ id: string }>;
	const completedTripId = completedTripRows[0].id;

	// Add waypoints for the completed trip
	await dataSource.query(
		`INSERT INTO "trip_waypoints" ("trip_id", "type", "name", "location", "day_number", "sequence_order")
		 VALUES
		 ($1, 'start', 'Điểm xuất phát', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 1),
		 ($1, 'finish', 'Điểm về đích', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 2)`,
		[completedTripId, JSON.stringify(meetingPoint)]
	);

	// SCENARIO 1: Pre-trip cancelled booking with paid charge (Eligible for pre-trip refund)
	const b1Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancelled_at", "cancellation_reason", "cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'cancelled', 'paid', "starts_at", "ends_at", $3, $3,
		        now() - interval '2 hours', 'Bận việc gia đình đột xuất', "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip1.id, camperId, trip1.price_per_person || "650000.00"]
	)) as Array<{ id: string }>;
	const b1Id = b1Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b1Id, camperId]
	);

	const p1Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', $2, $3, 'fp-b1', 'PAYOS-DEMO-001'
		 ) RETURNING "id"`,
		[b1Id, trip1.price_per_person || "650000.00", `demo-pay-${b1Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p1Rows[0].id]
	);

	// SCENARIO 2: Post-completion completed participation (Eligible for complaint refund within 24h)
	const b2Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '850000.00', '850000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[completedTripId, camperId]
	)) as Array<{ id: string }>;
	const b2Id = b2Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status", "checked_in_at")
		 VALUES ($1, $2, true, 'joined', now() - interval '9 hours')`,
		[b2Id, camperId]
	);

	const p2Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '850000.00', $2, 'fp-b2', 'PAYOS-DEMO-002'
		 ) RETURNING "id"`,
		[b2Id, `demo-pay-${b2Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p2Rows[0].id]
	);

	// SCENARIO 3: Already refunded booking (Fully processed refund)
	const b3Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancelled_at", "cancellation_reason", "cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'cancelled', 'paid', "starts_at", "ends_at", '500000.00', '500000.00',
		        now() - interval '1 day', 'Hủy do thay đổi lịch trình', "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip3.id, camperId]
	)) as Array<{ id: string }>;
	const b3Id = b3Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b3Id, camperId]
	);

	const p3Charge = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '500000.00', $2, 'fp-b3-charge', 'PAYOS-DEMO-003'
		 ) RETURNING "id"`,
		[b3Id, `demo-pay-${b3Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p3Charge[0].id]
	);

	// Refund payment referencing the charge
	const p3Refund = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "parent_payment_id", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'refund', 'succeeded', '500000.00', $2, $3, 'fp-b3-refund', 'PAYOS-REF-500000'
		 ) RETURNING "id"`,
		[b3Id, p3Charge[0].id, `demo-refund-${b3Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status", "transaction_ref") VALUES ($1, 'succeeded', 'PAYOS-REF-500000')`,
		[p3Refund[0].id]
	);

	console.log(
		`[seed:camper-refunds] Scenario 1 (Pre-Trip Cancelled): http://localhost:5173/bookings/${b1Id}`
	);
	console.log(
		`[seed:camper-refunds] Scenario 2 (Post-Completion Complaint): http://localhost:5173/bookings/${b2Id}`
	);
	console.log(
		`[seed:camper-refunds] Scenario 3 (Already Refunded): http://localhost:5173/bookings/${b3Id}`
	);

	return {
		preTripBookingId: b1Id,
		completedBookingId: b2Id,
		alreadyRefundedBookingId: b3Id,
	};
}

// ==========================================================================
// [6/6] SETTLEMENTS, HOST WALLETS & PAYOUT REQUESTS
// ==========================================================================
interface SeedSettlementUser {
	email: string;
	phone: string;
	fullName: string;
	role: "admin" | "host" | "camper";
	password: string;
	dateOfBirth?: string;
	address?: string;
	gender?: "male" | "female" | "other";
}

const SEED_SETTLEMENT_USERS: SeedSettlementUser[] = [
	{
		email: "admin@ctms.local",
		phone: "0900000000",
		fullName: "Administrator",
		role: "admin",
		password: "Admin@123",
	},
	{
		email: "host@ctms.local",
		phone: "0900000002",
		fullName: "Host Ban Mai",
		role: "host",
		password: "Host@123",
	},
	{
		email: "camper@ctms.local",
		phone: "0900000003",
		fullName: "Nguyễn Văn An",
		role: "camper",
		password: "Camper@123",
		dateOfBirth: "1998-10-20",
		gender: "male",
		address: "Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
	},
];

const SEED_TRIP_TITLES = [
	"Trekking Bạch Mã 2N1Đ - Đủ điều kiện Quyết toán",
	"Chèo SUP Hồ Hòa Trung - Đang giữ 72h",
	"Khám phá Đỉnh Bàn Cờ - Bị giữ do Khiếu nại",
	"Cắm trại Đảo Điệp Sơn - Đã quyết toán thành công",
];

async function ensureSettlementUser(user: SeedSettlementUser): Promise<string> {
	const existing = (await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
		[user.email, user.phone]
	)) as Array<{ id: string }>;

	let userId = "";
	if (existing.length > 0) {
		userId = existing[0].id;
		const passwordHash = await hash(user.password, BCRYPT_COST_FACTOR);
		await dataSource.query(
			`UPDATE "users" 
			 SET "password_hash" = $1, 
			     "status" = 'active', 
			     "full_name" = $2,
			     "date_of_birth" = COALESCE($4, "date_of_birth"),
			     "address" = COALESCE($5, "address"),
			     "gender" = COALESCE($6, "gender")
			 WHERE "id" = $3`,
			[
				passwordHash,
				user.fullName,
				userId,
				user.dateOfBirth ?? null,
				user.address ?? null,
				user.gender ?? null,
			]
		);
	} else {
		const passwordHash = await hash(user.password, BCRYPT_COST_FACTOR);
		const inserted = (await dataSource.query(
			`INSERT INTO "users" ("email", "phone", "password_hash", "role", "status", "full_name", "date_of_birth", "address", "gender")
			 VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8)
			 RETURNING "id"`,
			[
				user.email,
				user.phone,
				passwordHash,
				user.role,
				user.fullName,
				user.dateOfBirth ?? null,
				user.address ?? null,
				user.gender ?? null,
			]
		)) as Array<{ id: string }>;
		userId = inserted[0].id;
	}

	await dataSource.query(
		`INSERT INTO "user_roles" ("user_id", "role")
		 VALUES ($1, $2)
		 ON CONFLICT ("user_id", "role") DO NOTHING`,
		[userId, user.role]
	);

	return userId;
}

export async function seedSettlementsAndPayouts(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:settlements] Database connected successfully.");

	// 1. Ensure required user accounts exist
	const userMap: Record<string, string> = {};
	for (const u of SEED_SETTLEMENT_USERS) {
		userMap[u.email] = await ensureSettlementUser(u);
	}
	const hostId = userMap["host@ctms.local"];
	const camperId = userMap["camper@ctms.local"];

	// 2. Ensure trekking route exists for host
	let routeRows = (await dataSource.query(
		'SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1 LIMIT 1',
		[hostId]
	)) as Array<{ id: string }>;

	if (routeRows.length === 0) {
		routeRows = (await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"host_id", "name", "description", "route_geom", "length_meters",
				"difficulty", "expected_duration_minutes", "status"
			 ) VALUES (
				$1, 'Cung đường Trekking Demo', 'Tuyến đường mẫu cho kịch bản quyết toán',
				ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.47 11.95)'), 3000,
				'moderate', 240, 'active'
			 ) RETURNING "id"`,
			[hostId]
		)) as Array<{ id: string }>;
	}
	const routeId = routeRows[0].id;

	// 3. Clean up previously seeded trips & associated records for idempotency
	const oldTrips = (await dataSource.query('SELECT "id" FROM "trips" WHERE "title" = ANY($1)', [
		SEED_TRIP_TITLES,
	])) as Array<{ id: string }>;

	if (oldTrips.length > 0) {
		const oldTripIds = oldTrips.map((t) => t.id);

		// Delete content reports
		await dataSource.query('DELETE FROM "content_reports" WHERE "target_id" = ANY($1)', [
			oldTripIds,
		]);

		// Delete wallet transactions linked to old settlements/trips
		await dataSource.query('DELETE FROM "wallet_transactions" WHERE "trip_id" = ANY($1)', [
			oldTripIds,
		]);

		// Delete settlements
		await dataSource.query('DELETE FROM "settlements" WHERE "trip_id" = ANY($1)', [oldTripIds]);

		// Delete payments & payment_transactions
		const oldBookings = (await dataSource.query(
			'SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1)',
			[oldTripIds]
		)) as Array<{ id: string }>;

		if (oldBookings.length > 0) {
			const oldBookingIds = oldBookings.map((b) => b.id);
			const oldPayments = (await dataSource.query(
				'SELECT "id" FROM "payments" WHERE "booking_id" = ANY($1)',
				[oldBookingIds]
			)) as Array<{ id: string }>;

			if (oldPayments.length > 0) {
				const oldPaymentIds = oldPayments.map((p) => p.id);
				await dataSource.query('DELETE FROM "payment_transactions" WHERE "payment_id" = ANY($1)', [
					oldPaymentIds,
				]);
				await dataSource.query('DELETE FROM "payments" WHERE "id" = ANY($1)', [oldPaymentIds]);
			}

			await dataSource.query('DELETE FROM "booking_members" WHERE "booking_id" = ANY($1)', [
				oldBookingIds,
			]);
			await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [oldBookingIds]);
		}

		await dataSource.query('DELETE FROM "trip_waypoints" WHERE "trip_id" = ANY($1)', [oldTripIds]);
		await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [oldTripIds]);
	}

	// Clean up previous demo payout & its wallet transaction
	const oldDemoPayouts = (await dataSource.query(
		'SELECT "id" FROM "payouts" WHERE "transaction_ref" = $1',
		["PAYOUT-DEMO-001"]
	)) as Array<{ id: string }>;
	if (oldDemoPayouts.length > 0) {
		const oldPayoutIds = oldDemoPayouts.map((p) => p.id);
		await dataSource.query('DELETE FROM "wallet_transactions" WHERE "payout_id" = ANY($1)', [
			oldPayoutIds,
		]);
		await dataSource.query('DELETE FROM "payouts" WHERE "id" = ANY($1)', [oldPayoutIds]);
	}

	const meetingPoint = { type: "Point", coordinates: [108.2022, 16.0544] };

	// Helper to insert trip waypoints
	const insertWaypoints = async (tripId: string) => {
		await dataSource.query(
			`INSERT INTO "trip_waypoints" ("trip_id", "type", "name", "location", "day_number", "sequence_order")
			 VALUES
			 ($1, 'start', 'Điểm xuất phát', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 1),
			 ($1, 'finish', 'Điểm về đích', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 2)`,
			[tripId, JSON.stringify(meetingPoint)]
		);
	};

	// -----------------------------------------------------------------------------------------
	// SCENARIO 1: Eligible for Settlement (> 72h completed, 0 claims/disputes)
	// Ended 80h ago. Revenue: 1.500.000 VNĐ. Expected Fee: 75.000 VNĐ, Net: 1.425.000 VNĐ
	// -----------------------------------------------------------------------------------------
	const trip1Rows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Trekking Bạch Mã 2N1Đ - Đủ điều kiện Quyết toán',
			'Chuyến đi đã kết thúc cách đây 80 giờ, vượt qua mốc bảo lưu 72h và sẵn sàng quyết toán.',
			'day_trip', 0,
			now() - interval '86 hours', now() - interval '80 hours',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '4 days',
			1, 15, '1500000.00', 'completed',
			$4::jsonb
		 ) RETURNING "id"`,
		[hostId, routeId, JSON.stringify(meetingPoint), JSON.stringify(DEFAULT_CANCELLATION_POLICY)]
	)) as Array<{ id: string }>;
	const trip1Id = trip1Rows[0].id;
	await insertWaypoints(trip1Id);

	const b1Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '1500000.00', '1500000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip1Id, camperId]
	)) as Array<{ id: string }>;
	const b1Id = b1Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b1Id, camperId]
	);

	const p1Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '1500000.00', 'seed-settle-b1-charge', 'fp-settle-1', 'PAYOS-SETTLE-001'
		 ) RETURNING "id"`,
		[b1Id]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p1Rows[0].id]
	);

	// -----------------------------------------------------------------------------------------
	// SCENARIO 2: Held under 72h Lock (< 72h completed)
	// Ended 20h ago. Revenue: 850.000 VNĐ. Eligible: false (còn ~52h bảo lưu)
	// -----------------------------------------------------------------------------------------
	const trip2Rows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Chèo SUP Hồ Hòa Trung - Đang giữ 72h',
			'Chuyến đi vừa kết thúc 20 giờ trước, hệ thống đang giữ bảo lưu phòng khiếu nại (72h).',
			'day_trip', 0,
			now() - interval '26 hours', now() - interval '20 hours',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '2 days',
			1, 10, '850000.00', 'completed',
			$4::jsonb
		 ) RETURNING "id"`,
		[hostId, routeId, JSON.stringify(meetingPoint), JSON.stringify(DEFAULT_CANCELLATION_POLICY)]
	)) as Array<{ id: string }>;
	const trip2Id = trip2Rows[0].id;
	await insertWaypoints(trip2Id);

	const b2Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '850000.00', '850000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip2Id, camperId]
	)) as Array<{ id: string }>;
	const b2Id = b2Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b2Id, camperId]
	);

	const p2Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '850000.00', 'seed-settle-b2-charge', 'fp-settle-2', 'PAYOS-SETTLE-002'
		 ) RETURNING "id"`,
		[b2Id]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p2Rows[0].id]
	);

	// -----------------------------------------------------------------------------------------
	// SCENARIO 3: Blocked by Claim (> 72h completed, but has pending refund request & report)
	// Ended 90h ago. Revenue: 3.200.000 VNĐ. Eligible: false (Có khiếu nại đang xử lý)
	// -----------------------------------------------------------------------------------------
	const trip3Rows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Khám phá Đỉnh Bàn Cờ - Bị giữ do Khiếu nại',
			'Chuyến đi đã hoàn thành 90 giờ trước nhưng đang có yêu cầu khiếu nại hoàn tiền chưa xử lý.',
			'day_trip', 0,
			now() - interval '96 hours', now() - interval '90 hours',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '5 days',
			1, 10, '3200000.00', 'completed',
			$4::jsonb
		 ) RETURNING "id"`,
		[hostId, routeId, JSON.stringify(meetingPoint), JSON.stringify(DEFAULT_CANCELLATION_POLICY)]
	)) as Array<{ id: string }>;
	const trip3Id = trip3Rows[0].id;
	await insertWaypoints(trip3Id);

	const b3Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '3200000.00', '3200000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip3Id, camperId]
	)) as Array<{ id: string }>;
	const b3Id = b3Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b3Id, camperId]
	);

	const p3Charge = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '3200000.00', 'seed-settle-b3-charge', 'fp-settle-3-charge', 'PAYOS-SETTLE-003'
		 ) RETURNING "id"`,
		[b3Id]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p3Charge[0].id]
	);

	// Pending refund claim (PB AC-4 / BR-339 blocker)
	await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "parent_payment_id",
			"idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'refund', 'pending', '3200000.00', $2,
			'seed-settle-b3-refund', 'fp-settle-3-refund', 'PAYOS-SETTLE-REF-003'
		 )`,
		[b3Id, p3Charge[0].id]
	);

	// Content report claim on the trip
	await dataSource.query(
		`INSERT INTO "content_reports" (
			"reporter_id", "target_type", "target_id", "reason", "status"
		 ) VALUES (
			$1, 'trip', $2, 'Host không chuẩn bị đúng dụng cụ bảo hộ như đã cam kết', 'pending'
		 )`,
		[camperId, trip3Id]
	);

	// -----------------------------------------------------------------------------------------
	// SCENARIO 4: Already Settled Trip (Settled 4 days ago)
	// Base: 4.000.000 VNĐ, Fee (5%): 200.000 VNĐ, Net (95%): 3.800.000 VNĐ credited to Host Wallet
	// -----------------------------------------------------------------------------------------
	const trip4Rows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Cắm trại Đảo Điệp Sơn - Đã quyết toán thành công',
			'Chuyến đi đã được quyết toán tự động, phí 5% đã thu và 95% đã ghi có vào ví Host.',
			'day_trip', 0,
			now() - interval '6 days', now() - interval '5 days',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '7 days',
			1, 10, '4000000.00', 'completed',
			$4::jsonb
		 ) RETURNING "id"`,
		[hostId, routeId, JSON.stringify(meetingPoint), JSON.stringify(DEFAULT_CANCELLATION_POLICY)]
	)) as Array<{ id: string }>;
	const trip4Id = trip4Rows[0].id;
	await insertWaypoints(trip4Id);

	const b4Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '4000000.00', '4000000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip4Id, camperId]
	)) as Array<{ id: string }>;
	const b4Id = b4Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b4Id, camperId]
	);

	const p4Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '4000000.00', 'seed-settle-b4-charge', 'fp-settle-4', 'PAYOS-SETTLE-004'
		 ) RETURNING "id"`,
		[b4Id]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p4Rows[0].id]
	);

	// Create Settlement snapshot for Scenario 4
	const settlementRows = (await dataSource.query(
		`INSERT INTO "settlements" (
			"trip_id", "host_id", "settlement_base", "commission_rate", "platform_fee", "net_amount", "settled_at"
		 ) VALUES (
			$1, $2, '4000000.00', '0.0500', '200000.00', '3800000.00', now() - interval '4 days'
		 ) RETURNING "id"`,
		[trip4Id, hostId]
	)) as Array<{ id: string }>;
	const settlement4Id = settlementRows[0].id;

	// -----------------------------------------------------------------------------------------
	// SCENARIO 5: Host Wallet & Payout Requests for UI testing
	// Host 1: Has 3.800.000 VNĐ balance, 0 pending payouts -> Can test "Rút toàn bộ số dư"
	// Host 2: Has 1 pending payout (1.200.000 VNĐ) -> Admin can test Confirm / Reject
	// -----------------------------------------------------------------------------------------

	// Upsert Host 1 Wallet with 3.800.000 VNĐ
	const wallet1Rows = (await dataSource.query(
		`INSERT INTO "host_wallets" ("host_id", "balance")
		 VALUES ($1, '3800000.00')
		 ON CONFLICT ("host_id") DO UPDATE SET "balance" = '3800000.00', "updated_at" = now()
		 RETURNING "id"`,
		[hostId]
	)) as Array<{ id: string }>;
	const wallet1Id = wallet1Rows[0].id;

	// Clean up old transactions and payouts for this wallet
	await dataSource.query('DELETE FROM "wallet_transactions" WHERE "wallet_id" = $1', [wallet1Id]);
	await dataSource.query('DELETE FROM "payouts" WHERE "wallet_id" = $1', [wallet1Id]);

	// Insert credit ledger entry 1: Settled trip revenue
	await dataSource.query(
		`INSERT INTO "wallet_transactions" (
			"wallet_id", "settlement_id", "trip_id", "type",
			"base_amount", "fee_amount", "net_amount", "balance_after",
			"description", "created_at"
		 ) VALUES (
			$1, $2, $3, 'settlement_credit',
			'4000000.00', '200000.00', '3800000.00', '3800000.00',
			'Quyết toán doanh thu chuyến: Cắm trại Đảo Điệp Sơn - Đã quyết toán thành công',
			now() - interval '4 days'
		 )`,
		[wallet1Id, settlement4Id, trip4Id]
	);

	// Insert credit ledger entry 2: Previous tour revenue
	await dataSource.query(
		`INSERT INTO "wallet_transactions" (
			"wallet_id", "type", "base_amount", "fee_amount", "net_amount",
			"balance_after", "description", "created_at"
		 ) VALUES (
			$1, 'settlement_credit', '1263158.00', '63158.00', '1200000.00',
			'5000000.00', 'Quyết toán doanh thu chuyến dã ngoại Sơn Trà', now() - interval '1 day'
		 )`,
		[wallet1Id]
	);

	// Host pending payout request for Admin testing
	const payoutRows = (await dataSource.query(
		`INSERT INTO "payouts" (
			"host_id", "wallet_id", "amount", "status", "bank_name",
			"account_number", "account_holder_name", "transaction_ref",
			"admin_notes", "created_at"
		 ) VALUES (
			$1, $2, '1200000.00', 'pending', 'Vietcombank',
			'0123456789', 'HOST BAN MAI', 'PAYOUT-DEMO-001',
			'Host yêu cầu rút một phần số dư về tài khoản', now() - interval '6 hours'
		 ) RETURNING "id"`,
		[hostId, wallet1Id]
	)) as Array<{ id: string }>;
	const payoutId = payoutRows[0].id;

	// Host payout debit transaction
	await dataSource.query(
		`INSERT INTO "wallet_transactions" (
			"wallet_id", "payout_id", "type", "base_amount", "fee_amount",
			"net_amount", "balance_after", "description", "created_at"
		 ) VALUES (
			$1, $2, 'payout_debit', '1200000.00', '0.00', '-1200000.00',
			'3800000.00', 'Yêu cầu rút tiền về Vietcombank (0123456789)', now() - interval '6 hours'
		 )`,
		[wallet1Id, payoutId]
	);

	// Ensure wallet balance accurately reflects the remaining balance
	await dataSource.query(
		'UPDATE "host_wallets" SET "balance" = \'3800000.00\', "updated_at" = now() WHERE "id" = $1',
		[wallet1Id]
	);

	console.log("\n==========================================================================");
	console.log("            SEED DATA FOR SETTLEMENTS & PAYOUTS READY!                    ");
	console.log("==========================================================================");
	console.log("👉 [1] Chuyến Đủ Điều Kiện Quyết Toán (Admin test Settle):");
	console.log(`       http://localhost:5173/admin/settlements (Trip ID: ${trip1Id})`);
	console.log("👉 [2] Chuyến Đang Giữ 72h (Admin test 72h hold lock):");
	console.log(`       http://localhost:5173/admin/settlements (Trip ID: ${trip2Id})`);
	console.log("👉 [3] Chuyến Bị Giữ Do Khiếu Nại (Admin test Dispute lock):");
	console.log(`       http://localhost:5173/admin/settlements (Trip ID: ${trip3Id})`);
	console.log("👉 [4] Chuyến Đã Quyết Toán (Host Card view & Snapshot):");
	console.log(`       http://localhost:5173/trips/${trip4Id}`);
	console.log("👉 [5] Ví Host & Rút Toàn Bộ Số Dư (Host login: host@ctms.local / Host@123):");
	console.log("       http://localhost:5173/host/wallet (Số dư khả dụng: 3.800.000 VNĐ)");
	console.log("👉 [6] Yêu Cầu Rút Tiền Đang Chờ Duyệt (Admin confirm/reject test):");
	console.log(`       http://localhost:5173/admin/settlements (Payout ID: ${payoutId})`);
	console.log("==========================================================================\n");
}

// ==========================================================================
// [7/7] USER BANK ACCOUNTS
// ==========================================================================
export async function seedUserBankAccounts(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:bank-accounts] Seeding user bank accounts for camper and host...");

	// 1. Host Bank Accounts (host@ctms.local)
	const hostRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["host@ctms.local"]
	);
	if (hostRows.length > 0) {
		const hostId = hostRows[0].id;
		await dataSource.query(
			'UPDATE "user_bank_accounts" SET "is_default" = false WHERE "user_id" = $1',
			[hostId]
		);
		await dataSource.query(
			`INSERT INTO "user_bank_accounts" ("user_id", "bank_name", "account_number", "account_holder_name", "is_default")
			 VALUES 
				($1, 'Vietcombank', '0123456789', 'HOST BAN MAI', true),
				($1, 'MB Bank (Ngân hàng Quân đội)', '9876543210', 'HOST BAN MAI', false)
			 ON CONFLICT ("user_id", "bank_name", "account_number") 
			 DO UPDATE SET 
				"account_holder_name" = EXCLUDED."account_holder_name",
				"is_default" = EXCLUDED."is_default",
				"updated_at" = now()`,
			[hostId]
		);
		console.log("[seed:bank-accounts] ✅ Seeded bank accounts for Host (host@ctms.local).");
	}

	// 2. Camper Bank Accounts (camper@ctms.local)
	const camperRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	if (camperRows.length > 0) {
		const camperId = camperRows[0].id;
		await dataSource.query(
			'DELETE FROM "user_bank_accounts" WHERE "user_id" = $1 AND "account_number" = \'3243234\'',
			[camperId]
		);
		await dataSource.query(
			'UPDATE "user_bank_accounts" SET "is_default" = false WHERE "user_id" = $1',
			[camperId]
		);
		await dataSource.query(
			`INSERT INTO "user_bank_accounts" ("user_id", "bank_name", "account_number", "account_holder_name", "is_default")
			 VALUES 
				($1, 'Vietcombank', '1012345678', 'NGUYEN VAN AN', true),
				($1, 'Techcombank', '19034567890123', 'NGUYEN VAN AN', false)
			 ON CONFLICT ("user_id", "bank_name", "account_number") 
			 DO UPDATE SET 
				"account_holder_name" = EXCLUDED."account_holder_name",
				"is_default" = EXCLUDED."is_default",
				"updated_at" = now()`,
			[camperId]
		);
		console.log("[seed:bank-accounts] ✅ Seeded bank accounts for Camper (camper@ctms.local).");
	}
}

// ==========================================================================
// [8/8] OFFLINE DEVICE TELEMETRY & SYNC SCENARIOS (CTMS-067)
// ==========================================================================
export async function seedDeviceSyncTelemetry(ds = dataSource): Promise<void> {
	if (!ds.isInitialized) {
		await ds.initialize();
	}
	console.log("[seed:device-sync] Seeding CTMS-067 offline GPS logs & safety incidents...");

	// 1. Get Camper and Porter accounts
	const [camperRows, porterRows] = await Promise.all([
		ds.query('SELECT "id" FROM "users" WHERE "email" = $1', ["camper@ctms.local"]) as Promise<
			Array<{ id: string }>
		>,
		ds.query('SELECT "id" FROM "users" WHERE "email" = $1', ["porter@ctms.local"]) as Promise<
			Array<{ id: string }>
		>,
	]);

	if (camperRows.length === 0 || porterRows.length === 0) {
		console.warn(
			"[seed:device-sync] Camper or Porter account not found. Skipping device sync telemetry."
		);
		return;
	}

	const camperId = camperRows[0].id;
	const porterId = porterRows[0].id;

	// 2. Resolve Host and Route to attach demo trips
	const referenceTrips = (await ds.query(
		'SELECT "host_id", "route_id" FROM "trips" LIMIT 1'
	)) as Array<{ host_id: string; route_id: string }>;

	if (referenceTrips.length === 0) {
		console.warn("[seed:device-sync] No trips found to attach device sync.");
		return;
	}
	const defaultHostId = referenceTrips[0].host_id;
	const defaultRouteId = referenceTrips[0].route_id;

	// 3. Ensure Completed Trip exists with ID DEMO_SYNC_TRIP_ID
	const tripRows = (await ds.query(
		'SELECT "id", "host_id", "route_id" FROM "trips" WHERE "id" = $1',
		[DEMO_SYNC_TRIP_ID]
	)) as Array<{ id: string; host_id: string; route_id: string }>;

	if (tripRows.length === 0) {
		const meetingPoint = { type: "Point", coordinates: [108.2022, 16.0544] };
		await ds.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "description", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline",
				"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
			 ) VALUES (
				$1, $2, $3, 'Trekking Sơn Trà Hoàn Thành - Demo Khiếu Nại', 'Chuyến đi phục vụ đồng bộ GPS & an toàn ngoại tuyến', 'day_trip', 0,
				now() - interval '10 hours', now() - interval '3 hours',
				ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography, now() - interval '1 day',
				1, 10, '850000.00', 'completed',
				$5::jsonb
			 ) ON CONFLICT ("id") DO NOTHING`,
			[
				DEMO_SYNC_TRIP_ID,
				defaultHostId,
				defaultRouteId,
				JSON.stringify(meetingPoint),
				JSON.stringify(DEFAULT_CANCELLATION_POLICY),
			]
		);
	}

	// 3. Ensure Porter is assigned to this trip in trip_porters
	await ds.query(
		`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status")
		 VALUES ($1, $2, 'assigned')
		 ON CONFLICT ("trip_id", "porter_id") DO UPDATE SET "status" = 'assigned'`,
		[DEMO_SYNC_TRIP_ID, porterId]
	);

	// 4. Ensure Camper is a joined member on this trip
	const bookingRows = (await ds.query(
		'SELECT "id" FROM "bookings" WHERE "trip_id" = $1 AND "user_id" = $2 LIMIT 1',
		[DEMO_SYNC_TRIP_ID, camperId]
	)) as Array<{ id: string }>;

	let bookingId = bookingRows[0]?.id;
	if (!bookingId) {
		const newBooking = (await ds.query(
			`INSERT INTO "bookings" (
				"trip_id", "user_id", "num_people", "status", "payment_status",
				"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
				"cancellation_policy_snapshot"
			 )
			 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '850000.00', '850000.00',
			        "cancellation_policy"
			 FROM "trips" WHERE "id" = $1
			 RETURNING "id"`,
			[DEMO_SYNC_TRIP_ID, camperId]
		)) as Array<{ id: string }>;
		bookingId = newBooking[0].id;
	}

	await ds.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status", "checked_in_at")
		 VALUES ($1, $2, true, 'joined', now() - interval '9 hours')
		 ON CONFLICT DO NOTHING`,
		[bookingId, camperId]
	);

	// 5. Seed 15 GPS Logs for Camper and 15 GPS Logs for Porter (BR-226, CTMS-067)
	await ds.query('DELETE FROM "gps_logs" WHERE "trip_id" = $1', [DEMO_SYNC_TRIP_ID]);

	// Insert Camper GPS Logs
	await ds.query(
		`INSERT INTO "gps_logs" (
			"id", "trip_id", "user_id", "participant_role", "event_time", 
			"location", "accuracy_meters", "altitude_meters", "battery_level", 
			"package_version", "config_version", "received_at"
		 )
		 SELECT 
			gen_random_uuid(),
			$1,
			$2,
			'camper',
			now() - (15 - s.i) * interval '1 minute',
			ST_SetSRID(ST_MakePoint(108.43 + s.i * 0.001, 11.53 + s.i * 0.001), 4326)::geography,
			5.0,
			800.0 + s.i * 25.0,
			85 - s.i,
			'pkg-v2',
			'v3',
			now() - (15 - s.i) * interval '1 minute'
		 FROM generate_series(1, 15) AS s(i);`,
		[DEMO_SYNC_TRIP_ID, camperId]
	);

	// Insert Porter GPS Logs
	await ds.query(
		`INSERT INTO "gps_logs" (
			"id", "trip_id", "user_id", "participant_role", "event_time", 
			"location", "accuracy_meters", "altitude_meters", "battery_level", 
			"package_version", "config_version", "received_at"
		 )
		 SELECT 
			gen_random_uuid(),
			$1,
			$2,
			'porter',
			now() - (15 - s.i) * interval '1 minute',
			ST_SetSRID(ST_MakePoint(108.43 + s.i * 0.001, 11.53 + s.i * 0.001), 4326)::geography,
			4.5,
			800.0 + s.i * 25.0,
			90 - s.i,
			'pkg-v2',
			'v3',
			now() - (15 - s.i) * interval '1 minute'
		 FROM generate_series(1, 15) AS s(i);`,
		[DEMO_SYNC_TRIP_ID, porterId]
	);

	// 6. Seed Safety Incident (CTMS-067)
	await ds.query('DELETE FROM "trip_incidents" WHERE "trip_id" = $1', [DEMO_SYNC_TRIP_ID]);
	await ds.query(
		`INSERT INTO "trip_incidents" (
			"id", "trip_id", "reporter_id", "category", "severity", "status", "description",
			"occurred_at", "location_status", "captured_offline", "received_at"
		 ) VALUES (
			gen_random_uuid(),
			$1,
			$2,
			'injury',
			'low',
			'open',
			'Trượt chân nhẹ gần suối, đã xử lý băng bó tại chỗ',
			now() - interval '30 minutes',
			'unavailable',
			false,
			now() - interval '30 minutes'
		 );`,
		[DEMO_SYNC_TRIP_ID, camperId]
	);

	console.log(
		`[seed:device-sync] ✅ Seeded 15 GPS logs & 1 safety incident for trip: ${DEMO_SYNC_TRIP_ID}`
	);

	// 7. Seed CTMS-064 Ongoing Trip for live offline buffering & safety events
	const meetingPointOngoing = { type: "Point", coordinates: [108.26, 16.11] };
	await ds.query(
		`INSERT INTO "trips" (
			"id", "host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, $3, 'Trekking Sơn Trà - Đang Diễn Ra (CTMS-064 Offline Buffer Demo)',
			'Chuyến đi đang diễn ra phục vụ kiểm thử Offline Buffer GPS & Cảnh báo an toàn ngoại tuyến', 'day_trip', 0,
			now() - interval '2 hours', now() + interval '7 days',
			ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography, now() - interval '1 day',
			1, 10, '850000.00', 'ongoing',
			$5::jsonb
		 ) ON CONFLICT ("id") DO UPDATE SET
			"status" = 'ongoing',
			"starts_at" = now() - interval '2 hours',
			"ends_at" = now() + interval '7 days'`,
		[
			DEMO_OFFLINE_BUFFER_TRIP_ID,
			defaultHostId,
			defaultRouteId,
			JSON.stringify(meetingPointOngoing),
			JSON.stringify(DEFAULT_CANCELLATION_POLICY),
		]
	);

	// Ensure Porter is assigned to ongoing trip
	await ds.query(
		`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status")
		 VALUES ($1, $2, 'assigned')
		 ON CONFLICT ("trip_id", "porter_id") DO UPDATE SET "status" = 'assigned'`,
		[DEMO_OFFLINE_BUFFER_TRIP_ID, porterId]
	);

	// Ensure Camper booking exists and is joined
	const ongoingBookingRows = (await ds.query(
		'SELECT "id" FROM "bookings" WHERE "trip_id" = $1 AND "user_id" = $2 LIMIT 1',
		[DEMO_OFFLINE_BUFFER_TRIP_ID, camperId]
	)) as Array<{ id: string }>;

	let ongoingBookingId = ongoingBookingRows[0]?.id;
	if (!ongoingBookingId) {
		const newOngoingBooking = (await ds.query(
			`INSERT INTO "bookings" (
				"trip_id", "user_id", "num_people", "status", "payment_status",
				"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
				"cancellation_policy_snapshot"
			 )
			 SELECT "id", $2, 1, 'confirmed', 'paid', "starts_at", "ends_at", '850000.00', '850000.00',
			        "cancellation_policy"
			 FROM "trips" WHERE "id" = $1
			 RETURNING "id"`,
			[DEMO_OFFLINE_BUFFER_TRIP_ID, camperId]
		)) as Array<{ id: string }>;
		ongoingBookingId = newOngoingBooking[0].id;
	}

	await ds.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status", "checked_in_at")
		 VALUES ($1, $2, true, 'joined', now() - interval '2 hours')
		 ON CONFLICT DO NOTHING`,
		[ongoingBookingId, camperId]
	);
	await ds.query(
		`UPDATE "booking_members"
		 SET "member_status" = 'joined', "checked_in_at" = now() - interval '2 hours'
		 WHERE "booking_id" = $1 AND "user_id" = $2`,
		[ongoingBookingId, camperId]
	);

	// Seed 5 initial server-confirmed GPS logs for camper
	await ds.query('DELETE FROM "gps_logs" WHERE "trip_id" = $1', [DEMO_OFFLINE_BUFFER_TRIP_ID]);
	await ds.query(
		`INSERT INTO "gps_logs" (
			"id", "trip_id", "user_id", "participant_role", "event_time", 
			"location", "accuracy_meters", "altitude_meters", "battery_level", 
			"package_version", "config_version", "received_at"
		 )
		 SELECT 
			gen_random_uuid(),
			$1,
			$2,
			'camper',
			now() - (5 - s.i) * interval '2 minutes',
			ST_SetSRID(ST_MakePoint(108.260 + s.i * 0.0005, 16.110 + s.i * 0.0005), 4326)::geography,
			5.0,
			150.0 + s.i * 10.0,
			95 - s.i,
			'pkg-v3',
			'v3',
			now() - (5 - s.i) * interval '2 minutes'
		 FROM generate_series(1, 5) AS s(i);`,
		[DEMO_OFFLINE_BUFFER_TRIP_ID, camperId]
	);

	console.log(
		`[seed:device-sync] ✅ Seeded CTMS-064 Ongoing trip for live offline buffer test: ${DEMO_OFFLINE_BUFFER_TRIP_ID}`
	);

	// 8. Seed CTMS-061 / CTMS-313 Automatic Checkpoint Arrival Context for Mobile testing
	await seedCheckpointArrivalContexts(ds);
}

export async function seedCheckpointArrivalContexts(ds: DataSource = dataSource): Promise<void> {
	const tripRows = await ds.query("SELECT route_id FROM trips WHERE id = $1", [
		DEMO_OFFLINE_BUFFER_TRIP_ID,
	]);
	const routeId = tripRows[0]?.route_id;
	if (!routeId) return;

	const checkpointRows: Array<{ id: string; latitude: number; longitude: number }> = await ds.query(
		`SELECT cp.id, ST_Y(cp.location::geometry) AS latitude, ST_X(cp.location::geometry) AS longitude
		 FROM checkpoints cp WHERE cp.route_id = $1`,
		[routeId]
	);

	if (checkpointRows.length > 0) {
		const routeVer = "v1";

		await ds.query(
			`INSERT INTO checkpoint_arrival_contexts (trip_id, route_id, route_version, package_id, package_version, checkpoints, context_source)
			 VALUES ($1, $2, $3, $4, 'v1-demo', $5::jsonb, 'demo')
			 ON CONFLICT (trip_id) DO UPDATE SET
				route_id = EXCLUDED.route_id,
				route_version = EXCLUDED.route_version,
				checkpoints = EXCLUDED.checkpoints,
				context_source = EXCLUDED.context_source`,
			[
				DEMO_OFFLINE_BUFFER_TRIP_ID,
				routeId,
				routeVer,
				DEMO_OFFLINE_BUFFER_TRIP_ID,
				JSON.stringify(checkpointRows),
			]
		);

		console.log(
			`[seed:checkpoint-arrivals] ✅ Seeded CTMS-061 Checkpoint arrival context for demo trip: ${DEMO_OFFLINE_BUFFER_TRIP_ID}`
		);
	}
}

// ==========================================================================
// [9/9] CONTENT REPORTS & MODERATION SCENARIOS
// ==========================================================================

export async function seedContentReports(ds = dataSource): Promise<void> {
	if (!ds.isInitialized) {
		await ds.initialize();
	}
	console.log("[seed:content-reports] 🚩 Seeding content moderation reports...");

	const camperRows: Array<{ id: string }> = await ds.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	const camperLanRows: Array<{ id: string }> = await ds.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper.lan@ctms.local"]
	);
	const camperId = camperRows[0]?.id;
	const camperLanId = camperLanRows[0]?.id || camperId;

	if (!camperId) {
		console.log("[seed:content-reports] ⚠️ Camper account not found, skipping.");
		return;
	}

	const tripRows: Array<{ id: string; title: string }> = await ds.query(
		'SELECT "id", "title" FROM "trips" LIMIT 5'
	);
	if (tripRows.length === 0) {
		console.log("[seed:content-reports] ⚠️ No trips found, skipping.");
		return;
	}

	const sampleReports = [
		{
			reporterId: camperId,
			targetType: "trip",
			targetId: tripRows[0].id,
			reason:
				"Host không chuẩn bị đúng dụng cụ bảo hộ và lều trại như đã cam kết trong lịch trình.",
			status: "pending",
		},
		{
			reporterId: camperLanId,
			targetType: "trip",
			targetId: tripRows[1] ? tripRows[1].id : tripRows[0].id,
			reason:
				"Lịch trình thực tế bị rút ngắn 3 tiếng so với mô tả mà không có thông báo trước cho đoàn.",
			status: "reviewing",
		},
		{
			reporterId: camperId,
			targetType: "review",
			targetId: "b1111111-1111-4111-8111-111111111111",
			reason: "Đánh giá chứa ngôn từ thô tục, mang tính công kích và vu khống hướng dẫn viên.",
			status: "actioned",
		},
		{
			reporterId: camperLanId,
			targetType: "review",
			targetId: "b2222222-2222-4222-8222-222222222222",
			reason: "Báo cáo nội dung spam quảng cáo dịch vụ du lịch bên ngoài không liên quan.",
			status: "rejected",
		},
	];

	for (const report of sampleReports) {
		await ds.query('DELETE FROM "content_reports" WHERE "reason" = $1', [report.reason]);
		await ds.query(
			`INSERT INTO "content_reports" ("reporter_id", "target_type", "target_id", "reason", "status")
			 VALUES ($1, $2, $3, $4, $5)`,
			[report.reporterId, report.targetType, report.targetId, report.reason, report.status]
		);
	}

	console.log(
		`[seed:content-reports] ✅ Seeded ${sampleReports.length} content reports across multiple moderation statuses.`
	);
}

// ==========================================================================
// [10/10] SOS & EMERGENCY ALERTS (CTMS-074, CTMS-077, CTMS-80)
// ==========================================================================

export async function seedSosAlerts(ds = dataSource): Promise<void> {
	if (!ds.isInitialized) {
		await ds.initialize();
	}

	const [camperRows, hostRows] = (await Promise.all([
		ds.query('SELECT "id" FROM "users" WHERE "email" = $1', ["camper@ctms.local"]),
		ds.query('SELECT "id" FROM "users" WHERE "email" = $1', ["host@ctms.local"]),
	])) as [Array<{ id: string }>, Array<{ id: string }>];

	const camperId = camperRows[0]?.id;
	const hostId = hostRows[0]?.id;
	if (!camperId || !hostId) {
		console.log("[seed:sos] ⚠️ Camper or Host account not found, skipping.");
		return;
	}

	const tripId = "a1736fee-62be-4991-9478-a62288e9b80a";
	const tripRows = (await ds.query('SELECT "id" FROM "trips" WHERE "id" = $1', [tripId])) as Array<{
		id: string;
	}>;
	if (tripRows.length === 0) {
		console.log(`[seed:sos] ⚠️ Trip ${tripId} not found, skipping.`);
		return;
	}

	// Ensure Host owns this demo sync trip for authorized SOS handling (AC1)
	await ds.query('UPDATE "trips" SET "host_id" = $1 WHERE "id" = $2', [hostId, tripId]);

	// Clean existing seeded demo SOS alerts & audit logs
	const demoAlertIds = [
		"e0500000-0000-4000-8000-000000000001",
		"e0500000-0000-4000-8000-000000000002",
		"e0500000-0000-4000-8000-000000000003",
		"e0500000-0000-4000-8000-000000000004",
	];
	await ds.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [demoAlertIds]);
	await ds.query('DELETE FROM "sos_alerts" WHERE "id" = ANY($1)', [demoAlertIds]);

	// 1. ACTIVE SOS Alert: Ready for Host to test "Tiếp nhận" (Acknowledge)
	await ds.query(
		`INSERT INTO "sos_alerts" (
			"id", "trip_id", "sender_id", "emergency_type", "location", "battery_level",
			"event_time", "status", "received_at", "created_at", "updated_at"
		 ) VALUES (
			$1, $2, $3, 'medical',
			ST_SetSRID(ST_MakePoint(108.2345, 16.0543), 4326)::geography, 88,
			now() - interval '15 minutes', 'active', now() - interval '15 minutes', now() - interval '15 minutes', now() - interval '15 minutes'
		 )`,
		["e0500000-0000-4000-8000-000000000001", tripId, camperId]
	);

	// 2. ACKNOWLEDGED SOS Alert: Ready for Host to test "Đóng SOS" (Close with resolution note)
	await ds.query(
		`INSERT INTO "sos_alerts" (
			"id", "trip_id", "sender_id", "emergency_type", "location", "battery_level",
			"event_time", "status", "acknowledged_by", "acknowledged_at",
			"received_at", "created_at", "updated_at"
		 ) VALUES (
			$1, $2, $3, 'injury',
			ST_SetSRID(ST_MakePoint(108.2310, 16.0520), 4326)::geography, 75,
			now() - interval '30 minutes', 'acknowledged', $4, now() - interval '20 minutes',
			now() - interval '30 minutes', now() - interval '30 minutes', now() - interval '20 minutes'
		 )`,
		["e0500000-0000-4000-8000-000000000002", tripId, camperId, hostId]
	);
	await ds.query(
		`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after", "created_at")
		 VALUES ($1, 'SOS_ACKNOWLEDGED', 'sos_alert', $2, '{"status": "active"}'::jsonb, '{"status": "acknowledged"}'::jsonb, now() - interval '20 minutes')`,
		[hostId, "e0500000-0000-4000-8000-000000000002"]
	);

	// 3. CLOSED SOS Alert: Terminal state verification (cannot be reopened / resolution note preserved)
	await ds.query(
		`INSERT INTO "sos_alerts" (
			"id", "trip_id", "sender_id", "emergency_type", "location", "battery_level",
			"event_time", "status", "acknowledged_by", "acknowledged_at", "closed_by", "closed_at", "resolution_note",
			"received_at", "created_at", "updated_at"
		 ) VALUES (
			$1, $2, $3, 'lost',
			ST_SetSRID(ST_MakePoint(108.2280, 16.0490), 4326)::geography, 60,
			now() - interval '2 hours', 'closed', $4, now() - interval '1 hour 45 minutes',
			$4, now() - interval '1 hour',
			'Đã tìm thấy camper tại trạm kiểm lâm số 2, sức khỏe ổn định và đã đoàn tụ cùng đoàn.',
			now() - interval '2 hours', now() - interval '2 hours', now() - interval '1 hour'
		 )`,
		["e0500000-0000-4000-8000-000000000003", tripId, camperId, hostId]
	);
	await ds.query(
		`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after", "created_at")
		 VALUES
		 ($1, 'SOS_ACKNOWLEDGED', 'sos_alert', $2, '{"status": "active"}'::jsonb, '{"status": "acknowledged"}'::jsonb, now() - interval '1 hour 45 minutes'),
		 ($1, 'SOS_CLOSED', 'sos_alert', $2, '{"status": "acknowledged"}'::jsonb, '{"status": "closed", "resolution_note": "Đã tìm thấy camper tại trạm kiểm lâm số 2, sức khỏe ổn định."}'::jsonb, now() - interval '1 hour')`,
		[hostId, "e0500000-0000-4000-8000-000000000003"]
	);

	// 4. CANCELLED SOS Alert: Accidental SOS cancellation flow preservation (CTMS-077)
	await ds.query(
		`INSERT INTO "sos_alerts" (
			"id", "trip_id", "sender_id", "emergency_type", "location", "battery_level",
			"event_time", "status", "cancelled_by", "cancelled_at", "cancellation_reason",
			"received_at", "created_at", "updated_at"
		 ) VALUES (
			$1, $2, $3, 'other',
			ST_SetSRID(ST_MakePoint(108.2250, 16.0510), 4326)::geography, 92,
			now() - interval '3 hours', 'cancelled', $3, now() - interval '2 hours 55 minutes',
			'Cấn nút SOS trong ba lô khi dừng nghỉ chân tại trạm 1',
			now() - interval '3 hours', now() - interval '3 hours', now() - interval '2 hours 55 minutes'
		 )`,
		["e0500000-0000-4000-8000-000000000004", tripId, camperId]
	);
	await ds.query(
		`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after", "reason", "created_at")
		 VALUES ($1, 'SOS_CANCELLED', 'sos_alert', $2, '{"status": "active"}'::jsonb, '{"status": "cancelled"}'::jsonb, 'Cấn nút SOS trong ba lô khi dừng nghỉ chân tại trạm 1', now() - interval '2 hours 55 minutes')`,
		[camperId, "e0500000-0000-4000-8000-000000000004"]
	);

	console.log(
		"[seed:sos] ✅ Seeded 4 demo SOS alerts for CTMS-80 & CTMS-077 (ACTIVE, ACKNOWLEDGED, CLOSED, CANCELLED) with audit logs."
	);
}

// ==========================================================================
// [11/11] TRIP INCIDENT MANAGEMENT SCENARIOS (CTMS-086)
// ==========================================================================

export async function seedManageTripIncidents(
	ds = dataSource
): Promise<{ ongoingTripId: string | null; incidentCount: number }> {
	if (!ds.isInitialized) {
		await ds.initialize();
	}

	console.log("[seed:incidents] 🛠️ Seeding CTMS-086 Trip Incident Management scenarios...");

	// 1. Fetch Accounts
	const [hostRows, porterRows, camperRows] = (await Promise.all([
		ds.query('SELECT "id" FROM "users" WHERE "email" = $1', ["host@ctms.local"]),
		ds.query('SELECT "id" FROM "users" WHERE "email" = $1', ["porter@ctms.local"]),
		ds.query('SELECT "id" FROM "users" WHERE "email" = $1', ["camper@ctms.local"]),
	])) as [Array<{ id: string }>, Array<{ id: string }>, Array<{ id: string }>];

	if (hostRows.length === 0 || porterRows.length === 0 || camperRows.length === 0) {
		console.warn(
			"[seed:incidents] ⚠️ Host, Porter or Camper account not found. Skipping incident scenarios."
		);
		return { ongoingTripId: null, incidentCount: 0 };
	}

	const hostId = hostRows[0].id;
	const porterId = porterRows[0].id;
	const camperId = camperRows[0].id;

	// 2. Locate the ongoing trip of host@ctms.local
	const ongoingTripRows: Array<{ id: string; title: string }> = await ds.query(
		`SELECT "id", "title" FROM "trips"
		 WHERE "host_id" = $1 AND ("status" = 'ongoing' OR "title" ILIKE '%Sơn Trà Sunset%')
		 ORDER BY "created_at" DESC
		 LIMIT 1`,
		[hostId]
	);

	if (ongoingTripRows.length === 0) {
		console.warn("[seed:incidents] ⚠️ Ongoing trip not found. Skipping incident scenarios.");
		return { ongoingTripId: null, incidentCount: 0 };
	}

	const ongoingTripId = ongoingTripRows[0].id;

	// 3. Clear old incidents & actions for this trip
	await ds.query(
		'DELETE FROM "incident_actions" WHERE "incident_id" IN (SELECT "id" FROM "trip_incidents" WHERE "trip_id" = $1)',
		[ongoingTripId]
	);
	await ds.query('DELETE FROM "trip_incidents" WHERE "trip_id" = $1', [ongoingTripId]);

	// Incident 1: OPEN (Chưa phân công, chờ xử lý)
	const inc1Id = "c1000000-0000-4000-8000-000000000001";
	await ds.query(
		`INSERT INTO "trip_incidents" (
			"id", "trip_id", "reporter_id", "assigned_to", "category", "severity", "status",
			"description", "occurred_at", "location", "location_accuracy_meters", "location_captured_at",
			"location_status", "captured_offline", "received_at"
		 ) VALUES (
			$1, $2, $3, NULL, 'route_obstruction', 'medium', 'open',
			'Cành cây lớn gãy chắn lối đi qua trạm quan sát số 2. Cần người dọn dẹp cành lá để đoàn tiếp tục di chuyển an toàn.',
			now() - interval '45 minutes',
			ST_SetSRID(ST_MakePoint(108.280, 16.120), 4326)::geography, 10.0, now() - interval '45 minutes',
			'fresh', false, now() - interval '40 minutes'
		 );`,
		[inc1Id, ongoingTripId, porterId]
	);
	await ds.query(
		`INSERT INTO "incident_actions" (
			"id", "incident_id", "actor_id", "action", "from_status", "to_status", "note", "created_at"
		 ) VALUES (
			gen_random_uuid(), $1, $2, 'reported', NULL, 'open',
			'Porter phát hiện chướng ngại vật khi dẫn đoàn qua km số 3.', now() - interval '40 minutes'
		 );`,
		[inc1Id, porterId]
	);

	// Incident 2: INVESTIGATING (Đang điều tra/xử lý, đã phân công cho Porter)
	const inc2Id = "c1000000-0000-4000-8000-000000000002";
	await ds.query(
		`INSERT INTO "trip_incidents" (
			"id", "trip_id", "reporter_id", "assigned_to", "category", "severity", "status",
			"description", "occurred_at", "location", "location_accuracy_meters", "location_captured_at",
			"location_status", "captured_offline", "received_at"
		 ) VALUES (
			$1, $2, $3, $4, 'injury', 'high', 'investigating',
			'Camper Nguyễn Văn An bị trượt chân trên dốc đá gần Bãi Rạng. Cần sơ cứu vết thương và theo dõi sức khỏe.',
			now() - interval '120 minutes',
			ST_SetSRID(ST_MakePoint(108.290, 16.115), 4326)::geography, 8.5, now() - interval '120 minutes',
			'fresh', false, now() - interval '115 minutes'
		 );`,
		[inc2Id, ongoingTripId, camperId, porterId]
	);
	await ds.query(
		`INSERT INTO "incident_actions" (
			"id", "incident_id", "actor_id", "action", "from_status", "to_status", "note", "created_at"
		 ) VALUES 
		 (gen_random_uuid(), $1, $2, 'reported', NULL, 'open', 'Camper thông báo chấn thương nhẹ ở mắt cá chân.', now() - interval '115 minutes'),
		 (gen_random_uuid(), $1, $3, 'assigned', NULL, NULL, 'Host phân công Porter Nguyễn Minh Sơn tiếp cận hiện trường để hỗ trợ.', now() - interval '110 minutes'),
		 (gen_random_uuid(), $1, $4, 'status_changed', 'open', 'investigating', 'Đã tiếp cận camper, đang tiến hành rửa vết thương bằng nước muối và băng bó.', now() - interval '90 minutes');`,
		[inc2Id, camperId, hostId, porterId]
	);

	// Incident 3: RESOLVED (Đã khắc phục xong, người phụ trách là Host)
	const inc3Id = "c1000000-0000-4000-8000-000000000003";
	await ds.query(
		`INSERT INTO "trip_incidents" (
			"id", "trip_id", "reporter_id", "assigned_to", "category", "severity", "status",
			"description", "occurred_at", "location", "location_accuracy_meters", "location_captured_at",
			"location_status", "captured_offline", "received_at"
		 ) VALUES (
			$1, $2, $3, $3, 'equipment_failure', 'medium', 'resolved',
			'Gió biển giật mạnh làm cong cọc lều số 3 tại khu vực bãi cắm trại. Đã thay thế bằng cọc nhôm dự phòng.',
			now() - interval '180 minutes',
			NULL, NULL, NULL,
			'unavailable', false, now() - interval '175 minutes'
		 );`,
		[inc3Id, ongoingTripId, hostId]
	);
	await ds.query(
		`INSERT INTO "incident_actions" (
			"id", "incident_id", "actor_id", "action", "from_status", "to_status", "note", "created_at"
		 ) VALUES 
		 (gen_random_uuid(), $1, $2, 'reported', NULL, 'open', 'Kiểm tra trang thiết bị trước giờ hạ trại.', now() - interval '175 minutes'),
		 (gen_random_uuid(), $1, $2, 'assigned', NULL, NULL, 'Host tự tiếp nhận và xử lý trang thiết bị.', now() - interval '170 minutes'),
		 (gen_random_uuid(), $1, $2, 'status_changed', 'open', 'investigating', 'Đang kiểm tra lều dự phòng từ kho vật dụng dã ngoại.', now() - interval '160 minutes'),
		 (gen_random_uuid(), $1, $2, 'status_changed', 'investigating', 'resolved', 'Đã thay cọc dự phòng và cố định lại dây neo, các camper sinh hoạt an toàn.', now() - interval '140 minutes');`,
		[inc3Id, hostId]
	);

	// Incident 4: CLOSED (Đã đóng - Terminal State)
	const inc4Id = "c1000000-0000-4000-8000-000000000004";
	await ds.query(
		`INSERT INTO "trip_incidents" (
			"id", "trip_id", "reporter_id", "assigned_to", "category", "severity", "status",
			"description", "occurred_at", "location", "location_accuracy_meters", "location_captured_at",
			"location_status", "captured_offline", "received_at"
		 ) VALUES (
			$1, $2, $3, $4, 'lost_member', 'low', 'closed',
			'Một thành viên rẽ nhầm nhánh đường mòn phụ khi chụp ảnh. Porter dẫn đoàn đã tìm thấy và đưa về đoàn sau 15 phút.',
			now() - interval '240 minutes',
			ST_SetSRID(ST_MakePoint(108.260, 16.110), 4326)::geography, 15.0, now() - interval '240 minutes',
			'fresh', false, now() - interval '235 minutes'
		 );`,
		[inc4Id, ongoingTripId, camperId, porterId]
	);
	await ds.query(
		`INSERT INTO "incident_actions" (
			"id", "incident_id", "actor_id", "action", "from_status", "to_status", "note", "created_at"
		 ) VALUES 
		 (gen_random_uuid(), $1, $2, 'reported', NULL, 'open', 'Báo cáo lạc thành viên qua app ngoại tuyến.', now() - interval '235 minutes'),
		 (gen_random_uuid(), $1, $3, 'assigned', NULL, NULL, 'Host phân công porter dẫn đường quay lại tìm kiếm.', now() - interval '230 minutes'),
		 (gen_random_uuid(), $1, $4, 'status_changed', 'open', 'investigating', 'Đang rà soát theo dấu chân tại ngã ba Suối Mơ.', now() - interval '225 minutes'),
		 (gen_random_uuid(), $1, $4, 'status_changed', 'investigating', 'resolved', 'Đã tìm thấy thành viên, tình trạng sức khỏe tốt.', now() - interval '210 minutes'),
		 (gen_random_uuid(), $1, $3, 'status_changed', 'resolved', 'closed', 'Đoàn đã tập trung đầy đủ, đóng sự cố an toàn.', now() - interval '200 minutes');`,
		[inc4Id, camperId, hostId, porterId]
	);

	console.log(
		`[seed:incidents] ✅ Seeded 4 demo incidents (open, investigating, resolved, closed) with full audit actions for trip: ${ongoingTripId}`
	);

	return { ongoingTripId, incidentCount: 4 };
}

// ==========================================================================
// MASTER RUNNER & SUMMARY
// ==========================================================================

/** CTMS-388: additive review scenarios; never resets unrelated development data. */
export async function seedTripReviewScenarios(ds = dataSource, titlesOnly = false): Promise<void> {
	if (process.env.NODE_ENV === "production") throw new Error("Review seed is development-only");
	if (!ds.isInitialized) await ds.initialize();
	await ds.transaction(async (manager) => {
		const accounts: Array<{ id: string; role: string }> = await manager.query(
			"SELECT id, role FROM users WHERE email IN ('host@ctms.local','camper@ctms.local') AND status='active'"
		);
		const host = accounts.find((item) => item.role === "host");
		const camper = accounts.find((item) => item.role === "camper");
		if (!host || !camper)
			throw new Error("Existing active demo Host and Camper accounts are required");
		const routes: Array<{ id: string }> = await manager.query(
			"SELECT id FROM trekking_routes WHERE host_id=$1 ORDER BY created_at LIMIT 1",
			[host.id]
		);
		if (!routes[0]) throw new Error("Existing demo Host Route is required");
		const scenarios = [
			{
				key: "1",
				title: "Sơn Trà",
				hours: 1,
				noShow: false,
				saved: false,
			},
			{ key: "2", title: "Hải Vân", hours: 2, noShow: false, saved: true },
			{ key: "6", title: "Ngũ Hành Sơn", hours: 1, noShow: false, saved: false },
			{
				key: "5",
				title: "Bạch Mã — Hết hạn chỉnh sửa",
				hours: 48,
				noShow: false,
				saved: true,
			},
			{
				key: "3",
				title: "Bà Nà — Hết hạn đánh giá",
				hours: 80,
				noShow: false,
				saved: true,
			},
			{
				key: "4",
				title: "Hòa Bắc — Không tham gia",
				hours: 1,
				noShow: true,
				saved: false,
			},
		];
		for (const scenario of scenarios) {
			const tripId = `d3880000-0000-4000-8000-00000000000${scenario.key}`;
			const bookingId = `d3880000-0000-4000-8001-00000000000${scenario.key}`;
			const memberId = `d3880000-0000-4000-8002-00000000000${scenario.key}`;
			await manager.query(
				`INSERT INTO trips (id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
				VALUES ($1,$2,$3,$4,'day_trip',0,now()-interval '4 days',now()-interval '3 days',ST_GeogFromText('POINT(108.22 16.04)'),now()-interval '5 days',1,10,1,0,'completed') ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title`,
				[tripId, host.id, routes[0].id, scenario.title]
			);
			if (titlesOnly) continue;
			await manager.query(
				`INSERT INTO bookings (id,trip_id,user_id,num_people,status,payment_status,completed_at) VALUES ($1,$2,$3,1,'completed','not_required',now()-make_interval(hours=>$4)) ON CONFLICT (id) DO UPDATE SET completed_at=EXCLUDED.completed_at`,
				[bookingId, tripId, camper.id, scenario.hours]
			);
			await manager.query(
				`INSERT INTO booking_members (id,booking_id,user_id,is_primary,member_status,checked_in_at,no_show_at)
				VALUES ($1,$2,$3,true,$4::booking_member_status,CASE WHEN $4::booking_member_status='joined' THEN now()-interval '4 days' ELSE NULL END,CASE WHEN $4::booking_member_status='no_show' THEN now()-interval '4 days' ELSE NULL END) ON CONFLICT (id) DO NOTHING`,
				[memberId, bookingId, camper.id, scenario.noShow ? "no_show" : "joined"]
			);
			await manager.query(
				"UPDATE bookings b SET trip_starts_at_snapshot=t.starts_at, trip_ends_at_snapshot=t.ends_at FROM trips t WHERE b.id=$1 AND t.id=b.trip_id",
				[bookingId]
			);
			if (scenario.saved) {
				// Existing review content is retained when refreshing these demo scenarios.
				for (const target of ["trip", "host"]) {
					await manager.query(
						`WITH inserted AS (
						INSERT INTO trip_reviews (booking_id,member_id,reviewer_id,trip_id,host_id,target,target_id,rating,comment,created_at,updated_at)
						VALUES ($1,$2,$3,$4,$5,$6,$7,4,'Dữ liệu seed: chuyến đi được tổ chức tốt.',now()-($8::double precision * interval '1 hour'),now()-($8::double precision * interval '1 hour')) ON CONFLICT DO NOTHING RETURNING *
					) INSERT INTO trip_review_revisions (review_id,revision,rating,comment,recorded_at) SELECT id,revision,rating,comment,updated_at FROM inserted`,
						[
							bookingId,
							memberId,
							camper.id,
							tripId,
							host.id,
							target,
							target === "trip" ? tripId : host.id,
							scenario.hours - 0.5,
						]
					);
				}
			}
		}
	});
}

/** CTMS-412: additive source evidence for multi-batch analysis; never seeds AI output. */
export async function seedReviewAnalysisScenarios(
	ds = dataSource,
	refreshVietnamese = false,
	demoNumber: 1 | 2 = 1
): Promise<void> {
	if (process.env.NODE_ENV === "production") throw new Error("Analysis seed is development-only");
	const database = new URL(
		process.env.DATABASE_URL ?? "postgresql://ctms:ctms@localhost:5432/ctms"
	);
	if (
		!["localhost", "127.0.0.1", "postgres"].includes(database.hostname) ||
		!["/ctms", "/ctms_test"].includes(database.pathname)
	)
		throw new Error("Analysis seed requires a local development/test database");
	if (!ds.isInitialized) await ds.initialize();
	const passwordHash = await hash(randomBytes(32).toString("hex"), BCRYPT_COST_FACTOR);
	const comments: ReadonlyArray<readonly [number, string]> = [
		[
			5,
			"Cảnh quan Sơn Trà rất đẹp, khâu tổ chức chu đáo và lịch trình phù hợp. Tôi có đủ thời gian nghỉ và chụp ảnh.",
		],
		[
			4,
			"Cảnh quan đẹp và mọi người trong nhóm thân thiện. Lịch trình rõ ràng, tuy nhiên chặng đi bộ đầu tiên hơi gấp.",
		],
		[
			2,
			"Điểm tập trung thông báo muộn, nhóm phải chờ khá lâu. Mong lần sau tổ chức đúng giờ và hướng dẫn rõ hơn.",
		],
		[
			5,
			"Hướng dẫn an toàn đầy đủ trước khi đi. Các điểm nghỉ hợp lý, tôi thấy yên tâm trong suốt hành trình.",
		],
		[
			3,
			"Phong cảnh rất đẹp, nhưng tiện nghi ở điểm nghỉ trưa chưa sạch sẽ. Nhìn chung trải nghiệm tốt nhưng vẫn cần cải thiện.",
		],
		[
			4,
			"Giá tour khá hợp lý so với trải nghiệm, đồ ăn vừa đủ. Phần giao tiếp trước chuyến đi cần phản hồi nhanh hơn.",
		],
		[
			1,
			"Điểm tập trung thay đổi mà không thông báo rõ ràng. Cách trao đổi thông tin và tổ chức cần cải thiện nhiều.",
		],
		[
			5,
			"Lịch trình hợp lý, nhóm đi đúng tốc độ và được hỗ trợ khi cần. Cảnh biển lúc bình minh rất đáng nhớ.",
		],
		[
			3,
			"Chuyến đi đúng như mô tả. Không có vấn đề lớn, nhưng chưa có hoạt động nào thật sự nổi bật.",
		],
		[
			4,
			"Hướng dẫn an toàn rõ ràng và hỗ trợ tận tình. Một số điểm nghỉ nên có thêm bóng mát và nước uống.",
		],
		[
			2,
			"Lịch trình hơi dày, thời gian nghỉ ít. Nhà vệ sinh ở điểm dừng chưa sạch nên trải nghiệm chưa thoải mái.",
		],
		[
			5,
			"Cảnh biển tuyệt đẹp, kế hoạch chu đáo và thông tin trước khi khởi hành đầy đủ. Trải nghiệm xứng đáng với chi phí.",
		],
		[
			4,
			"Tổ chức tốt, thông tin chi phí minh bạch. Tôi thích các điểm ngắm cảnh, mong có thêm thời gian tìm hiểu thiên nhiên.",
		],
		[
			3,
			"Trải nghiệm ở mức trung bình. Tuyến đi đúng mô tả và tiện nghi cơ bản vẫn đáp ứng nhu cầu.",
		],
		[
			2,
			"Chi phí phát sinh chưa được giải thích rõ trước chuyến đi. Cảnh đẹp nhưng tôi chưa hài lòng về cách trao đổi.",
		],
		[
			5,
			"Rất hài lòng với sự hỗ trợ và cách hướng dẫn an toàn. Cả nhóm phối hợp tốt, hành trình nhẹ nhàng và vui vẻ.",
		],
	];
	await ds.transaction(async (manager) => {
		const [host]: { id: string }[] = await manager.query(
			"SELECT id FROM users WHERE email='host@ctms.local' AND status='active'"
		);
		if (!host) throw new Error("Existing active demo Host required");
		let [route]: { id: string }[] = await manager.query(
			"SELECT id FROM trekking_routes WHERE host_id=$1 AND name LIKE '%Sơn Trà%' ORDER BY created_at LIMIT 1",
			[host.id]
		);
		if (!route) {
			[route] = await manager.query(
				"SELECT id FROM trekking_routes WHERE host_id=$1 ORDER BY created_at LIMIT 1",
				[host.id]
			);
		}
		if (!route) throw new Error("Existing demo Host Route required");
		const tripId = `d4120000-0000-4000-8004-${String(demoNumber).padStart(12, "0")}`;
		const title =
			demoNumber === 1
				? "Khám phá Sơn Trà – Trải nghiệm thiên nhiên"
				: "Khám phá Sơn Trà – Bình minh trên biển";
		await manager.query(
			`INSERT INTO trips(id,host_id,route_id,title,description,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
   VALUES($1,$2,$3,$4,'Chuyến đi mẫu phục vụ kiểm thử phân tích đánh giá, gồm 32 nhận xét tiếng Việt.','day_trip',0,now()-interval '4 days',now()-interval '3 days',ST_GeogFromText('POINT(108.22 16.04)'),now()-interval '5 days',1,40,32,0,'completed')
   ON CONFLICT(id) DO UPDATE SET route_id = EXCLUDED.route_id, title = EXCLUDED.title`,
			[tripId, host.id, route.id, title]
		);

		await manager.query(
			"INSERT INTO trip_review_analysis_slots (id) VALUES (1), (2) ON CONFLICT (id) DO NOTHING"
		);

		const batchId = `d4120000-0000-4000-8006-${String(demoNumber).padStart(12, "0")}`;
		await manager.query(
			`INSERT INTO trip_review_analysis_batches(
				id, trip_id, requester_id, provider, model, config_version, prompt_version, status, created_at, completed_at
			) VALUES (
				$1, $2, $3, 'gemini', 'gemini-3.1-flash-lite', 'gemini-v1', 'v1', 'succeeded', now() - interval '2 days', now() - interval '2 days'
			) ON CONFLICT (id) DO NOTHING`,
			[batchId, tripId, host.id]
		);

		for (let index = 0; index < 32; index++) {
			const suffix = String(index + 1 + (demoNumber - 1) * 100).padStart(12, "0");
			const userId = `d4120000-0000-4000-8000-${suffix}`;
			const bookingId = `d4120000-0000-4000-8001-${suffix}`;
			const memberId = `d4120000-0000-4000-8002-${suffix}`;
			const reviewId = `d4120000-0000-4000-8003-${suffix}`;
			const isQuarantinedDemo =
				(demoNumber === 1 && index === 9) || (demoNumber === 2 && index === 9);
			const isFlaggedHarassment =
				(demoNumber === 1 && index === 7) || (demoNumber === 2 && index === 7);
			const isFlaggedProfanity =
				(demoNumber === 1 && index === 8) || (demoNumber === 2 && index === 8);
			const isHiddenDemo = demoNumber === 1 && index === 10;
			const isResolvedDemo = demoNumber === 1 && index === 11;

			let [rating, comment] = comments[index % comments.length];
			if (isFlaggedHarassment) {
				rating = 1;
				comment =
					demoNumber === 1
						? "Porter béo ục ịch, đi chậm như rùa bò làm hỏng cả chuyến đi. Nhìn người vừa lùn vừa xấu vừa bẩn bựa không chịu nổi, ban tổ chức đuổi ngay thằng này đi!"
						: "Con bé hướng dẫn viên mặt mụn xấu xí, người thì gầy gò thô kệch nhìn phát tởm, nói chuyện thì vô duyên không có não.";
			} else if (isFlaggedProfanity) {
				rating = 1;
				comment =
					demoNumber === 1
						? "Chuyến đi như cái đ** c**, lũ làm ăn thất đức lừa đảo vcl, đồ ăn như cho chó ăn, đ* mẹ làm ăn tắc trách thế này mà cũng mở tour à!"
						: "Dịch vụ rác rưởi vcl, đcm tụi bay lừa tiền khách à? Đ*o bao giờ quay lại cái tour hãm tài này nữa.";
			} else if (isHiddenDemo) {
				rating = 1;
				comment = "Hướng dẫn viên ngu như bò, bọn lừa đảo đ** có tâm, cút mẹ chúng mày đi.";
			} else if (isResolvedDemo) {
				comment = "Tour bán phá giá, liên hệ Zalo 0905123456 mua vé giá rẻ giảm 50% ngay hôm nay.";
			}

			if (refreshVietnamese) {
				await manager.query(
					`WITH changed AS (
                  UPDATE trip_reviews SET comment=$2, rating=$4, created_at=now() - (($5 || ' days')::interval), revision=revision+1, updated_at=clock_timestamp()
                  WHERE id=$1 AND trip_id=$3 AND (comment IS DISTINCT FROM $2 OR rating IS DISTINCT FROM $4 OR created_at IS NULL) RETURNING *)
                  INSERT INTO trip_review_revisions(review_id,revision,rating,comment,recorded_at)
                  SELECT id,revision,rating,comment,updated_at FROM changed`,
					[reviewId, comment, tripId, rating, Math.max(1, 32 - index)]
				);
				await manager.query(
					`UPDATE trip_reviews SET created_at=now() - (($2 || ' days')::interval) WHERE id=$1`,
					[reviewId, Math.max(1, 32 - index)]
				);
			}

			await manager.query(
				`INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,$3,'camper','active',$4) ON CONFLICT(id) DO NOTHING`,
				[
					userId,
					`review-demo-${index + 1 + (demoNumber - 1) * 100}@example.test`,
					passwordHash,
					`Camper Demo ${index + 1}`,
				]
			);
			await manager.query(
				"INSERT INTO user_roles(user_id,role) VALUES($1,'camper') ON CONFLICT DO NOTHING",
				[userId]
			);
			await manager.query(
				`INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status,completed_at,trip_starts_at_snapshot,trip_ends_at_snapshot)
    SELECT $1,id,$3,1,'completed','not_required',ends_at,starts_at,ends_at FROM trips WHERE id=$2 ON CONFLICT(id) DO NOTHING`,
				[bookingId, tripId, userId]
			);
			await manager.query(
				`INSERT INTO booking_members(id,booking_id,user_id,is_primary,member_status,checked_in_at)
    SELECT $1,$2,$3,true,'joined',starts_at FROM trips WHERE id=$4 ON CONFLICT(id) DO NOTHING`,
				[memberId, bookingId, userId, tripId]
			);
			await manager.query(
				`WITH inserted AS (INSERT INTO trip_reviews(id,booking_id,member_id,reviewer_id,trip_id,host_id,target,target_id,rating,comment,created_at,updated_at)
    SELECT $1,$2,$3,$4,id,$6,'trip',id,$7,$8,ends_at - ((32 - $9) || ' days')::interval + (($9 * 3) || ' hours')::interval, ends_at - ((32 - $9) || ' days')::interval + (($9 * 3) || ' hours')::interval FROM trips WHERE id=$5 ON CONFLICT DO NOTHING RETURNING *)
    INSERT INTO trip_review_revisions(review_id,revision,rating,comment,recorded_at) SELECT id,revision,rating,comment,updated_at FROM inserted`,
				[reviewId, bookingId, memberId, userId, tripId, host.id, rating, comment, index + 1]
			);

			// CTMS-412: Seed completed moderation run, aspect sentiments, incident signals, and moderation flags
			const runId = `d4120000-0000-4000-8005-${suffix}`;

			await manager.query(
				`INSERT INTO trip_review_moderation_runs(
					id, review_id, source_revision, provider, model, config_version, prompt_version,
					text_scan_status, image_scan_status, aspects_status, incidents_status,
					attempts, created_at, completed_at
				) VALUES (
					$1, $2, 1, 'gemini', 'gemini-1.5-flash', 'v1.0', 'v1.0',
					'completed', $3, 'completed', 'completed',
					1, now() - interval '2 days', now() - interval '2 days'
				) ON CONFLICT (id) DO UPDATE SET aspects_status = 'completed', incidents_status = 'completed'`,
				[runId, reviewId, isQuarantinedDemo ? "completed" : "not_applicable"]
			);

			// Seed 4 aspect sentiments per review
			const safetySentiment = index < 25 ? "positive" : index < 29 ? "neutral" : "negative";
			const guideSentiment = index < 27 ? "positive" : index < 30 ? "neutral" : "negative";
			const equipSentiment = index < 21 ? "positive" : index < 28 ? "neutral" : "negative";
			const valueSentiment = index < 23 ? "positive" : index < 29 ? "neutral" : "negative";

			await manager.query(
				`INSERT INTO trip_review_aspect_sentiments(run_id, review_id, source_revision, aspect, sentiment, confidence, quote)
				 VALUES 
				 ($1, $2, 1, 'safety', $3, 0.95, 'Hướng dẫn an toàn rất chu đáo và chi tiết.'),
				 ($1, $2, 1, 'guide_support', $4, 0.96, 'Hướng dẫn viên nhiệt tình, hỗ trợ chu đáo suốt chuyến đi.'),
				 ($1, $2, 1, 'equipment', $5, 0.90, 'Trang thiết bị trekking và bộ sơ cứu được chuẩn bị tốt.'),
				 ($1, $2, 1, 'value', $6, 0.92, 'Trải nghiệm rất xứng đáng với chi phí bỏ ra.')
				 ON CONFLICT (run_id, aspect) DO UPDATE SET sentiment = EXCLUDED.sentiment`,
				[runId, reviewId, safetySentiment, guideSentiment, equipSentiment, valueSentiment]
			);

			// Seed completed batch analysis item for CTMS-107
			const itemId = `d4120000-0000-4000-8007-${suffix}`;
			const itemSentiment =
				rating >= 4
					? "positive"
					: rating === 3
						? index % 2 === 0
							? "neutral"
							: "mixed"
						: "negative";
			const itemTopics =
				rating >= 4
					? ["scenery", "itinerary", "organization"]
					: rating === 3
						? ["facilities", "scenery"]
						: ["organization", "communication"];
			const positiveSummaries = [
				"Cảnh quan Sơn Trà tuyệt đẹp, công tác tổ chức chu đáo và thời gian nghỉ ngắm cảnh hợp lý.",
				"Hướng dẫn viên tận tình, phổ biến an toàn rõ ràng và hỗ trợ đoàn nhiệt tình suốt chặng đi.",
				"Lịch trình đi bộ ven biển đón bình minh rất đáng nhớ, các điểm dừng chân bố trí hợp lý.",
				"Trang thiết bị bảo hộ và gậy trekking đầy đủ, chất lượng dịch vụ rất xứng đáng với chi phí.",
				"Không khí trong lành, nhóm đi hòa đồng vui vẻ và khâu hậu cần chuẩn bị chu đáo.",
				"Đoàn được hướng dẫn kỹ các quy tắc bảo vệ môi trường và giữ an toàn trên dốc đá.",
				"Trải nghiệm trekking bình minh tuyệt vời, thời gian chụp ảnh và nghỉ ngơi rất thoải mái.",
			];
			const neutralOrMixedSummaries = [
				"Phong cảnh đẹp nhưng tiện nghi vệ sinh ở điểm dừng chân buổi trưa cần được cải thiện.",
				"Giá tour hợp lý và đồ ăn vừa đủ, tuy nhiên tốc độ di chuyển chặng đầu hơi vội.",
				"Chuyến đi diễn ra đúng mô tả, dịch vụ ổn định nhưng chưa có nhiều hoạt động trải nghiệm đặc sắc.",
				"Cung đường đẹp và không khí thoáng đãng, tuy nhiên thông tin tập trung cần phản hồi nhanh hơn.",
			];
			const negativeSummaries = [
				"Thông báo đổi điểm tập trung sát giờ gây lúng túng cho khách, khâu tổ chức cần cải thiện.",
				"Lịch trình di chuyển khá gấp, ít thời gian nghỉ ngơi và thông tin trước chuyến đi chưa rõ ràng.",
				"Phát sinh chi phí phụ chưa được giải thích cặn kẽ trước khi khởi hành, cần minh bạch hơn.",
				"Hướng dẫn viên thiếu lắng nghe ý kiến thành viên trong đoàn, cần chấn chỉnh thái độ phục vụ.",
			];

			const itemSummary =
				rating >= 4
					? positiveSummaries[index % positiveSummaries.length]
					: rating === 3
						? neutralOrMixedSummaries[index % neutralOrMixedSummaries.length]
						: negativeSummaries[index % negativeSummaries.length];

			if (!isHiddenDemo) {
				await manager.query(
					`INSERT INTO trip_review_analysis_items(
						id, review_id, source_revision, provider, model, config_version, prompt_version,
						status, attempts, sentiment, topics, summary, confidence, actual_model, created_at, updated_at
					) VALUES (
						$1, $2, 1, 'gemini', 'gemini-3.1-flash-lite', 'gemini-v1', 'v1',
						'succeeded', 1, $3, $4::jsonb, $5, 0.94, 'gemini-3.1-flash-lite', now() - (($6 || ' days')::interval), now() - (($6 || ' days')::interval)
					) ON CONFLICT (review_id, source_revision, provider, model, config_version, prompt_version) DO UPDATE
					SET status='succeeded', sentiment=EXCLUDED.sentiment, topics=EXCLUDED.topics, summary=EXCLUDED.summary, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at`,
					[
						itemId,
						reviewId,
						itemSentiment,
						JSON.stringify(itemTopics),
						itemSummary,
						Math.max(1, 32 - index),
					]
				);

				await manager.query(
					`INSERT INTO trip_review_analysis_batch_items(batch_id, item_id, start_attempt, end_attempt, terminal_status)
					 VALUES ($1, $2, 0, 1, 'succeeded')
					 ON CONFLICT (batch_id, item_id) DO NOTHING`,
					[batchId, itemId]
				);
			}

			if (demoNumber === 1) {
				if (index === 0) {
					await manager.query(
						`INSERT INTO trip_review_incident_signals(run_id, review_id, source_revision, incident_type, occurred, severity, quote)
						 VALUES ($1, $2, 1, 'fall_slip', 'yes', 'minor', 'Đoạn dốc gần đỉnh Bàn Cờ có rêu trơn, tôi bị trượt ngã nhẹ nhưng không bị thương.')
						 ON CONFLICT (run_id, incident_type, md5(quote)) DO NOTHING`,
						[runId, reviewId]
					);
				} else if (index === 1) {
					await manager.query(
						`INSERT INTO trip_review_incident_signals(run_id, review_id, source_revision, incident_type, occurred, severity, quote)
						 VALUES ($1, $2, 1, 'fall_slip', 'warning', 'minor', 'Lối đi dốc nhiều lá khô trơn trượt, mọi người nên mang giày có gai bám.')
						 ON CONFLICT (run_id, incident_type, md5(quote)) DO NOTHING`,
						[runId, reviewId]
					);
				} else if (index === 2) {
					await manager.query(
						`INSERT INTO trip_review_incident_signals(run_id, review_id, source_revision, incident_type, occurred, severity, quote)
						 VALUES ($1, $2, 1, 'weather_hazard', 'warning', 'moderate', 'Gió trên sườn biển khá giật và sương mù dày vào sáng sớm.')
						 ON CONFLICT (run_id, incident_type, md5(quote)) DO NOTHING`,
						[runId, reviewId]
					);
				} else if (index === 3) {
					await manager.query(
						`INSERT INTO trip_review_incident_signals(run_id, review_id, source_revision, incident_type, occurred, severity, quote)
						 VALUES ($1, $2, 1, 'lost_path', 'warning', 'minor', 'Đoạn rẽ vào cây đa ngàn năm có vài nhánh đường mòn dễ nhầm.')
						 ON CONFLICT (run_id, incident_type, md5(quote)) DO NOTHING`,
						[runId, reviewId]
					);
				} else if (index === 4) {
					await manager.query(
						`INSERT INTO trip_review_incident_signals(run_id, review_id, source_revision, incident_type, occurred, severity, quote)
						 VALUES ($1, $2, 1, 'other', 'unknown', 'unknown', 'Có biển cảnh báo khỉ hoang có thể giật đồ ăn của du khách.')
						 ON CONFLICT (run_id, incident_type, md5(quote)) DO NOTHING`,
						[runId, reviewId]
					);
				} else if (index === 5) {
					await manager.query(
						`INSERT INTO trip_review_incident_signals(run_id, review_id, source_revision, incident_type, occurred, severity, quote)
						 VALUES ($1, $2, 1, 'fall_slip', 'yes', 'minor', 'Một bạn trong đoàn bị trượt chân ở đoạn dốc đá ven biển.')
						 ON CONFLICT (run_id, incident_type, md5(quote)) DO NOTHING`,
						[runId, reviewId]
					);
				} else if (index === 6) {
					await manager.query(
						`INSERT INTO trip_review_incident_signals(run_id, review_id, source_revision, incident_type, occurred, severity, quote)
						 VALUES ($1, $2, 1, 'injury', 'yes', 'minor', 'Tôi bị cành cây quẹt xước nhẹ ở bắp chân khi băng qua bụi rậm.')
						 ON CONFLICT (run_id, incident_type, md5(quote)) DO NOTHING`,
						[runId, reviewId]
					);
				}
			}

			if (isFlaggedHarassment) {
				const comment =
					demoNumber === 1
						? "Porter béo ục ịch, đi chậm như rùa bò làm hỏng cả chuyến đi. Nhìn người vừa lùn vừa xấu vừa bẩn bựa không chịu nổi, ban tổ chức đuổi ngay thằng này đi!"
						: "Con bé hướng dẫn viên mặt mụn xấu xí, người thì gầy gò thô kệch nhìn phát tởm, nói chuyện thì vô duyên không có não.";
				const quote =
					demoNumber === 1
						? "Porter béo ục ịch, đi chậm như rùa bò... vừa xấu vừa bẩn bựa"
						: "hướng dẫn viên mặt mụn xấu xí, người thì gầy gò thô kệch nhìn phát tởm";
				const evidence =
					"Miệt thị ngoại hình (body shaming), xúc phạm nhân phẩm porter và quấy rối cá nhân";

				await manager.query("UPDATE trip_reviews SET rating=1, comment=$1 WHERE id=$2", [
					comment,
					reviewId,
				]);
				await manager.query(
					`INSERT INTO trip_review_moderation_flags(run_id, review_id, source_revision, channel, flag_type, detection_source, confidence, evidence, quote, lifecycle_status)
					 VALUES ($1, $2, 1, 'text', 'harassment', 'model', 0.98, $3, $4, 'active')
					 ON CONFLICT (run_id, channel, flag_type, COALESCE(target_image_index, -1))
					 DO UPDATE SET evidence=EXCLUDED.evidence, quote=EXCLUDED.quote, confidence=EXCLUDED.confidence, lifecycle_status='active'`,
					[runId, reviewId, evidence, quote]
				);
			} else if (isFlaggedProfanity) {
				const comment =
					demoNumber === 1
						? "Chuyến đi như cái đ** c**, lũ làm ăn thất đức lừa đảo vcl, đồ ăn như cho chó ăn, đ* mẹ làm ăn tắc trách thế này mà cũng mở tour à!"
						: "Dịch vụ rác rưởi vcl, đcm tụi bay lừa tiền khách à? Đ*o bao giờ quay lại cái tour hãm tài này nữa.";
				const quote =
					demoNumber === 1
						? "Chuyến đi như cái đ** c**... đ* mẹ làm ăn tắc trách"
						: "Dịch vụ rác rưởi vcl, đcm tụi bay lừa tiền... Đ*o bao giờ";
				const evidence = "Sử dụng từ ngữ thô tục tục tĩu, chửi thề nặng nề và lăng mạ xúc phạm";

				await manager.query("UPDATE trip_reviews SET rating=1, comment=$1 WHERE id=$2", [
					comment,
					reviewId,
				]);
				await manager.query(
					`INSERT INTO trip_review_moderation_flags(run_id, review_id, source_revision, channel, flag_type, detection_source, confidence, evidence, quote, lifecycle_status)
					 VALUES ($1, $2, 1, 'text', 'profanity_or_insult', 'model', 0.99, $3, $4, 'active')
					 ON CONFLICT (run_id, channel, flag_type, COALESCE(target_image_index, -1))
					 DO UPDATE SET evidence=EXCLUDED.evidence, quote=EXCLUDED.quote, confidence=EXCLUDED.confidence, lifecycle_status='active'`,
					[runId, reviewId, evidence, quote]
				);
			} else if (isQuarantinedDemo) {
				const demoImgName = "img-1793798391368-gxi9wqgt.jpg";
				const liveImgPath = join(__dirname, "..", "..", "uploads", "trip-reviews", demoImgName);
				const quarantineDirPath = join(
					__dirname,
					"..",
					"..",
					"uploads",
					"quarantine",
					"trip-reviews"
				);
				const quarantineImgPath = join(quarantineDirPath, demoImgName);
				try {
					mkdirSync(quarantineDirPath, { recursive: true });
					if (existsSync(liveImgPath) && !existsSync(quarantineImgPath)) {
						copyFileSync(liveImgPath, quarantineImgPath);
					} else if (existsSync(quarantineImgPath) && !existsSync(liveImgPath)) {
						copyFileSync(quarantineImgPath, liveImgPath);
					}
				} catch {
					// Directory/file copy error gracefully tolerated in seed
				}

				await manager.query(
					`UPDATE trip_reviews SET images='["/uploads/trip-reviews/img-1793798391368-gxi9wqgt.jpg"]'::jsonb, image_storage_state='quarantined' WHERE id=$1`,
					[reviewId]
				);
				await manager.query(
					`INSERT INTO trip_review_moderation_image_items(run_id, review_id, source_revision, image_index, storage_key, scan_status, has_violation, flag_type, confidence, evidence)
					 VALUES ($1, $2, 1, 0, 'img-1793798391368-gxi9wqgt.jpg', 'completed', true, 'inappropriate_image', 0.95, 'Hình ảnh chứa nội dung nhạy cảm')
					 ON CONFLICT (run_id, image_index) DO NOTHING`,
					[runId, reviewId]
				);
				await manager.query(
					`INSERT INTO trip_review_moderation_flags(run_id, review_id, source_revision, channel, target_image_index, flag_type, detection_source, confidence, evidence, lifecycle_status)
					 VALUES ($1, $2, 1, 'image', 0, 'inappropriate_image', 'model', 0.95, 'Hình ảnh chứa nội dung nhạy cảm vi phạm tiêu chuẩn cộng đồng', 'active')
					 ON CONFLICT (run_id, channel, flag_type, COALESCE(target_image_index, -1)) DO NOTHING`,
					[runId, reviewId]
				);
			} else if (isHiddenDemo) {
				await manager.query(
					`UPDATE trip_reviews SET rating=1, comment='Hướng dẫn viên ngu như bò, bọn lừa đảo đ** có tâm, cút mẹ chúng mày đi.', moderation_status='hidden', hidden_reason='profanity_or_insult', hidden_at=now() - interval '1 day', hidden_by=$2 WHERE id=$1`,
					[reviewId, host.id]
				);
				await manager.query(
					`INSERT INTO trip_review_moderation_flags(run_id, review_id, source_revision, channel, flag_type, detection_source, confidence, evidence, quote, lifecycle_status, resolved_at, resolved_by)
					 VALUES ($1, $2, 1, 'text', 'profanity_or_insult', 'model', 0.99, 'Chửi thề thô tục lăng mạ nhân viên', 'Hướng dẫn viên ngu như bò, bọn lừa đảo đ** có tâm', 'resolved', now() - interval '1 day', $3)
					 ON CONFLICT (run_id, channel, flag_type, COALESCE(target_image_index, -1))
					 DO UPDATE SET evidence=EXCLUDED.evidence, quote=EXCLUDED.quote, confidence=EXCLUDED.confidence`,
					[runId, reviewId, host.id]
				);
			} else if (isResolvedDemo) {
				await manager.query(
					`UPDATE trip_reviews SET comment='Tour bán phá giá, liên hệ Zalo 0905123456 mua vé giá rẻ giảm 50% ngay hôm nay.' WHERE id=$1`,
					[reviewId]
				);
				await manager.query(
					`INSERT INTO trip_review_moderation_flags(run_id, review_id, source_revision, channel, flag_type, detection_source, confidence, evidence, quote, lifecycle_status, resolved_at, resolved_by)
					 VALUES ($1, $2, 1, 'text', 'spam_or_irrelevant', 'model', 0.95, 'Quảng cáo sản phẩm và lôi kéo liên hệ ngoài nền tảng', 'liên hệ Zalo 0905123456 mua vé giá rẻ', 'resolved', now() - interval '1 day', $3)
					 ON CONFLICT (run_id, channel, flag_type, COALESCE(target_image_index, -1))
					 DO UPDATE SET evidence=EXCLUDED.evidence, quote=EXCLUDED.quote, confidence=EXCLUDED.confidence`,
					[runId, reviewId, host.id]
				);
			}
		}

		// Simulate 2 reviews edited by campers to demonstrate stale analysis and re-analysis flow
		const suffixA = String(31 + (demoNumber - 1) * 100).padStart(12, "0");
		const suffixB = String(32 + (demoNumber - 1) * 100).padStart(12, "0");
		const staleReviewA = `d4120000-0000-4000-8003-${suffixA}`;
		const staleReviewB = `d4120000-0000-4000-8003-${suffixB}`;
		await manager.query(
			`UPDATE trip_reviews SET revision=2, comment = comment || ' (Cập nhật sau chuyến đi)', updated_at=now() - interval '1 hour' WHERE id IN ($1, $2)`,
			[staleReviewA, staleReviewB]
		);
		await manager.query(
			`INSERT INTO trip_review_revisions(review_id, revision, rating, comment, recorded_at)
			 SELECT id, revision, rating, comment, updated_at FROM trip_reviews WHERE id IN ($1, $2)
			 ON CONFLICT DO NOTHING`,
			[staleReviewA, staleReviewB]
		);
	});
	console.log(
		"[seed:review-analysis] Ensured Vietnamese demo source reviews; AI history preserved."
	);
}

/** Additive closed-month demand sources; never seeds AI results or rewrites existing records. */
export async function seedDemandInsightScenarios(ds = dataSource): Promise<void> {
	const database = new URL(
		process.env.DATABASE_URL ?? "postgresql://ctms:ctms@localhost:5432/ctms"
	);
	if (
		process.env.NODE_ENV === "production" ||
		!["localhost", "127.0.0.1", "postgres"].includes(database.hostname) ||
		!["/ctms", "/ctms_test"].includes(database.pathname)
	)
		throw new Error("Demand seed requires a local development/test database");
	if (!ds.isInitialized) await ds.initialize();
	const now = new Date(Date.now() + 7 * 3600000);
	const defaultMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15))
		.toISOString()
		.slice(0, 7);
	const requestedMonth = process.argv
		.find((argument) => argument.startsWith("--demand-month="))
		?.split("=")[1];
	const month = requestedMonth ?? defaultMonth;
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > defaultMonth) {
		throw new Error("Demand seed month must be a closed calendar month in YYYY-MM format");
	}
	const alternative = process.argv.includes("--demand-alternative");
	const varied = process.argv.includes("--demand-varied");
	const planning = process.argv.includes("--demand-planning");
	const bookersPerGroup = varied ? [24, 36] : [12, 12];
	if ((alternative || varied) && month === defaultMonth) {
		throw new Error(
			"Alternative demand scenario requires an earlier month to preserve the latest-month fixture"
		);
	}
	const suffix = (n: number) => `${month.replace("-", "")}${String(n).padStart(6, "0")}`;
	const hostId = (n: number) => `d4150000-0000-4000-8100-${String(n).padStart(12, "0")}`;
	const camperId = (n: number) => `d4150000-0000-4000-8200-${String(n).padStart(12, "0")}`;
	const passwordHash = await hash(randomBytes(32).toString("hex"), BCRYPT_COST_FACTOR);
	await ds.transaction(async (m) => {
		if (varied || planning) {
			const reports: { id: string }[] = await m.query(
				"SELECT id FROM demand_insight_reports WHERE month=$1",
				[month]
			);
			if (reports.length) throw new Error("Refusing to change sources for an existing report");
		}
		if (planning) {
			const existing: { id: string }[] = await m.query(
				"SELECT id FROM trips WHERE id::text LIKE $1 LIMIT 1",
				[`d4150000-0000-4000-8400-${month.replace("-", "")}%`]
			);
			if (existing.length) throw new Error("Planning fixture requires a fresh scenario month");
			await m.query(
				"INSERT INTO demand_areas(code,label) VALUES('demo-lowland','Vùng đồng bằng mẫu'),('demo-highland','Vùng cao mẫu') ON CONFLICT(code) DO NOTHING"
			);
		}
		for (let n = 1; n <= 3 + Math.max(...bookersPerGroup); n++) {
			const host = n <= 3;
			const id = host ? hostId(n) : camperId(n - 3);
			const role = host ? "host" : "camper";
			await m.query(
				"INSERT INTO users(id,email,password_hash,role,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(id) DO NOTHING",
				[id, `demand-${role}-${host ? n : n - 3}@example.test`, passwordHash, role]
			);
			await m.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2) ON CONFLICT DO NOTHING", [
				id,
				role,
			]);
		}
		for (let kind = 0; kind < 2; kind++) {
			for (let h = 1; h <= 3; h++) {
				const index = kind * 3 + h;
				const route = `d4150000-0000-4000-8300-${suffix(index)}`;
				const trip = `d4150000-0000-4000-8400-${suffix(index)}`;
				await m.query(
					"INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status) VALUES($1,$2,$3,ST_GeogFromText('LINESTRING(108.22 16.04,108.25 16.07)'),3000,$4,180,'active') ON CONFLICT(id) DO NOTHING",
					[
						route,
						hostId(h),
						kind ? "Hành trình khám phá thiên nhiên" : "Tuyến dã ngoại thư giãn",
						alternative ? (kind ? "hard" : "moderate") : kind ? "moderate" : "easy",
					]
				);
				await m.query(
					"INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,ST_GeogFromText('POINT(108.22 16.04)'),$9,1,$10,0,$11,'completed') ON CONFLICT(id) DO NOTHING",
					[
						trip,
						hostId(h),
						route,
						kind ? "Cắm trại giữa thiên nhiên" : "Dã ngoại cuối tuần",
						kind ? "overnight" : "day_trip",
						kind,
						`${month}-15T01:00:00Z`,
						`${month}-${kind ? "16" : "15"}T08:00:00Z`,
						`${month}-10T00:00:00Z`,
						planning && !kind ? 20 : 40,
						planning ? (kind ? 1200000 : 400000) : 0,
					]
				);
				if (planning) {
					await m.query("INSERT INTO trip_demand_contexts(trip_id,area_code) VALUES($1,$2)", [
						trip,
						kind ? "demo-highland" : "demo-lowland",
					]);
				}
				for (let c = h; c <= bookersPerGroup[kind]; c += 3) {
					await m.query(
						"INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status,created_at,completed_at,base_price,total_amount) VALUES($1,$2,$3,1,'completed',$6,$4,$5,$7,$7) ON CONFLICT(id) DO NOTHING",
						[
							`d4150000-0000-4000-8500-${suffix(kind * (varied ? 100 : 12) + c)}`,
							trip,
							camperId(c),
							`${month}-05T00:00:00Z`,
							`${month}-17T00:00:00Z`,
							planning ? "paid" : "not_required",
							planning ? (kind ? 1200000 : 400000) : 0,
						]
					);
					if (planning) {
						// Explicit synthetic historical fixture, never inferred from real legacy Bookings.
						await m.query(
							"INSERT INTO booking_demand_snapshots(booking_id,trip_type,difficulty,price_band,capacity_band,duration_band,area_code) VALUES($1,$2,$3,$4,$5,$6,$7)",
							[
								`d4150000-0000-4000-8500-${suffix(kind * (varied ? 100 : 12) + c)}`,
								kind ? "overnight" : "day_trip",
								alternative ? (kind ? "hard" : "moderate") : kind ? "moderate" : "easy",
								kind ? "1m_plus" : "under_500k",
								kind ? "21_to_40" : "11_to_20",
								kind ? "one_night" : "day",
								kind ? "demo-highland" : "demo-lowland",
							]
						);
					}
				}
			}
		}
	});
	console.log(
		`[seed:demand] Ensured synthetic Booking sources for ${month}: two taxonomy cells with ${bookersPerGroup.join(" / ")} distinct bookers and three Hosts per cell. No AI report was seeded.`
	);
}

/** Host 1 Trips moved to real Đà Nẵng places (CTMS-110); old titles stay listed for cleanup. */
function daNangMove(from: string): (typeof DA_NANG_TRIP_MOVES)[number] {
	const move = DA_NANG_TRIP_MOVES.find((item) => item.from === from);
	if (!move) throw new Error(`Missing Đà Nẵng mapping for ${from}`);
	return move;
}

export const SEED_PERF_TRIP_TITLES = [
	...DA_NANG_TRIP_MOVES.map((move) => move.title),
	"Trekking Tà Năng - Phan Dũng (Lâm Đồng)",
	"Chinh phục đỉnh Fansipan 3N2Đ Chạm Đỉnh Mây (Lào Cai)",
	"Cung đường săn mây Tà Xùa (Sơn La)",
	"Khám phá Rừng Tràm Trà Sư (An Giang)",
	"Thám hiểm Thác Bản Giốc & Pác Bó (Cao Bằng)",
	"Chinh phục đỉnh Bidoup Núi Bà (Lâm Đồng)",
	"Bạch Mộc Lương Tử Expedition (Lai Châu)",
	"Săn mây Y Tý - Bát Xát (Lào Cai)",
	"Trekking Mù Cang Chải mùa vàng (Yên Bái)",
	"Khám phá VQG Cát Tiên (Đồng Nai)",
];

/**
 * CTMS-101: Seed realistic performance reporting scenarios
 * (trips, bookings, settlements across multiple hosts & provinces).
 */
export async function seedPerformanceReportsScenarios(ds: DataSource = dataSource): Promise<void> {
	if (!ds.isInitialized) {
		await ds.initialize();
	}
	console.log("[seed:performance-reports] Seeding CTMS-101 demo data...");

	// 1. Get host accounts: host@ctms.local and ensure a second host for cross-host testing
	const host1Rows = await ds.query('SELECT id FROM "users" WHERE email = $1 LIMIT 1', [
		"host@ctms.local",
	]);
	if (host1Rows.length === 0) {
		await seedDevHostAndRoute();
	}
	const host1Id = (
		await ds.query('SELECT id FROM "users" WHERE email = $1 LIMIT 1', ["host@ctms.local"])
	)[0].id;

	// Ensure Host 2
	let host2Rows = await ds.query('SELECT id FROM "users" WHERE email = $1 LIMIT 1', [
		"host2@ctms.local",
	]);
	if (host2Rows.length === 0) {
		const host2Password = await hash("Host2@123", 10);
		host2Rows = await ds.query(
			`INSERT INTO "users" (email, phone, password_hash, role, status, full_name)
			 VALUES ('host2@ctms.local', '0900000101', $1, 'host', 'active', 'Host Tây Bắc Trek') RETURNING id`,
			[host2Password]
		);
		await ds.query(
			'INSERT INTO "user_roles" (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
			[host2Rows[0].id, "host"]
		);
	}
	const host2Id = host2Rows[0].id;

	// Ensure Campers
	const camperRows = await ds.query(
		`SELECT id FROM "users" WHERE role = 'camper' OR email LIKE '%camper%' ORDER BY id LIMIT 10`
	);
	const camperIds: string[] =
		camperRows.length > 0 ? camperRows.map((r: { id: string }) => r.id) : [host1Id];

	// 2. Ensure Routes
	let route1Rows = await ds.query('SELECT id FROM "trekking_routes" WHERE name = $1 LIMIT 1', [
		"Cung đường Tà Năng - Phan Dũng",
	]);
	if (route1Rows.length === 0) {
		route1Rows = await ds.query(
			`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, 'Cung đường Tà Năng - Phan Dũng', 'Cung trekking đẹp nhất miền Nam tại Lâm Đồng', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.47 11.95)'), 18000, 'moderate', 360, 'active')
			 RETURNING id`,
			[host1Id]
		);
	}
	const route1Id = route1Rows[0].id;

	let route2Rows = await ds.query('SELECT id FROM "trekking_routes" WHERE name = $1 LIMIT 1', [
		"Cung đường Fansipan Trạm Tôn",
	]);
	if (route2Rows.length === 0) {
		route2Rows = await ds.query(
			`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, 'Cung đường Fansipan Trạm Tôn', 'Chinh phục Nóc nhà Đông Dương tại Sa Pa, Lào Cai', ST_GeogFromText('SRID=4326;LINESTRING(103.78 22.33, 103.77 22.30)'), 12000, 'hard', 480, 'active')
			 RETURNING id`,
			[host2Id]
		);
	}
	const route2Id = route2Rows[0].id;

	// Host 1 Trips run on real Đà Nẵng routes; fall back to route 1 on a fresh database.
	const daNangRouteId = async (name: string): Promise<string> =>
		(
			(await ds.query('SELECT id FROM "trekking_routes" WHERE name = $1 LIMIT 1', [
				name,
			])) as Array<{
				id: string;
			}>
		)[0]?.id ?? route1Id;
	const hoaBacRouteId = await daNangRouteId("Khe Ram - Suối Mơ - Rừng Hòa Bắc");
	const baNaRouteId = await daNangRouteId("Rừng Nguyên Sinh Bà Nà - Núi Chúa");
	const sonTraRouteId = await daNangRouteId("Bán Đảo Sơn Trà Discovery");

	// 3. Clean up previously seeded CTMS-101 trips & bookings & settlements for idempotency
	const oldTrips = await ds.query('SELECT id FROM "trips" WHERE title = ANY($1)', [
		SEED_PERF_TRIP_TITLES,
	]);
	if (oldTrips.length > 0) {
		const oldIds = oldTrips.map((t: { id: string }) => t.id);
		await ds.query('DELETE FROM "settlements" WHERE trip_id = ANY($1)', [oldIds]);
		await ds.query('DELETE FROM "bookings" WHERE trip_id = ANY($1)', [oldIds]);
		await ds.query('DELETE FROM "trips" WHERE id = ANY($1)', [oldIds]);
	}

	// 4. Stagger AI review analysis demo bookings (older than 30 days) to prevent 64 zero-dollar bookings spike on a single day
	await ds.query(`
		UPDATE trips 
		SET created_at = now() - interval '45 days' 
		WHERE id::text LIKE 'd4120000-0000-4000-8004-%' AND created_at > now() - interval '30 days'
	`);
	await ds.query(`
		UPDATE bookings 
		SET created_at = now() - interval '40 days' 
		WHERE trip_id::text LIKE 'd4120000-0000-4000-8004-%' AND created_at > now() - interval '30 days'
	`);

	const meetingPoint = JSON.stringify({ type: "Point", coordinates: [108.2022, 16.0544] });

	interface SeedBookingItem {
		daysAgo: number;
		numPeople: number;
		status: "completed" | "confirmed" | "cancelled" | "pending_payment";
		paymentStatus: "paid" | "unpaid";
	}

	interface SeedTripConfig {
		hostId: string;
		routeId: string;
		title: string;
		description: string;
		tripType: string;
		durationNights: number;
		createdDaysAgo: number;
		startsDaysAgo: number;
		endsDaysAgo: number;
		deadlineDaysAgo: number;
		capacityMin: number;
		capacityMax: number;
		seatsTaken: number;
		pricePerPerson: number;
		status: "completed" | "ongoing" | "published";
		settlement?: {
			settledDaysAgo: number;
			base: number;
			fee: number;
			net: number;
		};
		bookings: SeedBookingItem[];
	}

	const tripConfigs: SeedTripConfig[] = [
		// Trip 1 (Host 1, Lâm Đồng)
		{
			hostId: host1Id,
			routeId: hoaBacRouteId,
			title: daNangMove("Trekking Tà Năng - Phan Dũng (Lâm Đồng)").title,
			description: daNangMove("Trekking Tà Năng - Phan Dũng (Lâm Đồng)").description,
			tripType: "overnight",
			durationNights: 2,
			createdDaysAgo: 28,
			startsDaysAgo: 14,
			endsDaysAgo: 12,
			deadlineDaysAgo: 16,
			capacityMin: 5,
			capacityMax: 20,
			seatsTaken: 16,
			pricePerPerson: 2000000,
			status: "completed",
			settlement: {
				settledDaysAgo: 10,
				base: 32000000,
				fee: 1600000,
				net: 30400000,
			},
			bookings: [
				{ daysAgo: 28, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 28, numPeople: 2, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 26, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 26, numPeople: 2, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 25, numPeople: 4, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 25, numPeople: 2, status: "cancelled", paymentStatus: "unpaid" },
				{ daysAgo: 23, numPeople: 2, status: "completed", paymentStatus: "paid" },
			],
		},
		// Trip 2 (Host 2, Lào Cai)
		{
			hostId: host2Id,
			routeId: route2Id,
			title: "Chinh phục đỉnh Fansipan 3N2Đ Chạm Đỉnh Mây (Lào Cai)",
			description: "Chinh phục Nóc nhà Đông Dương 3.143m ngắm trọn biển mây Tây Bắc.",
			tripType: "overnight",
			durationNights: 2,
			createdDaysAgo: 25,
			startsDaysAgo: 10,
			endsDaysAgo: 8,
			deadlineDaysAgo: 12,
			capacityMin: 5,
			capacityMax: 25,
			seatsTaken: 20,
			pricePerPerson: 2500000,
			status: "completed",
			settlement: {
				settledDaysAgo: 7,
				base: 50000000,
				fee: 2500000,
				net: 47500000,
			},
			bookings: [
				{ daysAgo: 25, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 25, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 23, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 23, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 23, numPeople: 2, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 22, numPeople: 4, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 22, numPeople: 2, status: "cancelled", paymentStatus: "unpaid" },
				{ daysAgo: 20, numPeople: 2, status: "completed", paymentStatus: "paid" },
			],
		},
		// Trip 3 (Host 2, Sơn La)
		{
			hostId: host2Id,
			routeId: route2Id,
			title: "Cung đường săn mây Tà Xùa (Sơn La)",
			description: "Check-in Sống lưng khủng long Háng Đồng và biển mây bồng bềnh nguyên sơ.",
			tripType: "overnight",
			durationNights: 2,
			createdDaysAgo: 22,
			startsDaysAgo: 8,
			endsDaysAgo: 6,
			deadlineDaysAgo: 10,
			capacityMin: 4,
			capacityMax: 16,
			seatsTaken: 13,
			pricePerPerson: 1800000,
			status: "completed",
			settlement: {
				settledDaysAgo: 5,
				base: 23400000,
				fee: 1170000,
				net: 22230000,
			},
			bookings: [
				{ daysAgo: 22, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 22, numPeople: 2, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 20, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 20, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 19, numPeople: 2, status: "completed", paymentStatus: "paid" },
			],
		},
		// Trip 4 (Host 1, An Giang)
		{
			hostId: host1Id,
			routeId: hoaBacRouteId,
			title: daNangMove("Khám phá Rừng Tràm Trà Sư (An Giang)").title,
			description: daNangMove("Khám phá Rừng Tràm Trà Sư (An Giang)").description,
			tripType: "day_trip",
			durationNights: 0,
			createdDaysAgo: 19,
			startsDaysAgo: 6,
			endsDaysAgo: 4,
			deadlineDaysAgo: 8,
			capacityMin: 5,
			capacityMax: 20,
			seatsTaken: 15,
			pricePerPerson: 1500000,
			status: "completed",
			settlement: {
				settledDaysAgo: 3,
				base: 22500000,
				fee: 1125000,
				net: 21375000,
			},
			bookings: [
				{ daysAgo: 19, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 19, numPeople: 2, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 17, numPeople: 5, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 17, numPeople: 1, status: "cancelled", paymentStatus: "unpaid" },
				{ daysAgo: 16, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 16, numPeople: 2, status: "completed", paymentStatus: "paid" },
			],
		},
		// Trip 5 (Host 2, Cao Bằng)
		{
			hostId: host2Id,
			routeId: route2Id,
			title: "Thám hiểm Thác Bản Giốc & Pác Bó (Cao Bằng)",
			description:
				"Chiêm ngưỡng thác nước tự nhiên đẹp nhất Việt Nam và dòng suối Lê-nin xanh ngọc.",
			tripType: "overnight",
			durationNights: 2,
			createdDaysAgo: 16,
			startsDaysAgo: 4,
			endsDaysAgo: 2,
			deadlineDaysAgo: 6,
			capacityMin: 4,
			capacityMax: 18,
			seatsTaken: 14,
			pricePerPerson: 2200000,
			status: "completed",
			settlement: {
				settledDaysAgo: 1,
				base: 30800000,
				fee: 1540000,
				net: 29260000,
			},
			bookings: [
				{ daysAgo: 16, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 16, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 14, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 14, numPeople: 3, status: "completed", paymentStatus: "paid" },
				{ daysAgo: 12, numPeople: 2, status: "completed", paymentStatus: "paid" },
			],
		},
		// Trip 6 (Host 1, Lâm Đồng)
		{
			hostId: host1Id,
			routeId: baNaRouteId,
			title: daNangMove("Chinh phục đỉnh Bidoup Núi Bà (Lâm Đồng)").title,
			description: daNangMove("Chinh phục đỉnh Bidoup Núi Bà (Lâm Đồng)").description,
			tripType: "overnight",
			durationNights: 2,
			createdDaysAgo: 12,
			startsDaysAgo: 1,
			endsDaysAgo: -1,
			deadlineDaysAgo: 3,
			capacityMin: 5,
			capacityMax: 18,
			seatsTaken: 14,
			pricePerPerson: 2400000,
			status: "ongoing",
			bookings: [
				{ daysAgo: 12, numPeople: 3, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 12, numPeople: 2, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 10, numPeople: 5, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 10, numPeople: 2, status: "cancelled", paymentStatus: "unpaid" },
				{ daysAgo: 9, numPeople: 2, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 9, numPeople: 2, status: "confirmed", paymentStatus: "paid" },
			],
		},
		// Trip 7 (Host 2, Lai Châu)
		{
			hostId: host2Id,
			routeId: route2Id,
			title: "Bạch Mộc Lương Tử Expedition (Lai Châu)",
			description: "Kỳ vĩ đồi Muối và biển mây ngút ngàn trên độ cao 3.046m.",
			tripType: "overnight",
			durationNights: 2,
			createdDaysAgo: 9,
			startsDaysAgo: 0,
			endsDaysAgo: -2,
			deadlineDaysAgo: 2,
			capacityMin: 4,
			capacityMax: 15,
			seatsTaken: 12,
			pricePerPerson: 2800000,
			status: "ongoing",
			bookings: [
				{ daysAgo: 9, numPeople: 3, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 9, numPeople: 2, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 7, numPeople: 4, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 7, numPeople: 3, status: "confirmed", paymentStatus: "paid" },
			],
		},
		// Trip 8 (Host 2, Lào Cai)
		{
			hostId: host2Id,
			routeId: route2Id,
			title: "Săn mây Y Tý - Bát Xát (Lào Cai)",
			description: "Cung đường ruộng bậc thang và biển mây ngút ngàn Lào Cai.",
			tripType: "overnight",
			durationNights: 2,
			createdDaysAgo: 7,
			startsDaysAgo: -5,
			endsDaysAgo: -7,
			deadlineDaysAgo: -3,
			capacityMin: 4,
			capacityMax: 16,
			seatsTaken: 10,
			pricePerPerson: 2000000,
			status: "published",
			bookings: [
				{ daysAgo: 7, numPeople: 3, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 7, numPeople: 2, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 5, numPeople: 3, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 5, numPeople: 1, status: "cancelled", paymentStatus: "unpaid" },
				{ daysAgo: 4, numPeople: 2, status: "confirmed", paymentStatus: "paid" },
			],
		},
		// Trip 9 (Host 2, Yên Bái)
		{
			hostId: host2Id,
			routeId: route2Id,
			title: "Trekking Mù Cang Chải mùa vàng (Yên Bái)",
			description: "Ngắm những triền ruộng bậc thang La Pán Tẩn rực rỡ sắc vàng Tây Bắc.",
			tripType: "overnight",
			durationNights: 2,
			createdDaysAgo: 4,
			startsDaysAgo: -8,
			endsDaysAgo: -10,
			deadlineDaysAgo: -5,
			capacityMin: 5,
			capacityMax: 20,
			seatsTaken: 12,
			pricePerPerson: 1900000,
			status: "published",
			bookings: [
				{ daysAgo: 4, numPeople: 3, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 4, numPeople: 2, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 2, numPeople: 4, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 2, numPeople: 3, status: "pending_payment", paymentStatus: "unpaid" },
			],
		},
		// Trip 10 (Host 1, Đồng Nai)
		{
			hostId: host1Id,
			routeId: sonTraRouteId,
			title: daNangMove("Khám phá VQG Cát Tiên (Đồng Nai)").title,
			description: daNangMove("Khám phá VQG Cát Tiên (Đồng Nai)").description,
			tripType: "day_trip",
			durationNights: 0,
			createdDaysAgo: 2,
			startsDaysAgo: -12,
			endsDaysAgo: -13,
			deadlineDaysAgo: -8,
			capacityMin: 4,
			capacityMax: 15,
			seatsTaken: 8,
			pricePerPerson: 1600000,
			status: "published",
			bookings: [
				{ daysAgo: 2, numPeople: 3, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 2, numPeople: 2, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 1, numPeople: 2, status: "confirmed", paymentStatus: "paid" },
				{ daysAgo: 1, numPeople: 1, status: "pending_payment", paymentStatus: "unpaid" },
			],
		},
	];

	let camperIndex = 0;
	let totalBookingsCreated = 0;

	for (const config of tripConfigs) {
		const tripRes = await ds.query(
			`INSERT INTO "trips" (
				host_id, route_id, title, description, trip_type, duration_nights,
				starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max,
				seats_taken, price_per_person, status, created_at
			) VALUES (
				$1, $2, $3, $4, $5, $6,
				now() - ($7 || ' days')::interval, now() - ($8 || ' days')::interval,
				ST_SetSRID(ST_GeomFromGeoJSON($9), 4326)::geography, now() - ($10 || ' days')::interval,
				$11, $12, $13, $14, $15, now() - ($16 || ' days')::interval
			) RETURNING id`,
			[
				config.hostId,
				config.routeId,
				config.title,
				config.description,
				config.tripType,
				config.durationNights,
				config.startsDaysAgo,
				config.endsDaysAgo,
				meetingPoint,
				config.deadlineDaysAgo,
				config.capacityMin,
				config.capacityMax,
				config.seatsTaken,
				config.pricePerPerson.toFixed(2),
				config.status,
				config.createdDaysAgo,
			]
		);
		const tripId = tripRes[0].id;

		// Insert bookings
		for (const b of config.bookings) {
			const camperId = camperIds[camperIndex % camperIds.length];
			camperIndex++;
			const totalAmount = (b.numPeople * config.pricePerPerson).toFixed(2);
			const holdExpiry = b.status === "pending_payment" ? "now() + interval '15 minutes'" : "null";

			await ds.query(
				`INSERT INTO "bookings" (
					trip_id, user_id, num_people, status, payment_status, total_amount, hold_expires_at, created_at
				) VALUES (
					$1, $2, $3, $4, $5, $6, ${holdExpiry}, now() - ($7 || ' days')::interval
				)`,
				[tripId, camperId, b.numPeople, b.status, b.paymentStatus, totalAmount, b.daysAgo]
			);
			totalBookingsCreated++;
		}

		// Insert settlement if trip completed and settled
		if (config.settlement) {
			await ds.query(
				`INSERT INTO "settlements" (
					trip_id, host_id, settlement_base, commission_rate, platform_fee, net_amount, settled_at, created_at, updated_at
				) VALUES (
					$1, $2, $3, '0.0500', $4, $5, now() - ($6 || ' days')::interval, now() - ($6 || ' days')::interval, now() - ($6 || ' days')::interval
				)`,
				[
					tripId,
					config.hostId,
					config.settlement.base.toFixed(2),
					config.settlement.fee.toFixed(2),
					config.settlement.net.toFixed(2),
					config.settlement.settledDaysAgo,
				]
			);
		}
	}

	// CTMS-110: recreated Trips get their Đà Nẵng area snapshot straight away.
	await backfillTripAreaSnapshots(ds);

	console.log(
		`[seed:performance-reports] ✅ Seeded ${tripConfigs.length} demo trips with ${totalBookingsCreated} bookings & settlements across 18 dates.`
	);
}
function recoveryDemoCore(): PackageCore {
	return {
		tripId: "trip",
		routeId: "route",
		status: TripStatus.PUBLISHED,
		tripType: TripType.DAY_TRIP,
		startsAt: "2026-12-01T01:00:00.000Z",
		endsAt: "2026-12-01T10:00:00.000Z",
		geometry: {
			type: "LineString",
			coordinates: [
				[108, 16],
				[108.01, 16.01],
			],
		},
		checkpoints: [
			{
				id: "checkpoint",
				routeId: "route",
				name: "Fictional checkpoint",
				type: CheckpointType.REST,
				location: { type: "Point", coordinates: [108, 16] },
				radiusMeters: 30,
				expectedArrivalOffset: 10,
				instructions: "Fictional instructions",
				routePosition: 0.5,
			},
		],
		waypoints: [WaypointType.START, WaypointType.FINISH].map((type, index) => ({
			id: `waypoint-${index}`,
			checkpointId: null,
			type,
			name: "Fictional waypoint",
			location: { type: "Point", coordinates: [108 + index * 0.01, 16 + index * 0.01] },
			dayNumber: 1,
			sequenceOrder: index,
			plannedAt: index ? "2026-12-01T10:00:00.000Z" : "2026-12-01T01:00:00.000Z",
			durationMinutes: 0,
		})),
	};
}

/** Opt-in additive UI demo. Never resets accounts or calls the destructive master seed. */
type RecoveryDemoMode = boolean | { screenshotRun: number; departureDue?: boolean };
function recoveryDemoTripId(mode: RecoveryDemoMode): string {
	if (mode && (process.env.CTMS306_DEMO_SEED !== "1" || process.env.NODE_ENV === "production"))
		throw new Error("CTMS-306 demo seed requires CTMS306_DEMO_SEED=1 outside production");
	if (typeof mode === "object") {
		if (!Number.isInteger(mode.screenshotRun) || mode.screenshotRun < 1 || mode.screenshotRun > 99)
			throw new Error("Screenshot run must be an explicit integer from 1 to 99");
		return `306de000-0000-4000-8000-${String(mode.screenshotRun * 10 + 1).padStart(12, "0")}`;
	}
	return mode ? "306de000-0000-4000-8000-000000000001" : "316de000-0000-4000-8000-000000000001";
}
/** Opt-in setup for the existing demo only; never clears shared development data. */
export async function seedPackagePolicyDemo(
	db: DataSource,
	readableDemo: RecoveryDemoMode = false
): Promise<void> {
	if (process.env.NODE_ENV === "production") throw new Error("Demo setup forbidden in production");
	await db.transaction(async (manager) => {
		const tripId = recoveryDemoTripId(readableDemo);
		const [trip] = (await manager.query("SELECT title,status FROM trips WHERE id=$1 FOR UPDATE", [
			tripId,
		])) as Array<{ title: string; status: string }>;
		if (
			!(
				trip?.title.startsWith(readableDemo ? "[DEMO CTMS-306]" : "[DEMO CTMS-316]") ||
				(readableDemo && trip?.title === "Sơn Trà – Hành trình ven biển")
			) ||
			trip.status !== "published"
		)
			throw new Error("Requires the existing published recovery demo");
		const [porter] = (await manager.query(
			"SELECT id FROM users WHERE email='porter@ctms.local' AND status='active' AND role='porter'"
		)) as Array<{ id: string }>;
		if (!porter) throw new Error("Existing demo Porter account required");
		const [pkg] = (await manager.query(
			"SELECT id FROM offline_packages WHERE trip_id=$1 ORDER BY package_version DESC LIMIT 1",
			[tripId]
		)) as Array<{ id: string }>;
		if (!pkg) throw new Error("Existing demo package required");
		await manager.query(
			"INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned') ON CONFLICT(trip_id,porter_id) DO NOTHING",
			[tripId, porter.id]
		);
		await manager.query(
			"INSERT INTO offline_package_requirements(trip_id,package_id) VALUES($1,$2) ON CONFLICT(trip_id) DO NOTHING",
			[tripId, pkg.id]
		);
	});
	console.log(
		"[seed:package-policy] Existing demo assignment/requirement ensured; no source approval or Trip lifecycle change."
	);
}

/** Explicitly labelled evidence fixture, not the approved safety-package pipeline. */
export async function seedPackagePolicyVersion(
	db: DataSource,
	version: number,
	required = true,
	readableDemo: RecoveryDemoMode = false
): Promise<void> {
	if (process.env.NODE_ENV === "production" || ![2, 3, 4].includes(version))
		throw new Error("Only demo evidence versions 2-4 are supported outside production");
	await db.transaction(async (m) => {
		const tripId = recoveryDemoTripId(readableDemo);
		const [trip] = (await m.query("SELECT title,status FROM trips WHERE id=$1 FOR UPDATE", [
			tripId,
		])) as Array<{ title: string; status: string }>;
		if (
			!(
				trip?.title.startsWith(readableDemo ? "[DEMO CTMS-306]" : "[DEMO CTMS-316]") ||
				(readableDemo && trip?.title === "Sơn Trà – Hành trình ven biển")
			) ||
			trip.status !== "published"
		)
			throw new Error("Requires existing published demo; does not bypass ongoing locks");
		const [existing] = (await m.query(
			"SELECT id FROM offline_packages WHERE trip_id=$1 AND package_version=$2",
			[tripId, version]
		)) as Array<{ id: string }>;
		if (existing) {
			console.log(`[seed:package-policy] Demo v${version} already exists; unchanged.`);
			return;
		}
		const core = await new PackageCoreReader().read(m, tripId);
		const safety: PackageSafetyInputs = {
			revision: `demo-evidence-v${version}-no-safety-advice`,
			blockers: [],
			conditionEvidence: [],
			feeds: [],
			hazards: [],
			guidance: [],
			policy: {
				version: "DEMO-NOT-APPROVED",
				approvalId: "DEMO-NOT-FOR-NAVIGATION",
				requiredGovernmentSources: [],
				baselineTopics: [],
				conditionTopics: [],
				hazardTopics: [],
				requiredConditions: [],
				requireCheckpoints: true,
				requiredWaypointTypes: [WaypointType.START, WaypointType.FINISH],
			},
		};
		const builder = new PackageArtifactBuilder();
		const artifact = builder.build(
			{
				core,
				safety,
				nextVersion: version,
				coreFingerprint: digest(canonical(core)),
				sourceFingerprint: sourceFingerprint(safety),
			},
			new TripSafetyContextResolver().resolve(core, safety),
			[],
			[],
			new Date().toISOString()
		);
		builder.verify(artifact.bytes, artifact.manifest);
		await new LocalPackageArtifactStorage().put(`${artifact.sha256}.zip`, artifact.bytes);
		const id = randomUUID();
		await m.query(
			`INSERT INTO offline_packages(id,trip_id,package_version,generation_key,schema_version,manifest,provenance,sha256,size_bytes,artifact_key,generated_at)
		 VALUES($1,$2,$3,$4,1,$5,$6,$4,$7,$8,$9)`,
			[
				id,
				tripId,
				version,
				artifact.sha256,
				artifact.manifest,
				{ testFixture: true, source: "CTMS-306 DEMO EVIDENCE ONLY; not approved safety pipeline" },
				artifact.bytes.length,
				`${artifact.sha256}.zip`,
				artifact.manifest.generatedAt,
			]
		);
		if (required)
			await m.query(
				"UPDATE offline_package_requirements SET package_id=$2,required_at=now(),last_checked_at=NULL,last_reason_code=NULL WHERE trip_id=$1",
				[tripId, id]
			);
		console.log(
			`[seed:package-policy] Demo v${version} created (required=${required}); source freshness remains unknown.`
		);
	});
}

/** Manual ongoing fixture only: NOT evidence of a successful departure gate. */
export async function seedPackagePolicyOngoing(
	db: DataSource,
	readableDemo: RecoveryDemoMode = false
): Promise<void> {
	if (process.env.NODE_ENV === "production") throw new Error("Fixture forbidden in production");
	await db.transaction(async (m) => {
		const tripId = recoveryDemoTripId(readableDemo);
		const [trip] = (await m.query("SELECT title,status FROM trips WHERE id=$1 FOR UPDATE", [
			tripId,
		])) as Array<{ title: string; status: string }>;
		if (
			!(
				trip?.title.startsWith(readableDemo ? "[DEMO CTMS-306]" : "[DEMO CTMS-316]") ||
				(readableDemo && trip?.title === "Sơn Trà – Hành trình ven biển")
			) ||
			!["published", "ongoing"].includes(trip.status)
		)
			throw new Error("Unexpected demo state");
		const [report] = (await m.query(
			`SELECT r.user_id,r.device_id,r.package_id FROM offline_package_device_reports r
		 JOIN offline_packages p ON p.id=r.package_id JOIN users u ON u.id=r.user_id
		 JOIN trip_porters tp ON tp.trip_id=r.trip_id AND tp.porter_id=r.user_id AND tp.status='assigned'
		 WHERE r.trip_id=$1 AND p.package_version=3 AND r.status='active' AND u.email='porter@ctms.local'
		 ORDER BY r.activated_at DESC LIMIT 1`,
			[tripId]
		)) as Array<{ user_id: string; device_id: string; package_id: string }>;
		if (!report) throw new Error("Real Porter device report for active demo v3 required");
		const newer = await m.query(
			"SELECT id FROM offline_packages WHERE trip_id=$1 AND package_version=4",
			[tripId]
		);
		if (!newer.length) throw new Error("Publish optional demo v4 first");
		await m.query(
			`INSERT INTO offline_package_departures(trip_id,user_id,device_id,package_id,locked_at)
		 VALUES($1,$2,$3,$4,now()) ON CONFLICT(trip_id) DO NOTHING`,
			[tripId, report.user_id, report.device_id, report.package_id]
		);
		const [lock] = (await m.query(
			"SELECT package_id,locked_at FROM offline_package_departures WHERE trip_id=$1",
			[tripId]
		)) as Array<{ package_id: string; locked_at: Date | null }>;
		if (lock.package_id !== report.package_id || !lock.locked_at)
			throw new Error("Conflicting demo lock; not overwritten");
		await m.query(
			"UPDATE trips SET status='ongoing',starts_at=LEAST(starts_at,now()-interval '1 minute'),ends_at=GREATEST(ends_at,now()+interval '1 day'),updated_at=now() WHERE id=$1",
			[tripId]
		);
	});
	console.log(
		"[seed:package-policy] MANUAL ONGOING FIXTURE: v3 locked, v4 optional; no source approval, NOT a successful departure-gate test."
	);
}

export async function seedRouteRecoveryDemo(
	db: DataSource,
	readableDemo: RecoveryDemoMode = false
): Promise<void> {
	if (process.env.NODE_ENV === "production")
		throw new Error("Demo seed is forbidden in production");
	if (
		process.argv.includes("--fresh") ||
		process.argv.includes("--clean") ||
		process.env.SEED_FRESH === "true"
	)
		throw new Error("Recovery demo must not run with destructive seed flags");
	if (!db.isInitialized) await db.initialize();
	const tripId = recoveryDemoTripId(readableDemo);
	const demoPrefix = readableDemo ? "[DEMO CTMS-306]" : "[DEMO CTMS-316]";
	const rows: Array<{ id: string; title: string; host_id: string; route_id: string }> =
		await db.query("SELECT id,title,host_id,route_id FROM trips WHERE id=$1", [tripId]);
	if (rows.length) {
		if (
			!rows[0].title.startsWith(demoPrefix) &&
			!(readableDemo && rows[0].title === "Sơn Trà – Hành trình ven biển")
		)
			throw new Error("Demo identity collision; refusing to modify existing Trip");
		const [metadata] = (await db.query(
			"SELECT * FROM offline_packages WHERE trip_id=$1 ORDER BY package_version DESC LIMIT 1",
			[tripId]
		)) as PackageMetadata[];
		if (!metadata) throw new Error("Demo package missing; refusing to replace existing data");
		const bytes = await new LocalPackageArtifactStorage().read(
			metadata.artifact_key,
			metadata.sha256,
			Number(metadata.size_bytes)
		);
		readVerifiedPackageRoute(bytes, metadata);
		const checkpoints = await db.query(
			"SELECT id,ST_Y(location::geometry) AS latitude,ST_X(location::geometry) AS longitude FROM checkpoints WHERE route_id=$1 ORDER BY route_position",
			[rows[0].route_id]
		);
		await new CheckpointArrivalsRepository(db).registerActivePackage({
			tripId,
			routeId: rows[0].route_id,
			routeVersion: metadata.manifest.route?.fingerprint ?? "",
			packageId: metadata.id,
			packageVersion: String(metadata.package_version),
			checkpoints,
		});
		if (
			process.argv.includes("--route-recovery-start") ||
			process.argv.includes("--route-recovery-prepare")
		) {
			const start = process.argv.includes("--route-recovery-start");
			await db.query(
				"UPDATE trips SET status=$2::trip_status,starts_at=now()+make_interval(mins=>$3),ends_at=now()+interval '7 days',booking_deadline=now()-interval '1 day',updated_at=now() WHERE id=$1",
				[tripId, start ? "ongoing" : "published", start ? -1 : 60]
			);
		}
		console.log(
			"[seed:recovery] Demo already exists; accounts, package and visits retained",
			tripId
		);
		return;
	}
	if (process.argv.includes("--route-recovery-start"))
		throw new Error("Create and download the demo package before starting the Trip");
	const [camperRow] = (await db.query(
		"SELECT id FROM users WHERE email=$1 AND role='camper' AND status='active'",
		[process.env.RECOVERY_DEMO_CAMPER_EMAIL ?? "camper@ctms.local"]
	)) as Array<{ id: string }>;
	const [hostRow] = (await db.query(
		"SELECT id FROM users WHERE email=$1 AND role='host' AND status='active'",
		[process.env.RECOVERY_DEMO_HOST_EMAIL ?? "host@ctms.local"]
	)) as Array<{ id: string }>;
	if (!camperRow || !hostRow)
		throw new Error("Existing active Camper and Host required; no accounts will be created");
	const camper = camperRow.id;
	const host = hostRow.id;
	const booking = randomUUID();
	const core = recoveryDemoCore();
	core.tripId = tripId;
	core.routeId = `${tripId.slice(0, -1)}2`;
	core.startsAt = new Date(
		Date.now() + (typeof readableDemo === "object" && readableDemo.departureDue ? -60000 : 3600000)
	).toISOString();
	core.endsAt = new Date(Date.now() + 7 * 86400000).toISOString();
	core.geometry = {
		type: "LineString",
		coordinates: [
			[108.2754, 16.1002],
			[108.277, 16.101],
			[108.278, 16.1025],
			[108.28, 16.103],
			[108.282, 16.102],
			[108.284, 16.1038],
		],
	};
	core.checkpoints = [0, 2, 5].map((index, order) => ({
		id: randomUUID(),
		routeId: core.routeId,
		name: readableDemo
			? [
					"Điểm tập trung ven biển (Mẫu)",
					"Điểm nghỉ giữa tuyến (Mẫu)",
					"Điểm kết thúc hành trình (Mẫu)",
				][order]
			: `[TEST] Trạm ${order + 1}`,
		type:
			order === 0
				? CheckpointType.START
				: order === 2
					? CheckpointType.FINISH
					: CheckpointType.REST,
		location: { type: "Point" as const, coordinates: core.geometry.coordinates[index] },
		radiusMeters: 30,
		expectedArrivalOffset: order * 30,
		instructions: readableDemo
			? [
					"Đối chiếu danh sách thành viên và thống nhất lịch trình với người hỗ trợ. Đây là điểm mẫu để thử giao diện, không dùng dẫn đường thực tế.",
					"Điểm dừng mẫu để xem mô tả và khoảng cách. Thời gian nghỉ do người phụ trách chuyến thống nhất.",
					"Điểm kết thúc mẫu để kiểm tra danh sách điểm dừng. Xác nhận đủ thành viên theo quy trình của chuyến.",
				][order]
			: "Test fixture only; not real navigation data.",
		routePosition: order / 2,
	}));
	core.waypoints = core.waypoints.map((w, index) => ({
		...w,
		id: randomUUID(),
		location: { type: "Point", coordinates: core.geometry.coordinates[index === 0 ? 0 : 5] },
		plannedAt: index === 0 ? core.startsAt : core.endsAt,
	}));
	const safety: PackageSafetyInputs = {
		revision: "demo-only-no-safety-advice",
		blockers: [],
		conditionEvidence: [],
		feeds: [],
		hazards: [],
		guidance: [],
		policy: {
			version: "DEMO-NOT-APPROVED",
			approvalId: "DEMO-NOT-FOR-NAVIGATION",
			requiredGovernmentSources: [],
			baselineTopics: [],
			conditionTopics: [],
			hazardTopics: [],
			requiredConditions: [],
			requireCheckpoints: true,
			requiredWaypointTypes: [WaypointType.START, WaypointType.FINISH],
		},
	};
	const builder = new PackageArtifactBuilder();
	const artifact = builder.build(
		{
			core,
			safety,
			nextVersion: 1,
			coreFingerprint: digest(canonical(core)),
			sourceFingerprint: sourceFingerprint(safety),
		},
		new TripSafetyContextResolver().resolve(core, safety),
		[],
		safety.guidance,
		new Date().toISOString()
	);
	const packageId = randomUUID();
	const metadata: PackageMetadata = {
		id: packageId,
		trip_id: core.tripId,
		package_version: 1,
		generation_key: artifact.sha256,
		schema_version: 1,
		manifest: artifact.manifest,
		sha256: artifact.sha256,
		size_bytes: artifact.bytes.length,
		artifact_key: `${artifact.sha256}.zip`,
		generated_at: new Date(artifact.manifest.generatedAt),
	};
	builder.verify(artifact.bytes, metadata.manifest);
	readVerifiedPackageRoute(artifact.bytes, metadata);
	const storage = new LocalPackageArtifactStorage();
	await storage.put(metadata.artifact_key, artifact.bytes);

	await db.transaction(async (manager) => {
		await manager.query(
			`INSERT INTO trekking_routes(id,host_id,name,description,route_geom,length_meters,difficulty,expected_duration_minutes,status)
        VALUES($1,$2,'[DEMO CTMS-316] Sơn Trà','Fictional test route; not for real navigation',ST_GeomFromGeoJSON($3)::geography,1500,'easy',120,'active')`,
			[core.routeId, host, JSON.stringify(core.geometry)]
		);
		await manager.query(
			`INSERT INTO trips(id,host_id,route_id,title,description,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,price_per_person,status)
        VALUES($1,$2,$3,'[DEMO CTMS-316] Sơn Trà - Quay lại tuyến','Synthetic UI demo; no safety guidance or live hazard sources; not for real navigation','day_trip',0,$4,$5,ST_GeomFromGeoJSON($6)::geography,($4::timestamptz - interval '1 day'),1,10,0,'published')`,
			[
				core.tripId,
				host,
				core.routeId,
				core.startsAt,
				core.endsAt,
				JSON.stringify({ type: "Point", coordinates: core.geometry.coordinates[0] }),
			]
		);
		for (const cp of core.checkpoints)
			await manager.query(
				`INSERT INTO checkpoints(id,route_id,name,location,radius_m,type,expected_arrival_offset,instructions,nearby_water_or_shelter,route_position)
        VALUES($1,$2,$3,ST_GeomFromGeoJSON($4)::geography,$5,$6,$7,$8,false,$9)`,
				[
					cp.id,
					cp.routeId,
					cp.name,
					JSON.stringify(cp.location),
					cp.radiusMeters,
					cp.type,
					cp.expectedArrivalOffset,
					cp.instructions,
					cp.routePosition,
				]
			);
		await manager.query(
			`INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status,trip_starts_at_snapshot,trip_ends_at_snapshot,base_price,total_amount)
        VALUES($1,$2,$3,1,'confirmed','paid',$4,$5,0,0)`,
			[booking, core.tripId, camper, core.startsAt, core.endsAt]
		);
		await manager.query(
			`INSERT INTO booking_members(booking_id,user_id,is_primary,member_status,checked_in_at) VALUES($1,$2,true,'joined',$3)`,
			[booking, camper, new Date()]
		);
		await manager.query(
			`INSERT INTO offline_packages(id,trip_id,package_version,generation_key,schema_version,manifest,provenance,sha256,size_bytes,artifact_key,generated_at)
        VALUES($1,$2,1,$3,1,$4,$5,$6,$7,$8,$9)`,
			[
				packageId,
				core.tripId,
				metadata.generation_key,
				metadata.manifest,
				{ testFixture: true, source: "DEMO ONLY; builder-generated; not approved safety pipeline" },
				artifact.sha256,
				artifact.bytes.length,
				metadata.artifact_key,
				metadata.generated_at,
			]
		);
	});
	if (readableDemo) {
		await db.transaction(async (m) => {
			await m.query(
				"UPDATE trips SET title='Sơn Trà – Hành trình ven biển',description='Dữ liệu mẫu thử giao diện; không dùng dẫn đường hay hướng dẫn an toàn thực tế.' WHERE id=$1",
				[tripId]
			);
			await m.query("UPDATE trekking_routes SET name='Sơn Trà – Tuyến ven biển' WHERE id=$1", [
				core.routeId,
			]);
			await m.query(
				"INSERT INTO trip_porters(trip_id,porter_id,status) SELECT $1,id,'assigned' FROM users WHERE email='porter@ctms.local' AND role='porter' AND status='active' ON CONFLICT(trip_id,porter_id) DO NOTHING",
				[tripId]
			);
		});
	}
	await new CheckpointArrivalsRepository(db).registerActivePackage({
		tripId: core.tripId,
		routeId: core.routeId,
		routeVersion: artifact.manifest.route.fingerprint,
		packageId,
		packageVersion: "1",
		checkpoints: core.checkpoints.map((cp) => ({
			id: cp.id,
			latitude: cp.location.coordinates[1],
			longitude: cp.location.coordinates[0],
		})),
	});

	console.log(
		"[seed:recovery] Created DEMO package; no safety guidance. Download before starting Trip:",
		tripId
	);
	console.log(
		"[seed:recovery] Generate the basemap with the existing offline basemap worker after requesting the package metadata."
	);
}

/** CTMS-370: refresh only the existing Host monitoring fixture, retaining source history. */
/** Opt-in local monitoring fixture reusing existing accounts and preserving existing transactions. */
export async function seedHostMonitoringGroup(ds: DataSource): Promise<void> {
	if (!ds.isInitialized) await ds.initialize();
	await ds.transaction(async (manager) => {
		const [source] = await manager.query<
			Array<{ hostId: string; routeId: string; porterId: string }>
		>(`
 SELECT t.host_id AS "hostId",t.route_id AS "routeId",p.porter_id AS "porterId"
 FROM trips t JOIN users u ON u.id=t.host_id JOIN trip_porters p ON p.trip_id=t.id AND p.status='assigned'
 WHERE u.email='host@ctms.local' AND t.title='Chinh phục đèo Hải Vân' LIMIT 1`);
		if (!source) throw new Error("Existing Host monitoring Trip and assigned Porter are required");
		const accounts = await manager.query<Array<{ id: string; name: string }>>(`
 SELECT id,full_name AS name FROM users WHERE role='camper'
 AND (email='camper@ctms.local' OR full_name ~ '^Camper Demo [0-9]+$'
 OR id IN (SELECT user_id FROM booking_members WHERE booking_id=md5('ctms-370-group-booking')::uuid))
 ORDER BY (email='camper@ctms.local') DESC,id LIMIT 24`);
		if (accounts.length !== 24) throw new Error("24 existing Camper accounts are required");
		const names = [
			"Nguyễn Văn An",
			"Trần Quốc Huy",
			"Lê Thanh Mai",
			"Phạm Thanh Bình",
			"Nguyễn Minh Anh",
			"Đặng Ngọc Lan",
			"Võ Hoàng Nam",
			"Bùi Thu Hà",
			"Đỗ Minh Khang",
			"Hồ Phương Thảo",
			"Ngô Đức Anh",
			"Dương Thị Hương",
			"Lý Quang Huy",
			"Phan Bảo Ngọc",
			"Trịnh Hải Đăng",
			"Mai Khánh Linh",
			"Đinh Tuấn Kiệt",
			"Tạ Minh Châu",
			"Cao Thanh Tùng",
			"Lương Ngọc Ánh",
			"Vũ Gia Bảo",
			"Đoàn Thảo Nguyên",
			"Trương Hoài An",
			"Huỳnh Bích Trâm",
		];
		for (const [index, account] of accounts.entries()) {
			await manager.query(
				"UPDATE users SET full_name=$2 WHERE id=$1 AND full_name ~ '^Camper Demo [0-9]+$'",
				[account.id, names[index]]
			);
		}
		const [trip] = await manager.query<Array<{ id: string }>>(
			`
 INSERT INTO trips(id,host_id,route_id,title,description,trip_type,duration_nights,starts_at,ends_at,
 meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
 SELECT md5('ctms-370-group-trip')::uuid,$1,$2,'Hành trình xanh Hải Vân',
 'Cùng khám phá đèo Hải Vân và thu gom rác dọc tuyến, góp phần giữ gìn cảnh quan thiên nhiên.',
 'day_trip',0,now()-interval '1 hour',now()+interval '6 hours',
 ST_StartPoint(r.route_geom::geometry)::geography,now()-interval '2 hours',1,30,24,0,'ongoing'
 FROM trekking_routes r WHERE r.id=$2
 ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description RETURNING id`,
			[source.hostId, source.routeId]
		);
		await manager.query(
			`INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status,base_price,total_amount)
 VALUES(md5('ctms-370-group-booking')::uuid,$1,$2,24,'confirmed','not_required',0,0)
 ON CONFLICT(id) DO NOTHING`,
			[trip.id, accounts[0].id]
		);
		await manager.query(
			`INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned') ON CONFLICT DO NOTHING`,
			[trip.id, source.porterId]
		);
		for (const [index, account] of accounts.entries()) {
			await manager.query(
				`INSERT INTO booking_members(id,booking_id,user_id,is_primary,member_status,checked_in_at)
 VALUES(md5('ctms-370-group-member:' || $1::text)::uuid,md5('ctms-370-group-booking')::uuid,$1::uuid,$2,'joined',now()-interval '1 hour')
 ON CONFLICT(id) DO NOTHING`,
				[account.id, index === 0]
			);
		}
		const positioned = [
			...accounts.slice(0, 23).map((account) => ({ id: account.id, role: "camper" })),
			{ id: source.porterId, role: "porter" },
		];
		for (const [index, person] of positioned.entries()) {
			await manager.query(
				`INSERT INTO gps_logs(id,trip_id,user_id,participant_role,event_time,location,accuracy_meters,config_version,received_at)
 SELECT md5('ctms-370-group-gps:' || $1::text || ':' || $2::text)::uuid,$1::uuid,$2::uuid,$3::gps_participant_role,
 now()-make_interval(secs=>$4),ST_LineInterpolatePoint(r.route_geom::geometry,$5)::geography,5,'v3',now()
 FROM trekking_routes r WHERE r.id=$6
 ON CONFLICT(id) DO UPDATE SET event_time=EXCLUDED.event_time,received_at=EXCLUDED.received_at`,
				[
					trip.id,
					person.id,
					person.role,
					index === 23 ? 1200 : 30,
					index < 18 ? 0.35 : 0.55,
					source.routeId,
				]
			);
		}
	});
	console.log("[seed:host-monitoring] Existing-account group Trip prepared");
}

export async function seedHostTripMonitoring(ds: DataSource = dataSource): Promise<void> {
	if (!ds.isInitialized) await ds.initialize();
	await ds.transaction(async (manager) => {
		const trips = await manager.query<Array<{ id: string; routeId: string }>>(
			`SELECT t.id,t.route_id AS "routeId" FROM trips t JOIN users u ON u.id=t.host_id
			 JOIN trekking_routes r ON r.id=t.route_id
			 WHERE u.email='host@ctms.local' AND t.status='ongoing'
			 AND t.title IN ('Trekking Sơn Trà Hoàn Thành - Demo Khiếu Nại','Chinh phục đèo Hải Vân')
			 AND r.name='Hải Vân Pass - Nam Hải Vân Trail' ORDER BY t.id LIMIT 1`
		);
		const trip = trips[0];
		if (!trip) throw new Error("Existing Host monitoring Trip is required");
		await manager.query("UPDATE trips SET title='Chinh phục đèo Hải Vân' WHERE id=$1", [trip.id]);
		await manager.query(
			`UPDATE trips SET title=CASE title
 WHEN '[DEMO CTMS-316] Sơn Trà - Quay lại tuyến' THEN 'Khám phá cung đường Sơn Trà'
 WHEN 'Sơn Trà - Nền mới' THEN 'Khám phá đỉnh Bàn Cờ' END
 WHERE host_id=(SELECT host_id FROM trips WHERE id=$1)
 AND title IN ('[DEMO CTMS-316] Sơn Trà - Quay lại tuyến','Sơn Trà - Nền mới')`,
			[trip.id]
		);
		const participants = await manager.query<Array<{ userId: string; role: string }>>(
			`SELECT DISTINCT m.user_id AS "userId",'camper' AS role FROM booking_members m
			 JOIN bookings b ON b.id=m.booking_id JOIN users u ON u.id=m.user_id
			 WHERE b.trip_id=$1 AND m.member_status='joined'
			 AND b.status IN ('confirmed','completed') AND u.email='camper@ctms.local'
			 UNION ALL SELECT porter_id,'porter' FROM trip_porters WHERE trip_id=$1 AND status='assigned'`,
			[trip.id]
		);
		if (participants.length === 0) throw new Error("Existing monitoring participants are required");
		for (const participant of participants) {
			const isCamper = participant.role === "camper";
			const farLocation = isCamper && process.argv.includes("--host-monitoring-far-location");
			const ageSeconds = isCamper ? 30 : 1200;
			const fraction = isCamper ? 0.35 : 0.55;
			for (let sample = 0; sample < 3; sample++) {
				await manager.query(
					`INSERT INTO gps_logs(id,trip_id,user_id,participant_role,event_time,location,
					 accuracy_meters,config_version,received_at)
					 SELECT md5('ctms-370-gps:' || $1::text || ':' || $2::text || ':' || $3::text || ':' || $6::text)::uuid,
					 $1::uuid,$2::uuid,$3::gps_participant_role,now()-($4::int+(2-$6::int)*10)*interval '1 second',
					 CASE WHEN $8::boolean THEN ST_SetSRID(ST_MakePoint(-122.084,37.4219983),4326)::geography
					 ELSE ST_LineInterpolatePoint(r.route_geom::geometry,$5::double precision)::geography END,5,'v3',now()
					 FROM trekking_routes r WHERE r.id=$7
					 ON CONFLICT(id) DO UPDATE SET event_time=EXCLUDED.event_time,location=EXCLUDED.location,
					 accuracy_meters=EXCLUDED.accuracy_meters,received_at=EXCLUDED.received_at`,
					[
						trip.id,
						participant.userId,
						participant.role,
						ageSeconds,
						fraction,
						sample,
						trip.routeId,
						farLocation,
					]
				);
			}
			if (isCamper) {
				await manager.query(
					`INSERT INTO safety_events(id,trip_id,user_id,participant_role,event_type,event_time,
					 location,accuracy_meters,distance_to_route_meters,consecutive_valid_samples,
					 route_id,route_version,config_version,received_at)
					 SELECT md5((CASE WHEN $4::boolean THEN 'ctms-370-far:' ELSE 'ctms-370-recovery:' END) || $1::text || ':' || $2::text)::uuid,
					 $1::uuid,$2::uuid,'camper',
					 CASE WHEN $4::boolean THEN 'OFF_ROUTE'::safety_event_type ELSE 'ON_ROUTE_RECOVERED'::safety_event_type END,
					 now()-interval '30 seconds',g.location,5,ST_Distance(g.location,r.route_geom),3,r.id,
					 COALESCE((SELECT route_version FROM safety_events WHERE trip_id=$1::uuid AND route_id=r.id
					 ORDER BY event_time DESC LIMIT 1),'v3'),'v3',now()
					 FROM trekking_routes r CROSS JOIN LATERAL (
					 SELECT CASE WHEN $4::boolean THEN ST_SetSRID(ST_MakePoint(-122.084,37.4219983),4326)::geography
					 ELSE ST_LineInterpolatePoint(r.route_geom::geometry,0.35)::geography END AS location
					 ) g WHERE r.id=$3
					 ON CONFLICT(id) DO UPDATE SET event_time=EXCLUDED.event_time,received_at=EXCLUDED.received_at`,
					[trip.id, participant.userId, trip.routeId, farLocation]
				);
			}
		}
	});
	console.log("[seed:host-monitoring] Existing Trip locations refreshed");
}

/** Opt-in operational alerts, sourced from GPS and Porter confirmations rather than warning rows. */
export async function seedHostMonitoringAlerts(ds: DataSource): Promise<void> {
	await ds.transaction(async (manager) => {
		const [trip] = await manager.query<Array<{ id: string; routeId: string; porterId: string }>>(`
 SELECT t.id,t.route_id AS "routeId",p.porter_id AS "porterId" FROM trips t
 JOIN trip_porters p ON p.trip_id=t.id AND p.status='assigned'
 WHERE t.id=md5('ctms-370-group-trip')::uuid AND t.status='ongoing' LIMIT 1`);
		if (!trip) throw new Error("Existing ongoing group Trip is required for alerts");
		const members = await manager.query<Array<{ id: string; userId: string }>>(`
 SELECT m.id,m.user_id AS "userId" FROM booking_members m JOIN users u ON u.id=m.user_id
 WHERE m.booking_id=md5('ctms-370-group-booking')::uuid AND m.member_status='joined'
 ORDER BY (u.email='camper@ctms.local') DESC,u.id`);
		const checkpoints = await manager.query<Array<{ id: string; fraction: number }>>(
			`
 SELECT c.id,ST_LineLocatePoint(r.route_geom::geometry,c.location::geometry) AS fraction
 FROM checkpoints c JOIN trekking_routes r ON r.id=c.route_id WHERE r.id=$1
 ORDER BY fraction DESC LIMIT 2`,
			[trip.routeId]
		);
		if (members.length < 3 || checkpoints.length !== 2 || Number(checkpoints[1].fraction) <= 0.55)
			throw new Error("Existing group members and two later Route checkpoints are required");
		const [finish, reference] = checkpoints;
		for (const [checkpoint, age] of [
			[reference, 65],
			[finish, 40],
		] as const) {
			await manager.query(
				`
 INSERT INTO checkpoint_visits(id,trip_id,checkpoint_id,member_id,confirmed_by_id,arrived_at,location)
 SELECT md5('ctms-374-visit:' || $1::text || ':' || $2::text)::uuid,$1::uuid,$2::uuid,$3::uuid,$4::uuid,
 now()-make_interval(mins=>$5::int),location FROM checkpoints WHERE id=$2::uuid
 ON CONFLICT(id) DO UPDATE SET arrived_at=EXCLUDED.arrived_at`,
				[trip.id, checkpoint.id, members[0].id, trip.porterId, age]
			);
		}
		for (const [index, member] of members.slice(0, 3).entries()) {
			const fraction =
				index === 0
					? 0.35
					: index === 1
						? (Number(reference.fraction) + Number(finish.fraction)) / 2
						: 1;
			await manager.query(
				`
 INSERT INTO gps_logs(id,trip_id,user_id,participant_role,event_time,location,accuracy_meters,config_version,received_at)
 SELECT md5('ctms-374-gps:' || $1::text || ':' || $2::text)::uuid,$1::uuid,$2::uuid,'camper',now()-interval '30 seconds',
 CASE WHEN $4::boolean THEN ST_Project(ST_LineInterpolatePoint(r.route_geom::geometry,$3)::geography,120,pi()/2)
 ELSE ST_LineInterpolatePoint(r.route_geom::geometry,$3)::geography END,5,'v3',now()
 FROM trekking_routes r WHERE r.id=$5
 ON CONFLICT(id) DO UPDATE SET event_time=EXCLUDED.event_time,location=EXCLUDED.location,received_at=EXCLUDED.received_at`,
				[trip.id, member.userId, fraction, index === 0, trip.routeId]
			);
			if (index === 1) continue;
			for (const recovered of index === 2 ? [false, true] : [false]) {
				await manager.query(
					`
 INSERT INTO safety_events(id,trip_id,user_id,participant_role,event_type,event_time,location,
 accuracy_meters,distance_to_route_meters,consecutive_valid_samples,route_id,route_version,config_version,received_at)
 SELECT md5('ctms-374-route:' || $1::text || ':' || $2::text || ':' || $3::text)::uuid,$1::uuid,$2::uuid,'camper',
 CASE WHEN $3::boolean THEN 'ON_ROUTE_RECOVERED'::safety_event_type ELSE 'OFF_ROUTE'::safety_event_type END,
 now()-make_interval(secs=>CASE WHEN $3::boolean THEN 30 ELSE 90 END),g.location,5,
 CASE WHEN $3::boolean THEN 0 ELSE 120 END,3,r.id,md5(ST_AsBinary(r.route_geom)),'v3',now()
 FROM trekking_routes r JOIN gps_logs g ON g.id=md5('ctms-374-gps:' || $1::text || ':' || $2::text)::uuid WHERE r.id=$4
 ON CONFLICT(id) DO UPDATE SET event_time=EXCLUDED.event_time,location=EXCLUDED.location,received_at=EXCLUDED.received_at`,
					[trip.id, member.userId, recovered, trip.routeId]
				);
			}
		}
	});
	console.log("[seed:host-monitoring] GPS, recovery and Porter checkpoint confirmations prepared");
}

/** CTMS-380: additive inbox scenarios using the existing primary Host/Admin accounts. */
export async function seedInAppNotificationScenarios(ds: DataSource = dataSource): Promise<void> {
	if (!ds.isInitialized) await ds.initialize();
	const notices = new InAppNotificationsService(ds);
	const titles = [
		"Bình minh trên đèo Hải Vân",
		"Hải Vân – Cung đường ven núi",
		"Hải Vân – Mùa cỏ lau",
		"Hải Vân – Khám phá rừng xanh",
		"Hải Vân – Ngắm vịnh từ trên cao",
		"Hải Vân – Hành trình trong mây",
		"Hải Vân – Dấu chân bên sườn núi",
		"Hải Vân – Đón nắng đầu ngày",
		"Hải Vân – Gió biển và rừng núi",
		"Hải Vân – Cuối tuần giữa thiên nhiên",
		"Hải Vân – Con đường qua triền dốc",
		"Hải Vân – Khám phá đỉnh đèo",
		"Hải Vân – Sắc xanh mùa mới",
		"Hải Vân – Hẹn cùng bình minh",
		"Hải Vân – Về phía biển",
		"Hải Vân – Lắng nghe núi rừng",
		"Hải Vân – Ngày mới trên đỉnh núi",
		"Hải Vân – Bước qua rừng già",
		"Hải Vân – Dọc theo mây trắng",
		"Hải Vân – Vịnh xanh dưới chân đèo",
		"Hải Vân – Ngắm biển mùa thu",
		"Hải Vân – Nắng sớm bên đường mòn",
		"Hải Vân – Hành trình đón gió",
		"Hải Vân – Hoàng hôn trên sườn núi",
		"Hải Vân – Buổi sáng giữa tầng mây",
	];
	await ds.transaction(async (manager) => {
		const actors: { id: string; email: string }[] = await manager.query(
			"SELECT id,email FROM users WHERE email = ANY($1) AND status = 'active'",
			[["host@ctms.local", "admin@ctms.local"]]
		);
		const host = actors.find((actor) => actor.email === "host@ctms.local");
		const admin = actors.find((actor) => actor.email === "admin@ctms.local");
		if (!host || !admin) throw new Error("Primary Host and Admin seed accounts are required");
		const routes: { id: string }[] = await manager.query(
			`SELECT id FROM trekking_routes WHERE host_id = $1 AND status = 'active'
			 AND (name ILIKE '%Hải Vân%' OR name ILIKE '%Hai Van%') ORDER BY created_at LIMIT 1`,
			[host.id]
		);
		if (!routes[0])
			throw new Error("An existing active Hai Van Route owned by the primary Host is required");
		await manager.query(
			`UPDATE users SET full_name = CASE WHEN id = $1 THEN 'Nguyễn Thị Mai' ELSE 'Nguyễn Minh Anh' END
			WHERE (id = $1 AND full_name = 'Host Ban Mai') OR (id = $2 AND full_name = 'Administrator')`,
			[host.id, admin.id]
		);
		for (const [index, title] of titles.entries()) {
			// Keep scenario identities stable when adding a new submission for realtime verification.
			const rejected = index === 23;
			const reminder = index === 22;
			const submittedAt = new Date(
				Date.now() - (rejected ? 25 * 60 : reminder ? 23 * 60 + 20 : index * 5) * 60_000
			);
			const startsAt = new Date();
			startsAt.setDate(startsAt.getDate() + 14 + index);
			startsAt.setHours(7, 0, 0, 0);
			const endsAt = new Date(startsAt.getTime() + 8 * 60 * 60_000);
			const key = `ctms-380-trip:${index}`;
			// Stable RFC-4122 version/variant bits are required by the public UUID validators.
			const seedId =
				"(substr(md5($1),1,12)||'4'||substr(md5($1),14,3)||'8'||substr(md5($1),18))::uuid";
			const oldRows: { id: string }[] = await manager.query(
				`SELECT id FROM trips
				WHERE id=md5($1)::uuid AND id<>${seedId} AND host_id=$2`,
				[key, host.id]
			);
			for (const old of oldRows) {
				const protectedRows: { id: string }[] = await manager.query(
					`SELECT id FROM trips WHERE id=$1 AND
					(updated_at<>created_at OR title<>$2 OR status NOT IN ('pending_approval','rejected')
					 OR EXISTS(SELECT 1 FROM bookings WHERE trip_id=$1))`,
					[old.id, title]
				);
				if (protectedRows.length)
					throw new Error("An earlier inbox fixture has user changes; refusing to replace it");
				// Only untouched rows created by this fixture are repaired; operational Trips are never selected.
				await manager.query("DELETE FROM in_app_notifications WHERE trip_id=$1", [old.id]);
				await manager.query("DELETE FROM audit_logs WHERE target_type='trip' AND target_id=$1", [
					old.id,
				]);
				await manager.query("DELETE FROM trips WHERE id=$1", [old.id]);
			}
			const inserted: { id: string }[] = await manager.query(
				`INSERT INTO trips
				(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,meeting_at,
				 booking_deadline,capacity_min,capacity_max,price_per_person,status,created_at,updated_at)
				SELECT ${seedId},$2,r.id,$3,'day_trip',0,$4,$5,ST_StartPoint(r.route_geom::geometry)::geography,
				$4::timestamptz-interval '30 minutes',$4::timestamptz-interval '2 days',2,20,350000,
				$6::trip_status,$7,$7 FROM trekking_routes r WHERE r.id=$8 ON CONFLICT(id) DO NOTHING RETURNING id`,
				[
					key,
					host.id,
					title,
					startsAt,
					endsAt,
					rejected ? TripStatus.REJECTED : TripStatus.PENDING_APPROVAL,
					submittedAt,
					routes[0].id,
				]
			);
			const trips: { id: string; status: string; updatedAt: Date }[] = await manager.query(
				`SELECT id,status,updated_at AS "updatedAt" FROM trips WHERE id=${seedId}`,
				[key]
			);
			const trip = trips[0];
			// Preserve all existing user decisions, dates, prices, and read state on reruns.
			if (inserted.length === 0) continue;
			await manager.query(
				`INSERT INTO trip_waypoints(id,trip_id,type,name,location,day_number,sequence_order,planned_at)
				SELECT md5($1||':start')::uuid,$2::uuid,'start'::waypoint_type,'Điểm tập trung chân đèo',ST_StartPoint(r.route_geom::geometry)::geography,1,1,$3::timestamptz
				FROM trekking_routes r WHERE r.id=$5
				UNION ALL SELECT md5($1||':finish')::uuid,$2::uuid,'finish'::waypoint_type,'Điểm kết thúc hành trình',ST_EndPoint(r.route_geom::geometry)::geography,1,2,$4::timestamptz
				FROM trekking_routes r WHERE r.id=$5`,
				[key, trip.id, startsAt, endsAt, routes[0].id]
			);
			await manager.query(
				`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,"before","after",reason,created_at)
				VALUES(md5($1||':submit')::uuid,$2,'trip.submitted_for_approval','trip',$3,
				'{"status":"draft"}'::jsonb,'{"status":"pending_approval"}'::jsonb,'Chủ chuyến gửi lịch trình để xét duyệt.',$4)`,
				[key, host.id, trip.id, submittedAt]
			);
			const type = rejected
				? InAppNotificationType.AUTO_REJECTED
				: reminder
					? InAppNotificationType.REVIEW_REMINDER
					: InAppNotificationType.REVIEW_REQUESTED;
			await notices.enqueueTripReview(
				manager,
				trip.id,
				type,
				trip.updatedAt.toISOString(),
				reminder || rejected ? new Date() : submittedAt
			);
			if (reminder || rejected)
				await manager.query(
					`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,"before","after",reason)
				VALUES(md5($1||':outcome')::uuid,NULL,$2,'trip',$3,'{"status":"pending_approval"}'::jsonb,$4::jsonb,$5)`,
					[
						key,
						rejected ? "trip.auto_rejected" : "trip.review.reminder_sent",
						trip.id,
						JSON.stringify({ status: trip.status }),
						rejected
							? "Chuyến đi chưa được duyệt trong thời hạn 24 giờ."
							: "Lịch trình đang chờ xét duyệt trước khi hết hạn.",
					]
				);
			if (index === 0)
				await manager.query(
					"UPDATE in_app_notifications SET read_at=now() WHERE trip_id=$1 AND recipient_id=$2",
					[trip.id, admin.id]
				);
		}
		// Historical inbox records retain read state after their original Trip becomes unavailable.
		for (const actor of [host, admin]) {
			await manager.query(
				`DELETE FROM in_app_notifications WHERE recipient_id=$1
				AND id=md5('ctms-380-unavailable:'||$1::text)::uuid AND read_at IS NULL`,
				[actor.id]
			);
			await manager.query(
				`INSERT INTO in_app_notifications
			(id,recipient_id,trip_id,event_type,source_key,occurred_at)
			VALUES(uuid_generate_v4(),$1::uuid,NULL,$2,'ctms-380-unavailable:'||$1::text,now()-interval '1 hour')
			ON CONFLICT(source_key,recipient_id) DO NOTHING`,
				[
					actor.id,
					actor.id === host.id
						? InAppNotificationType.AUTO_REJECTED
						: InAppNotificationType.REVIEW_REQUESTED,
				]
			);
		}
	});
	console.log(
		"[seed:in-app-notifications] Existing primary accounts and additive inbox scenarios prepared"
	);
}

export async function runMasterSeed(): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[seed:master] Refusing to run seed script in production environment!");
	}
	const standaloneSeed = process.argv.includes("--financial-adjustments-only")
		? seedFinancialAdjustments
		: process.argv.includes("--bank-accounts-only")
			? seedUserBankAccounts
			: process.argv.includes("--group-bookings-only")
				? seedHostGroupBookingsWithEquipment
				: undefined;
	if (standaloneSeed) {
		try {
			await standaloneSeed();
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	if (process.argv.includes("--in-app-notifications-only")) {
		try {
			await seedInAppNotificationScenarios(dataSource);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	if (process.argv.includes("--host-monitoring-only")) {
		try {
			await seedHostTripMonitoring(dataSource);
			if (process.argv.includes("--host-monitoring-group"))
				await seedHostMonitoringGroup(dataSource);
			if (process.argv.includes("--host-monitoring-alerts"))
				await seedHostMonitoringAlerts(dataSource);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	if (process.argv.includes("--revenue-analytics-only")) {
		try {
			await seedRevenueAnalyticsScenarios(dataSource);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	if (process.argv.includes("--safety-hotspots-only")) {
		try {
			if (!dataSource.isInitialized) await dataSource.initialize();
			await seedSafetyHotspotScenarios(dataSource);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	if (process.argv.includes("--performance-reports-only")) {
		try {
			await seedPerformanceReportsScenarios(dataSource);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	if (
		process.argv.some((arg) =>
			["--route-recovery-only", "--route-recovery-start", "--route-recovery-prepare"].includes(arg)
		)
	) {
		try {
			await seedRouteRecoveryDemo(dataSource);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	if (process.argv.includes("--demand-insights-only")) {
		try {
			await seedDemandInsightScenarios(dataSource);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	if (
		process.argv.includes("--review-analysis-only") ||
		process.argv.includes("--review-analysis-vietnamese-only") ||
		process.argv.includes("--review-analysis-video-only")
	) {
		try {
			await seedReviewAnalysisScenarios(
				dataSource,
				process.argv.includes("--review-analysis-vietnamese-only"),
				process.argv.includes("--review-analysis-video-only") ? 2 : 1
			);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	if (
		process.argv.includes("--trip-reviews-only") ||
		process.argv.includes("--trip-review-titles-only")
	) {
		try {
			await seedTripReviewScenarios(dataSource, process.argv.includes("--trip-review-titles-only"));
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
		return;
	}
	const startTime = Date.now();
	const isFresh =
		process.argv.includes("--fresh") ||
		process.argv.includes("--clean") ||
		process.env.SEED_FRESH === "true";

	console.log("\n==========================================================================");
	console.log(
		`   🚀 STARTING CTMS MASTER DATABASE SEEDING ${isFresh ? "(FRESH / CLEAN WIPE)" : "(IDEMPOTENT MODE)"}`
	);
	console.log("==========================================================================\n");

	if (!dataSource.isInitialized) {
		console.log("🔌 Connecting to database...");
		await dataSource.initialize();
		console.log("✅ Database connected successfully.\n");
	}

	try {
		if (isFresh) {
			console.log("--------------------------------------------------------------------------");
			console.log("👉 [0/9] Wiping all database tables clean (--fresh mode)...");
			console.log("--------------------------------------------------------------------------");
			await cleanDatabase(dataSource);
			console.log("✅ Database wiped clean.\n");
		}

		// Step 1: Admin & Porter default accounts
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [1/9] Seeding Admin & Porter accounts...");
		console.log("--------------------------------------------------------------------------");
		await seedDevAdmin();
		console.log("✅ Step 1 completed.\n");

		// Step 2: Host & default trekking route
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [2/9] Seeding Host profile & baseline trekking route...");
		console.log("--------------------------------------------------------------------------");
		await seedDevHostAndRoute();
		console.log("✅ Step 2 completed.\n");

		// Step 3: Full Trips ecosystem (Catalogs, Equipment, Routes, Checkpoints, Danger Zones, Porters, Campers, Health & Contacts, Bookings, Diverse Statuses)
		console.log("--------------------------------------------------------------------------");
		console.log(
			"👉 [3/9] Seeding Trips ecosystem (Routes, Checkpoints, Danger Zones, Equipment, Porters, Health, Bookings & Statuses)..."
		);
		console.log("--------------------------------------------------------------------------");
		await seedDevTrips();
		await seedPorterLevelDemo();
		console.log("✅ Step 3 completed.\n");

		// Step 4: Weather Risk Assessment scenarios (Green / Red routes + Weather Advice)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [4/9] Seeding Weather Risk Scenarios (Green & Red routes + AI Advice)...");
		console.log("--------------------------------------------------------------------------");
		await seedWeatherRiskScenarios();
		console.log("✅ Step 4 completed.\n");

		// Step 5: Camper Refund Scenarios (Pre-trip cancellation, Post-completion complaint, Already refunded)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [5/9] Seeding Camper Refund & Dispute Scenarios...");
		console.log("--------------------------------------------------------------------------");
		const refundScenarios = await seedCamperRefunds();
		console.log("✅ Step 5 completed.\n");

		// Step 6: Settlements, Host Wallets & Payout Requests
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [6/9] Seeding Settlements, Host Wallets & Payout Requests...");
		console.log("--------------------------------------------------------------------------");
		await seedSettlementsAndPayouts();
		await seedFinancialAdjustments();
		// Weather decisions, notices and Host weather penalties (debits/refunds use the wallets above).
		await seedWeatherOperationsDemo();
		console.log("✅ Step 6 completed.\n");

		// Step 7: User Bank Accounts (Host & Camper)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [7/9] Seeding User Bank Accounts for Camper & Host...");
		console.log("--------------------------------------------------------------------------");
		await seedUserBankAccounts();
		console.log("✅ Step 7 completed.\n");

		// Step 8: Offline Device Telemetry & Sync Scenarios (CTMS-067)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [8/9] Seeding Offline Device Telemetry & Sync Scenarios (CTMS-067)...");
		console.log("--------------------------------------------------------------------------");
		await seedDeviceSyncTelemetry();
		console.log("✅ Step 8 completed.\n");

		// Step 9: Content Moderation Reports
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [9/9] Seeding Content Moderation Reports...");
		console.log("--------------------------------------------------------------------------");
		await seedContentReports();
		console.log("✅ Step 9 completed.\n");

		// Step 10: SOS & Emergency Alerts (CTMS-074, CTMS-077)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [10/10] Seeding SOS Emergency Alerts (CTMS-074, CTMS-077)...");
		console.log("--------------------------------------------------------------------------");
		await seedSosAlerts();
		console.log("✅ Step 10 completed.\n");
		// Step 11: Trip Incident Management Scenarios (CTMS-086)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [11/12] Seeding Trip Incident Management Scenarios (CTMS-086)...");
		console.log("--------------------------------------------------------------------------");
		const incidentScenarios = await seedManageTripIncidents();
		console.log("✅ Step 11 completed.\n");

		// Step 12: Trip Review Moderation & AI Analytics (CTMS-412)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [12/13] Seeding Trip Review Moderation & AI Analytics (CTMS-412)...");
		console.log("--------------------------------------------------------------------------");
		await seedReviewAnalysisScenarios(dataSource, false, 1);
		await seedReviewAnalysisScenarios(dataSource, false, 2);
		console.log("✅ Step 12 completed.\n");

		// Step 13: Performance Reports Scenarios (CTMS-101)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [13/13] Seeding Booking & Trip Performance Reports (CTMS-101)...");
		console.log("--------------------------------------------------------------------------");
		await seedPerformanceReportsScenarios(dataSource);
		console.log("✅ Step 13 completed.\n");

		// Step 14: Camper trip preferences for personalized recommendations (CTMS-106)
		console.log("👉 [14/14] Seeding Camper trip preferences (CTMS-106)...");
		await seedCamperTripPreferences(dataSource);
		console.log("✅ Step 14 completed.\n");

		// Step 15: Revenue analytics history and Trip area snapshots (CTMS-110). Runs after the
		// performance-report seed because that step recreates its own Trips.
		console.log("👉 [15/15] Seeding revenue analytics history and Trip areas (CTMS-110)...");
		await seedRevenueAnalyticsScenarios(dataSource);
		console.log("✅ Step 15 completed.\n");

		// Step 16: Safety hotspots on the Sơn Trà route (CTMS-116/117/118). Runs last so the
		// completed Trips and their members already exist.
		console.log("👉 [16/16] Seeding safety hotspots (CTMS-116/117/118)...");
		await seedSafetyHotspotScenarios(dataSource);
		console.log("✅ Step 16 completed.\n");

		const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

		console.log("==========================================================================");
		console.log(`🎉 ALL SEED DATA GENERATED SUCCESSFULLY IN ${elapsedSec}s!`);
		console.log("==========================================================================");
		console.log("\n📋 TÀI KHOẢN ĐĂNG NHẬP MẶC ĐỊNH (4 ROLE CHÍNH):");
		console.log(
			"┌──────────────┬──────────────────────┬─────────────┬────────────────────────────────────┐"
		);
		console.log(
			"│ Role         │ Email                │ Password    │ Full Name / Ghi chú                │"
		);
		console.log(
			"├──────────────┼──────────────────────┼─────────────┼────────────────────────────────────┤"
		);
		console.log(
			"│ Admin        │ admin@ctms.local     │ Admin@123   │ Quản trị viên hệ thống             │"
		);
		console.log(
			"│ Host         │ host@ctms.local      │ Host@123    │ Host Ban Mai (Tất cả tour, ví 3.8M)│"
		);
		console.log(
			"│ Porter       │ porter@ctms.local    │ Porter@123  │ Nguyễn Minh Sơn (chuyên gia Route) │"
		);
		console.log(
			"│ Camper       │ camper@ctms.local    │ Camper@123  │ Camper Nguyễn Văn An               │"
		);
		console.log(
			"└──────────────┴──────────────────────┴─────────────┴────────────────────────────────────┘"
		);

		console.log("\n🔗 CÁC KỊCH BẢN KIỂM THỬ SẴN SÀNG TRÊN HỆ THỐNG:");
		console.log("1. Quyết toán & Chi trả Host (Admin):");
		console.log("   👉 http://localhost:5173/admin/settlements");
		console.log("      - Chuyến đủ điều kiện quyết toán (Eligible > 72h)");
		console.log("      - Chuyến bị khóa giữ tiền (< 72h hold)");
		console.log("      - Chuyến bị giữ do khiếu nại (Dispute/Claim)");
		console.log("      - Duyệt/Từ chối yêu cầu rút tiền của Host (Payouts)");
		console.log("\n2. Ví & Rút tiền của Host (Host login: host@ctms.local):");
		console.log("   👉 http://localhost:5173/host/wallet");
		console.log("      - Xem số dư khả dụng (3.800.000 VNĐ), lịch sử biến động sổ cái");
		console.log("      - Thao tác rút toàn bộ số dư về tài khoản ngân hàng");
		console.log("\n3. Hoàn tiền & Khiếu nại của Camper (Camper login: camper@ctms.local):");
		console.log(
			`   👉 Pre-trip hủy trước khởi hành: http://localhost:5173/bookings/${refundScenarios.preTripBookingId}`
		);
		console.log(
			`   👉 Khiếu nại trong 24h sau chuyến: http://localhost:5173/bookings/${refundScenarios.completedBookingId}`
		);
		console.log(
			`   👉 Đã hoàn tiền xong:            http://localhost:5173/bookings/${refundScenarios.alreadyRefundedBookingId}`
		);
		console.log("\n4. Đánh giá rủi ro thời tiết & Lời khuyên AI (Weather Risk):");
		console.log("   👉 Tuyến Xanh: Cho phép đặt chỗ bình thường + Lời khuyên thời tiết");
		console.log("   👉 Tuyến Đỏ: Cảnh báo bão, tự động chặn đăng ký mới + Hướng dẫn khẩn cấp");
		console.log("\n5. Checkpoints & Vùng nguy hiểm trên Route (Trekking Routes):");
		console.log("   👉 Checkpoints trạm nghỉ, trạm cấp nước, điểm trú ẩn, xuất phát, về đích");
		console.log(
			"   👉 Vùng nguy hiểm (vách đá trơn, sạt lở, nước xoáy) với mức độ rủi ro (high/medium)"
		);
		console.log("\n6. Hệ sinh thái Porter & Hồ sơ Camper:");
		console.log(
			"   👉 Porter: hồ sơ đa dạng về availability, kinh nghiệm, qualification và xung đột lịch"
		);
		console.log(
			"   👉 Camper: Hồ sơ sức khỏe (nhóm máu O+, dị ứng, ăn chay) & Người liên hệ khẩn cấp"
		);
		console.log("\n7. Đa dạng trạng thái Vòng đời Tuyến & Chuyến đi:");
		console.log(
			"   👉 Trips: Published, Ongoing (chạy điểm danh/no-show), Pending Approval, Draft, Cancelled"
		);
		console.log(
			"   👉 Routes: Active, Pending Approval (chờ Admin duyệt), Closed (đóng do sạt lở)"
		);
		console.log("\n8. Tài khoản ngân hàng liên kết (User Bank Accounts):");
		console.log(
			"   👉 Host (host@ctms.local): Vietcombank 0123456789 (mặc định), MBBank 9876543210"
		);
		console.log(
			"   👉 Camper (camper@ctms.local): Vietcombank 1012345678 (mặc định), Techcombank 19034567890123"
		);
		console.log(
			"\n9. Đồng bộ thiết bị ngoại tuyến (CTMS-067 & CTMS-064 Offline Device Telemetry & Buffer):"
		);
		console.log("   👉 Completed Trip ID (CTMS-067 Sync): a1736fee-62be-4991-9478-a62288e9b80a");
		console.log(
			"   👉 Ongoing Trip ID (CTMS-064 Live Offline Buffer): c3958000-0064-4064-8064-000000000064"
		);
		console.log(
			"   👉 Camper (camper@ctms.local): Trạng thái JOINED, sẵn sàng kích hoạt live GPS tracking & local buffer"
		);
		console.log(
			"   👉 Porter (porter@ctms.local): Đã phân công (ASSIGNED), đủ điều kiện theo dõi tracking"
		);
		console.log("   👉 Web: http://localhost:5173/trips/c3958000-0064-4064-8064-000000000064");
		console.log("   👉 Mobile: http://localhost:50565/#/camper/overview");
		console.log("\n10. Báo cáo & Kiểm duyệt nội dung (Content Moderation Reports):");
		console.log("   👉 Admin: http://localhost:5173/admin/content-reports");
		console.log(
			"   👉 Đa dạng báo cáo chuyến đi & đánh giá (chờ duyệt, đang xử lý, đã xử lý, từ chối)"
		);
		console.log("\n11. Quản lý sự cố chuyến đi (CTMS-086 Manage Trip Incidents):");
		console.log("   👉 Host login: host@ctms.local / Host@123");
		console.log(
			"   👉 Đầy đủ 4 trạng thái sự cố: Mới báo cáo (open), Đang điều tra (investigating), Đã xử lý (resolved), Đã đóng (closed)"
		);
		console.log(
			"   👉 Phân công phụ trách (assigned_to) cho Porter / Host kèm lịch sử thao tác (incident_actions) và ghi chú."
		);
		if (incidentScenarios?.ongoingTripId) {
			console.log(
				`   👉 Web quản lý sự cố: http://localhost:5173/trips/${incidentScenarios.ongoingTripId}`
			);
		}

		console.log("\n12. Tiếp nhận & Đóng SOS cứu trợ (CTMS-80 Acknowledge and Close SOS):");
		console.log("   👉 Host login: host@ctms.local / Host@123");
		console.log("   👉 Trang Tổng quan Host: http://localhost:5173/host (Mục Yêu cầu cứu trợ)");
		console.log(
			"   👉 Alert 1 (ACTIVE): e0500000-0000-4000-8000-000000000001 -> Test bấm Tiếp nhận"
		);
		console.log(
			"   👉 Alert 2 (ACKNOWLEDGED): e0500000-0000-4000-8000-000000000002 -> Test bấm Đóng SOS kèm ghi chú"
		);
		console.log(
			"   👉 Alert 3 (CLOSED): e0500000-0000-4000-8000-000000000003 -> Trạng thái cuối, không mở lại"
		);
		console.log(
			"   👉 Alert 4 (CANCELLED): e0500000-0000-4000-8000-000000000004 -> Camper đã hủy (CTMS-077)\n"
		);
		console.log("\n13. Báo cáo hiệu suất hoạt động (CTMS-101 Booking & Trip Performance Reports):");
		console.log("   👉 Admin login: admin@ctms.local / Admin@123");
		console.log(
			"   👉 Trang báo cáo Admin: http://localhost:5173/admin/reports/performance (Toàn hệ thống)"
		);
		console.log("   👉 Host login: host@ctms.local / Host@123");
		console.log(
			"   👉 Trang báo cáo Host: http://localhost:5173/host/reports/performance (Phạm vi chuyến của bạn)\n"
		);
		console.log("==========================================================================\n");
	} catch (error) {
		console.error("\n❌ MASTER SEED ENCOUNTERED AN ERROR:", error);
		throw error;
	} finally {
		if (dataSource.isInitialized) {
			await dataSource.destroy();
			console.log("🔌 Database connection closed cleanly.");
		}
	}
}

// ==========================================================================
// WEATHER OPERATIONS & HOST WEATHER PENALTIES DEMO (CTMS-93/97/98/60/94/102/58/62)
// Every time is relative to the moment the seed runs, so "Trip leaves in 20 hours" stays true.
// Demo Trips start with "[Demo thời tiết]" / "[Demo phạt]"; re-running replaces them.
// ==========================================================================

const WEATHER_DEMO_PREFIXES = ["[Demo thời tiết]%", "[Demo phạt]%"];

const WEATHER_DEMO_HOSTS: SeedAccount[] = [
	{
		label: "host.blocked",
		email: "host.blocked@ctms.local",
		phone: "0900000091",
		password: "Host@123",
		role: "host",
		fullName: "Host Bị Khoá Tạo Trip",
	},
	{
		label: "host.suspended",
		email: "host.suspended@ctms.local",
		phone: "0900000092",
		password: "Host@123",
		role: "host",
		fullName: "Host Bị Đình Chỉ",
	},
];

type DemoRisk = "green" | "yellow" | "red";

const DEMO_READINGS: Record<
	DemoRisk,
	{
		rainfallMm: number;
		windKph: number;
		temperatureC: number;
		visibilityM: number;
		thunderstorm: boolean;
	}
> = {
	green: {
		rainfallMm: 1.2,
		windKph: 14,
		temperatureC: 27,
		visibilityM: 20000,
		thunderstorm: false,
	},
	yellow: { rainfallMm: 22, windKph: 46, temperatureC: 24, visibilityM: 4000, thunderstorm: false },
	red: { rainfallMm: 68, windKph: 78, temperatureC: 21, visibilityM: 800, thunderstorm: true },
};

const DEMO_ADVICE: Record<DemoRisk, { text: string; actions: string[] }> = {
	green: {
		text: "Thời tiết ngày đi thuận lợi, chỉ có mưa nhỏ rải rác.",
		actions: ["Mang áo mưa mỏng", "Uống đủ nước, đội mũ chống nắng"],
	},
	yellow: {
		text: "Có mưa vừa và gió khá mạnh trên đỉnh, đường có thể trơn.",
		actions: ["Mang giày chống trượt", "Theo dõi thông báo của Host trước giờ đi"],
	},
	red: {
		text: "Mưa lớn, gió mạnh và có dông sét: đi trong điều kiện này rất nguy hiểm.",
		actions: ["Cân nhắc dời hoặc huỷ chuyến", "Không lên đỉnh khi có dông sét"],
	},
};

function demoCriteria(risk: DemoRisk) {
	const r = DEMO_READINGS[risk];
	const level = (red: boolean, yellow: boolean): DemoRisk =>
		red ? "red" : yellow ? "yellow" : "green";
	const score = (l: DemoRisk) => (l === "red" ? 2 : l === "yellow" ? 1 : 0);
	const rainfall = level(r.rainfallMm >= 50, r.rainfallMm >= 10);
	const wind = level(r.windKph >= 70, r.windKph >= 40);
	const temperature: DemoRisk = "green";
	const visibility = level(r.visibilityM <= 1000, r.visibilityM <= 5000);
	const thunderstorm: DemoRisk = r.thunderstorm ? "red" : "green";
	return {
		rainfall: { value: r.rainfallMm, level: rainfall, weight: 0.3, score: score(rainfall) },
		wind: { value: r.windKph, level: wind, weight: 0.25, score: score(wind) },
		temperature: { value: r.temperatureC, level: temperature, weight: 0.15, score: 0 },
		visibility: { value: r.visibilityM, level: visibility, weight: 0.15, score: score(visibility) },
		thunderstorm: {
			value: r.thunderstorm,
			level: thunderstorm,
			weight: 0.15,
			score: score(thunderstorm),
		},
	};
}

const DEMO_COMPOSITE: Record<DemoRisk, number> = { green: 0.15, yellow: 0.95, red: 1.7 };

async function removeWeatherDemoData(): Promise<void> {
	const tripRows: Array<{ id: string }> = await dataSource.query(
		`SELECT "id" FROM "trips" WHERE "title" LIKE ANY($1::text[])`,
		[WEATHER_DEMO_PREFIXES]
	);
	const tripIds = tripRows.map((row) => row.id);
	if (tripIds.length === 0) return;
	const bookingIds = `SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1)`;
	await dataSource.query(`DELETE FROM "payments" WHERE "booking_id" IN (${bookingIds})`, [tripIds]);
	await dataSource.query(`DELETE FROM "booking_members" WHERE "booking_id" IN (${bookingIds})`, [
		tripIds,
	]);
	await dataSource.query(`DELETE FROM "bookings" WHERE "trip_id" = ANY($1)`, [tripIds]);
	await dataSource.query(`DELETE FROM "wallet_transactions" WHERE "trip_id" = ANY($1)`, [tripIds]);
	await dataSource.query(`DELETE FROM "host_weather_penalties" WHERE "trip_id" = ANY($1)`, [
		tripIds,
	]);
	await dataSource.query(`DELETE FROM "trip_weather_decision_alerts" WHERE "trip_id" = ANY($1)`, [
		tripIds,
	]);
	await dataSource.query(`DELETE FROM "trip_weather_decisions" WHERE "trip_id" = ANY($1)`, [
		tripIds,
	]);
	await dataSource.query(`DELETE FROM "trip_weather_change_notices" WHERE "trip_id" = ANY($1)`, [
		tripIds,
	]);
	await dataSource.query(`DELETE FROM "trip_weather_forecasts" WHERE "trip_id" = ANY($1)`, [
		tripIds,
	]);
	await dataSource.query(
		`DELETE FROM "audit_logs" WHERE "target_type" = 'trip' AND "target_id" = ANY($1)`,
		[tripIds]
	);
	await dataSource.query(`DELETE FROM "trips" WHERE "id" = ANY($1)`, [tripIds]);
}

/**
 * Seeds one scenario per weather / penalty screen so each can be tested right after `pnpm seed`:
 * forecasts for the Trip dates, change notices, near-departure decisions and reminders, Admin
 * interventions and pause, a weather reschedule waiting for the Camper, and Host penalties in
 * every state (with wallet debits/refunds). Accounts: admin/host/camper@ctms.local plus
 * host.blocked@ / host.suspended@ctms.local (password Host@123).
 */
export async function seedWeatherOperationsDemo(): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[seed:weather-demo] Refusing to run with NODE_ENV=production.");
	}
	if (!dataSource.isInitialized) await dataSource.initialize();
	console.log("[seed:weather-demo] Seeding weather decisions, notices and Host penalties...");

	for (const account of WEATHER_DEMO_HOSTS) await seedAccount(account);
	const userId = async (email: string): Promise<string> => {
		const rows: Array<{ id: string }> = await dataSource.query(
			`SELECT "id" FROM "users" WHERE "email" = $1`,
			[email]
		);
		if (!rows[0]) throw new Error(`[seed:weather-demo] Missing seed account ${email}`);
		return rows[0].id;
	};
	const adminId = await userId("admin@ctms.local");
	const hostId = await userId("host@ctms.local");
	const camperId = await userId("camper@ctms.local");
	const blockedHostId = await userId("host.blocked@ctms.local");
	const suspendedHostId = await userId("host.suspended@ctms.local");

	const ruleRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "weather_risk_rules" ORDER BY "is_active" DESC, "created_at" DESC LIMIT 1'
	);
	if (!ruleRows[0])
		throw new Error("[seed:weather-demo] No weather risk rule; run the weather step first");
	const ruleId = ruleRows[0].id;
	const routeRows: Array<{ id: string }> = await dataSource.query(
		`SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1 AND "status" = 'active' ORDER BY "created_at" LIMIT 1`,
		[hostId]
	);
	if (!routeRows[0]) throw new Error("[seed:weather-demo] host@ctms.local has no active route");
	const routeId = routeRows[0].id;

	await removeWeatherDemoData();

	const HOUR = 3600_000;
	const now = Date.now();
	const at = (hoursFromNow: number) => new Date(now + hoursFromNow * HOUR);

	const createTrip = async (input: {
		title: string;
		host: string;
		startsInHours: number;
		status?: string;
		pausedHoursAgo?: number;
		price?: number;
	}): Promise<{ id: string; title: string; startsAt: Date; endsAt: Date }> => {
		const startsAt = at(input.startsInHours);
		const endsAt = new Date(startsAt.getTime() + 9 * HOUR);
		const rows: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "trips" (
				host_id, route_id, title, description, trip_type, duration_nights, starts_at, ends_at,
				meeting_point, booking_deadline, capacity_min, capacity_max, seats_taken, price_per_person,
				status, weather_paused_at
			) VALUES (
				$1, $2, $3, 'Dữ liệu mẫu để test luồng thời tiết và phạt Host.', 'day_trip', 0, $4, $5,
				ST_GeogFromText('SRID=4326;POINT(108.2208 16.0471)'), $6, 1, 15, 0, $7, $8, $9
			) RETURNING "id"`,
			[
				input.host,
				routeId,
				input.title,
				startsAt,
				endsAt,
				new Date(startsAt.getTime() - 12 * HOUR),
				input.price ?? 1_000_000,
				input.status ?? "published",
				input.pausedHoursAgo === undefined ? null : at(-input.pausedHoursAgo),
			]
		);
		return { id: rows[0].id, title: input.title, startsAt, endsAt };
	};

	const addForecast = async (
		trip: { id: string; startsAt: Date; endsAt: Date },
		risk: DemoRisk,
		createdHoursAgo: number,
		readingsOverride?: Partial<(typeof DEMO_READINGS)[DemoRisk]>
	): Promise<string> => {
		const createdAt = at(-createdHoursAgo);
		const readings = { ...DEMO_READINGS[risk], ...readingsOverride };
		const advice = DEMO_ADVICE[risk];
		const rows: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "trip_weather_forecasts" (
				trip_id, route_id, status, trip_starts_at, trip_ends_at, forecast_from, forecast_to,
				worst_reading, rule_version_id, risk_level, composite_score, criteria_scores,
				advice_text, advice_actions, advice_generated_at, created_by, created_at, checked_at
			) VALUES (
				$1, $2, 'available', $3, $4, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10, $11::jsonb,
				$12, $13, $12, $14
			) RETURNING "id"`,
			[
				trip.id,
				routeId,
				trip.startsAt,
				trip.endsAt,
				JSON.stringify({
					...readings,
					hoursCovered: Math.max(
						1,
						Math.round((trip.endsAt.getTime() - trip.startsAt.getTime()) / 3_600_000)
					),
					rainfallAt: trip.startsAt.toISOString(),
					windAt: trip.startsAt.toISOString(),
					temperatureAt: trip.startsAt.toISOString(),
					visibilityAt: trip.startsAt.toISOString(),
					thunderstormAt: readings.thunderstorm ? trip.startsAt.toISOString() : null,
				}),
				ruleId,
				risk,
				DEMO_COMPOSITE[risk],
				JSON.stringify(demoCriteria(risk)),
				advice.text,
				JSON.stringify(advice.actions),
				createdAt,
				hostId,
				at(-Math.min(createdHoursAgo, 1)),
			]
		);
		return rows[0].id;
	};

	/** Hybrid risk: the AI's own opinion on a stored forecast (the official level is untouched). */
	const addAiReview = async (
		forecastId: string,
		level: DemoRisk,
		reason: string,
		confidence: number,
		reviewedHoursAgo: number
	) => {
		await dataSource.query(
			`UPDATE "trip_weather_forecasts"
			 SET "ai_risk_level" = $2, "ai_reason" = $3, "ai_confidence" = $4,
			     "ai_model" = 'gpt-4o-mini (demo)', "ai_reviewed_at" = $5, "ai_review_attempts" = 1
			 WHERE "id" = $1`,
			[forecastId, level, reason, confidence, at(-reviewedHoursAgo)]
		);
	};

	const addNotice = async (
		recipientId: string,
		trip: { id: string; title: string; startsAt: Date },
		forecastId: string,
		previous: DemoRisk,
		risk: DemoRisk,
		createdHoursAgo: number,
		read = false
	) =>
		dataSource.query(
			`INSERT INTO "trip_weather_change_notices" (
				recipient_id, trip_id, forecast_id, trip_title, trip_starts_at, previous_risk_level, risk_level, read_at, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				recipientId,
				trip.id,
				forecastId,
				trip.title,
				trip.startsAt,
				previous,
				risk,
				read ? at(-createdHoursAgo + 0.5) : null,
				at(-createdHoursAgo),
			]
		);

	const addAlert = async (
		recipientId: string,
		trip: { id: string; title: string; startsAt: Date },
		forecastId: string,
		milestone: string,
		urgency: string,
		createdHoursAgo: number
	) =>
		dataSource.query(
			`INSERT INTO "trip_weather_decision_alerts" (
				recipient_id, trip_id, milestone, urgency, trip_title, trip_starts_at, forecast_id, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				recipientId,
				trip.id,
				milestone,
				urgency,
				trip.title,
				trip.startsAt,
				forecastId,
				at(-createdHoursAgo),
			]
		);

	const addDecision = async (input: {
		trip: { id: string; startsAt: Date };
		forecastId: string | null;
		by: string;
		role: "host" | "admin";
		decision: string;
		reason: string;
		safetyPlan?: string;
		late?: boolean;
		createdHoursAgo: number;
	}): Promise<string> => {
		const rows: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "trip_weather_decisions" (
				trip_id, forecast_id, risk_level, decided_by, decider_role, decision, reason, safety_plan, late, trip_starts_at, created_at
			) VALUES ($1, $2, 'red', $3, $4, $5, $6, $7, $8, $9, $10) RETURNING "id"`,
			[
				input.trip.id,
				input.forecastId,
				input.by,
				input.role,
				input.decision,
				input.reason,
				input.safetyPlan ?? null,
				input.late ?? false,
				input.trip.startsAt,
				at(-input.createdHoursAgo),
			]
		);
		return rows[0].id;
	};

	const bookCamper = async (
		trip: { id: string; startsAt: Date; endsAt: Date },
		options: { status?: string; amount?: number; reconfirmBy?: Date } = {}
	): Promise<string> => {
		const amount = options.amount ?? 1_000_000;
		const rows: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "bookings" (
				trip_id, user_id, num_people, base_price, total_amount, status, payment_status,
				trip_starts_at_snapshot, trip_ends_at_snapshot, reconfirmation_deadline
			) VALUES ($1, $2, 1, $3, $3, $4, 'paid', $5, $6, $7) RETURNING "id"`,
			[
				trip.id,
				camperId,
				amount,
				options.status ?? "confirmed",
				trip.startsAt,
				trip.endsAt,
				options.reconfirmBy ?? null,
			]
		);
		const bookingId = rows[0].id;
		await dataSource.query(
			`INSERT INTO "booking_members" (booking_id, user_id, is_primary, member_status)
			 VALUES ($1, $2, true, 'registered')`,
			[bookingId, camperId]
		);
		await dataSource.query(
			`INSERT INTO "payments" (booking_id, amount, type, status, idempotency_key, request_fingerprint)
			 VALUES ($1, $2, 'charge', 'succeeded', $3, $4)`,
			[bookingId, amount, `weather-demo-${bookingId}`, `weather-demo-${bookingId}`.slice(0, 64)]
		);
		await dataSource.query(`UPDATE "trips" SET "seats_taken" = "seats_taken" + 1 WHERE "id" = $1`, [
			trip.id,
		]);
		return bookingId;
	};

	// --- Weather near departure (policy §2–§5) ---------------------------------------------
	// 1. Green, 10 days ahead: Camper's forecast card ("Dự báo xa") and an improving notice.
	const sunny = await createTrip({
		title: "[Demo thời tiết] Sơn Trà ngày nắng (còn 10 ngày)",
		host: hostId,
		startsInHours: 240,
	});
	const sunnyBefore = await addForecast(sunny, "yellow", 48);
	const sunnyNow = await addForecast(sunny, "green", 3);
	await bookCamper(sunny);
	await addNotice(camperId, sunny, sunnyNow, "yellow", "green", 3, true);
	await addNotice(hostId, sunny, sunnyNow, "yellow", "green", 3, true);
	void sunnyBefore;

	// 2. Red, 40 h ahead, Host has not decided: Host decision card + T-48h reminder.
	const rainy = await createTrip({
		title: "[Demo thời tiết] Bà Nà mưa lớn (Host cần quyết định)",
		host: hostId,
		startsInHours: 40,
	});
	await addForecast(rainy, "yellow", 30);
	const rainyRed = await addForecast(rainy, "red", 6);
	await bookCamper(rainy);
	await addNotice(hostId, rainy, rainyRed, "yellow", "red", 6);
	await addNotice(camperId, rainy, rainyRed, "yellow", "red", 6);
	await addAlert(hostId, rainy, rainyRed, "host_t48", "normal", 2);

	// 3. Red, 20 h ahead, no Host answer: Admin "Cần xử lý" (Host chưa trả lời).
	const storm = await createTrip({
		title: "[Demo thời tiết] Hải Vân dông sét (Host chưa trả lời)",
		host: hostId,
		startsInHours: 20,
		price: 2_000_000,
	});
	const stormRed = await addForecast(storm, "red", 30);
	await bookCamper(storm, { amount: 2_000_000 });
	await addNotice(camperId, storm, stormRed, "yellow", "red", 30);
	await addAlert(hostId, storm, stormRed, "host_t48", "normal", 28);
	await addAlert(adminId, storm, stormRed, "admin_t24", "normal", 4);
	await addAiReview(
		stormRed,
		"red",
		"Dông sét kèm gió 78 km/h và mưa 68 mm/h, tầm nhìn dưới 1 km: không nên khởi hành.",
		0.93,
		29
	);

	// 4. Red, 50 h ahead, Host keeps the Trip: Admin "Cần xử lý" (Host muốn giữ chuyến).
	const windy = await createTrip({
		title: "[Demo thời tiết] Ngũ Hành Sơn gió mạnh (Host muốn giữ)",
		host: hostId,
		startsInHours: 50,
	});
	const windyRed = await addForecast(windy, "red", 10);
	await bookCamper(windy);
	await addDecision({
		trip: windy,
		forecastId: windyRed,
		by: hostId,
		role: "host",
		decision: "keep",
		reason: "Đường đi chủ yếu trong rừng, tránh đỉnh trống.",
		safetyPlan: "Đổi lộ trình xuống thấp, quay đầu trước 14h nếu gió vượt 60 km/h, mang bộ đàm.",
		createdHoursAgo: 3,
	});
	await addAlert(adminId, windy, windyRed, "admin_kept", "normal", 3);

	// 5. Red, 30 h ahead, paused by an Admin: locked Host card, bookings blocked.
	const paused = await createTrip({
		title: "[Demo thời tiết] Cù Lao Chàm (Admin tạm dừng)",
		host: hostId,
		startsInHours: 30,
		pausedHoursAgo: 2,
	});
	const pausedRed = await addForecast(paused, "red", 8);
	await addDecision({
		trip: paused,
		forecastId: pausedRed,
		by: adminId,
		role: "admin",
		decision: "pause",
		reason: "Chờ bản tin bão chiều nay rồi quyết định tiếp.",
		createdHoursAgo: 2,
	});

	// 6. Rescheduled for weather: the Camper keeps the new date or cancels with 100% refund.
	const moved = await createTrip({
		title: "[Demo thời tiết] Bidoup (đã dời lịch vì mưa bão)",
		host: hostId,
		startsInHours: 9 * 24,
	});
	await addForecast(moved, "green", 5);
	await addDecision({
		trip: moved,
		forecastId: null,
		by: hostId,
		role: "host",
		decision: "reschedule",
		reason: "Bão đổ bộ đúng ngày đi, dời sang tuần sau.",
		createdHoursAgo: 5,
	});
	await bookCamper(moved, {
		status: "pending_reconfirmation",
		reconfirmBy: new Date(moved.startsAt.getTime() - 24 * HOUR),
	});
	await dataSource.query(
		`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after", "reason", "created_at")
		 VALUES ($1, 'trip.rescheduled', 'trip', $2, NULL, NULL, 'weather_reschedule', $3)`,
		[hostId, moved.id, at(-5)]
	);

	// 7. Hybrid risk (thresholds vs AI): Admin › Quản lý thời tiết › "Cần xem lại ngưỡng".
	// Thresholds say Green (wind and visibility only reach Yellow), the AI says Red.
	const gusty = await createTrip({
		title: "[Demo thời tiết] Lang Biang gió giật (ngưỡng và AI lệch)",
		host: hostId,
		startsInHours: 72,
	});
	const gustyGreen = await addForecast(gusty, "green", 4, {
		rainfallMm: 3,
		windKph: 65,
		temperatureC: 9,
		visibilityM: 1500,
		thunderstorm: false,
	});
	await addAiReview(
		gustyGreen,
		"red",
		"Gió 65 km/h trên đỉnh trống, trời lạnh 9°C và tầm nhìn chỉ 1,5 km dễ gây lạc đường và hạ thân nhiệt.",
		0.78,
		3
	);
	// Thresholds say Yellow (one heavy-rain hour), the AI says Green.
	const shower = await createTrip({
		title: "[Demo thời tiết] Mỹ Sơn mưa rào ngắn (ngưỡng và AI lệch)",
		host: hostId,
		startsInHours: 60,
	});
	const showerYellow = await addForecast(shower, "yellow", 5, {
		rainfallMm: 52,
		windKph: 12,
		temperatureC: 27,
		visibilityM: 9000,
		thunderstorm: false,
	});
	await addAiReview(
		showerYellow,
		"green",
		"Chỉ có một cơn mưa rào khoảng 1 giờ, gió nhẹ, không dông và tầm nhìn tốt; đi bình thường, mang áo mưa.",
		0.7,
		4
	);

	// 8. T-6h auto-cancel (policy §5.4), all on host@ctms.local.
	// 8a. Red, 10 h ahead, Host never answered: Admin "Cần xử lý" at the urgent (T-12h) level.
	const urgent = await createTrip({
		title: "[Demo thời tiết] Sơn Trà Tây (còn 10 giờ, Khẩn)",
		host: hostId,
		startsInHours: 10,
	});
	const urgentRed = await addForecast(urgent, "red", 20);
	await bookCamper(urgent);
	await addAlert(hostId, urgent, urgentRed, "host_t48", "normal", 38);
	await addAlert(adminId, urgent, urgentRed, "admin_t24", "normal", 14);
	await addAlert(adminId, urgent, urgentRed, "admin_t12", "urgent", 2);

	// 8b. Red, 6.5 h ahead, still undecided: the cards show the auto-cancel time; with
	// TRIP_WEATHER_DECISION_WORKER_ENABLED=true the system cancels it about 30 minutes after seeding.
	const soon = await createTrip({
		title: "[Demo thời tiết] Bà Nà Núi Chúa (còn 6,5 giờ, sắp tự huỷ)",
		host: hostId,
		startsInHours: 6.5,
		price: 1_500_000,
	});
	const soonRed = await addForecast(soon, "red", 18);
	await bookCamper(soon, { amount: 1_500_000 });
	await addAlert(hostId, soon, soonRed, "host_t48", "normal", 41.5);
	await addAlert(adminId, soon, soonRed, "admin_t24", "normal", 17.5);
	await addAlert(adminId, soon, soonRed, "admin_t12", "urgent", 5.5);

	// 8c. Already cancelled by the system at T-6h: "Hệ thống" in the decision log, notices to the
	// Host and Admin, a pending 100% refund and the Host's open first penalty (still in the waiver
	// window, already deducted from the wallet below).
	const autoCancelled = await createTrip({
		title: "[Demo thời tiết] Tiên Sa (hệ thống đã tự huỷ T-6h)",
		host: hostId,
		startsInHours: 3,
		status: "cancelled",
		price: 1_500_000,
	});
	const cancelledRed = await addForecast(autoCancelled, "red", 20);
	const cancelledBooking = await bookCamper(autoCancelled, { amount: 1_500_000 });
	await dataSource.query(
		`UPDATE "trips" SET "cancelled_at" = $2, "cancellation_reason" = $3, "seats_taken" = 0 WHERE "id" = $1`,
		[autoCancelled.id, at(-3), `Huỷ vì thời tiết: ${AUTO_CANCEL_WEATHER_REASON}`]
	);
	await dataSource.query(`UPDATE "bookings" SET "status" = 'cancelled' WHERE "id" = $1`, [
		cancelledBooking,
	]);
	await dataSource.query(
		`INSERT INTO "payments" (booking_id, amount, type, status, idempotency_key, request_fingerprint, parent_payment_id)
		 SELECT $1, 1500000, 'refund', 'pending', $2, $3, charge."id"
		 FROM "payments" charge WHERE charge."booking_id" = $1 AND charge."type" = 'charge' LIMIT 1`,
		[
			cancelledBooking,
			`ctms-027:trip-cancel:${autoCancelled.id}:booking:${cancelledBooking}`,
			`weather-auto-cancel-${cancelledBooking}`.slice(0, 64),
		]
	);
	const systemDecision: Array<{ id: string }> = await dataSource.query(
		`INSERT INTO "trip_weather_decisions" (
			trip_id, forecast_id, risk_level, decided_by, decider_role, decision, reason, late, trip_starts_at, created_at
		) VALUES ($1, $2, 'red', NULL, 'system', 'cancel', $3, false, $4, $5) RETURNING "id"`,
		[autoCancelled.id, cancelledRed, AUTO_CANCEL_WEATHER_REASON, autoCancelled.startsAt, at(-3)]
	);
	await dataSource.query(
		`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after", "reason", "created_at")
		 VALUES (NULL, 'trip.cancelled', 'trip', $1, NULL, NULL, $2, $3)`,
		[autoCancelled.id, `Huỷ vì thời tiết: ${AUTO_CANCEL_WEATHER_REASON}`, at(-3)]
	);
	await addAlert(hostId, autoCancelled, cancelledRed, "host_t48", "normal", 45);
	await addAlert(adminId, autoCancelled, cancelledRed, "admin_t24", "normal", 21);
	await addAlert(adminId, autoCancelled, cancelledRed, "admin_t12", "urgent", 9);
	await addAlert(hostId, autoCancelled, cancelledRed, "auto_cancelled", "critical", 3);
	await addAlert(adminId, autoCancelled, cancelledRed, "auto_cancelled", "critical", 3);
	await dataSource.query(
		`INSERT INTO "host_weather_penalties" (
			trip_id, host_id, trip_title, trip_starts_at, decision_id, violation_number, booking_value,
			rate_basis_points, cap_amount, amount, deducted_amount, status, waiver_deadline, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, 1, 1500000, 500, 2000000, 75000, 75000, 'applied', $6, $7, now())`,
		[
			autoCancelled.id,
			hostId,
			autoCancelled.title,
			autoCancelled.startsAt,
			systemDecision[0].id,
			new Date(autoCancelled.startsAt.getTime() + 48 * HOUR),
			at(-3),
		]
	);

	// --- Host weather penalties (policy §6) ----------------------------------------------------
	const ensureWallet = async (host: string): Promise<{ id: string; balance: number }> => {
		const rows: Array<{ id: string; balance: string }> = await dataSource.query(
			`INSERT INTO "host_wallets" ("host_id", "balance") VALUES ($1, '0.00')
			 ON CONFLICT ("host_id") DO UPDATE SET "updated_at" = now()
			 RETURNING "id", "balance"`,
			[host]
		);
		return { id: rows[0].id, balance: Number(rows[0].balance) };
	};
	const walletEntry = async (
		wallet: { id: string; balance: number },
		tripId: string,
		type: "settlement_credit" | "penalty_debit" | "penalty_refund",
		amount: number,
		description: string,
		createdHoursAgo: number
	) => {
		wallet.balance += type === "penalty_debit" ? -amount : amount;
		await dataSource.query(
			`INSERT INTO "wallet_transactions" (
				wallet_id, trip_id, type, base_amount, fee_amount, net_amount, balance_after, description, created_at
			) VALUES ($1, $2, $3, 0, 0, $4, $5, $6, $7)`,
			[
				wallet.id,
				tripId,
				type,
				type === "penalty_debit" ? -amount : amount,
				wallet.balance.toFixed(2),
				description,
				at(-createdHoursAgo),
			]
		);
		await dataSource.query(
			`UPDATE "host_wallets" SET "balance" = $2, "updated_at" = now() WHERE "id" = $1`,
			[wallet.id, wallet.balance.toFixed(2)]
		);
	};

	const tiers = [
		{ rate: 500, cap: 2_000_000 },
		{ rate: 1000, cap: 5_000_000 },
		{ rate: 1500, cap: 10_000_000 },
	];
	const addPenalty = async (input: {
		host: string;
		title: string;
		startedHoursAgo: number;
		violation: 1 | 2 | 3;
		bookingValue: number;
		deducted: number;
		status?: "applied" | "waived";
		blockedDays?: number;
		waiver?: {
			reason: string;
			requestedHoursAgo: number;
			reviewDueInHours: number;
			decision?: "approved" | "rejected";
			note?: string;
			reviewedHoursAgo?: number;
		};
	}): Promise<{ tripId: string; amount: number }> => {
		const trip = await createTrip({
			title: input.title,
			host: input.host,
			startsInHours: -input.startedHoursAgo,
			status: "completed",
		});
		const decisionId = await addDecision({
			trip,
			forecastId: null,
			by: adminId,
			role: "admin",
			decision: "keep",
			reason: "Host không quyết định trước 24 tiếng, Admin giữ chuyến kèm điều kiện an toàn.",
			createdHoursAgo: input.startedHoursAgo + 20,
		});
		const tier = tiers[input.violation - 1];
		const amount = Math.min(Math.round((input.bookingValue * tier.rate) / 10_000), tier.cap);
		const createdAt = at(-(input.startedHoursAgo + 20));
		const waiver = input.waiver;
		await dataSource.query(
			`INSERT INTO "host_weather_penalties" (
				trip_id, host_id, trip_title, trip_starts_at, decision_id, violation_number, booking_value,
				rate_basis_points, cap_amount, amount, deducted_amount, status, hosting_blocked_until,
				waiver_deadline, waiver_reason, waiver_evidence_urls, waiver_requested_at, waiver_review_due_at,
				waiver_decision, waiver_reviewed_by, waiver_reviewed_at, waiver_review_note, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18,
				$19, $20, $21, $22, $23, now()
			)`,
			[
				trip.id,
				input.host,
				trip.title,
				trip.startsAt,
				decisionId,
				input.violation,
				input.bookingValue,
				tier.rate,
				tier.cap,
				amount,
				input.status === "waived" ? 0 : input.deducted,
				input.status ?? "applied",
				input.blockedDays ? new Date(createdAt.getTime() + input.blockedDays * 24 * HOUR) : null,
				new Date(trip.startsAt.getTime() + 48 * HOUR),
				waiver?.reason ?? null,
				JSON.stringify(
					waiver
						? ["https://res.cloudinary.com/demo/raw/upload/weather-penalty-waivers/giay-vien.pdf"]
						: []
				),
				waiver ? at(-waiver.requestedHoursAgo) : null,
				waiver ? at(waiver.reviewDueInHours) : null,
				waiver?.decision ?? null,
				waiver?.decision ? adminId : null,
				waiver?.reviewedHoursAgo !== undefined ? at(-waiver.reviewedHoursAgo) : null,
				waiver?.note ?? null,
				createdAt,
			]
		);
		return { tripId: trip.id, amount };
	};

	// host@ctms.local — one waived penalty (with refund) and one fresh penalty still open to a
	// waiver request; never blocked, so this account can keep creating Trips.
	const hostWallet = await ensureWallet(hostId);
	const waivedOld = await addPenalty({
		host: hostId,
		title: "[Demo phạt] Hòa Bắc (đã miễn phạt)",
		startedHoursAgo: 60 * 24,
		violation: 1,
		bookingValue: 8_000_000,
		deducted: 0,
		status: "waived",
		waiver: {
			reason: "Host nhập viện cấp cứu đúng ngày phải quyết định.",
			requestedHoursAgo: 59 * 24,
			reviewDueInHours: -54 * 24,
			decision: "approved",
			note: "Giấy viện hợp lệ, miễn phạt.",
			reviewedHoursAgo: 58 * 24,
		},
	});
	await walletEntry(
		hostWallet,
		waivedOld.tripId,
		"penalty_debit",
		400_000,
		"Trừ phạt thời tiết: Hòa Bắc",
		59 * 24 + 12
	);
	await walletEntry(
		hostWallet,
		waivedOld.tripId,
		"penalty_refund",
		400_000,
		"Hoàn phạt thời tiết (đã miễn): Hòa Bắc",
		58 * 24
	);
	// host@'s open first penalty is the T-6h auto-cancel demo (8c): one applied penalty only, so
	// host@ is never blocked by the seed.
	await walletEntry(
		hostWallet,
		autoCancelled.id,
		"penalty_debit",
		75_000,
		"Trừ phạt thời tiết: Tiên Sa",
		2
	);

	// host.blocked@ctms.local — 2nd violation: blocked 14 days, waiver waiting for the Admin.
	const blockedWallet = await ensureWallet(blockedHostId);
	await addPenalty({
		host: blockedHostId,
		title: "[Demo phạt] Lăng Cô (lần 1, bị từ chối miễn)",
		startedHoursAgo: 40 * 24,
		violation: 1,
		bookingValue: 6_000_000,
		deducted: 300_000,
		waiver: {
			reason: "Xe hỏng nên không kịp quyết định.",
			requestedHoursAgo: 39 * 24,
			reviewDueInHours: -34 * 24,
			decision: "rejected",
			note: "Không phải bất khả kháng, Host vẫn có thể báo qua ứng dụng.",
			reviewedHoursAgo: 37 * 24,
		},
	});
	const blockedPenalty = await addPenalty({
		host: blockedHostId,
		title: "[Demo phạt] Bạch Mã (lần 2, chờ duyệt miễn)",
		startedHoursAgo: 3 * 24,
		violation: 2,
		bookingValue: 12_000_000,
		deducted: 700_000,
		blockedDays: 14,
		waiver: {
			reason: "Mất điện thoại trên núi, không nhận được nhắc nhở. Có xác nhận của công an xã.",
			requestedHoursAgo: 20,
			reviewDueInHours: 4 * 24,
		},
	});
	// The penalty is taken from the Trip's own settlement, as settleTrip does.
	await walletEntry(
		blockedWallet,
		blockedPenalty.tripId,
		"settlement_credit",
		2_000_000,
		"Quyết toán doanh thu chuyến: Bạch Mã",
		2 * 24 + 1
	);
	await walletEntry(
		blockedWallet,
		blockedPenalty.tripId,
		"penalty_debit",
		700_000,
		"Trừ phạt thời tiết: Bạch Mã",
		2 * 24
	);

	// host.suspended@ctms.local — 3 applied violations in 90 days: suspended; the last waiver is
	// past its 5-working-day review deadline.
	await ensureWallet(suspendedHostId);
	await addPenalty({
		host: suspendedHostId,
		title: "[Demo phạt] Phú Ninh (lần 1)",
		startedHoursAgo: 70 * 24,
		violation: 1,
		bookingValue: 5_000_000,
		deducted: 250_000,
	});
	await addPenalty({
		host: suspendedHostId,
		title: "[Demo phạt] Đèo Le (lần 2)",
		startedHoursAgo: 45 * 24,
		violation: 2,
		bookingValue: 7_000_000,
		deducted: 700_000,
		blockedDays: 14,
	});
	await addPenalty({
		host: suspendedHostId,
		title: "[Demo phạt] Núi Thần Tài (lần 3, quá hạn xem)",
		startedHoursAgo: 12 * 24,
		violation: 3,
		bookingValue: 9_000_000,
		deducted: 0,
		waiver: {
			reason: "Người thân mất đột ngột, có giấy báo tử.",
			requestedHoursAgo: 10 * 24,
			reviewDueInHours: -24,
		},
	});

	console.log("[seed:weather-demo] Weather and penalty demo ready:");
	console.log(
		"  - Admin › Quản lý thời tiết: 4 Trip cần xử lý (1 Khẩn, 1 sắp tự huỷ), 2 yêu cầu miễn phạt (1 quá hạn), 2 Trip cần xem lại ngưỡng"
	);
	console.log(
		"  - host@ctms.local: Trip đã bị hệ thống tự huỷ T-6h (phạt lần 1), Trip còn 6,5 giờ sẽ tự huỷ khi bật TRIP_WEATHER_DECISION_WORKER_ENABLED (thành phạt lần 2, khoá tạo Trip 14 ngày)"
	);
	console.log(
		"  - host@ctms.local: thẻ quyết định thời tiết, chuông thông báo, ví có phạt/hoàn phạt"
	);
	console.log(
		"  - camper@ctms.local: dự báo theo ngày đi, thông báo đổi dự báo, đơn chờ xác nhận lịch mới"
	);
	console.log(
		"  - host.blocked@ctms.local / host.suspended@ctms.local (Host@123): bị khoá / đình chỉ tạo Trip"
	);
}

if (require.main === module) {
	runMasterSeed()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			console.error("[master-seed] Failed:", error);
			process.exit(1);
		});
}
