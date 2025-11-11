# GraphQL Cascade Repository Cleanup & Documentation Plan

**Task Complexity**: Complex | **Phased TDD Approach**

## Executive Summary

This plan outlines a systematic, phased approach to cleaning and organizing the GraphQL Cascade repository, consolidating documentation, establishing best practices, and creating a professional, maintainable documentation structure suitable for an open-source specification project.

**Current State**: Repository contains scattered documentation across multiple directories (docs/, specification/, research/) with some duplication and unclear hierarchy.

**Goal State**: Clean, well-organized repository with clear documentation hierarchy, comprehensive README, consolidated content, and reference implementations ready for public consumption.

---

## PHASES

### Phase 1: Repository Assessment & Inventory

**Objective**: Create a complete inventory of all content and identify duplication, gaps, and organization issues.

#### TDD Cycle:

1. **RED**: Create validation tests
   - Test: Check for duplicate content across docs
   - Test: Validate all internal links work
   - Test: Ensure all referenced files exist
   - Expected failure: Links broken, duplicates exist

2. **GREEN**: Build inventory tooling
   - Script to detect duplicate content (fuzzy matching)
   - Script to validate markdown links
   - Generate content inventory with metadata
   - Minimal implementation: Basic text comparison and link checking

3. **REFACTOR**: Improve inventory scripts
   - Add file size, last modified, content hash
   - Generate markdown report of findings
   - Flag potential consolidation opportunities

4. **QA**: Verify inventory completeness
   - [ ] All .md files catalogued
   - [ ] Duplicate content identified
   - [ ] Broken links documented
   - [ ] Content categorization complete

**Deliverables**:
- `CONTENT_INVENTORY.md` - Full listing with metadata
- `DUPLICATION_REPORT.md` - Files with overlapping content
- `LINK_VALIDATION_REPORT.md` - Broken/missing links
- `scripts/validate_docs.sh` - Reusable validation script

---

### Phase 2: Define Target Documentation Structure

**Objective**: Design the ideal documentation structure following best practices for open-source specification projects.

#### TDD Cycle:

1. **RED**: Create structure validation tests
   - Test: Required files exist (README.md, CONTRIBUTING.md, etc.)
   - Test: Directory structure matches specification
   - Expected failure: Missing files and directories

2. **GREEN**: Create target structure
   - Define directory hierarchy
   - Create stub files for required documents
   - Document purpose of each section

3. **REFACTOR**: Optimize structure
   - Review against similar spec projects (OpenAPI, GraphQL spec)
   - Adjust for GraphQL Cascade specific needs
   - Add detailed section purposes

4. **QA**: Validate structure design
   - [ ] Follows specification project conventions
   - [ ] Clear separation of concerns
   - [ ] Easy navigation for different audiences
   - [ ] Scalable for future content

