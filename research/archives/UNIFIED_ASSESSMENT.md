# SpecQL Universal Full-Stack Generator: Integration Assessment

**Date**: 2025-11-11
**Vision**: Integrate specql_front into specql as a universal full-stack generator from business logic
**Status**: Design Phase → Production Integration Path

## 🎯 Updated Vision

**Goal**: SpecQL becomes a **single-source-of-truth** business logic specification that generates:
- ✅ **Backend**: PostgreSQL schema, GraphQL API, business logic (already working)
- 🎨 **Frontend**: Complete UI applications from declarative YAML (to be integrated)
- 🔄 **Full-Stack**: End-to-end type safety, cache management, deployment configs

**Command Example**:
```bash
# From a single SpecQL YAML specification
specql generate entities crm/*.yaml \
  --output-backend db/schema/ \
  --output-frontend app/ \
  --frontend-framework next \
  --with-deployment

# Output:
# ✅ PostgreSQL migrations (db/schema/)
# ✅ GraphQL API functions (db/schema/30_functions/)
# ✅ TypeScript types (app/types.ts)
# ✅ Next.js pages (app/entities/[entity]/page.tsx)
# ✅ React forms with validation (app/components/forms/)
# ✅ Apollo cache config (app/apollo/cache.ts)
# ✅ Deployment configs (docker-compose.yml, Dockerfile)
```

---

## 📐 Current Architecture Analysis

### ✅ What SpecQL Already Has

#### 1. **Robust Generator Pipeline**
Located in `/home/lionel/code/specql/src/`:

**Entry Point**: `src/cli/generate.py`
- `entities` command (line 102-210)
- **Already has `--output-frontend` flag** (line 93-96)
- **Already conditionally generates frontend** (lines 128-177)

**Orchestration**: `src/cli/orchestrator.py`
- `CLIOrchestrator.generate_from_files()` (lines 108-411)
- Coordinates backend generation phases:
  1. Foundation (app setup)
  2. Entity parsing
  3. Schema generation (tables → helpers → mutations)
  4. Table views (CQRS read side)
  5. Query patterns

**Output Formats**:
- **Confiture**: Split schema (00_foundation/, 10_tables/, 20_helpers/, 30_functions/)
- **Hierarchical**: Registry-based (01_write_side/[domain]/[subdomain]/[entity]/)

#### 2. **Rich AST with Frontend Metadata**
`src/core/ast_models.py`:

**EntityDefinition** (line 308-360):
- All entity metadata needed for UI generation
- `description`, `identifier`, `organization`

**FieldDefinition** (line 136-268):
- **Tier system**: BASIC, SCALAR, COMPOSITE, REFERENCE
- **Rich scalar types**: 49 types (email, phone, money, coordinates, etc.)
- **UI hints**: `input_type`, `placeholder`, `example`
- **Validation**: `validation_pattern`, `min_value`, `max_value`
- **References**: `reference_entity` for FK relationships
- **Composite**: `composite_def` for nested JSONB structures

**ActionDefinition** (line 362-381):
- Business logic steps (validate, insert, update, delete, custom)
- **Impact metadata**: Which entities are affected (for cache invalidation)
- Permission requirements (`requires` expressions)

#### 3. **Existing Frontend Generators** (4 already working!)
Located in `src/generators/frontend/`:

1. **TypeScriptTypesGenerator** (`typescript_types_generator.py`):
   - Entity interfaces
   - Mutation input/output types
   - Filter types
   - Output: `types.ts`

2. **ApolloHooksGenerator** (`apollo_hooks_generator.py`):
   - React hooks for queries/mutations
   - Automatic cache updates
   - Optimistic update logic
   - Output: `hooks.ts`

3. **MutationImpactsGenerator** (`mutation_impacts_generator.py`):
   - Cache invalidation metadata
   - Entity impact tracking
   - Output: `mutation-impacts.json`

4. **MutationDocsGenerator** (`mutation_docs_generator.py`):
   - API documentation
   - Output: `mutations.md`

