import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { ConfigureTripWaypointsDto, CreateTripDto } from "../dto/create-trip.dto";
import { ReviewTripAction, type ReviewTripDto } from "../dto/review-trip.dto";
import type { SearchTripsQueryDto } from "../dto/search-trips-query.dto";
import type { PaginatedTripsResponseDto, TripResponseDto } from "../dto/trip-response.dto";
import { TripStatus, TripType } from "../entities/trip.entity";
import type { TripsService } from "../services/trips.service";
import { TripsController } from "./trips.controller";

const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "88888888-8888-4888-8888-888888888888";

const MOCK_USER: AuthenticatedUser = {
	userId: USER_ID,
	roles: [UserRole.CAMPER],
	status: UserStatus.ACTIVE,
};

describe("TripsController", () => {
	let tripsService: {
		search: jest.Mock;
		getTripDetails: jest.Mock;
		create: jest.Mock;
		configureWaypoints: jest.Mock;
		listPendingReview: jest.Mock;
		review: jest.Mock;
	};
	let controller: TripsController;

	beforeEach(() => {
		tripsService = {
			search: jest.fn(),
			getTripDetails: jest.fn(),
			create: jest.fn(),
			configureWaypoints: jest.fn(),
			listPendingReview: jest.fn(),
			review: jest.fn(),
		};
		controller = new TripsController(tripsService as unknown as TripsService);
	});

	describe("search", () => {
		it("delegates to TripsService.search with query", async () => {
			const mockResult: PaginatedTripsResponseDto = {
				items: [],
				pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			};
			tripsService.search.mockResolvedValue(mockResult);

			const query: SearchTripsQueryDto = { page: 1, limit: 20 };
			const result = await controller.search(query);

			expect(tripsService.search).toHaveBeenCalledWith(query);
			expect(result).toBe(mockResult);
		});
	});

	describe("getTripDetails", () => {
		it("delegates to TripsService.getTripDetails with user and tripId", async () => {
			const mockTrip: Partial<TripResponseDto> = {
				id: TRIP_ID,
				title: "Mountain Trek",
				status: TripStatus.PUBLISHED,
				isBookable: true,
			};
			tripsService.getTripDetails.mockResolvedValue(mockTrip as TripResponseDto);

			const result = await controller.getTripDetails({ user: MOCK_USER }, { tripId: TRIP_ID });

			expect(tripsService.getTripDetails).toHaveBeenCalledWith(MOCK_USER, TRIP_ID);
			expect(result).toBe(mockTrip);
		});
	});

	describe("create", () => {
		it("delegates to TripsService.create with hostId and dto", async () => {
			const dto: CreateTripDto = {
				routeId: "22222222-2222-4222-8222-222222222222",
				title: "Trip Title",
				tripType: TripType.DAY_TRIP,
				startsAt: "2026-09-20T01:00:00.000Z",
				endsAt: "2026-09-20T10:00:00.000Z",
				meetingPoint: { type: "Point", coordinates: [108.44, 11.94] },
				bookingDeadline: "2026-09-19T12:00:00.000Z",
				capacityMin: 2,
				pricePerPerson: 100000,
				waypoints: [],
			};
			const mockCreated: Partial<TripResponseDto> = { id: TRIP_ID, title: "Trip Title" };
			tripsService.create.mockResolvedValue(mockCreated as TripResponseDto);

			const result = await controller.create({ user: MOCK_USER }, dto);

			expect(tripsService.create).toHaveBeenCalledWith(USER_ID, dto);
			expect(result).toBe(mockCreated);
		});
	});

	describe("configureWaypoints", () => {
		it("delegates to TripsService.configureWaypoints with hostId, tripId, and dto", async () => {
			const dto: ConfigureTripWaypointsDto = { waypoints: [] };
			const mockConfigured: Partial<TripResponseDto> = {
				id: TRIP_ID,
				status: TripStatus.PENDING_APPROVAL,
			};
			tripsService.configureWaypoints.mockResolvedValue(mockConfigured as TripResponseDto);

			const result = await controller.configureWaypoints(
				{ user: MOCK_USER },
				{ tripId: TRIP_ID },
				dto
			);

			expect(tripsService.configureWaypoints).toHaveBeenCalledWith(USER_ID, TRIP_ID, dto);
			expect(result).toBe(mockConfigured);
		});
	});

	describe("listPendingReview", () => {
		it("delegates to TripsService.listPendingReview with no arguments", async () => {
			const mockPending: Array<Partial<TripResponseDto>> = [
				{ id: TRIP_ID, status: TripStatus.PENDING_APPROVAL },
			];
			tripsService.listPendingReview.mockResolvedValue(mockPending);

			const result = await controller.listPendingReview();

			expect(tripsService.listPendingReview).toHaveBeenCalledWith();
			expect(result).toBe(mockPending);
		});
	});

	describe("review", () => {
		it("delegates to TripsService.review with adminId, tripId, and dto", async () => {
			const dto: ReviewTripDto = { action: ReviewTripAction.APPROVE };
			const mockReviewed: Partial<TripResponseDto> = { id: TRIP_ID, status: TripStatus.PUBLISHED };
			tripsService.review.mockResolvedValue(mockReviewed as TripResponseDto);

			const result = await controller.review({ user: MOCK_USER }, { tripId: TRIP_ID }, dto);

			expect(tripsService.review).toHaveBeenCalledWith(USER_ID, TRIP_ID, dto);
			expect(result).toBe(mockReviewed);
		});
	});
});