**Target Structure**:
```
graphql-cascade/
├── README.md                          # Project overview, quick start
├── CONTRIBUTING.md                    # How to contribute
├── CODE_OF_CONDUCT.md                # Community guidelines
├── CHANGELOG.md                       # Version history
├── LICENSE                           # MIT license
│
├── specification/                     # Core specification (versioned)
│   ├── README.md                     # Spec navigation guide
│   ├── 00_introduction.md            # Problem, solution, benefits
│   ├── 01_conformance.md             # Compliance requirements
│   ├── 02_cascade_model.md           # Core concepts
│   ├── 03_entity_identification.md   # Entity tracking
│   ├── 04_mutation_responses.md      # Response format
│   ├── 05_invalidation.md            # Cache invalidation rules
│   ├── 06_subscriptions.md           # Real-time updates
│   ├── 07_schema_conventions.md      # GraphQL schema requirements
│   ├── 08_directives.md              # Custom directives
│   ├── 09_server_requirements.md     # Server implementation
│   ├── 10_tracking_algorithm.md      # Cascade tracking
│   ├── 11_invalidation_algorithm.md  # Invalidation logic
│   ├── 12_performance_requirements.md # Performance specs
│   ├── 13_client_integration.md      # Client implementation
│   ├── 14_optimistic_updates.md      # Optimistic UI
│   ├── 15_conflict_resolution.md     # Conflict handling
│   ├── 16_security.md                # Security considerations
│   ├── 17_performance.md             # Performance tuning
│   └── appendices/
│       ├── A_comparison_with_relay.md
│       ├── B_comparison_with_apollo.md
│       ├── C_migration_guide.md
│       ├── D_glossary.md
│       └── E_examples.md
│
├── docs/                             # User-facing documentation
│   ├── README.md                     # Docs navigation
│   ├── getting-started/
│   │   ├── README.md
│   │   ├── quick-start.md           # 5-minute setup
│   │   ├── concepts.md              # Core concepts explained
│   │   └── first-cascade.md         # First implementation
│   ├── guides/
│   │   ├── README.md
│   │   ├── server-implementation.md  # Server setup guide
│   │   ├── client-integration.md     # Client setup guide
│   │   ├── apollo-integration.md     # Apollo-specific
│   │   ├── relay-integration.md      # Relay-specific
│   │   ├── react-query-integration.md
│   │   ├── urql-integration.md
│   │   ├── testing.md               # Testing cascades
│   │   ├── debugging.md             # Debug tools
│   │   └── migration.md             # Migrating existing apps
│   ├── tutorials/
│   │   ├── README.md
│   │   ├── todo-app.md              # Build a todo app
│   │   ├── blog-platform.md         # Complex relationships
│   │   └── real-time-collab.md      # Real-time features
│   ├── api/
│   │   ├── README.md
│   │   ├── server-api.md            # Server API reference
│   │   ├── client-api.md            # Client API reference
│   │   └── directives.md            # Directive reference
│   └── architecture/
│       ├── README.md
│       ├── design-decisions.md       # ADRs
│       ├── comparison.md             # vs Relay, Apollo, etc.
│       └── internals.md              # How it works
│
├── examples/                         # Example implementations
│   ├── README.md                     # Examples overview
│   ├── todo-app/                     # Simple CRUD
│   │   ├── README.md
│   │   ├── backend/                 # GraphQL server
│   │   └── frontend/                # React client
│   ├── blog-platform/                # Complex relationships
│   │   ├── README.md
│   │   ├── backend/
│   │   └── frontend/
│   ├── real-time-collab/             # Subscriptions
│   │   ├── README.md
│   │   ├── backend/
│   │   └── frontend/
│   └── e-commerce/                   # Large-scale example
│       ├── README.md
│       ├── backend/
│       └── frontend/
│
├── packages/                         # Implementation packages
│   ├── server/                       # Server implementation
│   │   ├── README.md
│   │   ├── package.json
│   │   └── src/
│   ├── client-core/                  # Core client logic
│   │   ├── README.md
│   │   ├── package.json
│   │   └── src/
│   ├── client-apollo/                # Apollo integration
│   │   ├── README.md
│   │   ├── package.json
│   │   └── src/
│   ├── client-relay/                 # Relay integration
│   │   ├── README.md
│   │   ├── package.json
│   │   └── src/
│   ├── client-react-query/           # React Query integration
│   │   ├── README.md
│   │   ├── package.json
│   │   └── src/
│   └── client-urql/                  # URQL integration
│       ├── README.md
│       ├── package.json
│       └── src/
│
├── reference/                        # Reference implementations
│   ├── README.md
│   ├── server-python/                # Python/FraiseQL server
│   │   ├── README.md
│   │   └── graphql_cascade/
│   ├── server-node/                  # Node.js server
│   │   ├── README.md
│   │   └── src/
│   └── compliance-suite/             # Compliance tests
│       ├── README.md
│       └── tests/
│
├── research/                         # Research & analysis
│   ├── README.md                     # Research overview
│   ├── requirements.md               # Requirements analysis
│   ├── relay-analysis.md             # Relay protocol study
│   ├── apollo-analysis.md            # Apollo cache study
│   ├── comparison-matrix.md          # Feature comparison
│   ├── other-protocols.md            # Other cache protocols
│   ├── value-proposition.md          # Why GraphQL Cascade
│   └── phase-1-summary.md            # Initial research summary
│
├── design/                           # Design documents (new)
│   ├── README.md
│   ├── ADR-001-cascade-format.md     # Architecture decisions
│   ├── ADR-002-entity-identification.md
│   ├── implementation-strategy.md    # How to implement
│   └── roadmap.md                    # Future features
│
└── .github/                          # GitHub-specific
    ├── ISSUE_TEMPLATE/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
        ├── validate-docs.yml         # CI for docs
        └── compliance-tests.yml      # CI for compliance
```

