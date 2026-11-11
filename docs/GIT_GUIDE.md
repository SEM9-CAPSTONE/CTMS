# Git, Commit, PR, and Jira Workflow

This guide is the source of truth for creating branches, writing commits, linking work to Jira, and opening pull requests for CTMS.

## 1. One-Time Git Setup

Run once on your machine:

```bash
git config --global pull.ff only
git config --global push.default current
```

If you work from `develop`, make sure it tracks the remote branch:

```bash
git checkout develop
git branch --set-upstream-to=origin/develop develop
```

## 2. Jira Key Rule

Every branch, commit, and pull request that implements or changes a Jira story/task must include the Jira key.

Valid examples:

```text
CTMS-01
CTMS-43
CTMS-126
```

Use the story key when the work covers a story. Use the task key only when the task exists in Jira and is the direct implementation unit.

## 3. Branch Naming

Create branches from an updated `develop` branch:

```bash
git checkout develop
git pull
git checkout -b feat/CTMS-01-register-account
```

Allowed branch prefixes:

```text
feat/
feature/
fix/
bugfix/
hotfix/
refactor/
chore/
docs/
test/
release/
```

Required format for Jira-backed work:

```text
<type>/<JIRA-KEY>-<short-kebab-description>
```

Examples:

```text
feat/CTMS-01-register-account
fix/CTMS-43-payment-idempotency
refactor/CTMS-06-role-guards
docs/CTMS-01-jira-planning-specs
test/CTMS-35-overcapacity-rollback
```

Release branches may use:

```text
release/1.0.0
release/sprint-1-demo
```

## 4. Commit Message Standard

Use Conventional Commits and include the Jira key in the scope:

```text
<type>(<JIRA-KEY>): <short imperative summary>
```

Examples:

```text
feat(CTMS-01): implement account registration
fix(CTMS-43): prevent duplicate payment capture
refactor(CTMS-06): centralize role guard checks
docs(CTMS-01): update Jira planning specs
test(CTMS-35): cover overcapacity transaction rollback
```

Allowed commit types:

```text
feat
fix
refactor
docs
test
chore
build
ci
perf
style
revert
```

For commits that span multiple Jira stories, prefer separate commits. If one commit must cover multiple keys, put the primary key in the scope and list the other keys in the body:

```text
docs(CTMS-01): update sprint planning references

Related Jira: CTMS-02, CTMS-03, CTMS-04
```

## 5. Linking Commits and PRs to Jira

Add a Jira reference in the commit body or PR description:

```text
Jira: https://thuha140105.atlassian.net/browse/CTMS-01
```

For multiple issues:

```text
Jira:
- https://thuha140105.atlassian.net/browse/CTMS-01
- https://thuha140105.atlassian.net/browse/CTMS-02
```

If the team uses Jira development panel automation, keeping the key in the branch, commit, and PR title helps Jira auto-link the work.

## 6. Pull Request Standard

PR title format:

```text
[CTMS-01] Register with email or phone number
```

PR description must include:

- Jira key and Jira URL.
- Summary of changes.
- Type of change.
- Scope.
- Test evidence or a clear reason tests were not run.

Before requesting review, run the relevant checks:

```bash
pnpm lint:all
pnpm build:all
pnpm test:all
```

For documentation-only changes, full build/test may be skipped, but the changed files should still be reviewed for links, formatting, and CSV parseability when applicable.

## 7. Push and Open PR

Push the current branch:

```bash
git push
```

Then open a PR into `develop`.

## 8. Common Cases

### Documentation-only Jira planning update

```bash
git checkout develop
git pull
git checkout -b docs/CTMS-01-jira-planning-specs
git add docs/planning file/spec
git commit -m "docs(CTMS-01): update Jira planning specs"
git push
```

Use this PR title:

```text
[CTMS-01] Update Jira planning specs
```

### Fix linked to a Jira story

```bash
git checkout -b fix/CTMS-43-payment-idempotency
git add .
git commit -m "fix(CTMS-43): prevent duplicate payment capture"
git push
```

### Work without Jira

Avoid this for product work. If a change has no Jira item, use a clear non-product branch only when appropriate:

```text
chore/no-jira-update-tooling
docs/no-jira-readme-cleanup
```

If the branch validator rejects a no-Jira branch, create or assign a Jira task first.
