# SpecQL Language Extension for Frontend Concepts

**Date**: 2025-11-11
**Approach**: Extend SpecQL language with first-class UI concepts instead of separate `frontend:` block

## 🎯 The Core Question

Should frontend UI be:
- **Option A**: A separate `frontend:` block? (embedded but distinct)
- **Option B**: First-class language extensions? (integrated into the language itself)

**Answer**: **Option B** - Frontend concepts should be **first-class citizens** in SpecQL

## 💡 Why Language Extension is Superior

### 1. **Unified Mental Model**
Instead of "backend fields" vs "frontend overrides":
```yaml
# BAD: Separate frontend block (duplication)
entity: Contact
fields:
  email: email!

frontend:
  fields:
    email:
      label: "Work Email"  # Duplicate reference
```

We have **fields with UI metadata**:
```yaml
# GOOD: Unified field definition
entity: Contact
fields:
  email:
    type: email!
    label: "Work Email"
    placeholder: "user@company.com"
    help_text: "Primary business email"
    visible_in: [list, form, detail]
    list_config:
      width: 250
      sortable: true
    form_config:
      section: "contact_info"
      validation: strict
```

### 2. **Progressive Enhancement**
SpecQL already has **progressive type system**:
- Basic types: `text`, `integer`
- Rich scalar types (Tier 1): `email`, `phoneNumber`, `money`
- Composite types (Tier 2): `Address`, `MoneyAmount`
- References (Tier 3): `ref(Organization)`

Frontend should follow the same pattern:
```yaml
# Start simple (auto-generated UI)
fields:
  email: email!

# Add UI metadata as needed
fields:
  email:
    type: email!
    label: "Work Email"  # First enhancement

# Add advanced UI config
fields:
  email:
    type: email!
    label: "Work Email"
    form_config:
      section: "contact_details"
      conditional_visibility: "organization IS NOT NULL"
```

### 3. **Single Source of Truth**
Backend concerns and UI concerns are **intrinsically linked**:
- Field type → Widget type
- Validation → Client-side validation
- Permissions → UI visibility
- Actions → Buttons/forms

Separating them creates **artificial boundaries** and duplication.

### 4. **Consistency with SpecQL Philosophy**
SpecQL already embeds multiple concerns in one place:
- **Field definition**: Type, nullability, default
- **Database mapping**: PostgreSQL types, indexes
- **GraphQL mapping**: FraiseQL annotations
- **Validation**: Patterns, constraints

Adding **UI metadata** is the natural next step.

## 🏗️ Proposed Language Extensions

### Extension 1: Field-Level UI Metadata

**Current SpecQL Field**:
```yaml
fields:
  email: email!  # Type only
```

**Extended Field**:
```yaml
fields:
  # Short form (backwards compatible)
  email: email!

  # Long form with UI metadata
  phone:
    type: phoneNumber
    label: "Phone Number"
    placeholder: "+1 (555) 000-0000"
    help_text: "Primary contact number"

    # Visibility control
    visible_in: [list, form, detail]  # Or: visible_in: all

    # List view config
    list:
      width: 150
      sortable: true
      alignment: left

    # Form config
    form:
      section: contact_info
      order: 2
      required_override: true  # Override backend nullability for UI
      conditional_visibility: "organization != null"

    # Detail view config
    detail:
      section: primary
      order: 1
      render_as: link  # For phone: click to call

  # Reference fields with UI config
  organization:
    type: ref(Organization)
    label: "Company"

    form:
      widget: autocomplete  # Or: select, modal_lookup, inline_create
      lookup_config:
        display_template: "{{name}} ({{country}})"
        filters: ["active = true"]
        sort: name
        allow_create: true
```

**Benefits**:
- Backwards compatible (short form still works)
- UI metadata co-located with field definition
- No duplication (field name appears once)
- Progressive enhancement (add UI config as needed)

---

### Extension 2: Page-Level Metadata

**New Top-Level Section**: `pages`