**Current Output**:
```
frontend/generated/
├── mutation-impacts.json
├── types.ts
├── hooks.ts
└── mutations.md
```

#### 4. **Universal AST System** (Multi-Framework)
`src/core/universal_ast.py`:

**Framework-agnostic models**:
- `UniversalEntity`, `UniversalField`, `UniversalAction`
- `UniversalStep` with step types (VALIDATE, INSERT, UPDATE, etc.)

**Adapter Pattern** (`src/adapters/`):
- `FrameworkAdapter` base class (base_adapter.py)
- `PostgreSQLAdapter` already implemented
- `AdapterRegistry` for auto-discovery
- **Ready for frontend adapters** (React, Vue, Svelte)

**CLI Integration**: `specql generate universal` command (generate.py:225-309)

#### 5. **Rich Scalar Type System**
`src/core/scalar_types.py` (49 types):

Each type includes:
- PostgreSQL mapping
- GraphQL scalar name
- **Validation pattern** (regex)
- **UI hints**: `input_type`, `placeholder`, `example`
- Min/max values
- Description

**Examples**:
- `email`: input_type=email, pattern=RFC 5322, placeholder="user@example.com"
- `phoneNumber`: input_type=tel, pattern=E.164, placeholder="+1234567890"
- `money`: input_type=number, step=0.01, example="99.99"
- `coordinates`: composite with lat/lng, placeholder="40.7128,-74.0060"
- `markdown`: input_type=textarea, example="# Heading\n\nContent"

**This is gold for frontend generation!** Direct mapping to UI widgets.

---

## 🔄 Integration Architecture

### Design Principle: **Single Source, Multiple Targets**

```
┌─────────────────────────────────────────────────────────────┐
│                     SpecQL YAML                              │
│  (Single Source of Truth: Business Logic)                   │
│                                                              │
│  entities:                                                   │
│    - entity: Contact                                         │
│      fields:                                                 │
│        email: email!                                         │
│        phone: phoneNumber                                    │
│        organization: ref(Organization)                       │
│      actions:                                                │
│        - name: create_contact                                │
│        - name: qualify_lead                                  │
│                                                              │
│  frontend:  # NEW SECTION                                    │
│    Contact:                                                  │
│      pages:                                                  │
│        list: { sort: [name], filters: [email, status] }     │
│        form: { sections: [basic_info, contact_details] }    │
│      overrides:                                              │
│        fields:                                               │
│          email: { label: "Work Email" }                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
              ┌─────────────┴─────────────┐
              ↓                           ↓
   ╔══════════════════╗        ╔═════════════════════╗
   ║  BACKEND         ║        ║  FRONTEND           ║
   ║  (existing)      ║        ║  (to integrate)     ║
   ╚══════════════════╝        ╚═════════════════════╝
              ↓                           ↓
   ┌──────────────────────┐   ┌─────────────────────┐
   │ PostgreSQL Schema    │   │ Next.js Pages       │
   │ GraphQL Functions    │   │ React Components    │
   │ Table Views (CQRS)   │   │ Forms + Validation  │
   │ FraiseQL Annotations │   │ Apollo Integration  │
   └──────────────────────┘   │ Routing Config      │
                              │ UI Layout           │
                              └─────────────────────┘
```

### Key Design Decision: **Embedded vs. Separate**

#### Option A: Embedded Frontend Block (RECOMMENDED)
```yaml
# crm/contact.yaml
entity: Contact
schema: crm
fields:
  email: email!
  organization: ref(Organization)
actions:
  - name: create_contact

# Frontend spec embedded in same file
frontend:
  label: "Contacts"
  icon: "user-circle"
  pages:
    list:
      fields: [email, organization, status]
      filters: [email, status]
      sort: [name, created_at]
    form:
      sections:
        basic_info:
          fields: [name, email]
        organization:
          fields: [organization, role]
  actions:
    create_contact:
      label: "New Contact"
      confirmation: false
    delete_contact:
      label: "Delete"
      confirmation: true
      confirmMessage: "Delete this contact?"
```

