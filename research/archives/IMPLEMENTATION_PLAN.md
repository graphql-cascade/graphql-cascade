# SpecQL Frontend Language Extension: Detailed Implementation Plan

**Project**: Extend SpecQL language with first-class UI concepts for full-stack generation
**Target**: Universal full-stack generator from business logic
**Timeline**: 7 weeks (35 working days)
**Approach**: Test-Driven Development with phased releases

---

## 🎯 Project Goals

1. **Extend SpecQL language** to include UI metadata as first-class concepts
2. **Maintain backwards compatibility** with existing SpecQL specifications
3. **Generate production-ready frontend** (Next.js) from extended specs
4. **Enable progressive enhancement** (start simple, add UI config as needed)
5. **Provide smart defaults** (sensible UI without explicit configuration)

---

## 📐 Architecture Overview

### Data Flow

```
SpecQL YAML (extended)
       ↓
   Parser (extended to read UI metadata)
       ↓
   AST (EntityDefinition with UI properties)
       ↓
   UI Defaults Generator (fill missing metadata)
       ↓
   ┌──────────────┬────────────────┐
   ↓              ↓                ↓
Backend Gen   Frontend Gen    Universal AST
(existing)    (NEW)          (ready for adapters)
   ↓              ↓                ↓
SQL Files    Next.js Pages    Multi-Framework
```

### Key Components

1. **Extended AST Models** (`src/core/ast_models.py`)
   - `FieldDefinition` with UI properties
   - `ActionDefinition` with UI metadata
   - `EntityDefinition` with `ui` and `pages`
   - New UI config dataclasses

2. **Extended Parser** (`src/core/specql_parser.py`)
   - Parse short form fields (backwards compatible)
   - Parse long form fields with UI metadata
   - Parse entity-level `ui` section
   - Parse `pages` section
   - Parse action `ui` property

3. **UI Defaults Generator** (`src/core/ui_defaults.py`)
   - Infer field labels from names
   - Map scalar types to widgets
   - Generate default page structures
   - Generate default action UI

4. **Next.js Page Generator** (`src/generators/frontend/nextjs_page_generator.py`)
   - Generate list pages with filters
   - Generate form pages with sections
   - Generate detail pages with actions
   - Wire to existing TypeScript types and Apollo hooks

5. **CLI Integration** (`src/cli/generate.py`)
   - Coordinate backend + frontend generation
   - Add new CLI flags for frontend control

---

## 📅 Phase 1: Foundation - Extended AST & Parser (2 weeks)

**Goal**: Extend language to support UI metadata, maintain backwards compatibility

### Week 1: AST Extension

#### Day 1-2: Design & Define UI Dataclasses

**Task**: Add UI metadata dataclasses to `src/core/ast_models.py`

**New Dataclasses**:

```python
@dataclass
class ListFieldConfig:
    """Configuration for field in list views"""
    width: int | None = None
    sortable: bool = True
    alignment: str = "left"  # left, center, right
    render_as: str | None = None  # badge, link, avatar, etc.
    badge_colors: dict[str, str] | None = None  # For enum badges

@dataclass
class FormFieldConfig:
    """Configuration for field in forms"""
    section: str | None = None
    order: int | None = None
    widget: str | None = None  # Override default widget
    conditional_visibility: str | None = None  # Expression
    validation: str = "default"  # default, strict, relaxed
    lookup_config: LookupConfig | None = None  # For reference fields

@dataclass
class LookupConfig:
    """Configuration for reference field lookups"""
    display_template: str  # e.g., "{{name}} - {{city}}"
    filters: list[str] | None = None
    sort: str | None = None
    allow_create: bool = False
    create_inline: bool = False

@dataclass
class DetailFieldConfig:
    """Configuration for field in detail views"""
    section: str | None = None
    order: int | None = None
    render_as: str | None = None  # link, call_link, external_link, etc.

@dataclass
class DisplayConfig:
    """Entity display configuration"""
    title_template: str | None = None
    subtitle_template: str | None = None
    avatar_field: str | None = None

@dataclass
class SearchConfig:
    """Search configuration"""
    fields: list[str]
    placeholder: str | None = None

@dataclass
class AutoGenerateConfig:
    """Auto-generation control"""
    list: bool = True
    form: bool = True
    detail: bool = True

@dataclass
class EntityUIMetadata:
    """Entity-level UI metadata"""
    label: str | None = None
    label_singular: str | None = None
    icon: str | None = None
    color: str | None = None
    display: DisplayConfig | None = None
    search: SearchConfig | None = None
    auto_generate: AutoGenerateConfig | None = None

@dataclass
class ConfirmationConfig:
    """Action confirmation configuration"""
    enabled: bool = False
    title: str | None = None
    message: str | None = None
    confirm_label: str = "Confirm"
    cancel_label: str = "Cancel"
    require_typing: bool = False
    type_text: str | None = None

@dataclass
class SuccessConfig:
    """Success handling configuration"""
    message: str
    toast: str = "success"  # success, info, warning, error
    redirect: str | None = None
    refetch: list[str] | None = None

@dataclass
class ErrorConfig:
    """Error handling configuration"""
    message: str
    toast: str = "error"
    retry: bool = False

@dataclass
class ActionUIMetadata:
    """Action-level UI metadata"""
    label: str
    icon: str | None = None
    variant: str = "primary"  # primary, secondary, danger, success
    show_in: list[str] = field(default_factory=lambda: ["detail_actions"])
    visible_when: str | None = None  # Conditional expression
    confirmation: ConfirmationConfig | None = None
    on_success: SuccessConfig | None = None
    on_error: ErrorConfig | None = None
    roles: list[str] | None = None

@dataclass
class FilterConfig:
    """Filter configuration for list pages"""
    field: str
    operators: list[str]  # eq, ne, gt, gte, lt, lte, in, contains, etc.
    default: Any | None = None
    placeholder: str | None = None
    widget: str | None = None

@dataclass
class QuickFilter:
    """Quick filter button"""
    label: str
    filter: dict[str, Any]
    icon: str | None = None

@dataclass
class FormSection:
    """Form section configuration"""
    title: str | None = None
    description: str | None = None
    icon: str | None = None
    fields: list[str]
    collapsible: bool = False
    default_collapsed: bool = False

@dataclass
class DetailSection:
    """Detail section configuration"""
    title: str | None = None
    layout: str = "default"  # default, two_column, header_card, reference_card
    type: str = "fields"  # fields, custom
    fields: list[str] | None = None
    component: str | None = None  # For custom sections
    props: dict[str, Any] | None = None
    collapsible: bool = False

@dataclass
class ListPageConfig:
    """List page configuration"""
    title: str | None = None
    description: str | None = None
    icon: str | None = None
    columns: list[str]
    default_sort: list[dict[str, str]] | None = None
    filters: list[FilterConfig] | None = None
    quick_filters: list[QuickFilter] | None = None
    row_actions: list[str] | None = None
    primary_actions: list[str] | None = None
    bulk_actions: list[dict[str, Any]] | None = None
    pagination: PaginationConfig | None = None
    empty_state: EmptyStateConfig | None = None

@dataclass
class PaginationConfig:
    """Pagination configuration"""
    page_size: int = 25
    options: list[int] = field(default_factory=lambda: [10, 25, 50, 100])

@dataclass
class EmptyStateConfig:
    """Empty state configuration"""
    icon: str | None = None
    title: str
    description: str | None = None
    action: str | None = None

@dataclass
class FormPageConfig:
    """Form page configuration"""
    title_create: str | None = None
    title_edit: str | None = None
    sections: dict[str, FormSection] | None = None
    layout: str = "single_column"  # single_column, two_column, tabs
    submit_action: str | None = None
    secondary_actions: list[dict[str, Any]] | None = None
    validation: ValidationConfig | None = None

@dataclass
class ValidationConfig:
    """Validation configuration"""
    mode: str = "onChange"  # onChange, onBlur, onSubmit
    show_errors: str = "immediate"  # immediate, onSubmit

@dataclass
class DetailPageConfig:
    """Detail page configuration"""
    title: str | None = None
    subtitle: str | None = None
    icon: str | None = None
    sections: dict[str, DetailSection] | None = None
    actions: list[str] | None = None
    tabs: list[TabConfig] | None = None

@dataclass
class TabConfig:
    """Tab configuration for detail pages"""
    id: str
    label: str
    sections: list[str]

@dataclass
class PageDefinitions:
    """All page configurations for an entity"""
    list: ListPageConfig | None = None
    form: FormPageConfig | None = None
    detail: DetailPageConfig | None = None

@dataclass
class NavigationConfig:
    """Navigation configuration"""
    menu_item: MenuItemConfig | None = None

@dataclass
class MenuItemConfig:
    """Menu item configuration"""
    label: str
    icon: str | None = None
    section: str | None = None
    order: int | None = None
```

**Extend Existing Dataclasses**:

```python
@dataclass
class FieldDefinition:
    # Existing fields
    name: str
    type_name: str
    nullable: bool
    default: Any | None
    # ... (all existing fields)

    # NEW: UI metadata
    label: str | None = None
    placeholder: str | None = None
    help_text: str | None = None
    visible_in: list[str] | None = None  # ['list', 'form', 'detail', 'all']

    # Nested UI configs
    list: ListFieldConfig | None = None
    form: FormFieldConfig | None = None
    detail: DetailFieldConfig | None = None

@dataclass
class ActionDefinition:
    # Existing fields
    name: str
    description: str
    steps: list[ActionStep]
    # ... (all existing fields)

    # NEW: UI metadata
    ui: ActionUIMetadata | None = None

@dataclass
class EntityDefinition:
    # Existing fields
    name: str
    schema: str
    description: str
    fields: dict[str, FieldDefinition]
    actions: list[ActionDefinition]
    # ... (all existing fields)

    # NEW: UI metadata and pages
    ui: EntityUIMetadata | None = None
    pages: PageDefinitions | None = None
    navigation: NavigationConfig | None = None
```

**Testing Strategy**:
```python
# tests/unit/test_ui_dataclasses.py

def test_field_definition_with_ui_metadata():
    """Test FieldDefinition with UI properties"""
    field = FieldDefinition(
        name="email",
        type_name="email",
        nullable=False,
        label="Work Email",
        placeholder="user@company.com",
        visible_in=["list", "form"],
        list=ListFieldConfig(width=250, sortable=True),
    )
    assert field.label == "Work Email"
    assert field.list.width == 250
    assert "list" in field.visible_in

def test_backwards_compatibility():
    """Test that old fields still work"""
    field = FieldDefinition(
        name="email",
        type_name="email",
        nullable=False,
    )
    assert field.label is None  # No UI metadata is fine
    assert field.list is None
```

**Deliverables**:
- ✅ All UI dataclasses added to `ast_models.py`
- ✅ Existing dataclasses extended with UI properties
- ✅ Unit tests for all new dataclasses
- ✅ Documentation strings for all new classes

---

#### Day 3-5: Extend Parser for Short & Long Form Fields

**Task**: Update `src/core/specql_parser.py` to parse both field forms

**Implementation**:

```python
class SpecQLParser:
    def _parse_fields(self, fields_data: dict) -> dict[str, FieldDefinition]:
        """Parse fields section (supporting short and long forms)"""
        fields = {}
        for field_name, field_spec in fields_data.items():
            fields[field_name] = self._parse_field(field_name, field_spec)
        return fields

    def _parse_field(self, field_name: str, field_spec: str | dict) -> FieldDefinition:
        """
        Parse field definition supporting both:
        - Short form: email: email!
        - Long form: email: { type: email!, label: "Work Email", ... }
        """
        # Short form (backwards compatible)
        if isinstance(field_spec, str):
            return self._parse_short_field(field_name, field_spec)

        # Long form with UI metadata
        if isinstance(field_spec, dict):
            if 'type' not in field_spec:
                raise ValueError(f"Field '{field_name}' missing required 'type' property")
            return self._parse_long_field(field_name, field_spec)

        raise ValueError(f"Invalid field spec for '{field_name}': {field_spec}")

    def _parse_short_field(self, field_name: str, type_spec: str) -> FieldDefinition:
        """Parse short form: email: email!"""
        # Use existing parsing logic
        type_name, nullable = self._parse_type_spec(type_spec)

        return FieldDefinition(
            name=field_name,
            type_name=type_name,
            nullable=nullable,
            # UI metadata will be filled by defaults generator
        )

    def _parse_long_field(self, field_name: str, config: dict) -> FieldDefinition:
        """Parse long form with UI metadata"""
        type_spec = config['type']
        type_name, nullable = self._parse_type_spec(type_spec)

        # Parse UI metadata
        label = config.get('label')
        placeholder = config.get('placeholder')
        help_text = config.get('help_text')
        visible_in = config.get('visible_in')

        # Parse nested configs
        list_config = self._parse_list_config(config.get('list')) if 'list' in config else None
        form_config = self._parse_form_config(config.get('form')) if 'form' in config else None
        detail_config = self._parse_detail_config(config.get('detail')) if 'detail' in config else None

        return FieldDefinition(
            name=field_name,
            type_name=type_name,
            nullable=nullable,
            label=label,
            placeholder=placeholder,
            help_text=help_text,
            visible_in=visible_in,
            list=list_config,
            form=form_config,
            detail=detail_config,
        )

    def _parse_list_config(self, config: dict) -> ListFieldConfig:
        """Parse list field configuration"""
        return ListFieldConfig(
            width=config.get('width'),
            sortable=config.get('sortable', True),
            alignment=config.get('alignment', 'left'),
            render_as=config.get('render_as'),
            badge_colors=config.get('badge_colors'),
        )

    def _parse_form_config(self, config: dict) -> FormFieldConfig:
        """Parse form field configuration"""
        lookup_config = None
        if 'lookup_config' in config:
            lc = config['lookup_config']
            lookup_config = LookupConfig(
                display_template=lc.get('display_template', '{{name}}'),
                filters=lc.get('filters'),
                sort=lc.get('sort'),
                allow_create=lc.get('allow_create', False),
                create_inline=lc.get('create_inline', False),
            )

        return FormFieldConfig(
            section=config.get('section'),
            order=config.get('order'),
            widget=config.get('widget'),
            conditional_visibility=config.get('conditional_visibility'),
            validation=config.get('validation', 'default'),
            lookup_config=lookup_config,
        )

    def _parse_detail_config(self, config: dict) -> DetailFieldConfig:
        """Parse detail field configuration"""
        return DetailFieldConfig(
            section=config.get('section'),
            order=config.get('order'),
            render_as=config.get('render_as'),
        )
```

**Testing Strategy**:
```python
# tests/unit/test_parser_fields.py

def test_parse_short_form_field():
    """Test backwards compatible short form"""
    parser = SpecQLParser()
    yaml_content = """
    entity: Contact
    schema: crm
    fields:
      email: email!
    """
    entity = parser.parse(yaml_content)
    assert entity.fields['email'].name == 'email'
    assert entity.fields['email'].type_name == 'email'
    assert entity.fields['email'].nullable is False
    assert entity.fields['email'].label is None  # Will be filled by defaults

def test_parse_long_form_field():
    """Test long form with UI metadata"""
    parser = SpecQLParser()
    yaml_content = """
    entity: Contact
    schema: crm
    fields:
      email:
        type: email!
        label: "Work Email"
        placeholder: "user@company.com"
        help_text: "Primary business email"
        visible_in: [list, form, detail]
        list:
          width: 250
          sortable: true
        form:
          section: contact_info
          order: 1
    """
    entity = parser.parse(yaml_content)
    field = entity.fields['email']
    assert field.label == "Work Email"
    assert field.placeholder == "user@company.com"
    assert field.visible_in == ['list', 'form', 'detail']
    assert field.list.width == 250
    assert field.form.section == 'contact_info'

def test_mixed_short_long_forms():
    """Test mixing short and long forms"""
    parser = SpecQLParser()
    yaml_content = """
    entity: Contact
    schema: crm
    fields:
      first_name: text!
      last_name: text!
      email:
        type: email!
        label: "Work Email"
    """
    entity = parser.parse(yaml_content)
    assert entity.fields['first_name'].type_name == 'text'
    assert entity.fields['email'].label == "Work Email"
```

**Deliverables**:
- ✅ Parser handles short form fields (backwards compatible)
- ✅ Parser handles long form fields with UI metadata
- ✅ Parser validates field configs
- ✅ Unit tests for both forms
- ✅ Integration tests with real YAML files

---

### Week 2: Entity & Pages Parsing

#### Day 6-7: Parse Entity UI Metadata

**Task**: Add parsing for entity-level `ui:` section

```python
class SpecQLParser:
    def _parse_entity(self, data: dict) -> EntityDefinition:
        """Parse entity with UI metadata"""
        # Existing parsing...
        entity = EntityDefinition(
            name=data['entity'],
            schema=data['schema'],
            description=data.get('description'),
            fields=self._parse_fields(data.get('fields', {})),
            actions=self._parse_actions(data.get('actions', [])),
        )

        # NEW: Parse UI metadata
        if 'ui' in data:
            entity.ui = self._parse_entity_ui(data['ui'])

        # NEW: Parse pages
        if 'pages' in data:
            entity.pages = self._parse_pages(data['pages'], entity)

        # NEW: Parse navigation
        if 'navigation' in data:
            entity.navigation = self._parse_navigation(data['navigation'])

        return entity

    def _parse_entity_ui(self, ui_data: dict) -> EntityUIMetadata:
        """Parse entity UI metadata"""
        display_config = None
        if 'display' in ui_data:
            d = ui_data['display']
            display_config = DisplayConfig(
                title_template=d.get('title_template'),
                subtitle_template=d.get('subtitle_template'),
                avatar_field=d.get('avatar_field'),
            )

        search_config = None
        if 'search' in ui_data:
            s = ui_data['search']
            search_config = SearchConfig(
                fields=s['fields'],
                placeholder=s.get('placeholder'),
            )

        auto_generate = None
        if 'auto_generate' in ui_data:
            a = ui_data['auto_generate']
            auto_generate = AutoGenerateConfig(
                list=a.get('list', True),
                form=a.get('form', True),
                detail=a.get('detail', True),
            )

        return EntityUIMetadata(
            label=ui_data.get('label'),
            label_singular=ui_data.get('label_singular'),
            icon=ui_data.get('icon'),
            color=ui_data.get('color'),
            display=display_config,
            search=search_config,
            auto_generate=auto_generate,
        )
```

