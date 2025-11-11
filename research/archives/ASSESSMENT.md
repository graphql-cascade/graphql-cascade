# SpecQL Frontend: Gap Analysis & Implementation Roadmap

**Date**: 2025-11-11
**Status**: Early Design Phase → Implementation Ready

## Executive Summary

The SpecQL Frontend project has **excellent design documentation** but **zero implementation artifacts**. The backend (specql) provides a robust foundation with 49 scalar types, GraphQL generation, and frontend code generators already in place. The frontend spec needs to bridge the gap between SpecQL's rich domain types and a declarative YAML UI definition language.

**Current Completion**: ~15% (design docs only)
**Priority Areas**: Personas refinement, canonical YAML examples, JSON Schema validation, integration syntax

---

## 🎯 Current State Summary

### ✅ What Exists

#### Design Documentation (specql_front)
- **CLAUDE.md** - High-level project goals and constraints
- **PRD.md** - Comprehensive TypeScript-style data model (12.8 KB)
- **5 Persona files** - AI collaboration roles defined

#### Backend Foundation (specql)
- **49 scalar rich types** (`email`, `money`, `coordinates`, etc.) with validation patterns and UI hints
- **Composite types** (JSONB structures like `Address`)
- **Entity references** (`ref(Entity)` syntax)
- **GraphQL generation** via FraiseQL annotations
- **Frontend code generators** - TypeScript types, Apollo hooks, mutation impacts
- **Table views (tv_*)** - CQRS read side with denormalized JSONB data
- **Actions system** - Business logic with validation steps
- **Multi-tenancy & permissions** - Tenant isolation and role-based access

### ❌ What Does NOT Exist

#### Core Artifacts
- ❌ No canonical YAML examples (Company/User/Address use case)
- ❌ No JSON Schema or TypeScript definitions for frontend YAML validation
- ❌ No implementation parsers or validators
- ❌ No integration code connecting frontend YAML to backend entities/actions
- ❌ No test cases or validation examples
- ❌ No framework adapters (React/Vue/Next generators)
- ❌ No end-user documentation

#### Persona Gaps
- ❌ Personas lack specific responsibilities for SpecQL integration
- ❌ No persona for backend integration architecture
- ❌ No persona for GraphQL/TypeScript code generator integration
- ❌ Missing validation persona for testing frontend YAML against backend schemas

---

## 📊 Gap Analysis

### 1. Persona System Refinement

**Current Personas** (5 defined):
1. Product Architect - Modular structure design
2. Frontend Architect - YAML structure & formal schema
3. UX & Best Practices Architect - UX metadata
4. Cross-Framework Adapter - Framework agnostic guard
5. Validator - Spec critic
6. Example Generator - Rich type examples

**Missing Personas** (3 needed):

#### A. **Backend Integration Architect**
**Responsibility**: Bridge frontend YAML to SpecQL backend
- Map frontend field widgets to backend scalar types (`email` → email widget)
- Connect frontend actions to backend GraphQL mutations
- Resolve entity references (`Company.owner: ref(User)` → User entity lookup)
- Handle nested composite types (`Company.address: Address` → embedded form sections)
- Define filter mapping (frontend filter UI → GraphQL filter operators)
- Specify permission integration (`roles` in actions → backend `requires` expressions)

**Key Questions**:
- How does frontend YAML reference backend entity names?
- How are backend scalar type UI hints (`input_type`, `placeholder`) applied?
- How do frontend actions discover available backend mutations?
- How does multi-tenant `tenant_id` filtering work in frontend queries?

#### B. **Code Generation Orchestrator**
**Responsibility**: Coordinate frontend YAML → framework code generation
- Define generation pipeline (YAML → AST → TypeScript → React/Vue)
- Integrate with existing specql frontend generators (TypeScript types, Apollo hooks)
- Generate routing configuration from page definitions
- Generate form validation from backend type constraints
- Generate GraphQL queries/mutations from page data requirements
- Handle cache invalidation using backend mutation impact metadata