**Pros**:
- ✅ Single file = single source of truth
- ✅ Co-located backend + frontend logic
- ✅ Easier version control (one file to change)
- ✅ Natural backend-frontend consistency
- ✅ Simpler mental model

**Cons**:
- ⚠️ Larger YAML files
- ⚠️ Parser must handle both sections

#### Option B: Separate Frontend Files
```yaml
# crm/contact.yaml (backend)
entity: Contact
fields: ...
actions: ...

# crm/contact.frontend.yaml (frontend)
entity: Contact
import_backend: true
frontend:
  pages: ...
  overrides: ...
```

**Pros**:
- ✅ Separation of concerns
- ✅ Can generate frontend for existing specs

**Cons**:
- ❌ Two files to keep in sync
- ❌ More complex mental model
- ❌ Version skew risk

**RECOMMENDATION**: **Option A (Embedded)** - Simpler, more maintainable, aligns with "single source of truth" vision

---

## 🏗️ Integration Implementation Plan

### Phase 1: Frontend Spec Parser (2 weeks)
**Goal**: Parse `frontend:` block from SpecQL YAML

**Tasks**:
1. Extend `SpecQLParser` to handle `frontend:` block
2. Create `FrontendDefinition` AST models
3. Validate frontend references (entity, field, action names)
4. Add to `EntityDefinition` as optional `.frontend` property

**AST Models** (add to `src/core/ast_models.py`):

```python
@dataclass
class FrontendDefinition:
    """Frontend specification for an entity"""
    label: str | None
    label_singular: str | None
    icon: str | None
    pages: dict[str, PageDefinition]  # list, form, detail, custom
    actions: dict[str, FrontendActionDefinition]
    field_overrides: dict[str, FieldFrontendOverride]
    navigation: NavigationConfig | None

@dataclass
class PageDefinition:
    """Page configuration"""
    type: str  # 'list', 'form', 'detail', 'custom'
    title: str | None
    fields: list[str]  # Field names to include
    sections: dict[str, FormSection] | None  # For forms
    filters: list[FilterConfig] | None  # For lists
    sort: list[str] | None
    columns: dict[str, ColumnConfig] | None  # For lists

@dataclass
class FrontendActionDefinition:
    """Frontend action configuration"""
    label: str
    icon: str | None
    confirmation: bool
    confirm_message: str | None
    success_message: str | None
    redirect_to: str | None
    roles: list[str] | None  # Permission roles

@dataclass
class FieldFrontendOverride:
    """Override backend field defaults for frontend"""
    label: str | None
    placeholder: str | None
    help_text: str | None
    widget: str | None  # Override widget type
    required: bool | None  # Override nullability
    visible_in_list: bool
    visible_in_form: bool
    visible_in_detail: bool
    order: int | None
```

**Parser Extension** (`src/core/specql_parser.py`):

```python
class SpecQLParser:
    def parse(self, content: str) -> EntityDefinition:
        data = yaml.safe_load(content)

        # Existing backend parsing...
        entity = self._parse_entity(data)

        # NEW: Parse frontend block if present
        if 'frontend' in data:
            entity.frontend = self._parse_frontend(data['frontend'], entity)

        return entity

    def _parse_frontend(self, frontend_data: dict, entity: EntityDefinition) -> FrontendDefinition:
        """Parse frontend specification"""
        # Validate field references
        for page in frontend_data.get('pages', {}).values():
            for field_name in page.get('fields', []):
                if field_name not in entity.fields:
                    raise ValueError(f"Frontend references unknown field: {field_name}")

        # Validate action references
        for action_name in frontend_data.get('actions', {}).keys():
            if action_name not in [a.name for a in entity.actions]:
                raise ValueError(f"Frontend references unknown action: {action_name}")

        return FrontendDefinition(
            label=frontend_data.get('label'),
            pages=self._parse_pages(frontend_data.get('pages', {})),
            actions=self._parse_frontend_actions(frontend_data.get('actions', {})),
            field_overrides=self._parse_field_overrides(frontend_data.get('overrides', {})),
            # ...
        )
```