**Testing**:
```python
def test_parse_entity_ui_metadata():
    """Test parsing entity-level UI metadata"""
    parser = SpecQLParser()
    yaml_content = """
    entity: Contact
    schema: crm
    ui:
      label: "Contacts"
      label_singular: "Contact"
      icon: user-circle
      color: blue
      display:
        title_template: "{{first_name}} {{last_name}}"
        subtitle_template: "{{job_title}}"
      search:
        fields: [first_name, last_name, email]
        placeholder: "Search contacts..."
    fields:
      first_name: text!
    """
    entity = parser.parse(yaml_content)
    assert entity.ui.label == "Contacts"
    assert entity.ui.icon == "user-circle"
    assert entity.ui.display.title_template == "{{first_name}} {{last_name}}"
    assert entity.ui.search.fields == ['first_name', 'last_name', 'email']
```

**Deliverables**:
- ✅ Entity UI metadata parsing
- ✅ Display config parsing
- ✅ Search config parsing
- ✅ Unit tests

---

#### Day 8-10: Parse Pages Section

**Task**: Parse list, form, and detail page configurations

```python
class SpecQLParser:
    def _parse_pages(self, pages_data: dict, entity: EntityDefinition) -> PageDefinitions:
        """Parse pages section"""
        list_config = None
        if 'list' in pages_data:
            list_config = self._parse_list_page(pages_data['list'], entity)

        form_config = None
        if 'form' in pages_data:
            form_config = self._parse_form_page(pages_data['form'], entity)

        detail_config = None
        if 'detail' in pages_data:
            detail_config = self._parse_detail_page(pages_data['detail'], entity)

        return PageDefinitions(
            list=list_config,
            form=form_config,
            detail=detail_config,
        )

    def _parse_list_page(self, config: dict, entity: EntityDefinition) -> ListPageConfig:
        """Parse list page configuration"""
        # Validate column references
        columns = config.get('columns', [])
        for col in columns:
            if col not in entity.fields:
                raise ValueError(f"List page references unknown field: {col}")

        # Parse filters
        filters = []
        for filter_data in config.get('filters', []):
            field_name = filter_data['field']
            if field_name not in entity.fields:
                raise ValueError(f"Filter references unknown field: {field_name}")

            filters.append(FilterConfig(
                field=field_name,
                operators=filter_data['operators'],
                default=filter_data.get('default'),
                placeholder=filter_data.get('placeholder'),
                widget=filter_data.get('widget'),
            ))

        # Parse quick filters
        quick_filters = []
        for qf_data in config.get('quick_filters', []):
            quick_filters.append(QuickFilter(
                label=qf_data['label'],
                filter=qf_data['filter'],
                icon=qf_data.get('icon'),
            ))

        # Parse pagination
        pagination = None
        if 'pagination' in config:
            p = config['pagination']
            pagination = PaginationConfig(
                page_size=p.get('page_size', 25),
                options=p.get('options', [10, 25, 50, 100]),
            )

        # Parse empty state
        empty_state = None
        if 'empty_state' in config:
            es = config['empty_state']
            empty_state = EmptyStateConfig(
                icon=es.get('icon'),
                title=es['title'],
                description=es.get('description'),
                action=es.get('action'),
            )

        return ListPageConfig(
            title=config.get('title'),
            description=config.get('description'),
            icon=config.get('icon'),
            columns=columns,
            default_sort=config.get('default_sort'),
            filters=filters,
            quick_filters=quick_filters,
            row_actions=config.get('row_actions'),
            primary_actions=config.get('primary_actions'),
            bulk_actions=config.get('bulk_actions'),
            pagination=pagination,
            empty_state=empty_state,
        )

    def _parse_form_page(self, config: dict, entity: EntityDefinition) -> FormPageConfig:
        """Parse form page configuration"""
        sections = {}
        if 'sections' in config:
            for section_id, section_data in config['sections'].items():
                # Validate field references
                fields = section_data.get('fields', [])
                for field_name in fields:
                    if field_name not in entity.fields:
                        raise ValueError(f"Form section '{section_id}' references unknown field: {field_name}")

                sections[section_id] = FormSection(
                    title=section_data.get('title'),
                    description=section_data.get('description'),
                    icon=section_data.get('icon'),
                    fields=fields,
                    collapsible=section_data.get('collapsible', False),
                    default_collapsed=section_data.get('default_collapsed', False),
                )

        # Parse validation config
        validation = None
        if 'validation' in config:
            v = config['validation']
            validation = ValidationConfig(
                mode=v.get('mode', 'onChange'),
                show_errors=v.get('show_errors', 'immediate'),
            )

        return FormPageConfig(
            title_create=config.get('title_create'),
            title_edit=config.get('title_edit'),
            sections=sections,
            layout=config.get('layout', 'single_column'),
            submit_action=config.get('submit_action'),
            secondary_actions=config.get('secondary_actions'),
            validation=validation,
        )

    def _parse_detail_page(self, config: dict, entity: EntityDefinition) -> DetailPageConfig:
        """Parse detail page configuration"""
        sections = {}
        if 'sections' in config:
            for section_id, section_data in config['sections'].items():
                section_type = section_data.get('type', 'fields')

                # Validate field references for field sections
                if section_type == 'fields' and 'fields' in section_data:
                    for field_name in section_data['fields']:
                        if field_name not in entity.fields:
                            raise ValueError(f"Detail section '{section_id}' references unknown field: {field_name}")

                sections[section_id] = DetailSection(
                    title=section_data.get('title'),
                    layout=section_data.get('layout', 'default'),
                    type=section_type,
                    fields=section_data.get('fields'),
                    component=section_data.get('component'),
                    props=section_data.get('props'),
                    collapsible=section_data.get('collapsible', False),
                )

        # Parse tabs
        tabs = None
        if 'tabs' in config:
            tabs = []
            for tab_data in config['tabs']:
                tabs.append(TabConfig(
                    id=tab_data['id'],
                    label=tab_data['label'],
                    sections=tab_data['sections'],
                ))

        return DetailPageConfig(
            title=config.get('title'),
            subtitle=config.get('subtitle'),
            icon=config.get('icon'),
            sections=sections,
            actions=config.get('actions'),
            tabs=tabs,
        )
```

**Testing**:
```python
def test_parse_list_page():
    """Test list page parsing"""
    parser = SpecQLParser()
    yaml_content = """
    entity: Contact
    schema: crm
    fields:
      email: email!
      status: enum(lead, customer)
    pages:
      list:
        title: "Contacts"
        columns: [email, status]
        filters:
          - field: email
            operators: [contains, eq]
          - field: status
            operators: [eq, in]
    """
    entity = parser.parse(yaml_content)
    assert entity.pages.list.title == "Contacts"
    assert entity.pages.list.columns == ['email', 'status']
    assert len(entity.pages.list.filters) == 2

def test_parse_form_page():
    """Test form page parsing"""
    parser = SpecQLParser()
    yaml_content = """
    entity: Contact
    schema: crm
    fields:
      first_name: text!
      email: email!
    pages:
      form:
        title_create: "New Contact"
        sections:
          basic:
            title: "Basic Info"
            fields: [first_name, email]
    """
    entity = parser.parse(yaml_content)
    assert entity.pages.form.title_create == "New Contact"
    assert 'basic' in entity.pages.form.sections
    assert entity.pages.form.sections['basic'].fields == ['first_name', 'email']
```

**Deliverables**:
- ✅ List page parsing with validation
- ✅ Form page parsing with sections
- ✅ Detail page parsing
- ✅ Field reference validation
- ✅ Unit tests for all page types

---

#### Day 11-12: Parse Action UI Metadata

**Task**: Add UI metadata parsing to actions

```python
class SpecQLParser:
    def _parse_actions(self, actions_data: list) -> list[ActionDefinition]:
        """Parse actions with UI metadata"""
        actions = []
        for action_data in actions_data:
            action = ActionDefinition(
                name=action_data['name'],
                description=action_data.get('description'),
                steps=self._parse_action_steps(action_data.get('steps', [])),
            )

            # NEW: Parse UI metadata
            if 'ui' in action_data:
                action.ui = self._parse_action_ui(action_data['ui'])

            actions.append(action)

        return actions

    def _parse_action_ui(self, ui_data: dict) -> ActionUIMetadata:
        """Parse action UI metadata"""
        confirmation = None
        if 'confirmation' in ui_data:
            c = ui_data['confirmation']
            confirmation = ConfirmationConfig(
                enabled=c.get('enabled', False),
                title=c.get('title'),
                message=c.get('message'),
                confirm_label=c.get('confirm_label', 'Confirm'),
                cancel_label=c.get('cancel_label', 'Cancel'),
                require_typing=c.get('require_typing', False),
                type_text=c.get('type_text'),
            )

        on_success = None
        if 'on_success' in ui_data:
            s = ui_data['on_success']
            on_success = SuccessConfig(
                message=s['message'],
                toast=s.get('toast', 'success'),
                redirect=s.get('redirect'),
                refetch=s.get('refetch'),
            )

        on_error = None
        if 'on_error' in ui_data:
            e = ui_data['on_error']
            on_error = ErrorConfig(
                message=e['message'],
                toast=e.get('toast', 'error'),
                retry=e.get('retry', False),
            )

        return ActionUIMetadata(
            label=ui_data['label'],
            icon=ui_data.get('icon'),
            variant=ui_data.get('variant', 'primary'),
            show_in=ui_data.get('show_in', ['detail_actions']),
            visible_when=ui_data.get('visible_when'),
            confirmation=confirmation,
            on_success=on_success,
            on_error=on_error,
            roles=ui_data.get('roles'),
        )
```

