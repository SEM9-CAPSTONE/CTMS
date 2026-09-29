# CTMS-107 — Analyze Trip Reviews with AI

## 1. Overview

Story: CTMS-107

Epic: EPIC 16. Reviews and Feedback

Use Case: Analyze Trip Reviews with AI

Priority: Should Have

Goal: Generate derived AI insights from reviews without altering the authoritative user review or numeric reputation input.

Backlog story: As the System, I want to analyze reviews with AI so useful sentiment/topics can be derived while preserving original review evidence.

Acceptance Criteria:

| Source  | Criterion                                                                |
| ------- | ------------------------------------------------------------------------ |
| PB AC-1 | AI analysis creates only derived fields.                                 |
| PB AC-2 | AI must not modify rating, original comment, reviewer, or Trip relation. |
| PB AC-3 | AI sentiment/topic does not replace numeric Camper rating in reputation. |
| PB AC-4 | Re-analysis is allowed when model changes.                               |
| PB AC-5 | Raw review and analysis model/version metadata remain traceable.         |
| PB AC-6 | Reported reviews continue through moderation policy.                     |

## 2. Scope

### In Scope

Derived fields such as:

- sentiment;
- topics;
- summary;
- confidence;
- model version.

### Out of Scope

- Modifying original reviews.
- Replacing rating with AI sentiment.
- Moderation decisions.

## 3. Actors & Authorization

Primary actor:

- System/AI analysis process.

## 4. Preconditions & Dependencies

Review exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-303 | AI review analysis may create only derived fields such as sentiment, topics, summary, confidence, and model_version. AI must not modify the rating, original comment, reviewer, or Trip relationship. |
| BR-304 | AI-derived sentiment or topics must not replace the Camper's numeric rating when calculating reputation. Aggregate rating and AI insight are separate outputs.                                        |
| BR-305 | When the analysis model changes, the system may re-analyze existing reviews. The raw review, metadata, and model version for each analysis result must be preserved for traceability.                 |
| BR-306 | A reported review must be handled through the moderation policy. Review history and audit records must not be hard-deleted during content handling.                                                   |

## 6. State & Lifecycle

Raw review
→ AI analysis
→ derived analysis version
→ optional later re-analysis
→ new derived version/context.

Raw review remains authoritative.

## 7. Business Flow

1. Load eligible review.
2. Preserve raw review unchanged.
3. Run AI analysis.
4. Produce derived fields.
5. Store model/version metadata.
6. Display/use derived insight separately from numeric rating.
7. Re-analyze if model/version changes when required.

## 8. Data & Invariants

Authoritative:

- rating;
- original comment;
- reviewer;
- Trip relation.

Derived:

- sentiment;
- topics;
- summary;
- confidence;
- model_version.

Derived data must not overwrite authoritative fields.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior              |
| ------------------------ | ------------------------------ |
| AI disagrees with rating | Preserve rating                |
| Model changes            | Re-analysis allowed            |
| Re-analysis              | Previous traceability retained |
| Reported review          | Moderation still applies       |
| AI fails                 | Raw review remains valid       |

## 11. Acceptance & Test Matrix

| Source | Scenario                      | Expected Result        | Test Type     |
| ------ | ----------------------------- | ---------------------- | ------------- |
| BR-303 | Analyze review                | Derived fields created | Integration   |
| BR-303 | AI output                     | Raw review unchanged   | Integrity     |
| BR-304 | Sentiment differs from rating | Rating unchanged       | Business Rule |
| BR-305 | Model update                  | Re-analysis traceable  | Audit         |

## 12. Open Decisions

Exact AI model and taxonomy belong to Technical Design.