**Deliverables**:
- Updated `SpecQLParser` with frontend block parsing
- New AST models in `ast_models.py`
- Validation for frontend references
- Unit tests for parser

---

### Phase 2: Page Generator (3 weeks)
**Goal**: Generate Next.js pages from frontend specs

**Tasks**:
1. Create `NextJSPageGenerator` class
2. Generate list pages (table, filters, pagination)
3. Generate form pages (create/edit with validation)
4. Generate detail pages (read-only display)
5. Wire up to existing TypeScript types and Apollo hooks

**Generator Class** (`src/generators/frontend/nextjs_page_generator.py`):

```python
from pathlib import Path
from src.core.ast_models import EntityDefinition, FrontendDefinition
import jinja2

class NextJSPageGenerator:
    """Generate Next.js App Router pages"""

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.templates = jinja2.Environment(
            loader=jinja2.FileSystemLoader('src/generators/frontend/templates/')
        )

    def generate_pages(self, entities: list[EntityDefinition]) -> None:
        """Generate pages for all entities"""
        for entity in entities:
            if not entity.frontend:
                continue  # Skip if no frontend spec

            self._generate_list_page(entity)
            self._generate_form_pages(entity)
            self._generate_detail_page(entity)

    def _generate_list_page(self, entity: EntityDefinition) -> None:
        """Generate list page: app/entities/[entity]/page.tsx"""
        if 'list' not in entity.frontend.pages:
            return

        list_config = entity.frontend.pages['list']

        # Prepare template context
        context = {
            'entity': entity,
            'fields': self._get_list_fields(entity, list_config),
            'filters': self._get_filters(entity, list_config),
            'sort_options': list_config.sort or [],
            'query_hook': f"useList{entity.name}",  # From Apollo generator
        }

        # Render template
        template = self.templates.get_template('list_page.tsx.j2')
        content = template.render(**context)

        # Write file
        output_path = self.output_dir / 'app' / 'entities' / entity.name.lower() / 'page.tsx'
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content)

    def _generate_form_pages(self, entity: EntityDefinition) -> None:
        """Generate create/edit forms"""
        # app/entities/[entity]/new/page.tsx
        # app/entities/[entity]/[id]/edit/page.tsx
        ...

    def _get_list_fields(self, entity: EntityDefinition, list_config: PageDefinition) -> list:
        """Build field configurations for list view"""
        fields = []
        for field_name in list_config.fields:
            field_def = entity.fields[field_name]

            # Apply frontend overrides if present
            override = entity.frontend.field_overrides.get(field_name)

            field_config = {
                'name': field_name,
                'label': override.label if override else field_name.replace('_', ' ').title(),
                'type': field_def.type_name,
                'sortable': field_name in (list_config.sort or []),
                'widget': self._map_widget(field_def),
            }
            fields.append(field_config)

        return fields

    def _map_widget(self, field: FieldDefinition) -> str:
        """Map backend field type to React component"""
        # Use scalar type UI hints
        if field.scalar_def and field.scalar_def.input_type:
            input_type = field.scalar_def.input_type
            return {
                'email': 'EmailDisplay',
                'tel': 'PhoneDisplay',
                'url': 'LinkDisplay',
                'date': 'DateDisplay',
                'textarea': 'TextPreview',
                'checkbox': 'BooleanBadge',
            }.get(input_type, 'TextDisplay')

        # Reference fields
        if field.reference_entity:
            return 'ReferenceDisplay'

        # Default
        return 'TextDisplay'
```

**Templates** (`src/generators/frontend/templates/list_page.tsx.j2`):