**Testing**:
```python
def test_parse_action_ui_metadata():
    """Test action UI metadata parsing"""
    parser = SpecQLParser()
    yaml_content = """
    entity: Contact
    schema: crm
    fields:
      email: email!
    actions:
      - name: delete_contact
        steps:
          - delete: Contact
        ui:
          label: "Delete"
          icon: trash
          variant: danger
          confirmation:
            enabled: true
            title: "Delete Contact?"
            message: "This cannot be undone"
          on_success:
            message: "Contact deleted"
            redirect: "/contacts"
    """
    entity = parser.parse(yaml_content)
    action = entity.actions[0]
    assert action.ui.label == "Delete"
    assert action.ui.confirmation.enabled is True
    assert action.ui.on_success.message == "Contact deleted"
```

**Deliverables**:
- ✅ Action UI parsing
- ✅ Confirmation config parsing
- ✅ Success/error handling parsing
- ✅ Unit tests

---

#### Day 13-14: Integration Testing & Documentation

**Task**: End-to-end parser tests and documentation

**Integration Tests**:
```python
def test_parse_complete_extended_spec():
    """Test parsing complete extended specification"""
    yaml_path = 'examples/contact_extended.yaml'
    parser = SpecQLParser()

    with open(yaml_path) as f:
        entity = parser.parse(f.read())

    # Verify entity UI
    assert entity.ui is not None
    assert entity.ui.label == "Contacts"

    # Verify fields with UI metadata
    email_field = entity.fields['email']
    assert email_field.label == "Work Email"
    assert email_field.list is not None
    assert email_field.list.width == 250

    # Verify pages
    assert entity.pages is not None
    assert entity.pages.list is not None
    assert entity.pages.form is not None
    assert entity.pages.detail is not None

    # Verify actions with UI
    create_action = next(a for a in entity.actions if a.name == 'create_contact')
    assert create_action.ui is not None
    assert create_action.ui.label == "New Contact"

def test_backwards_compatibility_old_specs():
    """Test that old specs still parse correctly"""
    yaml_content = """
    entity: Contact
    schema: crm
    fields:
      email: email!
      phone: phoneNumber
    actions:
      - name: create_contact
        steps:
          - insert: Contact
    """
    parser = SpecQLParser()
    entity = parser.parse(yaml_content)

    # Old spec should parse successfully
    assert entity.name == "Contact"
    assert 'email' in entity.fields

    # UI metadata should be None (will be filled by defaults)
    assert entity.ui is None
    assert entity.pages is None
    assert entity.actions[0].ui is None
```

**Documentation**:
- Update `docs/language/fields.md` with long form syntax
- Create `docs/language/ui-metadata.md` with all UI options
- Create `docs/guides/progressive-enhancement.md` showing how to add UI incrementally

**Deliverables**:
- ✅ Integration tests with real YAML files
- ✅ Backwards compatibility tests
- ✅ Updated language reference documentation
- ✅ Migration guide for existing specs

---

## 📅 Phase 2: UI Defaults Generator (1 week)

**Goal**: Auto-generate sensible UI metadata when not explicitly provided

### Week 3: Smart Defaults

#### Day 15-17: Core Defaults Generator

**Task**: Create `src/core/ui_defaults.py`

