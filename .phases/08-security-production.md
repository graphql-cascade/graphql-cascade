# AXIS 8: Security & Production Hardening

**Engineer Persona**: Security Engineer
**Status**: Analysis Complete
**Priority**: Critical (Enterprise adoption)

---

## Executive Summary

For graphql-cascade to be trusted in production environments, especially at enterprises, it must be secure by default and thoroughly hardened. This axis covers security auditing, authorization integration, data exposure prevention, audit logging, and compliance considerations.

---

## Current State Assessment

### Security Documentation

| Aspect | Current State | Risk Level |
|--------|---------------|------------|
| Authorization | Documented (spec 16) | Medium |
| Data exposure | Mentioned | High |
| Rate limiting | Not addressed | Medium |
| Audit logging | Not implemented | Medium |
| Compliance | Not addressed | Medium |

### Security Gaps

1. **No security audit performed** - Unknown vulnerabilities
2. **No authorization examples** - Implementation unclear
3. **Data exposure risk** - Cascade might leak data
4. **No rate limiting guidance** - DoS potential
5. **No audit trail** - Compliance issues
6. **No threat model** - Security not systematically analyzed

---

## Threat Model

### Attack Surface

```
┌─────────────────────────────────────────────────────────────┐
│                    GraphQL Cascade System                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client                    Server                            │
│  ┌──────────┐             ┌──────────────────┐              │
│  │ Cascade  │   HTTP/WS   │  GraphQL Server  │              │
│  │ Client   │◄───────────►│  + Cascade       │              │
│  └──────────┘             └──────────────────┘              │
│       │                          │                          │
│       ▼                          ▼                          │
│  ┌──────────┐             ┌──────────────────┐              │
│  │  Cache   │             │    Database      │              │
│  │ (Local)  │             │                  │              │
│  └──────────┘             └──────────────────┘              │
│                                                              │
│  Attack Vectors:                                             │
│  1. Unauthorized data in cascade response                    │
│  2. Cache poisoning via malicious response                   │
│  3. Information disclosure via error messages                │
│  4. DoS via expensive cascade operations                     │
│  5. Privilege escalation via relationship traversal          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Threat Matrix

| Threat | Likelihood | Impact | Risk | Mitigation |
|--------|------------|--------|------|------------|
| Unauthorized data exposure | High | Critical | Critical | Authorization checks |
| Cache poisoning | Medium | High | High | Response validation |
| Information disclosure | Medium | Medium | Medium | Error sanitization |
| DoS via deep graphs | Medium | Medium | Medium | Depth limits |
| Privilege escalation | Low | Critical | Medium | Relationship auth |
| Replay attacks | Low | Low | Low | Nonces/timestamps |

---

## Security Controls

### 1. Authorization Integration

#### Per-Entity Authorization

```python
# Server-side: Filter unauthorized entities from cascade
class AuthorizedCascadeBuilder:
    def __init__(self, user: User, tracker: CascadeTracker):
        self.user = user
        self.tracker = tracker

    def build_response(self) -> CascadeResponse:
        all_entities = self.tracker.get_tracked_entities()

        # Filter to only entities user can see
        authorized = [
            entity for entity in all_entities
            if self.can_user_see(self.user, entity)
        ]

        return CascadeResponse(
            updated=authorized,
            invalidations=self.build_invalidations(authorized),
            metadata=self.build_metadata(authorized)
        )

    def can_user_see(self, user: User, entity: Entity) -> bool:
        """Check if user is authorized to see this entity."""
        # Example: Row-level security
        if entity.typename == 'Todo':
            return entity.user_id == user.id or entity.is_public

        if entity.typename == 'User':
            return entity.id == user.id or user.is_admin

        return True  # Default allow
```

#### Relationship Authorization

```python
# Prevent privilege escalation via relationships
class SecureCascadeTracker(CascadeTracker):
    def track_relationships(
        self,
        entity: Entity,
        depth: int = 3
    ) -> List[Entity]:
        visited = set()
        authorized = []

        def traverse(e: Entity, d: int):
            if d > depth or e.id in visited:
                return

            visited.add(e.id)

            # Check authorization before including
            if self.authorize_entity(e):
                authorized.append(e)

                # Only traverse relationships user can access
                for rel in e.relationships:
                    if self.authorize_relationship(e, rel):
                        traverse(rel.target, d + 1)

        traverse(entity, 0)
        return authorized

    def authorize_relationship(
        self,
        source: Entity,
        relationship: Relationship
    ) -> bool:
        """Prevent accessing related entities without permission."""
        # Example: Can only traverse to own data
        if relationship.target.typename == 'PrivateNote':
            return relationship.target.owner_id == self.user.id
        return True
```

### 2. Data Exposure Prevention

#### Field-Level Filtering

```python
# Remove sensitive fields from cascade response
SENSITIVE_FIELDS = {
    'User': ['password_hash', 'ssn', 'api_key'],
    'Payment': ['card_number', 'cvv'],
    'Session': ['token', 'refresh_token']
}