```tsx
// Auto-generated by SpecQL
import { DataTable } from '@/components/ui/data-table'
import { {{ query_hook }} } from '@/generated/hooks'
import { {{ entity.name }} } from '@/generated/types'

export default function {{ entity.name }}ListPage() {
  const { data, loading, error } = {{ query_hook }}({
    variables: {
      // Filters from URL params
    }
  })

  const columns = [
    {% for field in fields %}
    {
      accessorKey: '{{ field.name }}',
      header: '{{ field.label }}',
      cell: ({ row }) => <{{ field.widget }} value={row.getValue('{{ field.name }}')} />,
    },
    {% endfor %}
  ]

  return (
    <div className="container mx-auto py-10">
      <DataTable
        columns={columns}
        data={data?.{{ entity.name.lower() }}s || []}
        loading={loading}
        filters={[
          {% for filter in filters %}
          { field: '{{ filter.field }}', type: '{{ filter.type }}' },
          {% endfor %}
        ]}
      />
    </div>
  )
}
```

**Deliverables**:
- `NextJSPageGenerator` class
- Jinja2 templates for list/form/detail pages
- Generated Next.js App Router structure
- Integration with existing TypeScript/Apollo generators

---

### Phase 3: Form Generator with Validation (2 weeks)
**Goal**: Generate forms with rich validation from backend types

**Tasks**:
1. Map backend scalar types to React form components
2. Generate client-side validation from scalar type patterns
3. Wire up to backend mutations via Apollo hooks
4. Implement success/error handling (toasts, redirects)

**Validation Mapping**:

```python
def _generate_validation_schema(self, entity: EntityDefinition) -> str:
    """Generate Zod schema from backend field types"""
    rules = []

    for field_name, field_def in entity.fields.items():
        if field_def.nullable:
            rule = f"  {field_name}: z.string().optional()"
        else:
            rule = f"  {field_name}: z.string()"

        # Add scalar type validation
        if field_def.scalar_def and field_def.scalar_def.validation_pattern:
            pattern = field_def.scalar_def.validation_pattern
            rule += f".regex(/{pattern}/, '{{ Invalid {field_def.scalar_def.display_name} }}')"

        # Add min/max validation
        if field_def.scalar_def:
            if field_def.scalar_def.min_value is not None:
                rule += f".min({field_def.scalar_def.min_value})"
            if field_def.scalar_def.max_value is not None:
                rule += f".max({field_def.scalar_def.max_value})"

        rules.append(rule)

    return f"z.object({{\n" + ",\n".join(rules) + "\n}})"
```

**Deliverables**:
- Form generator with validation
- Zod schema generation
- Form templates with error handling
- Success/error toast integration

---

### Phase 4: Layout & Navigation Generator (1 week)
**Goal**: Generate app shell, navigation, routing

**Tasks**:
1. Generate `app/layout.tsx` with navigation sidebar
2. Generate navigation menu from entities with frontend specs
3. Apply permission-based visibility
4. Generate breadcrumbs

**Deliverables**:
- Layout generator
- Navigation menu generator
- Role-based visibility

---

### Phase 5: CLI Integration & Orchestration (1 week)
**Goal**: Unified CLI for full-stack generation

**Tasks**:
1. Update `CLIOrchestrator` to coordinate frontend generation
2. Add `--frontend-framework` flag (next, vue, svelte)
3. Coordinate backend + frontend generation
4. Add `--watch` mode for development

**Updated CLI**:

```bash
# Full-stack generation
specql generate entities crm/*.yaml \
  --output-backend db/schema/ \
  --output-frontend app/ \
  --frontend-framework next \
  --watch

# Output:
# ✅ Backend: PostgreSQL schema, GraphQL API
# ✅ Frontend: Next.js pages, forms, routing
# ✅ Integration: TypeScript types, Apollo hooks, cache config
# 🔄 Watching for changes...
```

**Orchestration** (`src/cli/orchestrator.py`):