```python
"""
UI Defaults Generator

Generates sensible default UI metadata for entities that don't have explicit UI configuration.
Follows convention over configuration principle.
"""

import re
from typing import Optional
from src.core.ast_models import (
    EntityDefinition,
    FieldDefinition,
    ActionDefinition,
    EntityUIMetadata,
    ListPageConfig,
    FormPageConfig,
    DetailPageConfig,
    PageDefinitions,
    ActionUIMetadata,
    ListFieldConfig,
    FormFieldConfig,
    DetailFieldConfig,
    FormSection,
    DetailSection,
    SearchConfig,
    AutoGenerateConfig,
)

class UIDefaultsGenerator:
    """Generate default UI metadata from backend definitions"""

    # Hidden fields (not visible in UI by default)
    HIDDEN_FIELDS = [
        'pk_', 'fk_',  # Internal keys
        'created_by', 'updated_by', 'deleted_by',  # Audit users
        'tenant_id',  # Multi-tenant
    ]

    # Fields visible only in detail view
    DETAIL_ONLY_FIELDS = [
        'created_at', 'updated_at', 'deleted_at',  # Timestamps
        'notes', 'description', 'comments',  # Long text
    ]

    # Icon mapping (entity name → icon)
    ICON_MAP = {
        'user': 'user',
        'contact': 'user-circle',
        'organization': 'building',
        'company': 'briefcase',
        'order': 'shopping-cart',
        'product': 'package',
        'customer': 'users',
        'invoice': 'file-text',
        'payment': 'credit-card',
        'task': 'check-square',
        'project': 'folder',
    }

    def apply_defaults(self, entity: EntityDefinition) -> None:
        """Apply default UI metadata to entity"""
        # Entity-level defaults
        if not entity.ui:
            entity.ui = self._generate_entity_ui(entity)
        else:
            # Fill missing entity UI properties
            self._fill_entity_ui_defaults(entity.ui, entity)

        # Field-level defaults
        for field_name, field_def in entity.fields.items():
            self._apply_field_defaults(field_def, entity)

        # Page defaults
        if not entity.pages:
            entity.pages = self._generate_default_pages(entity)
        else:
            # Fill missing page configs
            if not entity.pages.list:
                entity.pages.list = self._generate_default_list_page(entity)
            if not entity.pages.form:
                entity.pages.form = self._generate_default_form_page(entity)
            if not entity.pages.detail:
                entity.pages.detail = self._generate_default_detail_page(entity)

        # Action defaults
        for action in entity.actions:
            if not action.ui:
                action.ui = self._generate_default_action_ui(action)

    def _generate_entity_ui(self, entity: EntityDefinition) -> EntityUIMetadata:
        """Generate default entity UI metadata"""
        return EntityUIMetadata(
            label=self._pluralize(entity.name),
            label_singular=entity.name,
            icon=self._guess_icon(entity.name),
            search=SearchConfig(
                fields=self._get_searchable_fields(entity),
                placeholder=f"Search {self._pluralize(entity.name).lower()}...",
            ),
            auto_generate=AutoGenerateConfig(
                list=True,
                form=True,
                detail=True,
            ),
        )

    def _apply_field_defaults(self, field: FieldDefinition, entity: EntityDefinition) -> None:
        """Apply default UI metadata to field"""
        # Label
        if not field.label:
            field.label = self._humanize(field.name)

        # Placeholder (from scalar type or generate)
        if not field.placeholder:
            if field.scalar_def and field.scalar_def.placeholder:
                field.placeholder = field.scalar_def.placeholder
            else:
                field.placeholder = self._generate_placeholder(field)

        # Visibility
        if not field.visible_in:
            field.visible_in = self._determine_visibility(field)

        # List config
        if not field.list and 'list' in field.visible_in:
            field.list = ListFieldConfig(
                width=self._guess_column_width(field),
                sortable=self._is_sortable(field),
            )

        # Form config
        if not field.form and 'form' in field.visible_in:
            field.form = FormFieldConfig(
                section=self._guess_section(field, entity),
                order=None,  # Will be ordered by definition order
            )

        # Detail config
        if not field.detail and 'detail' in field.visible_in:
            field.detail = DetailFieldConfig(
                section='main',
                render_as=self._guess_render_as(field),
            )

    def _generate_default_pages(self, entity: EntityDefinition) -> PageDefinitions:
        """Generate default page configurations"""
        return PageDefinitions(
            list=self._generate_default_list_page(entity),
            form=self._generate_default_form_page(entity),
            detail=self._generate_default_detail_page(entity),
        )

    def _generate_default_list_page(self, entity: EntityDefinition) -> ListPageConfig:
        """Generate default list page"""
        # Get visible fields
        columns = [
            name for name, field in entity.fields.items()
            if 'list' in (field.visible_in or [])
        ]

        # Limit columns (too many = bad UX)
        if len(columns) > 6:
            columns = columns[:6]

        # Generate filters for searchable fields
        filters = []
        for field_name, field in entity.fields.items():
            if self._is_filterable(field):
                filters.append(self._generate_filter_config(field))

        return ListPageConfig(
            title=entity.ui.label if entity.ui else self._pluralize(entity.name),
            columns=columns,
            default_sort=[{'created_at': 'desc'}] if 'created_at' in entity.fields else None,
            filters=filters[:5] if filters else None,  # Limit to 5 filters
            primary_actions=self._get_create_actions(entity),
            row_actions=self._get_row_actions(entity),
        )

    def _generate_default_form_page(self, entity: EntityDefinition) -> FormPageConfig:
        """Generate default form page with sections"""
        sections = self._organize_fields_into_sections(entity)

        return FormPageConfig(
            title_create=f"New {entity.ui.label_singular if entity.ui else entity.name}",
            title_edit=f"Edit {entity.ui.label_singular if entity.ui else entity.name}",
            sections=sections,
            submit_action=self._get_create_action_name(entity),
        )

    def _generate_default_detail_page(self, entity: EntityDefinition) -> DetailPageConfig:
        """Generate default detail page"""
        sections = {}

        # Main section with primary fields
        main_fields = [
            name for name, field in entity.fields.items()
            if 'detail' in (field.visible_in or []) and not self._is_audit_field(name)
        ]

        sections['main'] = DetailSection(
            title=None,  # No title for main section
            layout='two_column',
            type='fields',
            fields=main_fields,
        )

        # Audit section with timestamps
        audit_fields = [name for name in ['created_at', 'updated_at'] if name in entity.fields]
        if audit_fields:
            sections['audit'] = DetailSection(
                title='History',
                type='fields',
                fields=audit_fields,
                collapsible=True,
            )

        return DetailPageConfig(
            sections=sections,
            actions=self._get_detail_actions(entity),
        )

    def _generate_default_action_ui(self, action: ActionDefinition) -> ActionUIMetadata:
        """Generate default action UI metadata"""
        action_type = self._classify_action(action.name)

        return ActionUIMetadata(
            label=self._humanize(action.name),
            icon=self._guess_action_icon(action_type),
            variant=self._guess_action_variant(action_type),
            show_in=self._guess_action_placement(action_type),
            confirmation=self._generate_confirmation_config(action_type),
            on_success=SuccessConfig(
                message=f"{self._humanize(action.name)} completed successfully",
                toast='success',
            ),
        )

    # Helper methods

    def _humanize(self, name: str) -> str:
        """Convert snake_case to Title Case"""
        return ' '.join(word.capitalize() for word in name.split('_'))

    def _pluralize(self, name: str) -> str:
        """Simple pluralization"""
        if name.endswith('y'):
            return name[:-1] + 'ies'
        elif name.endswith('s'):
            return name
        else:
            return name + 's'

    def _guess_icon(self, entity_name: str) -> str:
        """Guess icon from entity name"""
        name_lower = entity_name.lower()
        for key, icon in self.ICON_MAP.items():
            if key in name_lower:
                return icon
        return 'file'  # Default icon

    def _determine_visibility(self, field: FieldDefinition) -> list[str]:
        """Determine default visibility for field"""
        # Hidden fields
        if any(field.name.startswith(prefix) for prefix in self.HIDDEN_FIELDS):
            return []

        # Detail only fields
        if any(suffix in field.name for suffix in self.DETAIL_ONLY_FIELDS):
            return ['detail']

        # Long text fields
        if field.type_name == 'text' and not field.name.endswith('_name'):
            return ['form', 'detail']

        # Default: visible everywhere
        return ['list', 'form', 'detail']

    def _guess_column_width(self, field: FieldDefinition) -> int:
        """Guess column width for list view"""
        if field.type_name in ['boolean', 'integer']:
            return 100
        elif field.type_name == 'email':
            return 250
        elif field.type_name == 'url':
            return 200
        elif field.type_name == 'date':
            return 120
        elif field.type_name == 'timestamp':
            return 180
        else:
            return 200  # Default

    def _is_sortable(self, field: FieldDefinition) -> bool:
        """Determine if field should be sortable"""
        # Most fields are sortable
        return field.type_name not in ['text', 'jsonb']

    def _guess_section(self, field: FieldDefinition, entity: EntityDefinition) -> str:
        """Guess form section for field"""
        # Reference fields → relations section
        if field.reference_entity:
            return 'relations'

        # Audit fields → metadata section
        if any(field.name.endswith(suffix) for suffix in ['_at', '_by']):
            return 'metadata'

        # Default section
        return 'basic'

    def _guess_render_as(self, field: FieldDefinition) -> str | None:
        """Guess how to render field in detail view"""
        if field.type_name == 'email':
            return 'link'
        elif field.type_name == 'url':
            return 'external_link'
        elif field.type_name == 'phoneNumber':
            return 'call_link'
        elif field.reference_entity:
            return 'reference_card'
        return None

    def _organize_fields_into_sections(self, entity: EntityDefinition) -> dict[str, FormSection]:
        """Organize fields into logical form sections"""
        sections = {}
        section_fields = {}

        # Group fields by section
        for field_name, field in entity.fields.items():
            if 'form' not in (field.visible_in or []):
                continue

            section = field.form.section if field.form else 'basic'
            if section not in section_fields:
                section_fields[section] = []
            section_fields[section].append(field_name)

        # Create FormSection objects
        for section_id, fields in section_fields.items():
            sections[section_id] = FormSection(
                title=self._humanize(section_id),
                fields=fields,
            )

        return sections

    def _classify_action(self, action_name: str) -> str:
        """Classify action type from name"""
        name_lower = action_name.lower()
        if name_lower.startswith('create'):
            return 'create'
        elif name_lower.startswith('update'):
            return 'update'
        elif name_lower.startswith('delete'):
            return 'delete'
        else:
            return 'custom'

    def _guess_action_icon(self, action_type: str) -> str:
        """Guess icon for action type"""
        icons = {
            'create': 'plus-circle',
            'update': 'save',
            'delete': 'trash',
            'custom': 'zap',
        }
        return icons.get(action_type, 'circle')

    def _guess_action_variant(self, action_type: str) -> str:
        """Guess button variant for action type"""
        variants = {
            'create': 'primary',
            'update': 'primary',
            'delete': 'danger',
            'custom': 'secondary',
        }
        return variants.get(action_type, 'secondary')

    def _guess_action_placement(self, action_type: str) -> list[str]:
        """Guess where action button should appear"""
        if action_type == 'create':
            return ['list_primary']
        elif action_type == 'delete':
            return ['detail_actions', 'list_row_actions']
        else:
            return ['detail_actions']

    def _generate_confirmation_config(self, action_type: str) -> ConfirmationConfig | None:
        """Generate confirmation config for action"""
        if action_type == 'delete':
            return ConfirmationConfig(
                enabled=True,
                title=f"Delete this item?",
                message="This action cannot be undone.",
                confirm_label="Delete",
            )
        return None

    def _get_searchable_fields(self, entity: EntityDefinition) -> list[str]:
        """Get fields suitable for search"""
        searchable = []
        for name, field in entity.fields.items():
            if field.type_name in ['text', 'email'] and 'name' in name or 'email' in name:
                searchable.append(name)
        return searchable[:5]  # Limit to 5 fields

    def _is_filterable(self, field: FieldDefinition) -> bool:
        """Determine if field should have a filter"""
        return field.type_name in ['email', 'enum', 'date', 'timestamp'] or field.reference_entity

    def _get_create_actions(self, entity: EntityDefinition) -> list[str]:
        """Get create actions for entity"""
        return [a.name for a in entity.actions if a.name.startswith('create_')]

    def _get_row_actions(self, entity: EntityDefinition) -> list[str]:
        """Get row actions (view, edit, delete)"""
        actions = []
        for action in entity.actions:
            action_type = self._classify_action(action.name)
            if action_type in ['update', 'delete']:
                actions.append(action.name)
        return actions

    def _get_detail_actions(self, entity: EntityDefinition) -> list[str]:
        """Get actions for detail page"""
        return [a.name for a in entity.actions if not a.name.startswith('create_')]

    def _is_audit_field(self, field_name: str) -> bool:
        """Check if field is an audit field"""
        return any(field_name.endswith(suffix) for suffix in ['_at', '_by'])
```

**Testing**:
```python
# tests/unit/test_ui_defaults.py

def test_apply_defaults_to_simple_entity():
    """Test applying defaults to entity without UI metadata"""
    entity = EntityDefinition(
        name='Contact',
        schema='crm',
        fields={
            'email': FieldDefinition(name='email', type_name='email', nullable=False),
            'name': FieldDefinition(name='name', type_name='text', nullable=False),
        },
        actions=[
            ActionDefinition(
                name='create_contact',
                steps=[],
            )
        ],
    )

    generator = UIDefaultsGenerator()
    generator.apply_defaults(entity)

    # Check entity UI
    assert entity.ui is not None
    assert entity.ui.label == 'Contacts'
    assert entity.ui.icon is not None

    # Check field defaults
    assert entity.fields['email'].label == 'Email'
    assert entity.fields['email'].visible_in is not None

    # Check pages generated
    assert entity.pages is not None
    assert entity.pages.list is not None
    assert entity.pages.form is not None
    assert entity.pages.detail is not None

    # Check action UI
    assert entity.actions[0].ui is not None
    assert entity.actions[0].ui.label == 'Create Contact'

def test_preserve_explicit_metadata():
    """Test that explicit metadata is not overridden"""
    entity = EntityDefinition(
        name='Contact',
        schema='crm',
        fields={
            'email': FieldDefinition(
                name='email',
                type_name='email',
                nullable=False,
                label='Work Email',  # Explicit label
            ),
        },
        actions=[],
    )

    generator = UIDefaultsGenerator()
    generator.apply_defaults(entity)

    # Explicit label should be preserved
    assert entity.fields['email'].label == 'Work Email'
```

**Deliverables**:
- ✅ UI defaults generator implementation
- ✅ Field visibility rules
- ✅ Smart section organization
- ✅ Action classification
- ✅ Unit tests
- ✅ Documentation

---

#### Day 18-19: Integration with Parser

**Task**: Integrate defaults generator into parsing pipeline

