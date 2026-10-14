import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { ContentReport } from "../content-reports/entities/content-report.entity";
import { validateAccountHolderNameMatch } from "../profiles/utils/vietnamese-name.util";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import { User } from "../users/entities/user.entity";
import { minorToMoney, moneyToMinor } from "./cancellation-policy";
import type { AdminSettlementQueryDto } from "./dto/admin-settlement-query.dto";
import type {
	ConfirmHostPayoutDto,
	HostWalletResponseDto,
	RejectHostPayoutDto,
	RequestHostPayoutDto,
} from "./dto/host-payout.dto";
import type {
	SettlementResponseDto,
	TripSettlementEvaluationDto,
} from "./dto/trip-settlement-evaluation.dto";
import { HostWallet } from "./entities/host-wallet.entity";
import { Payout, PayoutStatus } from "./entities/payout.entity";
import { Settlement } from "./entities/settlement.entity";
import { WalletTransaction, WalletTransactionType } from "./entities/wallet-transaction.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { PaymentsRepository } from "./payments.repository";
import { evaluateSettlementBlockers } from "./refund-policy";

const PLATFORM_COMMISSION_RATE = "0.0500";
const HOLD_PERIOD_HOURS = 72;
const COMPLAINT_WINDOW_HOURS = 24;

@Injectable()
export class SettlementsService {
	private readonly logger = new Logger(SettlementsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly paymentsRepository: PaymentsRepository
	) {}

	/**
	 * Evaluates settlement eligibility, 72h hold condition, 24h complaint window,
	 * blocking refund claims, and calculates Platform Fee snapshot (PB AC-1 to PB AC-7).
	 */
	async evaluateTripSettlement(tripId: string): Promise<TripSettlementEvaluationDto> {
		const trip = await this.dataSource.getRepository(Trip).findOne({
			where: { id: tripId },
			relations: { host: true },
		});
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}

		const settlement = await this.dataSource.getRepository(Settlement).findOne({
			where: { tripId },
		});
		const isSettled = Boolean(settlement);

		const completedAt =
			(trip as unknown as { completedAt?: Date }).completedAt ?? trip.endsAt ?? trip.updatedAt;
		const now = new Date();
		const isCompleted = trip.status === TripStatus.COMPLETED;

		const hoursSinceCompleted = completedAt
			? Number(((now.getTime() - new Date(completedAt).getTime()) / (1000 * 60 * 60)).toFixed(1))
			: null;

		const isHoldPeriodSatisfied = Boolean(
			isCompleted &&
				completedAt &&
				now.getTime() >= new Date(completedAt).getTime() + HOLD_PERIOD_HOURS * 60 * 60 * 1000
		);

		const isComplaintWindowSatisfied = Boolean(
			isCompleted &&
				completedAt &&
				now.getTime() >= new Date(completedAt).getTime() + COMPLAINT_WINDOW_HOURS * 60 * 60 * 1000
		);

		const payments = await this.paymentsRepository.findPaymentsByTripId(tripId);

		const contentReports = await this.dataSource.getRepository(ContentReport).find({
			where: { targetId: tripId },
		});
		const externalClaims = contentReports.map((c) => ({ id: c.id, status: c.status }));

		const blockerResult = evaluateSettlementBlockers(payments, externalClaims);

		const blockingReasons: string[] = [...blockerResult.blockingReasons];
		if (!isCompleted) {
			blockingReasons.push("Trip is not completed (PB AC-1)");
		}
		if (isCompleted && !isHoldPeriodSatisfied) {
			blockingReasons.push(
				`72-hour hold period has not elapsed yet (completed ${hoursSinceCompleted ?? 0}h ago) (PB AC-2)`
			);
		}
		if (isCompleted && !isComplaintWindowSatisfied) {
			blockingReasons.push("24-hour camper complaint window has not ended yet (PB AC-3)");
		}