```python
class CLIOrchestrator:
    def generate_full_stack(
        self,
        entity_files: list[Path],
        backend_output: Path,
        frontend_output: Path | None,
        frontend_framework: str = 'next',
    ) -> None:
        """Coordinate backend + frontend generation"""

        # Parse entities with frontend specs
        entities = self._parse_entities(entity_files)

        # Generate backend
        self.generate_backend(entities, backend_output)

        # Generate frontend if requested
        if frontend_output:
            self.generate_frontend(entities, frontend_output, frontend_framework)

    def generate_frontend(
        self,
        entities: list[EntityDefinition],
        output_dir: Path,
        framework: str,
    ) -> None:
        """Generate frontend from entities with frontend specs"""

        # Filter entities with frontend specs
        frontend_entities = [e for e in entities if e.frontend]

        # Generate shared artifacts
        types_gen = TypeScriptTypesGenerator(output_dir)
        types_gen.generate_types(entities)

        hooks_gen = ApolloHooksGenerator(output_dir)
        hooks_gen.generate_hooks(entities)

        impacts_gen = MutationImpactsGenerator(output_dir)
        impacts_gen.generate_impacts(entities)

        # Generate framework-specific code
        if framework == 'next':
            page_gen = NextJSPageGenerator(output_dir)
            page_gen.generate_pages(frontend_entities)

            layout_gen = NextJSLayoutGenerator(output_dir)
            layout_gen.generate_layout(frontend_entities)

        elif framework == 'vue':
            # Vue generator
            pass
```

**Deliverables**:
- Updated `CLIOrchestrator`
- Unified CLI command
- Watch mode for development

---

### Phase 6: Documentation & Examples (1 week)
**Goal**: Production-ready with docs and examples

**Tasks**:
1. Create complete CRM example (Contact, Company, User)
2. Write user guide (how to add `frontend:` blocks)
3. Write generator guide (for future framework adapters)
4. Create migration guide (adding frontend to existing specs)

**Example** (`examples/crm/contact.yaml`):

```yaml
entity: Contact
schema: crm
description: "CRM contact"

fields:
  email: email!
  phone: phoneNumber
  organization: ref(Organization)
  status: enum(lead, qualified, customer)

actions:
  - name: create_contact
    steps:
      - validate: email IS NOT NULL
      - insert: Contact

  - name: qualify_lead
    steps:
      - validate: status = 'lead'
      - update: Contact SET status = 'qualified'

frontend:
  label: "Contacts"
  label_singular: "Contact"
  icon: "user-circle"

  pages:
    list:
      fields: [email, phone, organization, status]
      filters:
        - field: email
          operators: [contains, eq]
        - field: status
          operators: [eq, in]
      sort: [email, created_at]
      default_sort: created_at desc

    form:
      sections:
        basic:
          title: "Basic Information"
          fields: [email, phone]
        organization:
          title: "Organization"
          fields: [organization, role]

    detail:
      sections:
        main:
          fields: [email, phone, organization, status]
        activity:
          type: custom
          component: "ContactActivityTimeline"

  actions:
    create_contact:
      label: "New Contact"
      icon: "plus"
      confirmation: false
      success_message: "Contact created successfully"
      redirect_to: "/contacts/{{ id }}"

    qualify_lead:
      label: "Qualify Lead"
      icon: "check-circle"
      confirmation: true
      confirm_message: "Qualify this lead as a customer?"
      success_message: "Lead qualified"
      roles: [sales_manager, admin]

    delete_contact:
      label: "Delete"
      icon: "trash"
      confirmation: true
      confirm_message: "Permanently delete this contact?"
      roles: [admin]

  overrides:
    fields:
      email:
        label: "Work Email"
        help_text: "Primary business email address"
      organization:
        label: "Company"
        placeholder: "Select company..."
```

**Deliverables**:
- Complete CRM example
- User documentation
- Developer guide
- Video tutorial (optional)

---

## 📋 Updated Roadmap

### Timeline: 10 Weeks to Production