**Key Questions**:
- How does frontend YAML parser integrate with `specql_parser.py`?
- How are generated types from `frontend_types_generator.py` imported?
- How do frontend pages discover which GraphQL queries to use?
- Where does routing logic live (Next.js app router vs framework-agnostic)?

#### C. **Testing & Validation Architect**
**Responsibility**: Ensure frontend YAML validity against backend
- Validate entity names exist in backend
- Validate field names exist on referenced entities
- Validate action names map to backend mutations
- Validate widget types are compatible with backend scalar types
- Validate filter operators are supported by backend
- Validate permission roles match backend role definitions

**Key Questions**:
- How does frontend validation access backend entity schemas?
- What's the error message format for invalid references?
- How are breaking changes detected (backend entity removed, frontend still references it)?
- How do we version frontend specs alongside backend schema evolution?

---

### 2. Frontend YAML Syntax Integration Points

**Critical Design Decisions Needed**:

#### A. Entity Reference Syntax
**Decision**: How to reference backend entities in frontend YAML?

```yaml
# Option 1: Direct entity name (assumes entity exists in backend)
entities:
  Company:
    label: "Companies"
    fields:
      name: { label: "Company Name" }
      owner: { label: "Owner" }  # Backend knows this is ref(User)

# Option 2: Explicit backend reference
entities:
  Company:
    backend_entity: "crm.Company"  # Schema-qualified name
    label: "Companies"

# Option 3: Import from backend (minimal frontend override)
entities:
  Company:
    import_from_backend: true
    overrides:
      fields:
        name: { label: "Company Name" }  # Only override what's needed
```

**Recommendation**: Option 3 (import with overrides) - DRY principle, backend is source of truth

#### B. Field Widget Mapping
**Decision**: How to map backend scalar types to UI widgets?

```yaml
# Option 1: Implicit (backend scalar type → widget via type system)
fields:
  email:  # Backend type is 'email', frontend auto-uses email widget
    label: "Email Address"
    # Widget inferred: email input with validation

# Option 2: Explicit override
fields:
  email:
    label: "Email Address"
    widget: email  # Explicit widget specification
    validation: { pattern: "^[a-z]+@[a-z]+\\.[a-z]+$" }  # Override backend pattern

# Option 3: Backend hint + frontend override
fields:
  email:
    label: "Email Address"
    # Uses backend input_type hint unless overridden
    widget: { use_backend_hint: true }
```

**Recommendation**: Option 3 (backend hint with override) - flexible, maintains backend control

#### C. Action to Mutation Mapping
**Decision**: How to connect frontend actions to backend GraphQL mutations?

```yaml
# Option 1: Explicit mutation name
actions:
  - name: "create_company"
    type: "create"
    mutation: "createCompany"  # Explicit GraphQL mutation name
    entity: "Company"

# Option 2: Convention-based discovery
actions:
  - name: "create_company"
    type: "create"
    entity: "Company"
    # Mutation auto-discovered: createCompany (convention: create + Entity)

# Option 3: Backend action reference
actions:
  - name: "create_company"
    backend_action: "crm.create_company"  # References backend action definition
    label: "New Company"
```

**Recommendation**: Option 3 (backend action reference) - leverages backend action metadata, permissions, validation

#### D. Nested Type Handling
**Decision**: How to render nested composite types and references?

```yaml
# Scenario: Company has Address (composite JSONB) and owner (ref(User))

# Option 1: Inline embedded for composites, lookup for references
pages:
  - type: form
    entity: Company
    fields:
      - name: name
      - name: address  # Composite type → nested form section
        widget: embedded_form
        fields:  # Address fields
          - street
          - city
          - postal_code
      - name: owner  # Reference type → lookup/select
        widget: entity_select
        entity: User
        display_field: "name"

# Option 2: Automatic detection from backend type
pages:
  - type: form
    entity: Company
    fields:
      - name: name
      - name: address
        # Auto-detected: composite → embedded_form
      - name: owner
        # Auto-detected: ref(User) → entity_select
        config:
          display_field: "name"

# Option 3: Explicit rendering strategy
pages:
  - type: form
    entity: Company
    fields:
      - name: address
        render_as: embedded  # embedded | modal | inline | reference
      - name: owner
        render_as: reference
        lookup_config:
          query: listUsers
          display: "{{name}} ({{email}})"
```

