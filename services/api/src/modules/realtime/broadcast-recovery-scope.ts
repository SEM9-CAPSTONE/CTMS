/** SQL fragments receive only fixed aliases and parameter placeholders from our repositories. */
export function broadcastRecoveryScope(broadcast: string, user: string, includeTeam = false) {
	const camper = `EXISTS (
		SELECT 1 FROM booking_members m JOIN bookings bk ON bk.id = m.booking_id
		WHERE bk.trip_id = ${broadcast}.trip_id AND m.user_id = ${user}
		  AND bk.status IN ('confirmed', 'completed')
		  AND m.member_status IN ('registered', 'joined')
	)`;
	const recipient = `EXISTS (
		SELECT 1 FROM emergency_broadcast_recipients r
		WHERE r.broadcast_id = ${broadcast}.id AND r.user_id = ${user}
	) AND (${camper}${
		includeTeam
			? ` OR EXISTS (
		SELECT 1 FROM trip_porters p WHERE p.trip_id = ${broadcast}.trip_id
		  AND p.porter_id = ${user} AND p.status = 'assigned'
	)`
			: ""
	})`;
	return includeTeam ? `(${broadcast}.host_id = ${user} OR (${recipient}))` : `(${recipient})`;
}