```yaml
entity: Contact
schema: crm
description: "CRM contact"

# Backend fields (with UI metadata)
fields:
  email: email!
  organization: ref(Organization)
  status: enum(lead, qualified, customer)

# Backend actions
actions:
  - name: create_contact
    steps:
      - insert: Contact

# FRONTEND: Page definitions
pages:
  # List page config
  list:
    title: "Contacts"
    description: "Manage your contacts"
    icon: user-circle

    # Which fields to show
    columns: [email, organization, status, created_at]

    # Default sort
    default_sort:
      - created_at: desc

    # Available filters
    filters:
      - field: email
        operators: [contains, eq]
      - field: status
        operators: [eq, in]
        default: [lead, qualified]
      - field: organization
        operators: [eq, in]

    # Row actions
    row_actions: [view, edit, delete]

    # Primary actions (top of page)
    primary_actions: [create_contact]

    # Bulk actions
    bulk_actions: [export_csv, bulk_delete]

    # Pagination
    pagination:
      page_size: 25
      options: [10, 25, 50, 100]

  # Form page config (create/edit)
  form:
    title_create: "New Contact"
    title_edit: "Edit Contact"

    # Field organization
    sections:
      basic_info:
        title: "Basic Information"
        fields: [first_name, last_name, email, phone]

      organization:
        title: "Organization"
        fields: [organization, job_title]

      status:
        title: "Status"
        fields: [status, notes]

    # Submit actions
    submit_action: create_contact  # or update_contact

    # Secondary actions
    actions: [save_draft, cancel]

    # Success behavior
    on_success:
      message: "Contact {{action}} successfully"
      redirect: "/contacts/{{id}}"

  # Detail page config
  detail:
    title: "{{first_name}} {{last_name}}"
    subtitle: "{{job_title}} at {{organization.name}}"

    # Layout sections
    sections:
      main:
        layout: two_column
        fields: [email, phone, organization, status]

      activity:
        title: "Recent Activity"
        type: custom
        component: ContactActivityTimeline

    # Actions
    actions: [edit, delete, convert_to_customer]
```

**Benefits**:
- Declarative page structure
- Co-located with entity definition
- Reuses field definitions (no duplication)
- Clear separation: fields define data, pages define UI

---

### Extension 3: Action-Level UI Metadata

**Current SpecQL Action**:
```yaml
actions:
  - name: create_contact
    description: "Create a new contact"
    steps:
      - insert: Contact
```

**Extended Action**:
```yaml
actions:
  - name: create_contact
    description: "Create a new contact"

    # Backend logic
    steps:
      - validate: email IS NOT NULL
      - insert: Contact

    # FRONTEND UI metadata
    ui:
      label: "New Contact"
      icon: plus-circle
      variant: primary  # primary, secondary, danger

      # Where this action appears
      show_in: [list_primary, detail_actions]

      # Confirmation
      confirmation:
        enabled: false

      # Success handling
      on_success:
        message: "Contact created successfully!"
        toast: success
        redirect: "/contacts/{{id}}"
        refetch: [Contact, Organization]

      # Error handling
      on_error:
        message: "Failed to create contact"
        toast: error
        retry: true

  - name: delete_contact
    description: "Delete a contact"

    steps:
      - delete: Contact

    ui:
      label: "Delete"
      icon: trash
      variant: danger

      # Requires confirmation
      confirmation:
        enabled: true
        title: "Delete Contact?"
        message: "This will permanently delete {{first_name}} {{last_name}}. This cannot be undone."
        confirm_label: "Delete"
        cancel_label: "Cancel"

      # Permissions
      roles: [admin, sales_manager]

      on_success:
        message: "Contact deleted"
        toast: success
        redirect: "/contacts"
```

**Benefits**:
- Action behavior and UI co-located
- Backend permissions automatically affect UI visibility
- Success/error handling declarative
- Confirmation flows built-in

---

### Extension 4: Entity-Level UI Metadata

**Current SpecQL Entity**:
```yaml
entity: Contact
schema: crm
description: "CRM contact"
```

**Extended Entity**:
```yaml
entity: Contact
schema: crm
description: "CRM contact"

# FRONTEND: Entity-level UI metadata
ui:
  label: "Contacts"
  label_singular: "Contact"
  icon: user-circle
  color: blue

  # Entity routes (auto-generated by default)
  routes:
    list: /contacts
    detail: /contacts/{{id}}
    create: /contacts/new
    edit: /contacts/{{id}}/edit

  # Display configuration
  display:
    title_template: "{{first_name}} {{last_name}}"
    subtitle_template: "{{job_title}} at {{organization.name}}"
    avatar_field: avatar

  # Search configuration
  search:
    fields: [first_name, last_name, email]
    placeholder: "Search contacts..."

  # Auto-generate pages?
  auto_generate:
    list: true
    form: true
    detail: true
```

