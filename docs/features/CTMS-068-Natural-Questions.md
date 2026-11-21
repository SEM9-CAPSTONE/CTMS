# Natural Vietnamese questions against English planning sources

## Reproduced failure

For `tôi sắp đi trekking, tôi cần chuẩn bị cái gì`, the original `crossLingualCorroboration` recognized none of its listed hazard/medical/navigation concepts and returned false for every English passage. Consequently `selectRagChunks` rejected relevant planning evidence even above the configured cross-language cosine floor. This is a reproducible code defect; the screenshot alone cannot establish whether the running request also encounters a separate source-eligibility problem.

Four regression cases were first run against the old policy: all four failed, returning insufficient context despite a complete literal English checklist. The test also supplies higher-scoring unrelated text, a title-only match and a form stub, so relaxing the threshold or accepting every candidate would not satisfy it.

## Change

`rag-cross-lingual.ts` now recognizes a general preparation intent from multiple Vietnamese/English forms. When no more specific topic is recognized, the original passage must contain substantive preparation wording (at least six words) and outdoor context when requested. Recognized specific safety topics retain their all-topic body check and take precedence over generic trip wording. Contact, fitness, weather and wildlife aliases cover additional natural planning questions. Short colon-ended form labels are excluded; ambiguous aliases that confused a self-check with a trusted contact or a trip recap with fitness were removed.

The relevance version is `vi-en-concepts-v2`, which changes the retrieval configuration fingerprint. Source eligibility, current-version checks, OCR integrity, cosine floors, Top-K, context limits, item completeness and final answer provenance checks remain unchanged. Unknown intents and unsupported language pairs remain excluded; this bounded vocabulary does not guarantee recognition of every paraphrase.

## Actual local model diagnostic

The diagnostic used 100 cached original NPS Trip Planning Guide excerpts, their full existing embedding inputs, and the real CPU `intfloat/multilingual-e5-small` model at revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`. Artifacts were loaded offline. The same normalized vectors and cosine scores were passed through the baseline and updated TypeScript selection code, with the existing 0.74 cross-language floor and Top-K 5.

| Question | Baseline selected | Updated selected | Complete selected context, E5 tokens |
| --- | ---: | ---: | ---: |
| tôi sắp đi trekking, tôi cần chuẩn bị cái gì | 0 | 5 | 835 |
| Cuối tuần này mình đi trekking lần đầu, cần chuẩn bị những gì? | 0 | 5 | 817 |
| Trước khi đi mình nên báo cho người nhà những thông tin nào? | 0 | 5 | 730 |
| Làm sao biết cung đường đó có quá sức với mình? | 0 | 5 | 810 |

For the reported question, selected headings include Gear, Arrival at the Park, Before the Trip, Check the 10 Essentials and Your Gear, and Know Before You Go. The page-one checklist score was approximately 0.81863. Some short unusable fragments scored above 0.85, confirming why cosine alone is insufficient. The updated policy excludes them. All selected prefixes fit the 1,200-token retrieval budget with synthetic UUID-length citation IDs. Token counting does not run these long contexts through the E5 encoder.

This is an offline retrieval diagnostic, not a live database or LLM answer result. Cached excerpts do not activate a source, establish current publication or override any v5 review requirements. Live chunk IDs differ, and their tokenizer lengths can affect the exact budget.

## Validation

- 174 tests passed across 10 backend unit suites, including the natural-question regressions and preserved source/answer safety boundaries.
- API and affected PostgreSQL integration file passed TypeScript checking.
- Real pinned multilingual encoder and tokenizer were executed offline for the four questions above.
- Added a PostgreSQL integration case for the original Vietnamese question, English checklist provenance, and withdrawal fencing. The integration run was attempted but stopped in global setup with `connect EACCES 127.0.0.1:55451`; no database or real chat pass is claimed.
- No original PDF, runtime source publication, embeddings, UI message or production configuration was changed by this retrieval fix. It requires updated API code, not re-OCR of an otherwise eligible existing source.
