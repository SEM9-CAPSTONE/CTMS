import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { TrekkingRoute } from "../../trekking-routes/entities/trekking-route.entity";

export enum WeatherSnapshotStatus {
	SUCCESS = "success",
	FAILED = "failed",
}

/**
 * CTMS-25-T01. One row per fetch attempt for a Route's representative point
 * -- never updated in place, only ever inserted (BR-065's "timestamp is
 * stored" + the "reproducible" requirement CTMS-26 needs later: a later
 * risk-score calculation must be able to look up exactly which snapshot it
 * used, which an update-in-place table could never guarantee).
 *
 * A FAILED row (BR-229) records that an attempt happened and why it failed
 * -- every weather/provider column stays null, never a fabricated reading.
 */
@Entity({ name: "weather_snapshots" })
@Index("IDX_weather_snapshots_route_created", ["routeId", "createdAt"])
export class WeatherSnapshot {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "route_id", type: "uuid" })
	routeId!: string;

	@ManyToOne(() => TrekkingRoute, { onDelete: "CASCADE" })
	@JoinColumn({ name: "route_id" })
	route!: TrekkingRoute;

	@Column({ type: "enum", enum: WeatherSnapshotStatus, enumName: "weather_snapshot_status" })
	status!: WeatherSnapshotStatus;

	/** The provider's own reported observation time -- null on a FAILED row. */
	@Column({ name: "observed_at", type: "timestamptz", nullable: true })
	observedAt!: Date | null;

	@Column({ name: "rainfall_mm", type: "double precision", nullable: true })
	rainfallMm!: number | null;

	@Column({ name: "wind_kph", type: "double precision", nullable: true })
	windKph!: number | null;

	@Column({ name: "temperature_c", type: "double precision", nullable: true })
	temperatureC!: number | null;

	@Column({ name: "visibility_m", type: "double precision", nullable: true })
	visibilityM!: number | null;

	@Column({ name: "thunderstorm", type: "boolean", nullable: true })
	thunderstorm!: boolean | null;

	/** Raw WMO weather code from the provider -- kept so a future rule change
	 * (e.g. CTMS-26/CTMS-30) can re-derive `thunderstorm` or new signals
	 * without re-fetching. */
	@Column({ name: "provider_weather_code", type: "integer", nullable: true })
	providerWeatherCode!: number | null;

	/** Full raw provider response, for audit/debugging -- never parsed back
	 * out for business logic, only the typed columns above are authoritative. */
	@Column({ name: "provider_response", type: "jsonb", nullable: true })
	providerResponse!: Record<string, unknown> | null;

	@Column({ name: "error_message", type: "varchar", length: 500, nullable: true })
	errorMessage!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