| Phase | Duration | Deliverable | Dependencies |
|-------|----------|-------------|--------------|
| **1. Frontend Spec Parser** | 2 weeks | Parse `frontend:` blocks, AST models | None |
| **2. Page Generator** | 3 weeks | Generate Next.js list/form/detail pages | Phase 1 |
| **3. Form + Validation** | 2 weeks | Forms with Zod validation from scalar types | Phase 2 |
| **4. Layout & Navigation** | 1 week | App shell, navigation menu | Phase 2 |
| **5. CLI Integration** | 1 week | Unified full-stack CLI command | Phases 1-4 |
| **6. Docs & Examples** | 1 week | CRM example, user guide | Phases 1-5 |

**Total: 10 weeks to production-ready v1.0**

---

## 🎯 Critical Decisions for Unified Architecture

### 1. **Frontend Spec Location** ✅ DECIDED
**Decision**: Embed `frontend:` block in same YAML as entity definition

**Rationale**:
- Single source of truth
- Co-located logic
- Easier version control
- Natural consistency

### 2. **Default Behavior** (NEEDS DECISION)
**Question**: What happens if `frontend:` block is missing?

**Option A**: Generate default UI automatically
```yaml
# Entity without frontend: block
entity: Contact
fields:
  email: email!

# Auto-generates:
# - List page with all fields
# - Form page with all fields
# - Detail page with all fields
```

**Option B**: No frontend generated unless explicit
```yaml
# Must have frontend: block to generate UI
entity: Contact
fields:
  email: email!
# No UI generated
```

**RECOMMENDATION**: **Option A** - Generate sensible defaults, allow overrides
- Better DX (works out of the box)
- Progressive enhancement (start with defaults, customize as needed)
- Follows "convention over configuration"

### 3. **Framework Adapter Strategy** (NEEDS DECISION)
**Question**: Support multiple frameworks from day 1 or start with Next.js?

**Option A**: Next.js only (v1.0)
- Focus on one excellent implementation
- Ship faster
- Add Vue/Svelte later

**Option B**: Multi-framework from start
- Use Universal AST + adapters
- More complexity upfront
- Future-proof architecture

**RECOMMENDATION**: **Option A** - Start with Next.js, design for extensibility
- Faster time to market
- Learn from Next.js implementation
- Adapter pattern already exists (use it later)

### 4. **Customization Strategy** (NEEDS DECISION)
**Question**: How do developers customize generated code?

**Option A**: Generated code is read-only (regenerated on every change)
- Pro: Always in sync with spec
- Con: No manual customization

**Option B**: Generated code is scaffolding (edit freely)
- Pro: Full customization
- Con: Drift from spec

**Option C**: Hybrid (core generated, custom extensions)
- Pro: Balance between automation and flexibility
- Con: More complexity

**RECOMMENDATION**: **Option C** - Generate core, support custom components
```tsx
// Generated: app/entities/contact/page.tsx
import { GeneratedContactList } from '@/generated/pages/contact-list'
import { CustomContactActions } from '@/components/contact/actions'  // Custom

export default function ContactPage() {
  return (
    <GeneratedContactList
      customActions={<CustomContactActions />}  // Extension point
    />
  )
}
```

### 5. **Validation Sync** (NEEDS DECISION)
**Question**: Backend has validation (Postgres constraints, action steps). Frontend needs client-side validation. How to sync?

**Option A**: Duplicate validation (backend + frontend defined separately)
```yaml
# Backend validation
fields:
  email: email!  # Has regex in scalar_types.py

# Frontend validation
frontend:
  overrides:
    email:
      validation: "^[a-z]+@[a-z]+\\.[a-z]+$"  # Duplicate!
```

**Option B**: Frontend inherits from backend (DRY)
```yaml
# Backend validation
fields:
  email: email!  # Has regex in scalar_types.py

# Frontend auto-uses same validation
frontend:
  # No need to repeat validation
```