**Recommendation**: Option 2 (automatic detection with config override) - smart defaults, explicit control when needed

#### E. Filter Operator Mapping
**Decision**: How to map frontend filter UI to backend GraphQL operators?

```yaml
# Backend provides: eq, ne, gt, gte, lt, lte, in, not_in, contains, starts_with, etc.

# Option 1: Expose all backend operators
pages:
  - type: list
    entity: Company
    filters:
      - field: name
        operators: [eq, ne, contains, starts_with]  # Explicit list

# Option 2: Smart defaults per type
pages:
  - type: list
    entity: Company
    filters:
      - field: name  # String type → default operators: eq, contains, starts_with
      - field: created_at  # DateTime type → default operators: gte, lte, between

# Option 3: Filter presets
pages:
  - type: list
    entity: Company
    filter_presets:
      - name: "Recent"
        filter: { created_at: { gte: "now() - interval '7 days'" } }
      - name: "Active"
        filter: { deleted_at: { is_null: true } }
```

**Recommendation**: Option 2 (smart defaults) + Option 3 (presets) - good UX, covers common cases

---

### 3. Implementation Roadmap

#### Phase 1: Foundation (2-3 weeks)
**Goal**: Canonical YAML spec with validation

**Tasks**:
1. Create 3 new persona files:
   - `backend_integration_architect.md`
   - `code_generation_orchestrator.md`
   - `testing_validation_architect.md`

2. Generate canonical YAML examples (using example generator persona):
   - Simple: User entity (list + form + detail)
   - Medium: Company + Address (nested composite type)
   - Complex: Company + Address + User (composite + reference + filters)

3. Define JSON Schema for frontend YAML validation:
   - Entity structure
   - Field definitions
   - Page types (list, form, detail)
   - Action types
   - Layout/navigation

4. Implement YAML validator:
   - Parse frontend YAML
   - Validate against JSON Schema
   - Cross-reference backend entities (mock for now)

**Deliverables**:
- 3 new persona `.md` files
- 3 canonical YAML example files
- `frontend_schema.json` (JSON Schema)
- Python validator script (or TypeScript)

#### Phase 2: Backend Integration (3-4 weeks)
**Goal**: Connect frontend YAML to SpecQL backend

**Tasks**:
1. Implement entity reference resolution:
   - Parse backend entity definitions from `specql` AST
   - Validate frontend entity names against backend
   - Resolve field types and constraints

2. Implement type-to-widget mapping:
   - Load backend scalar type definitions (`scalar_types.py`)
   - Map scalar types to default widgets
   - Apply UI hints (`input_type`, `placeholder`)

3. Implement action-to-mutation mapping:
   - Parse backend action definitions
   - Generate GraphQL mutation metadata
   - Extract permissions (`requires` expressions)

4. Implement nested type resolution:
   - Detect composite types (JSONB)
   - Detect entity references (`ref(Entity)`)
   - Generate nested form/lookup configurations

5. Implement filter operator mapping:
   - Load FraiseQL filter annotations
   - Map to frontend filter UI configs
   - Generate GraphQL filter input types

**Deliverables**:
- `frontend_backend_bridge.py` - Integration module
- Updated validator with backend cross-reference
- Documentation on integration points

#### Phase 3: Code Generation (4-5 weeks)
**Goal**: Generate React/Next.js app from frontend YAML

**Tasks**:
1. Implement YAML → AST parser:
   - Parse frontend YAML into Python/TypeScript AST
   - Validate against backend schema
   - Resolve all references

2. Implement routing generator:
   - Generate Next.js App Router routes
   - Map pages to route paths
   - Generate route metadata (titles, breadcrumbs)

3. Implement page component generator:
   - Generate list pages with tables, filters, pagination
   - Generate form pages with fields, validation, submit handlers
   - Generate detail pages with fields, actions

