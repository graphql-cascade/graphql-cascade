# Security

This section defines security considerations for GraphQL Cascade implementations. Cascade responses can expose sensitive data or enable cache poisoning attacks if not properly secured.

## Authorization Considerations

### Entity Access Control

Cascade responses MUST NOT expose entities that the requesting user cannot access:

```python
# Server-side: Filter cascade based on user permissions
class CascadeBuilder:
    def build(self, primary_result, success=True, errors=None):
        # ... existing code ...

        # Filter updated entities
        filtered_updated = []
        for entity_data in updated_entities:
            if self.user_can_access_entity(entity_data['__typename'], entity_data['id']):
                filtered_updated.append(entity_data)

        # Filter deleted entities (user must have been able to see them)
        filtered_deleted = []
        for entity_data in deleted_entities:
            if self.user_can_access_entity(entity_data['__typename'], entity_data['id']):
                filtered_deleted.append(entity_data)

        # ... build response with filtered data ...
```

### Field-Level Security

Cascade responses MUST respect field-level permissions:

```python
class CascadeBuilder:
    def filter_entity_fields(self, entity, typename):
        """Remove sensitive fields based on user permissions."""
        if typename == 'User':
            # Remove sensitive fields for other users
            if entity['id'] != self.current_user_id:
                entity = {**entity}
                entity.pop('email', None)
                entity.pop('phoneNumber', None)
                entity.pop('salary', None)
        return entity
```

### Relationship Traversal Security

Cascade depth limits MUST be enforced to prevent information disclosure through deep relationships:

```python
class CascadeTracker:
    def __init__(self, max_depth=3, user_permissions=None):
        self.max_depth = max_depth
        self.user_permissions = user_permissions

    def _cascade_to_related(self, entity):
        """Only traverse relationships user can access."""
        if self.current_depth >= self.max_depth:
            return

        for related_entity in entity.get_related_entities():
            # Check if user can access this relationship
            if self.can_access_relationship(entity, related_entity):
                self._track(related_entity, CascadeOperation.UPDATED)
```

## Sensitive Data Protection

### Redaction of Sensitive Fields

Servers MUST redact sensitive data in cascade responses:

```python
class CascadeBuilder:
    SENSITIVE_FIELDS = {
        'User': ['passwordHash', 'socialSecurityNumber', 'bankAccount'],
        'Company': ['taxId', 'financialRecords'],
        'Payment': ['cardNumber', 'cvv', 'expiryDate']
    }

    def sanitize_entity(self, entity, typename):
        """Remove sensitive fields from entities."""
        if typename in self.SENSITIVE_FIELDS:
            entity = {**entity}  # Copy
            for field in self.SENSITIVE_FIELDS[typename]:
                entity.pop(field, None)
        return entity
```

### Audit Logging

Cascade operations SHOULD be logged for security monitoring:

```python
class CascadeAuditor:
    def log_cascade_access(self, user_id, cascade_response):
        """Log cascade access for security auditing."""
        log_entry = {
            'timestamp': datetime.utcnow(),
            'user_id': user_id,
            'operation': 'cascade_access',
            'entities_accessed': [
                f"{entity['__typename']}:{entity['id']}"
                for entity in cascade_response['cascade']['updated']
            ],
            'entities_deleted': [
                f"{entity['__typename']}:{entity['id']}"
                for entity in cascade_response['cascade']['deleted']
            ],
            'query_invalidations': len(cascade_response['cascade']['invalidations'])
        }
        self.audit_logger.log(log_entry)
```

## Query Invalidation Security

### Cache Poisoning Prevention

Invalidation hints MUST be validated to prevent cache poisoning:

```python
class SecureInvalidator:
    ALLOWED_QUERY_PATTERNS = [
        r'^list[A-Z][a-zA-Z]*$',      # listUsers, listCompanies
        r'^get[A-Z][a-zA-Z]*$',       # getUser, getCompany
        r'^search[A-Z][a-zA-Z]*$',    # searchUsers
        r'^[a-z][a-zA-Z]*Connection$', # usersConnection
    ]

    def validate_invalidation(self, invalidation):
        """Ensure invalidation targets are safe."""
        if invalidation.get('queryName'):
            if not self.is_allowed_query_name(invalidation['queryName']):
                raise SecurityError(f"Invalid query name: {invalidation['queryName']}")

        if invalidation.get('queryPattern'):
            if not self.is_safe_pattern(invalidation['queryPattern']):
                raise SecurityError(f"Unsafe pattern: {invalidation['queryPattern']}")

    def is_allowed_query_name(self, query_name):
        """Check if query name matches allowed patterns."""
        return any(re.match(pattern, query_name) for pattern in self.ALLOWED_QUERY_PATTERNS)
```

### Rate Limiting

Invalidation operations SHOULD be rate limited:

```python
class RateLimitedInvalidator:
    def __init__(self, max_invalidations_per_minute=100):
        self.max_invalidations = max_invalidations_per_minute
        self.invalidations_this_minute = 0
        self.minute_start = time.time()

    def invalidate(self, invalidation):
        """Rate-limited invalidation."""
        self.check_rate_limit()

        # Perform invalidation
        super().invalidate(invalidation)

        self.invalidations_this_minute += 1

    def check_rate_limit(self):
        """Enforce rate limiting."""
        current_time = time.time()
        if current_time - self.minute_start >= 60:
            self.invalidations_this_minute = 0
            self.minute_start = current_time

        if self.invalidations_this_minute >= self.max_invalidations:
            raise RateLimitError("Too many invalidations per minute")
```

## Denial of Service Prevention

### Cascade Size Limits

Servers MUST limit cascade response size to prevent DoS attacks:

```python
class SizeLimitedCascadeBuilder:
    MAX_ENTITIES = 500
    MAX_RESPONSE_SIZE_MB = 5

    def build(self, primary_result, success=True, errors=None):
        # ... build cascade ...

        # Check size limits
        total_entities = len(cascade['updated']) + len(cascade['deleted'])
        if total_entities > self.MAX_ENTITIES:
            # Truncate cascade and add warning
            cascade['updated'] = cascade['updated'][:self.MAX_ENTITIES//2]
            cascade['deleted'] = cascade['deleted'][:self.MAX_ENTITIES//2]
            cascade['metadata']['truncated'] = True
            cascade['metadata']['original_count'] = total_entities

        # Check response size
        response_size = self.calculate_response_size(cascade)
        if response_size > self.MAX_RESPONSE_SIZE_MB * 1024 * 1024:
            raise CascadeTooLargeError(f"Response too large: {response_size} bytes")

        return cascade
```

### Depth Limiting

Cascade depth MUST be strictly limited:

```python
class DepthLimitedTracker:
    def __init__(self, max_depth=3):
        self.max_depth = max_depth
        self.current_depth = 0

    def _cascade_to_related(self, entity):
        """Enforce depth limits."""
        if self.current_depth >= self.max_depth:
            return  # Stop cascading

        self.current_depth += 1
        try:
            for related_entity in entity.get_related_entities():
                self._track(related_entity, CascadeOperation.UPDATED)
        finally:
            self.current_depth -= 1
```

### Timeout Protection

Cascade computation MUST timeout to prevent long-running operations:

```python
import signal

class TimeoutCascadeBuilder:
    def build_with_timeout(self, primary_result, timeout_seconds=5):
        """Build cascade with timeout protection."""

        def timeout_handler(signum, frame):
            raise TimeoutError("Cascade computation timed out")

        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(timeout_seconds)

        try:
            return self.build(primary_result)
        finally:
            signal.alarm(0)  # Cancel alarm
```

## Client-Side Security

### Cascade Validation

Clients MUST validate cascade responses before applying them:

```typescript
class SecureCascadeClient extends CascadeClient {
  applyCascade(response: CascadeResponse): void {
    // Validate response structure
    this.validateCascadeResponse(response);

    // Check for suspicious patterns
    this.detectSuspiciousPatterns(response);

    // Apply cascade
    super.applyCascade(response);
  }

  private validateCascadeResponse(response: CascadeResponse): void {
    // Ensure cascade structure is valid
    if (!response.cascade || typeof response.cascade !== 'object') {
      throw new Error('Invalid cascade structure');
    }

    // Validate entity IDs are strings
    for (const entity of response.cascade.updated) {
      if (typeof entity.id !== 'string' || entity.id.length > 100) {
        throw new Error('Invalid entity ID');
      }
    }
  }

  private detectSuspiciousPatterns(response: CascadeResponse): void {
    const totalEntities = response.cascade.updated.length + response.cascade.deleted.length;

    // Warn on unusually large cascades
    if (totalEntities > 100) {
      console.warn(`Large cascade detected: ${totalEntities} entities`);
    }

    // Check for unexpected entity types
    const allowedTypes = ['User', 'Company', 'Post', 'Comment']; // App-specific
    for (const entity of response.cascade.updated) {
      if (!allowedTypes.includes(entity.__typename)) {
        throw new Error(`Unexpected entity type: ${entity.__typename}`);
      }
    }
  }
}
```

### Secure Cache Operations

Clients MUST handle cache operations securely:

```typescript
class SecureCascadeCache implements CascadeCache {
  write(typename: string, id: string, data: any): void {
    // Validate data before writing
    this.validateEntityData(typename, id, data);

    // Prevent prototype pollution
    this.sanitizeData(data);

    this.cache.write(typename, id, data);
  }

  private validateEntityData(typename: string, id: string, data: any): void {
    // Ensure ID matches
    if (data.id !== id) {
      throw new Error('Entity ID mismatch');
    }

    // Ensure typename matches
    if (data.__typename !== typename) {
      throw new Error('Entity typename mismatch');
    }

    // Validate field types (app-specific)
    if (typename === 'User' && typeof data.email !== 'string') {
      throw new Error('Invalid email field');
    }
  }

  private sanitizeData(data: any): void {
    // Remove __proto__, constructor, etc.
    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove dangerous fields
    delete sanitized.__proto__;
    delete sanitized.constructor;
    delete sanitized.prototype;

    return sanitized;
  }
}
```

## Authentication Integration

### User Context Propagation

Cascade operations MUST use the authenticated user's context:

```python
class AuthenticatedCascadeBuilder:
    def __init__(self, current_user):
        self.current_user = current_user

    def user_can_access_entity(self, typename, entity_id):
        """Check if current user can access the entity."""
        if typename == 'User':
            # Users can access themselves and their related entities
            return entity_id == self.current_user.id or self.is_related_entity(entity_id)

        # Company access control
        if typename == 'Company':
            return self.user_owns_company(entity_id) or self.user_works_for_company(entity_id)

        return False
```

### Session Validation

Cascade responses SHOULD include session validation:

```python
class SessionValidatedCascadeBuilder:
    def build(self, primary_result):
        # Validate user session is still active
        if not self.session_service.is_session_valid(self.current_user.session_id):
            raise AuthenticationError("Session expired")

        # Check if user permissions have changed during request
        if self.permission_service.have_permissions_changed(self.current_user.id):
            raise AuthorizationError("Permissions changed")

        return super().build(primary_result)
```

## Audit and Compliance

### Cascade Audit Trail

Servers SHOULD maintain audit trails of cascade operations:

```python
class AuditedCascadeBuilder:
    def build(self, primary_result):
        response = super().build(primary_result)

        # Log cascade operation
        self.audit_service.log_cascade_operation({
            'user_id': self.current_user.id,
            'timestamp': datetime.utcnow(),
            'mutation': self.current_mutation_name,
            'entities_affected': len(response.cascade.updated) + len(response.cascade.deleted),
            'invalidations_sent': len(response.cascade.invalidations),
            'response_size': len(json.dumps(response))
        })

        return response
```

### GDPR Compliance

Cascade implementations MUST support data deletion requirements:

```python
class GDPRCompliantCascadeBuilder:
    def handle_user_deletion(self, user_id):
        """When a user is deleted, clean up all related cascade data."""

        # Find all entities that reference the deleted user
        related_entities = self.find_entities_referencing_user(user_id)

        # Add to cascade as updated (with null references) or deleted
        for entity in related_entities:
            if self.should_nullify_reference(entity):
                # Update entity to remove user reference
                self.tracker.track_update(entity.with_user_reference_nullified())
            else:
                # Delete entity entirely
                self.tracker.track_delete(entity.__typename__, entity.id)

        # Invalidate all queries that might contain user data
        self.invalidator.invalidate_user_related_queries(user_id)
```