**Deliverables**:
- `TARGET_STRUCTURE.md` - Complete structure with descriptions
- `scripts/validate_structure.sh` - Structure validation script

---

### Phase 3: Content Consolidation & Deduplication

**Objective**: Consolidate overlapping documents, remove duplication, and establish single source of truth for each concept.

#### TDD Cycle:

1. **RED**: Create consolidation tests
   - Test: No duplicate explanations of core concepts
   - Test: All cross-references resolve correctly
   - Expected failure: Duplicates still exist

2. **GREEN**: Consolidate content
   - Merge duplicate content
   - Create master documents for core concepts
   - Update cross-references
   - Minimal implementation: Manual merges with clear structure

3. **REFACTOR**: Improve consolidated content
   - Enhance clarity and flow
   - Add missing context
   - Improve examples
   - Standardize terminology

4. **QA**: Verify consolidation
   - [ ] No duplicate content remains
   - [ ] All cross-references work
   - [ ] Content flows logically
   - [ ] Single source of truth for each concept

**High-Priority Consolidations**:

1. **Implementation Plans** (docs/ has 3+ overlapping docs)
   - Current: `IMPLEMENTATION_PLAN.md`, `graphql_cascade_implementation_plan.md`, `UNIFIED_ASSESSMENT.md`
   - Target: Single `design/implementation-strategy.md`
   - Archive: Move old versions to `research/archives/`

2. **Assessment Documents** (overlapping analysis)
   - Current: `ASSESSMENT.md`, `UNIFIED_ASSESSMENT.md`, `RECOMMENDATION.md`
   - Target: Consolidate into `design/ADR-000-initial-analysis.md`
   - Archive: Historical versions

3. **Research Summaries** (multiple summaries of same research)
   - Current: Multiple analysis documents
   - Target: Single comprehensive `research/README.md` with clear sections
   - Individual analyses remain but referenced from main README

**Deliverables**:
- Consolidated master documents
- Updated cross-references
- `research/archives/` with old versions
- `CONSOLIDATION_REPORT.md` documenting changes

---

### Phase 4: Create Core Documentation

**Objective**: Write missing essential documentation for public consumption.

#### TDD Cycle:

1. **RED**: Create documentation coverage tests
   - Test: README.md exists and has required sections
   - Test: CONTRIBUTING.md exists
   - Test: All guides have working examples
   - Expected failure: Missing or incomplete docs

2. **GREEN**: Write core documents
   - Root README.md (project overview)
   - CONTRIBUTING.md (contribution guide)
   - Getting Started guide
   - Quick Start guide
   - Minimal implementation: Cover essentials

3. **REFACTOR**: Enhance documentation
   - Add diagrams and visuals
   - Improve examples
   - Add troubleshooting sections
   - Polish writing

4. **QA**: Verify documentation quality
   - [ ] All required docs exist
   - [ ] Examples work
   - [ ] Clear for newcomers
   - [ ] Professional presentation

**Priority Documents**:

1. **ROOT README.md** - Must include:
   - Project tagline: "Cascading cache updates for GraphQL"
   - Problem statement (cache management pain)
   - Solution overview (automatic cascades)
   - Quick example showing before/after
   - Links to getting started, specification, examples
   - Status badges (build, license, version)
   - Community links (Discord, discussions, etc.)

2. **CONTRIBUTING.md** - Must include:
   - How to contribute (code, docs, issues)
   - Development setup
   - Testing requirements
   - Documentation standards
   - PR process
   - Code of conduct reference

3. **docs/getting-started/quick-start.md** - Must include:
   - 5-minute setup (server + client)
   - Simple working example
   - Expected output
   - Next steps links

4. **docs/guides/server-implementation.md** - Must include:
   - Server setup for FraiseQL, Apollo Server, etc.
   - Cascade tracking implementation
   - Testing your implementation
   - Common pitfalls

5. **docs/guides/client-integration.md** - Must include:
   - Client setup for Apollo, Relay, React Query, URQL
   - How cascades update cache automatically
   - Configuration options
   - Debugging tips

**Deliverables**:
- Complete core documentation set
- Working examples in all guides
- Professional README.md
- Clear contribution guidelines

---