4. Implement action/mutation generator:
   - Import Apollo hooks from backend generators
   - Wire up mutations to form submit handlers
   - Implement success/error handling (toasts, redirects)

5. Implement layout/navigation generator:
   - Generate app shell (header, sidebar, footer)
   - Generate navigation menu from nav items
   - Apply permissions (hide nav items based on roles)

6. Integrate with existing frontend generators:
   - Use TypeScript types from `frontend_types_generator.py`
   - Use Apollo hooks from `apollo_hooks_generator.py`
   - Use mutation impacts for cache invalidation

**Deliverables**:
- `frontend_codegen.py` - Code generation module
- Generated Next.js app example (from canonical YAML)
- Documentation on generated app structure

#### Phase 4: Testing & Documentation (2-3 weeks)
**Goal**: Production-ready with docs

**Tasks**:
1. Implement validation test suite:
   - Valid YAML examples
   - Invalid YAML examples (missing entities, bad types)
   - Backend schema evolution tests

2. Implement code generation test suite:
   - Generate apps from all example YAMLs
   - Run generated app tests
   - Visual regression tests

3. Write end-user documentation:
   - Getting started guide
   - Entity/field/page reference
   - Action configuration guide
   - Layout/navigation guide
   - Advanced topics (nested types, custom actions)

4. Write developer documentation:
   - Architecture overview
   - Backend integration design
   - Code generation pipeline
   - Extension points

**Deliverables**:
- Test suite with >80% coverage
- End-user docs (`docs/`)
- Developer docs (`docs/dev/`)
- Migration guide (for future versions)

#### Phase 5: Framework Adapters (Optional, 3-4 weeks)
**Goal**: Support Vue, Svelte, etc.

**Tasks**:
1. Abstract component templates
2. Implement Vue generator
3. Implement Svelte generator
4. Document multi-framework support

---

## 🚀 Immediate Next Steps (Priority Order)

### 1. **Refine Personas** (1-2 days)
Create 3 new persona files with specific SpecQL integration responsibilities:
- `/home/lionel/code/specql_front/backend_integration_architect.md`
- `/home/lionel/code/specql_front/code_generation_orchestrator.md`
- `/home/lionel/code/specql_front/testing_validation_architect.md`

**Success Criteria**:
- Each persona has clear scope tied to backend integration
- Personas can collaborate to produce integrated artifacts
- Gaps in current persona system are filled

### 2. **Generate Canonical YAML Examples** (2-3 days)
Use the example generator persona to create 3 complete YAML examples:
- `examples/simple_user.yaml` - Basic CRUD (User entity)
- `examples/company_address.yaml` - Composite type (Company + Address)
- `examples/company_full.yaml` - Full example (Company + Address + User reference)

**Success Criteria**:
- YAML is readable by non-developers
- YAML correctly references backend entities/types
- YAML covers all major features (list, form, detail, actions, filters)
- YAML demonstrates nested type handling

### 3. **Design Integration Syntax** (3-5 days)
Make concrete decisions on syntax for:
- Entity reference strategy (Option 3: import with overrides)
- Field widget mapping (Option 3: backend hint with override)
- Action-to-mutation mapping (Option 3: backend action reference)
- Nested type rendering (Option 2: auto-detect with config)
- Filter operator mapping (Option 2 + 3: defaults + presets)

**Success Criteria**:
- Update PRD.md with chosen syntax
- Document rationale for each decision
- Update personas to reflect integration syntax

### 4. **Create JSON Schema** (3-5 days)
Define formal validation schema:
- `schemas/frontend.schema.json` - Complete JSON Schema
- Or `schemas/frontend.schema.ts` - TypeScript definitions

**Success Criteria**:
- Schema validates all canonical YAML examples
- Schema enforces required fields
- Schema provides helpful validation messages
- Schema is versioned (v0.1.0)