## Security Testing

### Penetration Testing Checklist

```python
class CascadeSecurityTester:
    def test_authorization_bypass(self):
        """Test that users can't access unauthorized entities via cascade."""
        # Attempt to access entities user shouldn't see
        # Verify cascade filters them out

    def test_field_redaction(self):
        """Test that sensitive fields are properly redacted."""
        # Check cascade responses don't contain sensitive data

    def test_invalidation_injection(self):
        """Test that invalidation hints can't be manipulated."""
        # Attempt to inject malicious invalidation patterns
        # Verify they're rejected

    def test_cascade_size_limits(self):
        """Test that large cascades are properly limited."""
        # Create mutations that would generate huge cascades
        # Verify limits are enforced

    def test_timeout_protection(self):
        """Test that cascade computation times out properly."""
        # Create slow cascade computations
        # Verify timeout is enforced
```

### Security Headers

Cascade endpoints SHOULD include appropriate security headers:

```python
# Server response headers
CASCADE_SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'",
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
}
```

## Examples

### Secure Cascade Builder

```python
class SecureCascadeBuilder(CascadeBuilder):
    def __init__(self, current_user, audit_logger=None):
        super().__init__()
        self.current_user = current_user
        self.audit_logger = audit_logger

    def build(self, primary_result, success=True, errors=None):
        # Build the cascade
        response = super().build(primary_result, success, errors)

        # Apply security filters
        response.cascade.updated = [
            self.filter_entity_fields(entity, entity['__typename'])
            for entity in response.cascade.updated
            if self.user_can_access_entity(entity['__typename'], entity['id'])
        ]

        response.cascade.deleted = [
            entity for entity in response.cascade.deleted
            if self.user_can_access_entity(entity['__typename'], entity['id'])
        ]

        # Validate invalidations
        for invalidation in response.cascade.invalidations:
            self.validate_invalidation(invalidation)

        # Log the operation
        if self.audit_logger:
            self.audit_logger.log_cascade_access(
                self.current_user.id,
                len(response.cascade.updated),
                len(response.cascade.deleted)
            )

        return response

    def user_can_access_entity(self, typename, entity_id):
        """Check access control - implement based on your auth system."""
        # This is app-specific logic
        pass

    def filter_entity_fields(self, entity, typename):
        """Remove sensitive fields - implement based on your data model."""
        # This is app-specific logic
        pass

    def validate_invalidation(self, invalidation):
        """Validate invalidation hints are safe."""
        # Implement validation logic
        pass
```

### Client-Side Security

```typescript
class SecureApolloCascadeClient extends ApolloCascadeClient {
  applyCascade(response: CascadeResponse): void {
    // Validate response before processing
    this.validateResponse(response);

    // Check user permissions on client side (defense in depth)
    this.checkClientPermissions(response);

    // Apply cascade
    super.applyCascade(response);
  }

  private validateResponse(response: CascadeResponse): void {
    // Ensure response structure is valid
    if (!response.cascade?.updated || !Array.isArray(response.cascade.updated)) {
      throw new Error('Invalid cascade response structure');
    }

    // Check for reasonable limits
    const totalEntities = response.cascade.updated.length + (response.cascade.deleted?.length || 0);
    if (totalEntities > 1000) {
      throw new Error('Cascade response too large');
    }
  }

  private checkClientPermissions(response: CascadeResponse): void {
    // Client-side permission checks (defense in depth)
    // This should match server-side logic
    for (const entity of response.cascade.updated) {
      if (!this.canAccessEntity(entity.__typename, entity.id)) {
        console.warn(`Received unauthorized entity in cascade: ${entity.__typename}:${entity.id}`);
        // Remove from cascade
        response.cascade.updated = response.cascade.updated.filter(e => e !== entity);
      }
    }
  }
}
```</content>
</xai:function_call">The file has been written successfully.