**Benefits**:
- Entity-level UI settings
- Controls routing and navigation
- Search configuration
- Auto-generation control

---

### Extension 5: Navigation Structure

**New Top-Level Section**: `navigation` (optional, at entity or project level)

```yaml
# At entity level (contributes to global nav)
entity: Contact

ui:
  navigation:
    menu_item:
      label: "Contacts"
      icon: user-circle
      section: crm  # Navigation section grouping
      order: 1
```

Or at project level (separate file):
```yaml
# navigation.yaml (project-level)
navigation:
  sections:
    - id: crm
      label: "CRM"
      icon: briefcase
      order: 1
      items:
        - entity: Contact
        - entity: Organization
        - entity: Opportunity

    - id: settings
      label: "Settings"
      icon: cog
      order: 99
      items:
        - route: /settings/profile
          label: "Profile"
        - route: /settings/team
          label: "Team"
```

---

## 🔄 Comparison: Embedded Block vs Language Extension

### Scenario: Define a Contact with Email Field

#### Approach A: Embedded Frontend Block
```yaml
entity: Contact
fields:
  email: email!  # Backend definition

frontend:  # Separate block
  fields:
    email:  # DUPLICATE: field name again
      label: "Work Email"
      visible_in: [list, form]
  pages:
    list:
      columns: [email]  # DUPLICATE: field name again
```

**Issues**:
- ❌ Field name appears 3 times
- ❌ Mental context switch (backend → frontend)
- ❌ Risk of inconsistency
- ❌ Not DRY

#### Approach B: Language Extension
```yaml
entity: Contact
fields:
  email:
    type: email!
    label: "Work Email"
    visible_in: [list, form]

pages:
  list:
    columns: [email]  # References field defined above
```

**Benefits**:
- ✅ Field name appears twice (definition + reference)
- ✅ Unified mental model
- ✅ Single source of truth
- ✅ DRY principle

---

## 📐 Implementation Strategy

### Phase 1: Extend AST Models (1 week)

**File**: `src/core/ast_models.py`

Add UI metadata to existing models:

```python
@dataclass
class FieldDefinition:
    # Existing backend fields
    name: str
    type_name: str
    nullable: bool
    # ...

    # NEW: UI metadata
    label: str | None = None
    placeholder: str | None = None
    help_text: str | None = None
    visible_in: list[str] | None = None  # ['list', 'form', 'detail']

    # Nested UI config
    list_config: ListFieldConfig | None = None
    form_config: FormFieldConfig | None = None
    detail_config: DetailFieldConfig | None = None

@dataclass
class ListFieldConfig:
    width: int | None = None
    sortable: bool = True
    alignment: str = "left"

@dataclass
class FormFieldConfig:
    section: str | None = None
    order: int | None = None
    widget: str | None = None  # Override default widget
    conditional_visibility: str | None = None

@dataclass
class ActionDefinition:
    # Existing backend fields
    name: str
    description: str
    steps: list[ActionStep]
    # ...

    # NEW: UI metadata
    ui: ActionUIMetadata | None = None

@dataclass
class ActionUIMetadata:
    label: str
    icon: str | None = None
    variant: str = "primary"
    show_in: list[str] = field(default_factory=lambda: ["detail_actions"])
    confirmation: ConfirmationConfig | None = None
    on_success: SuccessConfig | None = None
    on_error: ErrorConfig | None = None
    roles: list[str] | None = None

@dataclass
class EntityDefinition:
    # Existing backend fields
    name: str
    schema: str
    fields: dict[str, FieldDefinition]
    actions: list[ActionDefinition]
    # ...

    # NEW: UI metadata
    ui: EntityUIMetadata | None = None
    pages: PageDefinitions | None = None

@dataclass
class EntityUIMetadata:
    label: str | None = None
    label_singular: str | None = None
    icon: str | None = None
    color: str | None = None
    display: DisplayConfig | None = None
    search: SearchConfig | None = None
    auto_generate: AutoGenerateConfig | None = None

@dataclass
class PageDefinitions:
    list: ListPageConfig | None = None
    form: FormPageConfig | None = None
    detail: DetailPageConfig | None = None
```