class SanitizedCascadeBuilder(CascadeBuilder):
    def sanitize_entity(self, entity: Dict[str, Any]) -> Dict[str, Any]:
        typename = entity.get('__typename')
        sensitive = SENSITIVE_FIELDS.get(typename, [])

        return {
            k: v for k, v in entity.items()
            if k not in sensitive
        }

    def build_response(self) -> CascadeResponse:
        response = super().build_response()

        return CascadeResponse(
            updated=[
                self.sanitize_entity(e)
                for e in response.updated
            ],
            invalidations=response.invalidations,
            metadata=response.metadata
        )
```

#### Schema-Based Field Visibility

```graphql
# Use directives to mark sensitive fields
directive @cascade(
  visible: Boolean = true  # Can this field appear in cascade?
) on FIELD_DEFINITION

type User {
  id: ID!
  name: String!
  email: String!
  passwordHash: String! @cascade(visible: false)
  apiKey: String! @cascade(visible: false)
}
```

### 3. Rate Limiting & DoS Prevention

#### Cascade Complexity Limits

```python
# Prevent expensive cascade operations
class RateLimitedCascadeTracker(CascadeTracker):
    MAX_ENTITIES_PER_CASCADE = 100
    MAX_DEPTH = 3
    MAX_RELATIONSHIPS_PER_ENTITY = 50

    def track_update(self, entity: Entity):
        if len(self.entities) >= self.MAX_ENTITIES_PER_CASCADE:
            raise CascadeLimitExceeded(
                f"Maximum {self.MAX_ENTITIES_PER_CASCADE} entities per cascade"
            )
        super().track_update(entity)

    def traverse_relationships(self, entity: Entity, depth: int):
        if depth > self.MAX_DEPTH:
            return []

        relationships = entity.relationships[:self.MAX_RELATIONSHIPS_PER_ENTITY]
        # ... continue traversal
```

#### Request Rate Limiting

```python
# Rate limit cascade operations per user
from limits import RateLimitItem
from limits.storage import MemoryStorage

cascade_limiter = RateLimitItem(
    per_minute=60,
    per_hour=500
)

class RateLimitedCascadeMiddleware:
    def __init__(self, storage=MemoryStorage()):
        self.storage = storage

    def process_request(self, request, user):
        key = f"cascade:{user.id}"

        if not cascade_limiter.hit(self.storage, key):
            raise RateLimitExceeded(
                "Too many cascade operations",
                retry_after=cascade_limiter.get_window_stats(
                    self.storage, key
                ).reset_time
            )
```

### 4. Audit Logging

#### Cascade Audit Trail

```python
import structlog
from datetime import datetime

logger = structlog.get_logger("cascade.audit")

class AuditedCascadeBuilder(CascadeBuilder):
    def build_response(self) -> CascadeResponse:
        response = super().build_response()

        # Log audit event
        logger.info(
            "cascade_response_built",
            user_id=self.context.user.id,
            mutation=self.context.operation_name,
            entities_updated=len(response.updated),
            entity_types=[e['__typename'] for e in response.updated],
            entity_ids=[e['id'] for e in response.updated],
            invalidation_count=len(response.invalidations),
            timestamp=datetime.utcnow().isoformat(),
            request_id=self.context.request_id,
            client_ip=self.context.client_ip
        )

        return response
```

#### Audit Log Schema

```json
{
  "event": "cascade_response_built",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "request_id": "req_abc123",
  "user": {
    "id": "user_456",
    "email": "user@example.com",
    "roles": ["user"]
  },
  "operation": {
    "name": "createTodo",
    "type": "mutation"
  },
  "cascade": {
    "entities_updated": 3,
    "entity_types": ["Todo", "User", "TodoList"],
    "entity_ids": ["todo_789", "user_456", "list_012"],
    "depth_traversed": 2,
    "processing_time_ms": 12
  },
  "client": {
    "ip": "192.168.1.100",
    "user_agent": "Apollo-Client/3.8.0"
  }
}
```

### 5. Input Validation

#### Response Validation (Client)

```typescript
// Client-side: Validate cascade response before applying
import { z } from 'zod';

const EntitySchema = z.object({
  __typename: z.string().min(1),
  id: z.string().min(1).or(z.number())
}).passthrough();

const InvalidationSchema = z.object({
  type: z.enum(['INVALIDATE', 'REFETCH', 'REMOVE']),
  target: z.string().min(1),
  scope: z.enum(['EXACT', 'PREFIX', 'PATTERN']).optional()
});

const CascadeResponseSchema = z.object({
  updated: z.array(EntitySchema),
  invalidations: z.array(InvalidationSchema),
  metadata: z.object({
    affectedCount: z.number().int().min(0),
    timestamp: z.string().datetime().optional()
  })
});

function validateCascadeResponse(data: unknown): CascadeResponse {
  return CascadeResponseSchema.parse(data);
}