### Phase 5: Reorganize & Migrate Content

**Objective**: Move all content to target structure, update all references, preserve git history where possible.

#### TDD Cycle:

1. **RED**: Create migration tests
   - Test: All content in target locations
   - Test: No broken links after migration
   - Test: Git history preserved for important files
   - Expected failure: Content still in old locations

2. **GREEN**: Execute migration
   - Use `git mv` to preserve history
   - Update all internal links
   - Update all relative paths
   - Minimal implementation: Basic moves with link updates

3. **REFACTOR**: Optimize organization
   - Ensure logical grouping
   - Add README.md to each directory
   - Create navigation aids
   - Add breadcrumbs or section headers

4. **QA**: Verify migration success
   - [ ] All content in correct locations
   - [ ] All links work
   - [ ] Git history preserved
   - [ ] Navigation clear

**Migration Strategy**:

1. **Create new directories** (Phase 2 structure)
2. **Move specification/** - Already well-organized
3. **Reorganize docs/** - Create subdirectories, move content
4. **Rename reference implementations**:
   - `reference/server-python/` → `reference/server-python/`
   - `client-reference/` → `packages/client-*/` (separate packages)
5. **Create new directories**:
   - `design/` - Move implementation plans here
   - `docs/getting-started/` - Extract from root docs
   - `docs/guides/` - Extract from root docs
6. **Archive old content**: `research/archives/`

**Commands Template**:
```bash
# Preserve git history with git mv
git mv old/path/file.md new/path/file.md

# Update links in all files
find . -name "*.md" -exec sed -i 's|old/path|new/path|g' {} +

# Validate after each major move
./scripts/validate_docs.sh
```

**Deliverables**:
- Complete target structure
- All content migrated
- All links working
- `MIGRATION_REPORT.md` documenting changes

---

### Phase 6: Enhance Discoverability

**Objective**: Add navigation aids, search optimization, and user-friendly features.

#### TDD Cycle:

1. **RED**: Create discoverability tests
   - Test: Each directory has README.md with navigation
   - Test: Root README links to all major sections
   - Test: Search keywords present in frontmatter
   - Expected failure: Navigation incomplete

2. **GREEN**: Add navigation
   - README.md in every directory
   - Table of contents in long documents
   - Clear next/previous links
   - Minimal implementation: Basic navigation

3. **REFACTOR**: Enhance navigation
   - Add visual diagrams
   - Create learning paths
   - Add tags and categories
   - Improve search metadata

4. **QA**: Verify discoverability
   - [ ] Easy to find information
   - [ ] Clear navigation paths
   - [ ] Good search results
   - [ ] New users can orient quickly

**Navigation Enhancements**:

1. **Directory READMEs** - Each directory needs:
   - Purpose of this section
   - Contents listing with descriptions
   - Links to related sections
   - Recommended reading order (if applicable)

2. **Specification Navigation**:
   - `specification/README.md` with section overview
   - Logical reading order for learning
   - Quick reference for implementation
   - Links to related examples

3. **Documentation Navigation**:
   - `docs/README.md` with user journey paths:
     - "I'm new" → Getting Started → Quick Start
     - "I'm implementing server" → Server Guide
     - "I'm integrating client" → Client Guide
     - "I'm debugging" → Debugging Guide

4. **Visual Aids**:
   - Architecture diagram in root README
   - Flow diagrams in specification
   - Sequence diagrams for cascade flow
   - Decision trees for implementation choices

5. **Learning Paths**:
   - Beginner path: README → Getting Started → Tutorial
   - Server developer path: README → Specification → Server Guide → Reference
   - Client developer path: README → Getting Started → Client Guide → Examples
   - Contributor path: README → CONTRIBUTING → Specification → Reference

**Deliverables**:
- README.md in every directory
- Visual diagrams
- Clear learning paths
- Enhanced navigation

---

### Phase 7: Quality Assurance & Polish

**Objective**: Comprehensive review, validation, and polish for public release.

#### TDD Cycle:

1. **RED**: Create comprehensive quality tests
   - Test: All code examples execute successfully
   - Test: All links work (internal and external)
   - Test: Consistent formatting across all docs
   - Test: No spelling/grammar errors
   - Expected failure: Quality issues exist

2. **GREEN**: Fix quality issues
   - Run all examples and fix errors
   - Fix broken links
   - Standardize formatting
   - Fix spelling/grammar
   - Minimal implementation: Address critical issues

3. **REFACTOR**: Polish for excellence
   - Improve writing clarity
   - Enhance examples
   - Add missing context
   - Professional copyediting

4. **QA**: Final verification
   - [ ] All examples work
   - [ ] All links work
   - [ ] Consistent style
   - [ ] Professional quality
   - [ ] Ready for public release

**Quality Checks**:

1. **Technical Accuracy**:
   - [ ] All code examples run successfully
   - [ ] API references match implementation
   - [ ] GraphQL schemas are valid
   - [ ] Examples follow best practices

2. **Link Validation**:
   - [ ] All internal links work
   - [ ] All external links work (and are appropriate)
   - [ ] No broken references
   - [ ] Cross-references accurate

3. **Formatting Consistency**:
   - [ ] Consistent markdown style
   - [ ] Consistent code block languages
   - [ ] Consistent heading hierarchy
   - [ ] Consistent file naming

4. **Writing Quality**:
   - [ ] Clear and concise
   - [ ] Consistent terminology
   - [ ] Appropriate tone (technical but friendly)
   - [ ] No spelling/grammar errors
   - [ ] Inclusive language

5. **Completeness**:
   - [ ] All TODO items resolved
   - [ ] All placeholders filled
   - [ ] All sections complete
   - [ ] All promises delivered

**Validation Tools**:
```bash
# Validate links
./scripts/validate_links.sh