### Phase 2: Extend Parser (1 week)

**File**: `src/core/specql_parser.py`

Update parser to handle both short and long field forms:

```python
def _parse_field(self, field_name: str, field_spec: str | dict) -> FieldDefinition:
    """Parse field definition with UI metadata"""

    # Short form (backwards compatible)
    if isinstance(field_spec, str):
        return self._parse_short_field(field_name, field_spec)

    # Long form with UI metadata
    if isinstance(field_spec, dict):
        return self._parse_long_field(field_name, field_spec)

def _parse_short_field(self, field_name: str, type_spec: str) -> FieldDefinition:
    """Parse: email: email!"""
    return FieldDefinition(
        name=field_name,
        type_name=self._extract_type(type_spec),
        nullable=not type_spec.endswith('!'),
        # UI metadata populated from defaults
    )

def _parse_long_field(self, field_name: str, config: dict) -> FieldDefinition:
    """Parse: email: { type: email!, label: 'Work Email', ... }"""
    return FieldDefinition(
        name=field_name,
        type_name=self._extract_type(config['type']),
        nullable=not config['type'].endswith('!'),
        # UI metadata from config
        label=config.get('label'),
        placeholder=config.get('placeholder'),
        help_text=config.get('help_text'),
        visible_in=config.get('visible_in'),
        list_config=self._parse_list_config(config.get('list')),
        form_config=self._parse_form_config(config.get('form')),
        detail_config=self._parse_detail_config(config.get('detail')),
    )

def _parse_entity(self, data: dict) -> EntityDefinition:
    """Parse entity with UI metadata and pages"""
    entity = EntityDefinition(
        name=data['entity'],
        schema=data['schema'],
        # ... existing parsing ...
    )

    # Parse UI metadata
    if 'ui' in data:
        entity.ui = self._parse_entity_ui(data['ui'])

    # Parse pages
    if 'pages' in data:
        entity.pages = self._parse_pages(data['pages'], entity)

    return entity
```

### Phase 3: Default Generation (1 week)

**Smart Defaults**: If UI metadata is missing, generate sensible defaults:

```python
class UIDefaultsGenerator:
    """Generate default UI metadata from backend definitions"""

    def apply_defaults(self, entity: EntityDefinition) -> None:
        """Apply smart defaults for missing UI metadata"""

        # Entity-level defaults
        if not entity.ui:
            entity.ui = EntityUIMetadata(
                label=self._pluralize(entity.name),
                label_singular=entity.name,
                icon=self._guess_icon(entity.name),
            )

        # Field-level defaults
        for field_name, field_def in entity.fields.items():
            if not field_def.label:
                field_def.label = self._humanize(field_name)

            if not field_def.placeholder and field_def.scalar_def:
                field_def.placeholder = field_def.scalar_def.placeholder

            if not field_def.visible_in:
                # Default visibility based on field type
                if field_name in ['pk_*', 'created_by', 'updated_by']:
                    field_def.visible_in = []  # Hidden
                elif field_def.type_name in ['text', 'timestamp']:
                    field_def.visible_in = ['detail']  # Detail only
                else:
                    field_def.visible_in = ['list', 'form', 'detail']

        # Page-level defaults
        if not entity.pages:
            entity.pages = self._generate_default_pages(entity)

        # Action-level defaults
        for action in entity.actions:
            if not action.ui:
                action.ui = self._generate_default_action_ui(action)

    def _generate_default_pages(self, entity: EntityDefinition) -> PageDefinitions:
        """Generate default list/form/detail pages"""
        return PageDefinitions(
            list=ListPageConfig(
                columns=[f for f in entity.fields.keys() if 'list' in entity.fields[f].visible_in],
                filters=self._generate_default_filters(entity),
                default_sort=['-created_at'],
            ),
            form=FormPageConfig(
                sections=self._organize_into_sections(entity),
            ),
            detail=DetailPageConfig(
                sections=self._organize_detail_sections(entity),
            ),
        )
```

