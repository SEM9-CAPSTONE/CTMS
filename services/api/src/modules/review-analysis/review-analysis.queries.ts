// Shared by selection and snapshot aggregation: do not drift eligibility rules.
export const SOURCE_FROM = `FROM trip_reviews r
 JOIN bookings b ON b.id=r.booking_id JOIN booking_members m ON m.id=r.member_id`;
export const BASE_ELIGIBLE = `(r.target='trip' AND b.trip_id=r.trip_id AND m.booking_id=b.id AND b.status='completed' AND m.member_status='joined'
 AND m.user_id=r.reviewer_id AND m.left_at IS NULL AND m.checked_in_at IS NOT NULL
 AND m.checked_in_at<=b.completed_at AND b.completed_at<=clock_timestamp()
 AND r.comment IS NOT NULL AND btrim(r.comment)<>'')`;
export const SUPPRESSED =
	"EXISTS(SELECT 1 FROM trip_review_analysis_suppressions s WHERE s.review_id=r.id)";
export const BLOCKED = `EXISTS(SELECT 1 FROM content_reports cr WHERE cr.target_id=r.id
 AND cr.target_type IN ('trip_review','review') AND cr.status<>'rejected')`;
export const ELIGIBLE = `(${BASE_ELIGIBLE} AND NOT ${SUPPRESSED} AND NOT ${BLOCKED})`;