**Option C**: Backend is source of truth, frontend can relax
```yaml
# Backend validation (strict)
fields:
  email: email!  # Regex enforced in DB

# Frontend can relax (better UX)
frontend:
  overrides:
    email:
      validation: relaxed  # Allow incomplete during typing, validate on submit
```

**RECOMMENDATION**: **Option B + C** - Inherit by default, allow relaxing
- Backend validation is authoritative (security)
- Frontend gets same validation automatically
- Frontend can relax for UX (e.g., real-time validation vs. submit validation)

---

## 🚀 Immediate Next Steps (This Week)

### 1. **Create Unified Example** (1-2 days)
File: `examples/crm/contact_unified.yaml`

Write complete example with:
- Entity definition
- Rich scalar types (email, phone)
- Reference field (organization)
- Actions (create, qualify, delete)
- **Frontend block with pages, actions, overrides**

Validates the syntax before implementation.

### 2. **Update AST Models** (1-2 days)
File: `src/core/ast_models.py`

Add:
- `FrontendDefinition` dataclass
- `PageDefinition` dataclass
- `FrontendActionDefinition` dataclass
- `FieldFrontendOverride` dataclass

### 3. **Extend Parser** (2-3 days)
File: `src/core/specql_parser.py`

Add:
- `_parse_frontend()` method
- Frontend block validation (field/action references)
- Unit tests

### 4. **Decision Review** (1 day)
Review and finalize:
- Default behavior (generate UI or not?)
- Framework strategy (Next.js only or multi-framework?)
- Customization approach (read-only, scaffolding, or hybrid?)
- Validation sync (duplicate or inherit?)

---

## 📊 Success Metrics

### Phase 1 Success (Frontend Spec Parser)
- [ ] Parse `frontend:` block from YAML
- [ ] Validate field/action references
- [ ] Store in `EntityDefinition.frontend`
- [ ] Unit tests pass

### Full Integration Success (Phase 6)
- [ ] Generate complete Next.js app from CRM example
- [ ] Generated forms submit to backend GraphQL API
- [ ] Generated list pages display data from backend
- [ ] Client-side validation matches backend scalar types
- [ ] Actions trigger correct mutations with cache updates
- [ ] Navigation reflects entity structure
- [ ] Documentation complete
- [ ] Example app runs successfully

### Ultimate Success (Production)
- [ ] Developers can add `frontend:` blocks to existing SpecQL specs
- [ ] Generated UI is production-ready (not just scaffolding)
- [ ] Single `specql generate` command produces full-stack app
- [ ] Generated code is maintainable and debuggable
- [ ] Community examples (blog, e-commerce, CRM)

---

## 🎯 Conclusion

### Current State
- ✅ **Backend generation**: Mature, production-ready
- ✅ **Frontend foundation**: 4 generators already working (types, hooks, impacts, docs)
- ✅ **Architecture**: Universal AST + adapter pattern ready for frontend
- ⚠️ **Frontend UI generation**: Design only, zero implementation

### The Path Forward
**10 weeks to production-ready full-stack generator**

The integration is **architecturally straightforward** because:
1. Entry point exists (`--output-frontend` flag)
2. AST has rich metadata (scalar types with UI hints)
3. Existing generators show the pattern
4. Universal AST system is ready for adapters

The main work is:
1. **Parse** `frontend:` blocks (2 weeks)
2. **Generate** Next.js pages/forms (5 weeks)
3. **Integrate** CLI and documentation (2 weeks)

### Competitive Advantage
Once complete, SpecQL will be **unique in the market**:
- ✅ Single YAML defines business logic
- ✅ Generates type-safe backend (Postgres + GraphQL)
- ✅ Generates type-safe frontend (Next.js + React)
- ✅ Co-located validation, permissions, UI
- ✅ Framework-agnostic (extensible to Vue, Svelte)
- ✅ Full-stack consistency guaranteed

**No other tool offers this level of integration from a single declarative spec.**

### Next Action
**START THIS WEEK**: Create unified example (`examples/crm/contact_unified.yaml`) to validate syntax before coding.