### 5. **Implement Python Validator** (5-7 days)
Build first implementation artifact:
- `src/frontend_validator.py` - Parse and validate frontend YAML
- `src/backend_schema_loader.py` - Load backend entity schemas (mock initially)
- `src/integration_validator.py` - Validate frontend references backend correctly

**Success Criteria**:
- Parses YAML and validates against JSON Schema
- Cross-references entity names (mock backend)
- Provides clear error messages
- CLI tool: `specql-frontend validate examples/company_full.yaml`

---

## 📋 Critical Questions to Resolve

### Integration Architecture
1. **Where does frontend YAML live?**
   - Embedded in SpecQL YAML under `frontend:` block?
   - Separate `*.frontend.yaml` files?
   - Both (with import mechanism)?

2. **How does versioning work?**
   - Frontend spec version independent of backend schema version?
   - Compatibility matrix?
   - Breaking change detection?

3. **How does the generation pipeline work?**
   - Single command generates both backend + frontend?
   - Separate generation steps?
   - Incremental generation (only changed entities)?

### Code Generation
4. **What's the generated app structure?**
   - Monorepo with `apps/frontend/` and `packages/`?
   - Standalone Next.js app?
   - Component library + app shell?

5. **How are customizations handled?**
   - Generated code is read-only (regenerated on every change)?
   - Generated code is scaffolding (edited by developers)?
   - Hybrid (core generated, extensions custom)?

6. **How does local development work?**
   - Watch mode (regenerate on YAML change)?
   - Hot reload?
   - Mock backend data?

### Backend Integration
7. **How does frontend discover backend schema?**
   - Introspection (GraphQL introspection query)?
   - Schema file export (`schema.json` from specql generation)?
   - Direct access to SpecQL AST?

8. **How are permissions enforced?**
   - Backend only (frontend just hides UI)?
   - Duplicated in frontend (client-side and server-side)?
   - Shared permission definitions?

9. **How does multi-tenancy work in frontend?**
   - Automatic `tenant_id` filtering in all queries?
   - Explicit tenant context in frontend YAML?
   - Configured at runtime (user login)?

---

## 📈 Success Metrics

### Phase 1 Success (Foundation)
- [ ] 8 total personas defined (5 existing + 3 new)
- [ ] 3 canonical YAML examples validated by team
- [ ] JSON Schema passes validation tests
- [ ] Python validator can parse and validate YAML

### Phase 2 Success (Integration)
- [ ] Backend entity resolution working (cross-reference validation)
- [ ] Type-to-widget mapping generates correct UI hints
- [ ] Action-to-mutation mapping resolves GraphQL operations
- [ ] Nested type detection generates form sections/lookups

### Phase 3 Success (Code Generation)
- [ ] Generated Next.js app from canonical YAML runs successfully
- [ ] Generated forms submit to backend GraphQL API
- [ ] Generated list pages query backend and display data
- [ ] Generated navigation reflects frontend YAML structure

### Phase 4 Success (Production-Ready)
- [ ] Test coverage >80%
- [ ] End-user documentation complete
- [ ] Generated app passes accessibility audit
- [ ] Performance benchmarks met (Lighthouse >90)

---

## 🎯 Conclusion

**Current State**: Strong design foundation, zero implementation
**Biggest Gap**: Personas lack backend integration specificity
**Critical Path**: Personas → Examples → Integration Syntax → Validation → Generation
**Timeline**: 11-17 weeks to production-ready v0.1.0
**Next Action**: Create 3 new persona files (backend integration, code generation, testing)

The project is well-positioned to move from design to implementation. The backend provides an excellent foundation, and the frontend design is comprehensive. The missing piece is **concrete integration decisions** and **executable artifacts** (YAML examples, schemas, validators, generators).

**Recommended Immediate Focus** (next 2 weeks):
1. ✅ Refine personas (1-2 days) - **START HERE**
2. ✅ Generate canonical YAML examples (2-3 days)
3. ✅ Design integration syntax (3-5 days)
4. ✅ Create JSON Schema (3-5 days)

Once these are complete, the project will be "implementation-ready" with clear specifications that can guide coding work.
