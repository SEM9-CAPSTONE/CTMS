---
name: react-component-splitter
description: >
  Analyzes and refactors large React components into smaller, focused sub-components
  following SOLID principles and the ehub project conventions.
  Use when the user asks to split, refactor, or decompose a component,
  or when reviewing a component that exceeds 150 lines.
---

# React Component Splitter Skill

## Purpose

Break down large, monolithic React components into small, focused sub-components
that each have a single responsibility. The output follows SOLID principles and
the ehub-reactjs-fe project conventions.

## Trigger

Use this skill when:
- User asks to split, decompose, or refactor a large component
- A component exceeds ~150 lines
- A component mixes UI rendering with business logic
- A component has multiple distinct visual sections

## Analysis Process

### Step 1 — Identify Responsibilities

Scan the component for:
1. **Distinct visual sections** (header, body, footer, sidebar, modals, etc.)
2. **Repeated UI patterns** (list items, cards, rows)
3. **Business logic mixed with UI** (data transformations, API calls, complex conditions)
4. **State management clusters** (groups of related `useState`)
5. **Effect handlers** (side effects that can be extracted)

### Step 2 — Plan the Split

For each identified responsibility, plan:
- A separate component file in `components/`
- A custom hook in `hooks/` if the component has significant logic
- Typed props interface (no `any`)
- Clear data flow: parent passes data → child renders

### Step 3 — Extract Custom Hooks

Move logic out of components:

```typescript
// ❌ BEFORE: Logic in component
function FeaturePage() {
  const [data, setData] = useState<FeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchData(page).then(setData).finally(() => setLoading(false));
  }, [page]);

  const handleDelete = async (id: string) => { /* ... */ };
  // ... 200 lines of JSX
}

// ✅ AFTER: Hook extracts logic
function useFeatureList() {
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.featureName.all, page],
    queryFn: () => featureService.getAll(page, FEATURE_DEFAULT_LIMIT),
  });

  return { items: data?.data ?? [], isLoading, page, setPage };
}

function useFeatureActions() {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => featureService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.featureName.all });
    },
  });

  return { deleteFeature: deleteMutation.mutate, isDeleting: deleteMutation.isPending };
}
```

### Step 4 — Extract Sub-Components

Rules for extracted components:
- **Typed Props**: Every component gets an explicit props interface
- **Single Responsibility**: One visual concern per component
- **No business logic**: Only rendering + event handler forwarding
- **Use Shadcn UI**: Prefer existing Shadcn components
- **Use cn()**: For class merging
- **Use i18n**: For all text

```typescript
// ❌ BEFORE: One massive component
function FeaturePage() {
  // ... 300 lines mixing everything
}

// ✅ AFTER: Composed from small components
function FeaturePage() {
  const { t } = useTranslation("featureName");
  const { items, isLoading } = useFeatureList();
  const { deleteFeature } = useFeatureActions();

  return (
    <div className="space-y-6">
      <FeatureHeader title={t("title")} />
      <FeatureFilters onFilterChange={handleFilter} />
      <FeatureTable
        items={items}
        isLoading={isLoading}
        onDelete={deleteFeature}
      />
      <FeaturePagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
```

### Step 5 — Define Props Interfaces

```typescript
// Every component gets its own typed props
interface FeatureTableProps {
  items: FeatureItem[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onEdit: (item: FeatureItem) => void;
}

interface FeatureCardProps {
  item: FeatureItem;
  onSelect: (id: string) => void;
  isSelected: boolean;
}
```

### Step 6 — Handle Conditional Rendering

```typescript
// ❌ NEVER: Nested ternaries
{condition1 ? <A /> : condition2 ? <B /> : <C />}

// ✅ ALWAYS: Extract to variables or early returns
const isEditing = mode === FormMode.EDIT;
const isCreating = mode === FormMode.CREATE;

if (isLoading) {
  return <FeatureSkeleton />;
}

return isEditing ? <EditForm /> : <ViewDisplay />;
```

## Output Structure

After splitting, the feature folder should look like:

```
features/<feature-name>/
├── components/
│   ├── FeatureHeader.tsx       # ~30 lines
│   ├── FeatureTable.tsx        # ~80 lines
│   ├── FeatureCard.tsx         # ~50 lines
│   ├── FeatureFilters.tsx      # ~60 lines
│   ├── FeatureDialog.tsx       # ~70 lines
│   └── FeatureEmptyState.tsx   # ~20 lines
├── hooks/
│   ├── useFeatureList.ts       # Query + pagination logic
│   ├── useFeatureActions.ts    # Mutations (create, update, delete)
│   └── useFeatureFilters.ts    # Filter state management
├── pages/
│   └── FeaturePage.tsx         # ~50 lines, composes components
├── services/
│   └── feature.service.ts      # API calls only
├── types.ts
└── constants.ts
```

## Validation Checklist

- [ ] Every component < 150 lines
- [ ] Every component has typed props interface
- [ ] No `any` types
- [ ] Business logic in hooks, not components
- [ ] API calls in services, not hooks
- [ ] All text uses `t()` for i18n
- [ ] `cn()` used for class merging
- [ ] No nested ternaries
- [ ] Conditions extracted to named booleans
- [ ] Shadcn UI components used where applicable
