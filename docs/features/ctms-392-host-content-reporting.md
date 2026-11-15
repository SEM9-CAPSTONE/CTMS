# CTMS-392 — Host web content reporting

The Host can open the current source review in Review Analysis, submit a report, and track it under “Báo cáo đánh giá”. This entry point covers source reviews visible in the existing analysis workflow. The owner API provides report details but does not provide the review text, Trip title, or Trip-versus-Host review subtype in report history. As a result, the detail view can identify the target only as a participant review. Hosts cannot tell which review a report references when descriptions are alike. Enriching that context requires separate backend work and a visibility decision.

Local smoke check: an existing eligible source review was opened as Host. Submission returned HTTP 200 and the saved record appeared in the owner list and detail. Browser-only simulated responses are used for UI evidence of edge states and are outside the source tree.

Follow-up smoke check: the browser discarded the first successful local POST response. Retrying with the same key returned HTTP 200 and the same report ID, and the report appeared in the owner list and detail. Keyboard checks at 390 and 1440 px verified forward and reverse tab trapping and focus restoration after Escape.

Follow-ups: show an existing open report alongside its source review; align timestamps on the Review Analysis page separately. Full repository verification remains pending.

The form counts Unicode code points after trimming. Retries of the same submitted content keep their request key. Editing the content clears that key. A tab-scoped draft keyed by account and review survives the existing sign-in redirect and is restored when the same account opens the form again.

Camper Flutter remains pending. The existing booking review context exposes only the caller's own reviews, which cannot be self-reported. Before assigning the read API, agree on readership, author attribution, hidden review and image visibility, and ownership of the API and Flutter work. Track Host web acceptance separately from Camper completion.

After UI approval, verify form validation at the Vietnamese/emoji boundary, repeat clicks, retry keys, conflicts, draft recovery, focus behavior, and report history with CTMS-391. Follow with relevant regression and repository checks. Previous review-analysis and web memory issues belong to prior verification history.