# Check formatting
npm run lint:markdown

# Spell check
npm run spellcheck

# Test all examples
./scripts/test_examples.sh

# Generate validation report
./scripts/quality_report.sh
```

**Deliverables**:
- Zero broken links
- All examples working
- Professional quality throughout
- `QUALITY_REPORT.md` with metrics

---

### Phase 8: CI/CD & Automation

**Objective**: Automate validation, ensure quality is maintained, and streamline updates.

#### TDD Cycle:

1. **RED**: Create automation tests
   - Test: CI runs on every PR
   - Test: Documentation builds successfully
   - Test: Link validation automated
   - Expected failure: No CI configured

2. **GREEN**: Set up CI/CD
   - GitHub Actions workflows
   - Documentation validation
   - Example testing
   - Minimal implementation: Basic CI

3. **REFACTOR**: Enhance automation
   - Auto-generate table of contents
   - Auto-update links
   - Auto-deploy documentation site
   - Performance optimizations

4. **QA**: Verify automation
   - [ ] CI runs reliably
   - [ ] Catches errors before merge
   - [ ] Documentation auto-deploys
   - [ ] Low maintenance overhead

**Automation Components**:

1. **Documentation Validation CI** (`.github/workflows/validate-docs.yml`):
   - Validate all markdown files
   - Check all links (internal and external)
   - Verify code examples execute
   - Check formatting consistency
   - Run spell check
   - Verify structure compliance

2. **Compliance Testing CI** (`.github/workflows/compliance-tests.yml`):
   - Run specification compliance tests
   - Validate reference implementations
   - Check example implementations
   - Performance benchmarks

3. **Documentation Site Deployment**:
   - Auto-build with MkDocs, Docusaurus, or similar
   - Deploy to GitHub Pages or Netlify
   - Version documentation (v0.1, v0.2, etc.)
   - Search functionality

4. **Automated Updates**:
   - Auto-generate API documentation from code
   - Auto-update changelog from commits
   - Auto-update table of contents
   - Dependency updates

**Scripts to Create**:
- `scripts/validate_docs.sh` - Complete validation
- `scripts/test_examples.sh` - Test all examples
- `scripts/generate_toc.sh` - Generate table of contents
- `scripts/check_structure.sh` - Verify directory structure
- `scripts/update_links.sh` - Update relative links after moves

**Deliverables**:
- Working CI/CD pipelines
- Automated validation
- Documentation site deployed
- Maintenance scripts

---

## Success Criteria

### Documentation Quality Metrics

- [ ] **Completeness**: 100% of required documentation exists
- [ ] **Accuracy**: 0 broken links, 0 invalid code examples
- [ ] **Consistency**: Uniform formatting, terminology, and structure
- [ ] **Discoverability**: ≤ 3 clicks to find any information
- [ ] **Clarity**: Understandable by developers without extensive context
- [ ] **Professional**: Publication-ready quality

### Repository Health Metrics

- [ ] **Organization**: Clear, logical structure following best practices
- [ ] **Duplication**: 0 duplicate content (except intentional examples)
- [ ] **Navigation**: Every directory has README.md with navigation
- [ ] **Automation**: CI validates all documentation changes
- [ ] **Maintenance**: Clear ownership and update procedures

### User Experience Metrics

- [ ] **Time to First Success**: < 10 minutes from README to working example
- [ ] **Onboarding**: Clear paths for different user types
- [ ] **Support**: Comprehensive troubleshooting and debugging guides
- [ ] **Community**: Clear contribution guidelines and welcoming tone

---

## Risk Management

### Potential Risks

1. **Git History Loss**: Moving files can lose git history
   - **Mitigation**: Use `git mv` instead of regular `mv`
   - **Testing**: Verify history after each major move

2. **Broken Links**: Moving content breaks internal references
   - **Mitigation**: Update links immediately after moves
   - **Testing**: Run link validator after every phase

3. **Content Loss**: Accidentally deleting important content
   - **Mitigation**: Archive before deleting, review archives
   - **Testing**: Diff before/after to catch losses

4. **Scope Creep**: Perfect becomes enemy of done
   - **Mitigation**: Clear phase deliverables, time-box work
   - **Testing**: Focus on success criteria, defer nice-to-haves

### Contingency Plans

- **If links break**: Revert to previous commit, fix systematically
- **If structure doesn't work**: Iterate on structure before migration
- **If automation fails**: Manual validation as fallback
- **If time constrained**: Prioritize phases 1-5, defer 6-8

---

## Maintenance Plan

### Ongoing Responsibilities

1. **Documentation Updates**:
   - Review quarterly for accuracy
   - Update examples with new releases
   - Add new guides as features develop
   - Archive outdated content

2. **Link Maintenance**:
   - Run link validator monthly
   - Fix broken external links
   - Update references to external docs

3. **Quality Monitoring**:
   - Track user feedback on documentation
   - Monitor time-to-first-success metric
   - Identify confusing sections
   - Improve based on questions received

4. **CI Maintenance**:
   - Keep workflows updated
   - Monitor CI performance
   - Add new validations as needed
   - Fix flaky tests

---

## Appendix: Tool Recommendations

### Documentation Tools

- **Markdown Linting**: `markdownlint-cli2`
- **Link Validation**: `markdown-link-check`
- **Spell Checking**: `cspell` or `hunspell`
- **Documentation Site**: MkDocs Material or Docusaurus
- **Diagram Generation**: Mermaid (in markdown) or draw.io

### Automation Tools

- **CI/CD**: GitHub Actions
- **Pre-commit Hooks**: `husky` + `lint-staged`
- **Auto-formatting**: `prettier` for markdown
- **TOC Generation**: `markdown-toc`

### Development Tools

- **Repository Backup**: git tags before major changes
- **Diffing**: Beyond Compare or similar for reviewing large changes
- **Search & Replace**: `ripgrep` + `sd` for bulk updates

---

## Estimated Timeline

**Total Duration**: 4-6 weeks (with one developer working part-time)

- **Phase 1**: 3-4 days (Assessment & Inventory)
- **Phase 2**: 2-3 days (Define Structure)
- **Phase 3**: 5-7 days (Content Consolidation)
- **Phase 4**: 7-10 days (Create Core Documentation)
- **Phase 5**: 3-5 days (Reorganize & Migrate)
- **Phase 6**: 4-6 days (Enhance Discoverability)
- **Phase 7**: 5-7 days (Quality Assurance)
- **Phase 8**: 3-5 days (CI/CD & Automation)

**Accelerated Timeline**: 2-3 weeks (with dedicated full-time effort)

**Note**: Phases can overlap. For example, Phase 6 (navigation) can proceed in parallel with Phase 5 (migration).

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Approve target structure** (Phase 2)
3. **Begin Phase 1** (Assessment & Inventory)
4. **Set up project tracking** (GitHub project board)
5. **Establish success criteria** for first milestone
6. **Schedule regular check-ins** (weekly recommended)

---

**Plan Version**: 1.0
**Last Updated**: 2025-11-11
**Status**: Ready for execution
