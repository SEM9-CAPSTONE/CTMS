import {
	ConnectedSocket,
	MessageBody,
	type OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

@WebSocketGateway({
	cors: {
		origin: "*",
	},
})
export class EventsGateway implements OnGatewayConnection {
	@WebSocketServer()
	server!: Server;

	handleConnection(client: Socket) {
		client.emit("connected", {
			message: "Connected to CTMS real-time gateway",
		});
	}

	@SubscribeMessage("emergency.broadcast")
	broadcastEmergency(@MessageBody() payload: unknown, @ConnectedSocket() client: Socket) {
		client.broadcast.emit("emergency.alert", payload);
		return {
			delivered: true,
		};
	}

	emitTripReviewUpdated(payload: {
		tripId: string;
		title: string;
		hostId: string;
		updatedAt: string;
	}) {
		this.server?.emit("trip.review.updated", payload);
	}

	emitTripReviewRequested(payload: {
		tripId: string;
		title: string;
		hostId: string;
		submittedAt: string;
		deadlineAt: string;
	}) {
		this.server?.emit("trip.review.requested", payload);
	}

	emitTripReviewReminder(payload: {
		tripId: string;
		title: string;
		hostId: string;
		submittedAt: string;
		deadlineAt: string;
	}) {
		this.server?.emit("trip.review.reminder", payload);
	}

	emitTripReviewAutoRejected(payload: {
		tripId: string;
		title: string;
		hostId: string;
		rejectedAt: string;
		reason: string;
	}) {
		this.server?.emit("trip.review.auto_rejected", payload);
	}

	emitPorterRequestCreated(payload: {
		requestId: string;
		tripId: string;
		porterId: string;
		requestedBy: string;
		requestedRole: string;
		expiresAt: string;
	}) {
		this.server?.emit("porter.request.created", payload);
	}

	emitPorterRequestStateChanged(payload: {
		requestId: string;
		tripId: string;
		porterId: string;
		requestedBy: string;
		status: string;
		respondedAt: string | null;
	}) {
		this.server?.emit("porter.request.state_changed", payload);
	}

	/** CTMS-049: classification only; description and coordinates stay behind the authorized API. */
	emitTripIncidentReported(payload: {
		incidentId: string;
		tripId: string;
		hostId: string;
		reporterId: string;
		category: string;
		severity: string;
		occurredAt: string;
	}) {
		this.server?.emit("trip.incident.reported", payload);
	}
}
