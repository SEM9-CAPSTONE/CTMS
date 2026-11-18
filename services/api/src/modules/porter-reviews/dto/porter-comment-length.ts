import { ValidateBy } from "class-validator";
import { PORTER_REVIEW_COMMENT_MAX_LENGTH } from "../porter-reviews.types";

/** Count Unicode code points, matching PostgreSQL char_length and Dart String.runes. */
export function PorterCommentLength(): PropertyDecorator {
	return ValidateBy({
		name: "maxLength",
		constraints: [PORTER_REVIEW_COMMENT_MAX_LENGTH],
		validator: {
			validate: (value: unknown) =>
				typeof value !== "string" || Array.from(value).length <= PORTER_REVIEW_COMMENT_MAX_LENGTH,
			defaultMessage: () =>
				`comment must be shorter than or equal to ${PORTER_REVIEW_COMMENT_MAX_LENGTH} Unicode characters`,
		},
	});
}