		const isBlocked = blockerResult.isBlocked;
		const isEligible =
			isCompleted &&
			isHoldPeriodSatisfied &&
			isComplaintWindowSatisfied &&
			!isBlocked &&
			!isSettled;

		const settlementBase = blockerResult.settlementBase;
		const baseMinor = moneyToMinor(settlementBase);
		const feeMinor = (baseMinor * 5n) / 100n;
		const netMinor = baseMinor - feeMinor;

		return {
			tripId: trip.id,
			tripTitle: trip.title,
			hostId: trip.hostId,
			hostName: trip.host?.fullName || "Host",
			tripStatus: trip.status,
			completedAt: completedAt ? new Date(completedAt) : null,
			hoursSinceCompleted,
			isCompleted,
			isHoldPeriodSatisfied,
			isComplaintWindowSatisfied,
			isBlocked,
			blockingReasons,
			isEligible,
			isSettled,
			settledAt: settlement?.settledAt ?? null,
			totalCharges: blockerResult.totalCharges,
			totalSucceededRefunds: blockerResult.totalSucceededRefunds,
			settlementBase,
			commissionRate: settlement?.commissionRate ?? PLATFORM_COMMISSION_RATE,
			platformFee: settlement?.platformFee ?? minorToMoney(feeMinor),
			hostNetAmount: settlement?.netAmount ?? minorToMoney(netMinor),
		};
	}

	/**
	 * Settles eligible Trip revenue, snapshots 5% Platform Fee, and credits 95% Host Net
	 * to the Host Wallet atomically and idempotently (BR-332, BR-333, BR-334, BR-335, BR-338, BR-339).
	 */
	async settleTrip(tripId: string, actorId: string): Promise<SettlementResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			// 1. Idempotency check: if settlement exists, return existing snapshot (BR-332, BR-339)
			const existingSettlement = await manager.getRepository(Settlement).findOne({
				where: { tripId },
			});
			if (existingSettlement) {
				const existingWallet = await manager.getRepository(HostWallet).findOne({
					where: { hostId: existingSettlement.hostId },
				});
				return {
					id: existingSettlement.id,
					tripId: existingSettlement.tripId,
					hostId: existingSettlement.hostId,
					settlementBase: existingSettlement.settlementBase,
					commissionRate: existingSettlement.commissionRate,
					platformFee: existingSettlement.platformFee,
					netAmount: existingSettlement.netAmount,
					settledAt: existingSettlement.settledAt,
					walletBalanceAfter: existingWallet?.balance ?? existingSettlement.netAmount,
				};
			}

			// 2. Lock Trip and revalidate conditions inside transaction (BR-335, BR-344)
			const trip = await manager.getRepository(Trip).findOne({
				where: { id: tripId },
				relations: { host: true },
			});
			if (!trip) {
				throw new NotFoundException("Trip not found");
			}

			if (trip.status !== TripStatus.COMPLETED) {
				throw new ConflictException("Settlement requires Trip status to be completed (PB AC-1)");
			}

			const completedAt =
				(trip as unknown as { completedAt?: Date }).completedAt ?? trip.endsAt ?? trip.updatedAt;
			const now = new Date();
			const completedTime = new Date(completedAt).getTime();

			if (now.getTime() < completedTime + HOLD_PERIOD_HOURS * 60 * 60 * 1000) {
				throw new ConflictException("Settlement requires 72-hour hold period to elapse (PB AC-2)");
			}

			if (now.getTime() < completedTime + COMPLAINT_WINDOW_HOURS * 60 * 60 * 1000) {
				throw new ConflictException(
					"Settlement requires 24-hour camper complaint window to end (PB AC-3)"
				);
			}

			// Revalidate payments & blockers with fresh transaction query
			const paymentsRepo = manager.withRepository(this.paymentsRepository);
			const payments = await paymentsRepo.findPaymentsByTripId(tripId);

			const contentReports = await manager.getRepository(ContentReport).find({
				where: { targetId: tripId },
			});
			const externalClaims = contentReports.map((c) => ({ id: c.id, status: c.status }));

			const blockerResult = evaluateSettlementBlockers(payments, externalClaims);
			if (blockerResult.isBlocked) {
				throw new ConflictException(
					`Settlement is blocked by active claims or pending refunds: ${blockerResult.blockingReasons.join("; ")}`
				);
			}

			// 3. Compute 5% platform commission and 95% net amount (BR-333, BR-337, BR-338)
			const settlementBase = blockerResult.settlementBase;
			const baseMinor = moneyToMinor(settlementBase);
			const feeMinor = (baseMinor * 5n) / 100n;
			const netMinor = baseMinor - feeMinor;

			const platformFee = minorToMoney(feeMinor);
			const netAmount = minorToMoney(netMinor);

			// 4. Save Settlement snapshot record (BR-334, PB AC-7)
			const settlement = await manager.getRepository(Settlement).save(
				manager.getRepository(Settlement).create({
					tripId,
					hostId: trip.hostId,
					settlementBase,
					commissionRate: PLATFORM_COMMISSION_RATE,
					platformFee,
					netAmount,
					settledAt: now,
				})
			);

			// 5. Upsert HostWallet and credit net balance
			let wallet = await manager.getRepository(HostWallet).findOne({
				where: { hostId: trip.hostId },
				lock: { mode: "pessimistic_write" },
			});
			if (!wallet) {
				wallet = manager.getRepository(HostWallet).create({
					hostId: trip.hostId,
					balance: "0.00",
				});
				wallet = await manager.getRepository(HostWallet).save(wallet);
			}

			const currentBalanceMinor = moneyToMinor(wallet.balance);
			const newBalanceMinor = currentBalanceMinor + netMinor;
			const walletBalanceAfter = minorToMoney(newBalanceMinor);

			wallet.balance = walletBalanceAfter;
			await manager.getRepository(HostWallet).save(wallet);

			// 6. Record immutable ledger transaction (BR-334)
			await manager.getRepository(WalletTransaction).save(
				manager.getRepository(WalletTransaction).create({
					walletId: wallet.id,
					settlementId: settlement.id,
					tripId: trip.id,
					type: WalletTransactionType.SETTLEMENT_CREDIT,
					baseAmount: settlementBase,
					feeAmount: platformFee,
					netAmount,
					balanceAfter: walletBalanceAfter,
					description: `Quyết toán doanh thu chuyến đi: ${trip.title}`,
				})
			);

			// 7. Record Audit Log (BR-347)
			await manager.getRepository(AuditLog).save({
				actorId: actorId || null,
				action: "settlement.created",
				targetType: "settlement",
				targetId: settlement.id,
				before: null,
				after: {
					settlementId: settlement.id,
					tripId: trip.id,
					settlementBase,
					platformFee,
					netAmount,
					commissionRate: PLATFORM_COMMISSION_RATE,
					hostId: trip.hostId,
					walletBalanceAfter,
				},
				reason: "Trip revenue settled and 95% net credited to Host Wallet",
			});

			this.logger.log(
				`Trip ${tripId} successfully settled. Base: ${settlementBase}, Fee: ${platformFee}, Net: ${netAmount}`
			);

			return {
				id: settlement.id,
				tripId: settlement.tripId,
				hostId: settlement.hostId,
				settlementBase: settlement.settlementBase,
				commissionRate: settlement.commissionRate,
				platformFee: settlement.platformFee,
				netAmount: settlement.netAmount,
				settledAt: settlement.settledAt,
				walletBalanceAfter,
			};
		});
	}

	/**
	 * Returns the Host's wallet balance, pending payout request (if any),
	 * and transaction history ledger.
	 */
	async getHostWallet(hostId: string): Promise<HostWalletResponseDto> {
		let wallet = await this.dataSource.getRepository(HostWallet).findOne({
			where: { hostId },
		});
		if (!wallet) {
			wallet = await this.dataSource.getRepository(HostWallet).save(
				this.dataSource.getRepository(HostWallet).create({
					hostId,
					balance: "0.00",
				})
			);
		}

		const pendingPayout = await this.dataSource.getRepository(Payout).findOne({
			where: { hostId, status: PayoutStatus.PENDING },
			order: { createdAt: "DESC" },
		});

		const transactions = await this.dataSource.getRepository(WalletTransaction).find({
			where: { walletId: wallet.id },
			order: { createdAt: "DESC" },
			take: 50,
		});

		return {
			id: wallet.id,
			hostId,
			balance: wallet.balance,
			pendingPayout: pendingPayout
				? {
						id: pendingPayout.id,
						amount: pendingPayout.amount,
						bankName: pendingPayout.bankName,
						accountNumber: pendingPayout.accountNumber,
						accountHolderName: pendingPayout.accountHolderName,
						createdAt: pendingPayout.createdAt,
					}
				: null,
			transactions: transactions.map((t) => ({
				id: t.id,
				type: t.type,
				baseAmount: t.baseAmount,
				feeAmount: t.feeAmount,
				netAmount: t.netAmount,
				balanceAfter: t.balanceAfter,
				description: t.description,
				createdAt: t.createdAt,
			})),
		};
	}

	/**
	 * Full-amount Host Payout ("Rút hết, không cho tự nhập số tiền").
	 * Host requests withdrawal of 100% of available wallet balance.
	 */
	async requestHostPayout(hostId: string, dto: RequestHostPayoutDto): Promise<Payout> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const wallet = await manager.getRepository(HostWallet).findOne({
				where: { hostId },
				lock: { mode: "pessimistic_write" },
			});
			if (!wallet || moneyToMinor(wallet.balance) <= 0n) {
				throw new ConflictException("Số dư ví không đủ để rút tiền (số dư phải lớn hơn 0 VNĐ)");
			}

			const existingPending = await manager.getRepository(Payout).findOne({
				where: { hostId, status: PayoutStatus.PENDING },
			});
			if (existingPending) {
				throw new ConflictException("Bạn đang có một yêu cầu rút tiền đang chờ xử lý");
			}

			// BR-351: Beneficiary account holder name MUST match Host registered fullName
			const hostUser = await manager.getRepository(User).findOne({ where: { id: hostId } });
			if (!hostUser || !hostUser.fullName || !hostUser.fullName.trim()) {
				throw new BadRequestException(
					"Vui lòng cập nhật họ và tên trong hồ sơ trước khi yêu cầu rút tiền"
				);
			}

			const isNameMatch = validateAccountHolderNameMatch(hostUser.fullName, dto.accountHolderName);
			if (!isNameMatch) {
				throw new BadRequestException(
					`Tên chủ tài khoản không khớp với họ tên đăng ký (${hostUser.fullName}). Vui lòng kiểm tra lại.`
				);
			}

			const withdrawAmount = wallet.balance;

			const payout = await manager.getRepository(Payout).save(
				manager.getRepository(Payout).create({
					hostId,
					walletId: wallet.id,
					amount: withdrawAmount,
					status: PayoutStatus.PENDING,
					bankName: dto.bankName.trim(),
					accountNumber: dto.accountNumber.trim(),
					accountHolderName: dto.accountHolderName.trim().toUpperCase(),
					adminNotes: dto.notes?.trim() || null,
				})
			);

			// Lock wallet balance to 0.00
			wallet.balance = "0.00";
			await manager.getRepository(HostWallet).save(wallet);

			// Immutable ledger entry
			await manager.getRepository(WalletTransaction).save(
				manager.getRepository(WalletTransaction).create({
					walletId: wallet.id,
					payoutId: payout.id,
					type: WalletTransactionType.PAYOUT_DEBIT,
					baseAmount: "0.00",
					feeAmount: "0.00",
					netAmount: `-${withdrawAmount}`,
					balanceAfter: "0.00",
					description: `Yêu cầu rút toàn bộ số dư về ${dto.bankName} - ${dto.accountNumber}`,
				})
			);

			// Audit log
			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "host.payout_requested",
				targetType: "payout",
				targetId: payout.id,
				before: { balance: withdrawAmount },
				after: {
					payoutId: payout.id,
					amount: withdrawAmount,
					bankName: dto.bankName,
					balanceAfter: "0.00",
				},
				reason: "Host requested full wallet withdrawal",
			});

			return payout;
		});
	}

	/**
	 * Admin confirms manual bank transfer for a Host Payout request.
	 */
	async confirmHostPayout(
		payoutId: string,
		adminId: string,
		dto: ConfirmHostPayoutDto
	): Promise<Payout> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const payout = await manager.getRepository(Payout).findOne({
				where: { id: payoutId },
				lock: { mode: "pessimistic_write" },
			});
			if (!payout) {
				throw new NotFoundException("Yêu cầu rút tiền không tồn tại");
			}
			if (payout.status !== PayoutStatus.PENDING) {
				throw new ConflictException("Yêu cầu rút tiền không ở trạng thái chờ xử lý");
			}

			payout.status = PayoutStatus.SUCCEEDED;
			payout.transactionRef = dto.transactionRef.trim();
			if (dto.adminNotes) {
				payout.adminNotes = dto.adminNotes.trim();
			}
			await manager.getRepository(Payout).save(payout);

			await manager.getRepository(AuditLog).save({
				actorId: adminId || null,
				action: "host.payout_confirmed",
				targetType: "payout",
				targetId: payout.id,
				before: { status: PayoutStatus.PENDING },
				after: {
					status: PayoutStatus.SUCCEEDED,
					transactionRef: dto.transactionRef,
					adminNotes: dto.adminNotes,
				},
				reason: dto.adminNotes ?? "Admin confirmed manual bank transfer for host payout",
			});

			return payout;
		});
	}

	/**
	 * Admin rejects a Host Payout request and restores the balance back to the Host Wallet.
	 */
	async rejectHostPayout(
		payoutId: string,
		adminId: string,
		dto: RejectHostPayoutDto
	): Promise<Payout> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const payout = await manager.getRepository(Payout).findOne({
				where: { id: payoutId },
				lock: { mode: "pessimistic_write" },
			});
			if (!payout) {
				throw new NotFoundException("Yêu cầu rút tiền không tồn tại");
			}
			if (payout.status !== PayoutStatus.PENDING) {
				throw new ConflictException("Yêu cầu rút tiền không ở trạng thái chờ xử lý");
			}

			payout.status = PayoutStatus.FAILED;
			payout.rejectionReason = dto.rejectionReason.trim();
			await manager.getRepository(Payout).save(payout);

			// Restore balance to wallet
			let wallet = await manager.getRepository(HostWallet).findOne({
				where: { id: payout.walletId },
				lock: { mode: "pessimistic_write" },
			});
			if (!wallet) {
				wallet = manager.getRepository(HostWallet).create({
					hostId: payout.hostId,
					balance: payout.amount,
				});
			} else {
				const restoredMinor = moneyToMinor(wallet.balance) + moneyToMinor(payout.amount);
				wallet.balance = minorToMoney(restoredMinor);
			}
			await manager.getRepository(HostWallet).save(wallet);

			// Record refund ledger entry
			await manager.getRepository(WalletTransaction).save(
				manager.getRepository(WalletTransaction).create({
					walletId: wallet.id,
					payoutId: payout.id,
					type: WalletTransactionType.PAYOUT_REFUND,
					baseAmount: "0.00",
					feeAmount: "0.00",
					netAmount: payout.amount,
					balanceAfter: wallet.balance,
					description: `Hoàn trả số dư yêu cầu rút tiền bị từ chối: ${dto.rejectionReason}`,
				})
			);

			await manager.getRepository(AuditLog).save({
				actorId: adminId || null,
				action: "host.payout_rejected",
				targetType: "payout",
				targetId: payout.id,
				before: { status: PayoutStatus.PENDING },
				after: {
					status: PayoutStatus.FAILED,
					rejectionReason: dto.rejectionReason,
					restoredBalance: wallet.balance,
				},
				reason: dto.rejectionReason,
			});

			return payout;
		});
	}

	/**
	 * Lists trips for Admin settlement overview with filtering.
	 */
	async listAdminSettlements(query: AdminSettlementQueryDto) {
		const qb = this.dataSource
			.getRepository(Trip)
			.createQueryBuilder("trip")
			.leftJoinAndSelect("trip.host", "host")
			.where("trip.status = :status", { status: TripStatus.COMPLETED })
			.orderBy("trip.updatedAt", "DESC");

		if (query.search?.trim()) {
			const term = `%${query.search.trim().toLowerCase()}%`;
			qb.andWhere("(LOWER(trip.title) LIKE :term OR LOWER(host.full_name) LIKE :term)", { term });
		}

		const trips = await qb.getMany();
		const evaluations = await Promise.all(trips.map((t) => this.evaluateTripSettlement(t.id)));

		let filtered = evaluations;
		if (query.status === "eligible") {
			filtered = evaluations.filter((e) => e.isEligible);
		} else if (query.status === "held") {
			filtered = evaluations.filter(
				(e) => !e.isSettled && (!e.isHoldPeriodSatisfied || !e.isComplaintWindowSatisfied)
			);
		} else if (query.status === "blocked") {
			filtered = evaluations.filter((e) => !e.isSettled && e.isBlocked);
		} else if (query.status === "settled") {
			filtered = evaluations.filter((e) => e.isSettled);
		}

		const page = query.page ?? 1;
		const limit = query.limit ?? 15;
		const total = filtered.length;
		const items = filtered.slice((page - 1) * limit, page * limit);

		return {
			items,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit) || 1,
		};
	}

	/**
	 * Lists Host Payouts for Admin reconciliation.
	 */
	async listAdminPayouts(query: {
		status?: string;
		search?: string;
		page?: number;
		limit?: number;
	}) {
		const page = query.page ?? 1;
		const limit = query.limit ?? 15;
		const skip = (page - 1) * limit;

		const qb = this.dataSource
			.getRepository(Payout)
			.createQueryBuilder("payout")
			.innerJoinAndSelect("payout.host", "host")
			.innerJoinAndSelect("payout.wallet", "wallet")
			.orderBy("payout.createdAt", "DESC");

		if (query.status) {
			qb.andWhere("payout.status = :status", { status: query.status });
		}

		if (query.search?.trim()) {
			const term = `%${query.search.trim().toLowerCase()}%`;
			qb.andWhere(
				"(LOWER(host.full_name) LIKE :term OR LOWER(host.email) LIKE :term OR LOWER(payout.account_holder_name) LIKE :term OR LOWER(payout.account_number) LIKE :term)",
				{ term }
			);
		}

		const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

		return {
			items: items.map((p) => ({
				id: p.id,
				hostId: p.hostId,
				hostName: p.host?.fullName || "Host",
				hostEmail: p.host?.email || null,
				hostPhone: p.host?.phone || null,
				walletId: p.walletId,
				amount: p.amount,
				status: p.status,
				bankName: p.bankName,
				accountNumber: p.accountNumber,
				accountHolderName: p.accountHolderName,
				transactionRef: p.transactionRef,
				rejectionReason: p.rejectionReason,
				adminNotes: p.adminNotes,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
			})),
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit) || 1,
		};
	}
}