```python
# In src/cli/generate.py

from src.core.ui_defaults import UIDefaultsGenerator

def parse_entities_with_ui(entity_files: list[Path]) -> list[EntityDefinition]:
    """Parse entities and apply UI defaults"""
    parser = SpecQLParser()
    defaults_generator = UIDefaultsGenerator()

    entities = []
    for file_path in entity_files:
        content = file_path.read_text()
        entity = parser.parse(content)

        # Apply UI defaults
        defaults_generator.apply_defaults(entity)

        entities.append(entity)

    return entities
```

**Testing**:
```python
def test_old_spec_gets_defaults():
    """Test that old specs get UI defaults automatically"""
    yaml_content = """
    entity: Contact
    schema: crm
    fields:
      email: email!
    actions:
      - name: create_contact
        steps:
          - insert: Contact
    """
    parser = SpecQLParser()
    entity = parser.parse(yaml_content)

    # Before defaults
    assert entity.ui is None

    # Apply defaults
    generator = UIDefaultsGenerator()
    generator.apply_defaults(entity)

    # After defaults
    assert entity.ui is not None
    assert entity.ui.label == 'Contacts'
    assert entity.fields['email'].label == 'Email'
    assert entity.pages.list is not None
```

**Deliverables**:
- ✅ Defaults integrated into parsing pipeline
- ✅ Integration tests
- ✅ Examples showing generated defaults

---

#### Day 20-21: Documentation & Examples

**Task**: Document defaults behavior and create examples

**Create Examples**:
1. `examples/minimal_with_defaults.yaml` - Minimal spec, see generated defaults
2. `examples/partial_ui.yaml` - Some UI metadata, rest filled by defaults
3. `examples/full_ui_override.yaml` - Complete UI overrides

**Documentation**:
- `docs/guides/ui-defaults.md` - How defaults work
- `docs/guides/customizing-ui.md` - How to override defaults

**Deliverables**:
- ✅ Example files
- ✅ Documentation
- ✅ Before/after comparison guide

---

## 📅 Phase 3: Next.js Page Generator (3 weeks)

**Goal**: Generate production-ready Next.js pages from extended specs

### Week 4-5: List & Form Pages

#### Day 22-24: List Page Generator

**Task**: Create `src/generators/frontend/nextjs_page_generator.py`

```python
"""
Next.js Page Generator

Generates Next.js App Router pages from extended SpecQL entities.
"""

from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from src.core.ast_models import EntityDefinition, FieldDefinition

class NextJSPageGenerator:
    """Generate Next.js pages from entity definitions"""

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.templates = Environment(
            loader=FileSystemLoader('src/generators/frontend/templates/')
        )

    def generate_pages(self, entities: list[EntityDefinition]) -> None:
        """Generate pages for all entities"""
        for entity in entities:
            if not entity.ui or not entity.ui.auto_generate:
                continue

            # Generate list page
            if entity.ui.auto_generate.list and entity.pages.list:
                self._generate_list_page(entity)

            # Generate form pages
            if entity.ui.auto_generate.form and entity.pages.form:
                self._generate_form_create_page(entity)
                self._generate_form_edit_page(entity)

            # Generate detail page
            if entity.ui.auto_generate.detail and entity.pages.detail:
                self._generate_detail_page(entity)

    def _generate_list_page(self, entity: EntityDefinition) -> None:
        """Generate list page: app/[entity]/page.tsx"""
        list_config = entity.pages.list

        # Prepare template context
        context = {
            'entity': entity,
            'entity_name': entity.name,
            'entity_name_lower': entity.name.lower(),
            'entity_label': entity.ui.label,
            'columns': self._build_columns(entity, list_config),
            'filters': self._build_filters(entity, list_config),
            'quick_filters': list_config.quick_filters or [],
            'primary_actions': list_config.primary_actions or [],
            'row_actions': list_config.row_actions or [],
            'default_sort': list_config.default_sort,
            'page_size': list_config.pagination.page_size if list_config.pagination else 25,
            'empty_state': list_config.empty_state,
        }

        # Render template
        template = self.templates.get_template('list_page.tsx.j2')
        content = template.render(**context)

        # Write file
        output_path = self.output_dir / 'app' / entity.name.lower() / 'page.tsx'
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content)

    def _build_columns(self, entity: EntityDefinition, list_config) -> list[dict]:
        """Build column configurations for DataTable"""
        columns = []

        for field_name in list_config.columns:
            field_def = entity.fields[field_name]

            column = {
                'accessorKey': field_name,
                'header': field_def.label,
                'cell_component': self._get_cell_component(field_def),
                'width': field_def.list.width if field_def.list else 200,
                'sortable': field_def.list.sortable if field_def.list else True,
            }

            columns.append(column)

        return columns

    def _get_cell_component(self, field: FieldDefinition) -> str:
        """Map field type to React cell component"""
        if field.list and field.list.render_as:
            return self._render_as_to_component(field.list.render_as)

        # Use scalar type hints
        if field.scalar_def and field.scalar_def.input_type:
            return {
                'email': 'EmailDisplay',
                'tel': 'PhoneDisplay',
                'url': 'LinkDisplay',
                'date': 'DateDisplay',
                'checkbox': 'BooleanBadge',
            }.get(field.scalar_def.input_type, 'TextDisplay')

        # Reference fields
        if field.reference_entity:
            return 'ReferenceDisplay'

        # Enum fields
        if field.values:
            return 'BadgeDisplay'

        return 'TextDisplay'

    def _build_filters(self, entity: EntityDefinition, list_config) -> list[dict]:
        """Build filter configurations"""
        if not list_config.filters:
            return []

        filters = []
        for filter_config in list_config.filters:
            field_def = entity.fields[filter_config.field]

            filters.append({
                'field': filter_config.field,
                'label': field_def.label,
                'operators': filter_config.operators,
                'widget': filter_config.widget or self._guess_filter_widget(field_def),
                'placeholder': filter_config.placeholder,
            })

        return filters

    def _guess_filter_widget(self, field: FieldDefinition) -> str:
        """Guess filter widget from field type"""
        if field.values:
            return 'multi_select'
        elif field.reference_entity:
            return 'entity_select'
        elif field.type_name in ['date', 'timestamp']:
            return 'date_range'
        else:
            return 'text_input'
```

**Template**: `src/generators/frontend/templates/list_page.tsx.j2`

```tsx
// Auto-generated by SpecQL
'use client'

import { useState } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { FilterBar } from '@/components/ui/filter-bar'
import { QuickFilters } from '@/components/ui/quick-filters'
{% for component in columns | map(attribute='cell_component') | unique %}
import { {{ component }} } from '@/components/ui/cells'
{% endfor %}
import { use{{ entity_name }}List } from '@/generated/hooks'
import type { {{ entity_name }} } from '@/generated/types'

export default function {{ entity_name }}ListPage() {
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState<any>({{ default_sort | tojson }})
  const [page, setPage] = useState(1)

  const { data, loading, error } = use{{ entity_name }}List({
    variables: {
      filters,
      sort,
      page,
      pageSize: {{ page_size }},
    }
  })

  const columns = [
    {% for column in columns %}
    {
      accessorKey: '{{ column.accessorKey }}',
      header: '{{ column.header }}',
      size: {{ column.width }},
      enableSorting: {{ column.sortable | lower }},
      cell: ({ row }) => (
        <{{ column.cell_component }}
          value={row.getValue('{{ column.accessorKey }}')}
        />
      ),
    },
    {% endfor %}
    {
      id: 'actions',
      cell: ({ row }) => (
        <RowActions
          entity={row.original}
          actions={[
            {% for action in row_actions %}
            '{{ action }}',
            {% endfor %}
          ]}
        />
      ),
    },
  ]

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{{ entity_label }}</h1>
          {% if list_config.description %}
          <p className="text-muted-foreground mt-1">{{ list_config.description }}</p>
          {% endif %}
        </div>
        <div className="flex gap-2">
          {% for action in primary_actions %}
          <Button onClick={() => router.push('/{{ entity_name_lower }}/new')}>
            New {{ entity_name }}
          </Button>
          {% endfor %}
        </div>
      </div>

      {% if quick_filters %}
      <QuickFilters
        filters={[
          {% for qf in quick_filters %}
          {
            label: '{{ qf.label }}',
            icon: '{{ qf.icon }}',
            filter: {{ qf.filter | tojson }},
          },
          {% endfor %}
        ]}
        onFilterChange={(filter) => setFilters(filter)}
      />
      {% endif %}

      <FilterBar
        filters={[
          {% for filter in filters %}
          {
            field: '{{ filter.field }}',
            label: '{{ filter.label }}',
            operators: {{ filter.operators | tojson }},
            widget: '{{ filter.widget }}',
            placeholder: '{{ filter.placeholder or "" }}',
          },
          {% endfor %}
        ]}
        value={filters}
        onChange={setFilters}
      />

      <DataTable
        columns={columns}
        data={data?.{{ entity_name_lower }}s || []}
        loading={loading}
        error={error}
        pagination={{
          page,
          pageSize: {{ page_size }},
          total: data?.total || 0,
          onPageChange: setPage,
        }}
        sorting={{
          value: sort,
          onChange: setSort,
        }}
        {% if empty_state %}
        emptyState={{
          icon: '{{ empty_state.icon }}',
          title: '{{ empty_state.title }}',
          description: '{{ empty_state.description }}',
          action: {{ empty_state.action | tojson }},
        }}
        {% endif %}
      />
    </div>
  )
}
```