### Phase 4: Update Generators (2 weeks)

Existing generators already work! They just need to **read UI metadata** instead of inferring:

```python
class NextJSPageGenerator:
    def _generate_list_page(self, entity: EntityDefinition):
        """Generate list page using entity.pages.list config"""

        # Use explicit config if present, otherwise use defaults
        list_config = entity.pages.list if entity.pages else self._default_list_config(entity)

        columns = []
        for field_name in list_config.columns:
            field_def = entity.fields[field_name]
            columns.append({
                'name': field_name,
                'label': field_def.label,  # From UI metadata!
                'width': field_def.list_config.width if field_def.list_config else None,
                'sortable': field_def.list_config.sortable if field_def.list_config else True,
                'widget': self._get_widget(field_def),
            })

        # Render template with columns
        ...
```

---

## 🎯 Migration Path

### For New Projects
```yaml
# Just write unified specs
entity: Contact
fields:
  email:
    type: email!
    label: "Work Email"
pages:
  list:
    columns: [email]
```

### For Existing SpecQL Projects

**Backwards Compatible!** Old syntax still works:

```yaml
# Old syntax (still works)
entity: Contact
fields:
  email: email!

# Generates default UI automatically
```

Can progressively enhance:

```yaml
# Step 1: Add entity-level UI
entity: Contact
ui:
  label: "Contacts"
  icon: user-circle
fields:
  email: email!

# Step 2: Add field-level UI
fields:
  email:
    type: email!
    label: "Work Email"

# Step 3: Add page config
pages:
  list:
    filters:
      - field: email
```

---

## ✅ Recommended Decision: **Language Extension**

### Why This is the Right Approach

1. **Unified Mental Model**: One field definition, not backend + frontend
2. **DRY Principle**: Field names appear once in definitions, referenced elsewhere
3. **Progressive Enhancement**: Start simple, add UI metadata as needed
4. **Backwards Compatible**: Existing specs work unchanged
5. **Consistent with SpecQL**: Follows existing patterns (scalar types, actions)
6. **Single Source of Truth**: Backend and UI are intrinsically linked
7. **Better DX**: Less duplication, clearer intent
8. **Easier to Reason About**: One entity definition tells the whole story

### Implementation Effort

| Approach | Parser Work | AST Changes | Generator Work | Migration |
|----------|-------------|-------------|----------------|-----------|
| **Embedded Block** | Medium (new section) | Small (add frontend property) | High (reconcile backend+frontend) | Breaking |
| **Language Extension** | Medium (extend fields) | Medium (add UI properties) | Low (read new properties) | **Backwards compatible** |

**Language extension is actually EASIER** because generators just read richer metadata, they don't need to reconcile two sources.

---

## 📋 Updated Roadmap with Language Extension

### Phase 1: Extend Language (2 weeks)
1. Add UI metadata to AST models (`FieldDefinition`, `ActionDefinition`, `EntityDefinition`)
2. Extend parser to handle long-form field syntax
3. Add `pages` section parsing
4. Add `ui` section parsing
5. Implement smart defaults generator

### Phase 2: Update Generators (3 weeks)
1. Update `TypeScriptTypesGenerator` to include UI metadata types
2. Update `NextJSPageGenerator` to read from UI metadata
3. Generate forms with sections from `pages.form`
4. Generate lists with filters from `pages.list`
5. Wire up action UI metadata to buttons

### Phase 3: Documentation & Examples (2 weeks)
1. Update SpecQL language reference
2. Create migration guide
3. Create comprehensive CRM example with all UI metadata
4. Add UI metadata to existing examples (simple-blog, ecommerce)

**Total: 7 weeks** (3 weeks faster than embedded block approach!)

---

## 🎯 Conclusion

**Extend the language, don't add a separate frontend block.**

This approach:
- ✅ Is more elegant and maintainable
- ✅ Reduces duplication
- ✅ Follows SpecQL's existing patterns
- ✅ Is backwards compatible
- ✅ Is actually faster to implement

The result: **SpecQL becomes a true full-stack specification language** where business logic, data models, and UI are all first-class concepts in a unified syntax.
