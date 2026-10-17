# Class Diagram Convention (Report 4)

One class diagram per Jira Epic, for the "3.x.1 Class Diagram" slot of Report 4.
Reference examples (follow them exactly):

- `EPIC-01-Authentication-Class-Diagram.drawio`
- `EPIC-02-Trekking-Route-and-Checkpoint-Management-Class-Diagram.drawio`

## 1. Source code is the only truth

- Read the real code in `services/api/src/modules/<module>` before drawing. Never invent a class, field,
  route or method.
- Controllers: every `@Get/@Post/@Patch/@Put/@Delete` handler, written as
  `+ handlerName(params): METHOD /real/route`.
- Services: public methods with real parameter names and return types; private fields are the injected
  dependencies (`- usersRepository: UsersRepository`).
- Models: entity columns from `*.entity.ts` (`+ name: type`, mark `{PK}`, `{FK}`, `{unique}`, `[0..1]` for
  nullable) plus **only the repository methods the services actually call** (grep the service for
  `repository.xxx(` / `withRepository(...)` / `getRepository(Entity)`).
- A UC of the Epic with no code is not drawn; report it instead of inventing classes.

## 2. Layout (3 layers, like the team sample)

- Title: Epic name + "Class Diagram" only. No `CTMS-xxx` codes, no notes box.
- Row 1: Controllers (+ `RolesGuard` / `JwtAuthGuard` at the right when the controller uses them).
- Row 2: Services.
- Row 3 (and 4 if needed): Models (entities). Entities owned by another Epic (e.g. `User`, `AuditLog`)
  may appear in a short form.
- Put each service directly under its controller and each model directly under the service that
  mainly uses it, so most arrows are straight vertical lines.

## 3. Relationships (always a verb label)

| From → To | Style | Label |
|---|---|---|
| Controller → Service | dashed, open arrow | `depends on` |
| Controller → RolesGuard | dashed, open arrow | `protected by` |
| RolesGuard → JwtAuthGuard | dashed, open arrow | `runs after` |
| Service → Model | solid, open arrow | `associates with` (or a precise verb: `checks ownership of`, `creates`) |
| Owner entity → owned entity (FK, cascade) | filled diamond at owner | `has` + multiplicities (`1` / `0..1` / `0..*` / `1..*`) |
| Entity → referenced entity | solid, open arrow | precise verb (`owned by`, `records actions of`) + multiplicities |

## 4. Visual rules

- Black and white UML class boxes (name / attributes / methods), font 11–12.
- **No arrow, edge label or multiplicity may cross or touch a class box.** Route edges only through the
  empty gaps between rows/columns using explicit waypoints; leave ≥ 120 px between rows and ≥ 130 px
  between columns.
- No text may be cut off: widen the column instead of wrapping long method signatures.
- Render the diagram and check it visually before committing.

## 5. Files

- Folder: `docs/class-diagrams/`.
- Name: `EPIC-<NN>-<Epic-Title>-Class-Diagram.drawio` (one Epic per file, plain draw.io XML).