**Testing**:
```python
def test_generate_list_page():
    """Test list page generation"""
    entity = # ... create test entity with list config

    generator = NextJSPageGenerator(Path('/tmp/test_output'))
    generator.generate_pages([entity])

    # Check file created
    list_page = Path('/tmp/test_output/app/contact/page.tsx')
    assert list_page.exists()

    # Check content
    content = list_page.read_text()
    assert 'ContactListPage' in content
    assert 'useContactList' in content
    assert 'DataTable' in content
```

**Deliverables**:
- ✅ List page generator
- ✅ Jinja2 template
- ✅ Column mapping
- ✅ Filter generation
- ✅ Unit tests

---

#### Day 25-28: Form Page Generator

**Task**: Generate create and edit form pages

```python
def _generate_form_create_page(self, entity: EntityDefinition) -> None:
    """Generate create form: app/[entity]/new/page.tsx"""
    form_config = entity.pages.form

    context = {
        'entity': entity,
        'title': form_config.title_create,
        'sections': self._build_form_sections(entity, form_config),
        'submit_action': form_config.submit_action,
        'validation_schema': self._build_validation_schema(entity),
        'mode': 'create',
    }

    template = self.templates.get_template('form_page.tsx.j2')
    content = template.render(**context)

    output_path = self.output_dir / 'app' / entity.name.lower() / 'new' / 'page.tsx'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content)

def _build_form_sections(self, entity: EntityDefinition, form_config) -> list[dict]:
    """Build form sections with fields"""
    sections = []

    for section_id, section_config in (form_config.sections or {}).items():
        fields = []

        for field_name in section_config.fields:
            field_def = entity.fields[field_name]
            fields.append({
                'name': field_name,
                'label': field_def.label,
                'widget': self._get_form_widget(field_def),
                'placeholder': field_def.placeholder,
                'help_text': field_def.help_text,
                'required': not field_def.nullable,
            })

        sections.append({
            'id': section_id,
            'title': section_config.title,
            'description': section_config.description,
            'fields': fields,
            'collapsible': section_config.collapsible,
        })

    return sections

def _get_form_widget(self, field: FieldDefinition) -> str:
    """Map field to form widget component"""
    # Explicit widget override
    if field.form and field.form.widget:
        return self._widget_name_to_component(field.form.widget)

    # Reference fields
    if field.reference_entity:
        lookup_config = field.form.lookup_config if field.form else None
        if lookup_config and lookup_config.allow_create:
            return 'EntitySelectWithCreate'
        return 'EntitySelect'

    # Enum fields
    if field.values:
        return 'Select'

    # Scalar type widgets
    if field.scalar_def and field.scalar_def.input_type:
        return {
            'email': 'EmailInput',
            'tel': 'PhoneInput',
            'url': 'URLInput',
            'date': 'DatePicker',
            'textarea': 'Textarea',
            'checkbox': 'Checkbox',
            'number': 'NumberInput',
        }.get(field.scalar_def.input_type, 'Input')

    return 'Input'

def _build_validation_schema(self, entity: EntityDefinition) -> str:
    """Generate Zod validation schema"""
    rules = []

    for field_name, field_def in entity.fields.items():
        if 'form' not in (field_def.visible_in or []):
            continue

        # Start with type
        if field_def.nullable:
            rule = f"  {field_name}: z.string().optional()"
        else:
            rule = f"  {field_name}: z.string()"

        # Add scalar type validation
        if field_def.scalar_def and field_def.scalar_def.validation_pattern:
            pattern = field_def.scalar_def.validation_pattern
            rule += f".regex(/{pattern}/, 'Invalid {field_def.label}')"

        # Add min/max for numbers
        if field_def.scalar_def:
            if field_def.scalar_def.min_value is not None:
                rule += f".min({field_def.scalar_def.min_value})"
            if field_def.scalar_def.max_value is not None:
                rule += f".max({field_def.scalar_def.max_value})"

        rules.append(rule)

    return "z.object({\n" + ",\n".join(rules) + "\n})"
```

**Template**: `templates/form_page.tsx.j2`

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form'
{% for field in sections | map(attribute='fields') | flatten %}
import { {{ field.widget }} } from '@/components/ui/form-widgets'
{% endfor %}
import { use{{ entity.name }}{{ mode | capitalize }} } from '@/generated/hooks'

const formSchema = {{ validation_schema }}

export default function {{ entity.name }}{{ mode | capitalize }}Page() {
  const [{{ submit_action }}, { loading }] = use{{ entity.name }}{{ mode | capitalize }}()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const result = await {{ submit_action }}({ variables: { input: values } })
      // Success handling
      toast.success('{{ title }} saved successfully')
      router.push(`/{{ entity.name | lower }}/${result.data.id}`)
    } catch (error) {
      toast.error('Failed to save {{ entity.name | lower }}')
    }
  }

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="text-3xl font-bold mb-6">{{ title }}</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {% for section in sections %}
          <div className="space-y-4">
            {% if section.title %}
            <div>
              <h2 className="text-xl font-semibold">{{ section.title }}</h2>
              {% if section.description %}
              <p className="text-sm text-muted-foreground">{{ section.description }}</p>
              {% endif %}
            </div>
            {% endif %}

            <div className="grid gap-4 {% if layout == 'two_column' %}md:grid-cols-2{% endif %}">
              {% for field in section.fields %}
              <FormField
                control={form.control}
                name="{{ field.name }}"
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>{{ field.label }}{% if field.required %} *{% endif %}</FormLabel>
                    <FormControl>
                      <{{ field.widget }}
                        {...formField}
                        placeholder="{{ field.placeholder or '' }}"
                      />
                    </FormControl>
                    {% if field.help_text %}
                    <FormDescription>{{ field.help_text }}</FormDescription>
                    {% endif %}
                    <FormMessage />
                  </FormItem>
                )}
              />
              {% endfor %}
            </div>
          </div>
          {% endfor %}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
```

**Deliverables**:
- ✅ Form page generator
- ✅ Zod validation schema generation
- ✅ Form widget mapping
- ✅ Section organization
- ✅ Unit tests

---

### Week 6: Detail Pages & CLI Integration

#### Day 29-31: Detail Page Generator

**Task**: Generate detail pages with sections and actions

```python
def _generate_detail_page(self, entity: EntityDefinition) -> None:
    """Generate detail page: app/[entity]/[id]/page.tsx"""
    detail_config = entity.pages.detail

    context = {
        'entity': entity,
        'title': detail_config.title,
        'subtitle': detail_config.subtitle,
        'sections': self._build_detail_sections(entity, detail_config),
        'actions': detail_config.actions or [],
    }

    template = self.templates.get_template('detail_page.tsx.j2')
    content = template.render(**context)

    output_path = self.output_dir / 'app' / entity.name.lower() / '[id]' / 'page.tsx'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content)

def _build_detail_sections(self, entity: EntityDefinition, detail_config) -> list[dict]:
    """Build detail sections"""
    sections = []

    for section_id, section_config in (detail_config.sections or {}).items():
        if section_config.type == 'custom':
            # Custom component
            sections.append({
                'id': section_id,
                'type': 'custom',
                'component': section_config.component,
                'props': section_config.props,
            })
        else:
            # Field section
            fields = []
            for field_name in section_config.fields:
                field_def = entity.fields[field_name]
                fields.append({
                    'name': field_name,
                    'label': field_def.label,
                    'display_component': self._get_display_component(field_def),
                })

            sections.append({
                'id': section_id,
                'type': 'fields',
                'title': section_config.title,
                'layout': section_config.layout,
                'fields': fields,
                'collapsible': section_config.collapsible,
            })

    return sections

def _get_display_component(self, field: FieldDefinition) -> str:
    """Map field to display component"""
    if field.detail and field.detail.render_as:
        return self._render_as_to_component(field.detail.render_as)

    return self._get_cell_component(field)  # Reuse list cell mapping
```

**Deliverables**:
- ✅ Detail page generator
- ✅ Section layouts
- ✅ Custom component support
- ✅ Action buttons
- ✅ Unit tests

---

#### Day 32-35: CLI Integration & Full-Stack Generation

**Task**: Integrate frontend generation into main CLI

```python
# src/cli/generate.py

@click.command()
@click.argument('entity_files', nargs=-1, type=click.Path(exists=True))
@click.option('--output-backend', default='db/schema/', help='Backend output directory')
@click.option('--output-frontend', default='app/', help='Frontend output directory')
@click.option('--frontend-framework', default='next', type=click.Choice(['next', 'vue', 'svelte']))
@click.option('--skip-backend', is_flag=True, help='Skip backend generation')
@click.option('--skip-frontend', is_flag=True, help='Skip frontend generation')
@click.option('--watch', is_flag=True, help='Watch mode for development')
def generate_fullstack(
    entity_files: tuple,
    output_backend: str,
    output_frontend: str,
    frontend_framework: str,
    skip_backend: bool,
    skip_frontend: bool,
    watch: bool,
):
    """Generate full-stack application from SpecQL entities"""

    # Parse entities with UI defaults
    click.secho("📖 Parsing entities...", fg="blue", bold=True)
    entities = parse_entities_with_ui(list(entity_files))
    click.echo(f"  Parsed {len(entities)} entities")

    # Generate backend
    if not skip_backend:
        click.secho("\n🗄️  Generating backend...", fg="blue", bold=True)
        orchestrator = CLIOrchestrator(output_dir=Path(output_backend))
        orchestrator.generate_backend(entities)
        click.echo("  ✅ Backend generation complete")

    # Generate frontend
    if not skip_frontend:
        click.secho("\n🎨 Generating frontend...", fg="blue", bold=True)
        generate_frontend(entities, Path(output_frontend), frontend_framework)
        click.echo("  ✅ Frontend generation complete")

    # Watch mode
    if watch:
        watch_and_regenerate(entity_files, output_backend, output_frontend, frontend_framework)