// Use in cascade link
const cascadeLink = new ApolloLink((operation, forward) => {
  return forward(operation).map(response => {
    if (response.extensions?.cascade) {
      try {
        response.extensions.cascade = validateCascadeResponse(
          response.extensions.cascade
        );
      } catch (error) {
        console.error('Invalid cascade response:', error);
        // Don't apply invalid cascade
        delete response.extensions.cascade;
      }
    }
    return response;
  });
});
```

### 6. Error Handling Security

#### Safe Error Messages

```python
# Don't leak internal details in errors
class SecureCascadeError(Exception):
    def __init__(
        self,
        message: str,
        internal_details: str = None,
        error_code: str = None
    ):
        self.message = message
        self.internal_details = internal_details
        self.error_code = error_code

    def to_client_response(self) -> dict:
        """Return safe error for client."""
        return {
            "error": self.message,
            "code": self.error_code
        }
        # Never include internal_details!

    def to_log_entry(self) -> dict:
        """Return full details for logging."""
        return {
            "error": self.message,
            "code": self.error_code,
            "internal": self.internal_details
        }

# Usage
try:
    cascade_response = build_cascade()
except DatabaseError as e:
    raise SecureCascadeError(
        message="Unable to process cascade",
        internal_details=str(e),  # Logged but not returned
        error_code="CASCADE_BUILD_FAILED"
    )
```

---

## Compliance Considerations

### GDPR

```python
# Right to be forgotten - cascade must not restore deleted data
class GDPRCompliantCascade:
    def __init__(self):
        self.deleted_entities: Set[str] = set()

    def record_deletion(self, typename: str, id: str):
        """Record that entity was deleted (GDPR erasure)."""
        self.deleted_entities.add(f"{typename}:{id}")

    def filter_response(self, response: CascadeResponse) -> CascadeResponse:
        """Remove any deleted entities from cascade."""
        filtered = [
            entity for entity in response.updated
            if f"{entity['__typename']}:{entity['id']}" not in self.deleted_entities
        ]
        return CascadeResponse(
            updated=filtered,
            invalidations=response.invalidations,
            metadata=response.metadata
        )
```

### SOC 2

- **Audit logging**: Implemented above
- **Access control**: Per-entity authorization
- **Encryption**: Use HTTPS/WSS only
- **Change management**: Version cascade responses

### HIPAA (Healthcare)

```python
# Minimum necessary principle
class HIPAACompliantCascade:
    PHI_TYPES = ['Patient', 'MedicalRecord', 'Prescription']

    def filter_to_minimum_necessary(
        self,
        response: CascadeResponse,
        user: User,
        purpose: str
    ) -> CascadeResponse:
        """Only include PHI that user needs for stated purpose."""
        filtered = []

        for entity in response.updated:
            if entity['__typename'] in self.PHI_TYPES:
                if self.is_necessary(entity, user, purpose):
                    filtered.append(self.redact_unnecessary_phi(entity))
            else:
                filtered.append(entity)

        return CascadeResponse(
            updated=filtered,
            invalidations=response.invalidations,
            metadata=response.metadata
        )
```

---

## Security Audit Checklist

### Pre-Production Checklist

- [ ] **Authentication**: All cascade endpoints require authentication
- [ ] **Authorization**: Per-entity authorization implemented
- [ ] **Field filtering**: Sensitive fields excluded from cascade
- [ ] **Depth limits**: Maximum traversal depth enforced
- [ ] **Entity limits**: Maximum entities per cascade enforced
- [ ] **Rate limiting**: Cascade operations rate limited
- [ ] **Input validation**: Cascade responses validated on client
- [ ] **Error handling**: No internal details leaked in errors
- [ ] **Audit logging**: All cascade operations logged
- [ ] **Transport security**: HTTPS/WSS only
- [ ] **Response integrity**: Consider signing cascade responses

### Security Testing

```bash
# Run security-focused tests
npm run test:security

# OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.example.com/graphql

# Dependency vulnerability scan
npm audit
pip-audit

# Static analysis
semgrep --config=p/security-audit ./src
```

---

## Implementation Roadmap

### Phase 1: Threat Modeling (Week 1)

- [ ] Complete threat model
- [ ] Identify all attack vectors
- [ ] Prioritize risks
- [ ] Document security requirements

### Phase 2: Authorization (Weeks 2-3)

- [ ] Implement per-entity authorization
- [ ] Implement relationship authorization
- [ ] Add field-level filtering
- [ ] Write security tests

### Phase 3: Rate Limiting & DoS (Week 4)

- [ ] Implement entity limits
- [ ] Implement depth limits
- [ ] Add rate limiting
- [ ] Performance test limits

### Phase 4: Audit & Compliance (Weeks 5-6)

- [ ] Implement audit logging
- [ ] Add GDPR compliance features
- [ ] Document compliance considerations
- [ ] Create compliance checklist

### Phase 5: Security Audit (Weeks 7-8)

- [ ] Internal security review
- [ ] External penetration test
- [ ] Fix identified issues
- [ ] Document security architecture

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Security vulnerabilities | 0 critical/high |
| Authorization coverage | 100% |
| Audit log coverage | 100% operations |
| Security test coverage | >80% |
| Penetration test pass | Yes |
| Compliance checklist | 100% complete |

---

## Dependencies

| Dependency | Source |
|------------|--------|
| Server implementation | Axis 2 |
| Client implementation | Axis 3 |
| Testing infrastructure | Axis 7 |

---

*Axis 8 Plan v1.0 - Security Engineer Analysis*
