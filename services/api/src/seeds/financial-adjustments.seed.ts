import { BookingsRepository } from "../modules/bookings/bookings.repository";
import { FinancialAdjustment } from "../modules/bookings/entities/financial-adjustment.entity";
import { Payment } from "../modules/bookings/entities/payment.entity";
import { PaymentsRepository } from "../modules/bookings/payments.repository";
import { RefundOrigin } from "../modules/bookings/refund-policy";
import { RefundsService } from "../modules/bookings/refunds.service";
import { Booking } from "../modules/profiles/entities/booking.entity";
import { UserRole } from "../modules/users/entities/user.entity";
import dataSource from "../shared/database/data-source";
import { consolidateFinancialHosts } from "./consolidate-financial-hosts";

const scenarios = [
	{
		index: 1,
		title: "Trekking vườn quốc gia Bạch Mã",
		description: "Khám phá các cung đường rừng và điểm ngắm cảnh tại vườn quốc gia Bạch Mã.",
		notes: "Khoản thu thừa đã được xác minh và chuyển xử lý hoàn tiền sau quyết toán.",
		amount: 600000,
		bookings: 1,
		paidOut: false,
		reason: "Khách đã thanh toán thừa, cần hoàn lại sau khi chuyến đi đã quyết toán.",
	},
	{
		index: 2,
		title: "Khám phá bán đảo Sơn Trà",
		description:
			"Đi bộ khám phá bán đảo Sơn Trà, ngắm biển và tìm hiểu hệ sinh thái rừng ven biển.",
		notes: "Đã xác định khoản cần thu hồi từ người tổ chức để xử lý yêu cầu hoàn tiền cho khách.",
		amount: 900000,
		bookings: 1,
		paidOut: true,
		reason: "Cần hoàn tiền cho khách nhưng chủ chuyến đã rút tiền, đang chờ thu hồi thủ công.",
	},
	{
		index: 3,
		title: "Chinh phục đèo Hải Vân",
		description:
			"Chuyến đi trong ngày qua cung đường đèo Hải Vân, dừng ngắm cảnh vịnh Đà Nẵng và Lăng Cô.",
		notes: "Khoản thu thừa đã được đối chiếu và khấu trừ từ số dư ví người tổ chức.",
		amount: 250000,
		bookings: 2,
		paidOut: false,
		reason: "Hoàn lại khoản thu thừa cho khách sau quyết toán, ví chủ chuyến còn đủ số dư.",
	},
	{
		index: 4,
		title: "Săn mây trên đỉnh Langbiang",
		description: "Hành trình lên đỉnh Langbiang, ngắm biển mây và toàn cảnh cao nguyên.",
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
		for (const scenario of scenarios) {
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
				 ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)'), 3000, 'moderate', 240, 'active')
				 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
				[routeId, hostId, scenario.title, scenario.description]
			);
			await manager.query(
				`INSERT INTO trips (id, host_id, route_id, title, description, trip_type, duration_nights,
				 starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max, seats_taken,
				 price_per_person, status)
				 VALUES ($1, $2, $3, $4, $7, 'day_trip', 0,
				 now() - interval '8 days', now() - interval '7 days',
				 ST_GeogFromText('SRID=4326;POINT(108.45 11.94)'), now() - interval '9 days', 1, 10, $5, $6, 'completed')
				 ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
				[tripId, hostId, routeId, scenario.title, bookings, amount.toFixed(2), scenario.description]
			);
			await manager.query("UPDATE trips SET description = $1 WHERE id = $2 AND description = $3", [
				scenario.description,
				tripId,
				LEGACY_TRIP_DESCRIPTION,
			]);
			await manager.query(
				"UPDATE trekking_routes SET description = $1 WHERE id = $2 AND description = $3",
				[scenario.description, routeId, LEGACY_ROUTE_DESCRIPTION]
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
	for (const scenario of scenarios) {
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

if (require.main === module) {
	seedFinancialAdjustments()
		.catch((error: unknown) => {
			console.error("[seed:financial-adjustments]", error);
			process.exitCode = 1;
		})
		.finally(async () => {
			if (dataSource.isInitialized) await dataSource.destroy();
		});
}