def generate_frontend(
    entities: list[EntityDefinition],
    output_dir: Path,
    framework: str,
) -> None:
    """Generate frontend from entities"""

    # Filter entities with frontend config
    frontend_entities = [e for e in entities if e.ui and e.ui.auto_generate]

    click.echo(f"  Generating for {len(frontend_entities)} entities")

    # Generate shared artifacts
    click.echo("  📝 Generating TypeScript types...")
    types_gen = TypeScriptTypesGenerator(output_dir)
    types_gen.generate_types(entities)

    click.echo("  🔗 Generating Apollo hooks...")
    hooks_gen = ApolloHooksGenerator(output_dir)
    hooks_gen.generate_hooks(entities)

    click.echo("  💾 Generating mutation impacts...")
    impacts_gen = MutationImpactsGenerator(output_dir)
    impacts_gen.generate_impacts(entities)

    # Generate framework-specific code
    if framework == 'next':
        click.echo("  📄 Generating Next.js pages...")
        page_gen = NextJSPageGenerator(output_dir)
        page_gen.generate_pages(frontend_entities)

        click.echo("  🧭 Generating navigation...")
        layout_gen = NextJSLayoutGenerator(output_dir)
        layout_gen.generate_layout(frontend_entities)

    elif framework == 'vue':
        # Future: Vue generator
        raise NotImplementedError("Vue generator not yet implemented")

    click.echo(f"\n  Generated {len(frontend_entities)} entity pages")
```

**Testing**:
```bash
# Test full-stack generation
specql generate fullstack examples/crm/*.yaml \
  --output-backend db/schema/ \
  --output-frontend app/

# Test frontend only
specql generate fullstack examples/crm/*.yaml \
  --skip-backend \
  --output-frontend app/

# Test watch mode
specql generate fullstack examples/crm/*.yaml \
  --output-backend db/schema/ \
  --output-frontend app/ \
  --watch
```

**Deliverables**:
- ✅ Unified CLI command
- ✅ Backend + frontend generation
- ✅ Watch mode (optional)
- ✅ Integration tests
- ✅ CLI documentation

---

## 📅 Phase 4: Documentation & Polish (1 week)

**Goal**: Production-ready with comprehensive documentation

### Week 7: Documentation & Examples

#### Day 36-38: Complete Examples

**Task**: Create comprehensive working examples

**Examples to Create**:

1. **Simple Blog** (`examples/simple-blog/`)
   - Post entity with full UI
   - Comment entity
   - Author entity
   - Shows: list, form, detail, actions

2. **CRM System** (`examples/crm-full/`)
   - Contact with extended UI
   - Organization with references
   - Opportunity with workflow
   - Shows: relationships, filters, custom actions

3. **E-commerce** (`examples/ecommerce-full/`)
   - Product with images
   - Order with status workflow
   - Customer entity
   - Shows: enums, composite types, complex forms

**For Each Example**:
- Complete SpecQL YAML files
- Generated backend SQL
- Generated Next.js app
- README with setup instructions
- Screenshot of running app

**Deliverables**:
- ✅ 3 complete working examples
- ✅ Each example runs successfully
- ✅ Documentation for each example

---

#### Day 39-41: Complete Documentation

**Task**: Write comprehensive documentation

**Documentation Structure**:

```
docs/
├── language/
│   ├── fields.md              # Field syntax (short & long form)
│   ├── entity-ui.md           # Entity-level UI metadata
│   ├── pages.md               # Page configurations
│   ├── actions-ui.md          # Action UI metadata
│   └── navigation.md          # Navigation configuration
│
├── guides/
│   ├── getting-started.md     # Quick start guide
│   ├── progressive-enhancement.md  # Adding UI incrementally
│   ├── ui-defaults.md         # How defaults work
│   ├── customizing-ui.md      # Overriding defaults
│   ├── form-sections.md       # Organizing forms
│   ├── filters-sorting.md     # Configuring list pages
│   └── custom-components.md   # Integrating custom React components
│
├── reference/
│   ├── field-widgets.md       # All available widgets
│   ├── display-components.md # All display components
│   ├── page-layouts.md        # Layout options
│   └── validation.md          # Validation strategies
│
└── tutorials/
    ├── first-fullstack-app.md     # Step-by-step tutorial
    ├── adding-ui-existing-spec.md # Migration guide
    └── advanced-customization.md   # Advanced techniques
```

**Key Documentation Pages**:

1. **Getting Started**:
   - Installation
   - First entity with UI
   - Generate and run
   - See it work

2. **Language Reference**:
   - Complete syntax documentation
   - All UI metadata options
   - Examples for each option

3. **Migration Guide**:
   - Adding UI to existing specs
   - Backwards compatibility
   - Step-by-step process

4. **Advanced Topics**:
   - Custom components
   - Conditional visibility
   - Complex validations
   - Performance optimization

**Deliverables**:
- ✅ Complete documentation website
- ✅ API reference
- ✅ Tutorial series
- ✅ Migration guide

---

#### Day 42: Final Testing & Release Preparation

**Task**: End-to-end testing and release prep

**Testing Checklist**:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Example apps run successfully
- [ ] Generated code is valid TypeScript
- [ ] Generated forms have proper validation
- [ ] Generated lists have working filters
- [ ] Actions trigger correctly
- [ ] Backwards compatibility verified
- [ ] Performance acceptable (< 5s for 10 entities)
- [ ] Documentation is complete and accurate

**Release Prep**:
- Version numbering (v0.1.0)
- Changelog
- Release notes
- Blog post announcing feature
- Video demo (optional)

**Deliverables**:
- ✅ All tests passing
- ✅ Release artifacts
- ✅ Announcement materials

---

## 📊 Success Metrics

### Phase 1 Success (Foundation)
- [ ] Parser handles short and long field forms
- [ ] Entity UI metadata parsing works
- [ ] Pages section parsing works
- [ ] Action UI parsing works
- [ ] All unit tests pass (>90% coverage)
- [ ] Backwards compatibility maintained

### Phase 2 Success (Defaults)
- [ ] UI defaults generator works
- [ ] Old specs get sensible UI automatically
- [ ] Explicit metadata is preserved
- [ ] Documentation explains defaults behavior

### Phase 3 Success (Generation)
- [ ] Next.js list pages generate correctly
- [ ] Forms have proper validation
- [ ] Detail pages render all sections
- [ ] CLI coordinates full-stack generation
- [ ] Generated app runs successfully
- [ ] Performance is acceptable

### Phase 4 Success (Production-Ready)
- [ ] 3 complete working examples
- [ ] Documentation is comprehensive
- [ ] Migration guide tested
- [ ] Release artifacts ready
- [ ] Community feedback positive

---

## 🎯 Overall Project Success Criteria

**Functional**:
- [ ] SpecQL language extended with UI concepts
- [ ] Backwards compatibility maintained
- [ ] Full-stack generation works end-to-end
- [ ] Generated apps are production-ready
- [ ] Progressive enhancement supported

**Quality**:
- [ ] Test coverage > 85%
- [ ] Documentation complete
- [ ] Examples demonstrate all features
- [ ] Performance acceptable
- [ ] Code is maintainable

**Developer Experience**:
- [ ] Easy to get started
- [ ] Clear error messages
- [ ] Good defaults (works without config)
- [ ] Flexible (customizable when needed)
- [ ] Well documented

---

## 📅 Timeline Summary

| Week | Phase | Focus | Deliverables |
|------|-------|-------|--------------|
| 1 | Foundation | AST Extension | Extended dataclasses, parser for short/long forms |
| 2 | Foundation | Entity & Pages Parsing | Entity UI, pages, actions parsing complete |
| 3 | Defaults | UI Defaults Generator | Smart defaults, integration with parser |
| 4-5 | Generation | List & Form Pages | Next.js list and form generators |
| 6 | Generation | Detail & CLI | Detail pages, full-stack CLI command |
| 7 | Polish | Docs & Examples | Complete docs, 3 working examples |

**Total**: 7 weeks (35 working days)

---

## 🚀 Getting Started

To begin implementation:

1. **Review** this plan with the team
2. **Approve** the syntax in `examples/contact_extended.yaml`
3. **Create** a feature branch: `feature/frontend-language-extension`
4. **Start** with Phase 1, Day 1: AST Extension
5. **Follow** TDD approach (tests first!)
6. **Commit** frequently with clear messages
7. **Review** progress daily

**First Task**: Create `src/core/ast_models_ui.py` with UI dataclasses (Day 1)

---

This plan provides a complete, detailed roadmap for implementing the SpecQL frontend language extension. Each phase builds on the previous, with clear deliverables and success criteria. The TDD approach ensures quality, and the phased releases allow for iterative feedback.
