import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { IncidentActionType, IncidentStatus } from "../incidents.enums";
import { TripIncident } from "./trip-incident.entity";

/**
 * CTMS-086. Immutable action log entry for Trip incidents (BR-269, PB AC-4).
 * Tracks state transitions, handler assignments, and notes with an authoritative actor and timestamp.
 */
@Entity({ name: "incident_actions" })
export class IncidentAction {
	@PrimaryColumn({ type: "uuid" })
	id!: string;

	@Column({ name: "incident_id", type: "uuid" })
	incidentId!: string;

	@ManyToOne(
		() => TripIncident,
		(incident) => incident.actions,
		{ onDelete: "CASCADE" }
	)
	@JoinColumn({ name: "incident_id", foreignKeyConstraintName: "FK_incident_actions_incident_id" })
	incident?: TripIncident;

	@Column({ name: "actor_id", type: "uuid" })
	actorId!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "actor_id", foreignKeyConstraintName: "FK_incident_actions_actor_id" })
	actor?: User;

	@Column({ type: "enum", enum: IncidentActionType, enumName: "incident_action_type" })
	action!: IncidentActionType;

	@Column({ type: "enum", enum: IncidentStatus, enumName: "incident_status", nullable: true })
	fromStatus!: IncidentStatus | null;

	@Column({ type: "enum", enum: IncidentStatus, enumName: "incident_status", nullable: true })
	toStatus!: IncidentStatus | null;

	@Column({ type: "varchar", length: 2000, nullable: true })
	note!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
