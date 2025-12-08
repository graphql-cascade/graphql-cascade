# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within GraphQL Cascade, please report it by creating a security advisory on GitHub. Do not disclose security vulnerabilities publicly until they have been addressed.

We will acknowledge receipt of your vulnerability report within 48 hours and will send a more detailed response within 72 hours indicating the next steps.

## Software Bill of Materials (SBOM)

A Software Bill of Materials in CycloneDX format is generated for each release and attached to the GitHub release assets. You can also generate an SBOM locally:

```bash
pnpm sbom
```

The SBOM includes all production dependencies and can be used for:
- Vulnerability scanning
- License compliance auditing
- Supply chain security analysis

## Security Best Practices

When using GraphQL Cascade in production, consider the following security measures:

### Entity Data Exposure

Cascade responses include full entity data, which may expose sensitive fields. Use the `fieldFilter` option to exclude sensitive data:

```typescript
const tracker = new CascadeTracker({
  fieldFilter: (typename, fieldName, value) => {
    const sensitiveFields = ['password', 'passwordHash', 'ssn', 'creditCard', 'apiKey'];
    return !sensitiveFields.includes(fieldName);
  }
});
```

### Type-Level Exclusion

Exclude internal types from cascade responses:

```typescript
const tracker = new CascadeTracker({
  excludeTypes: ['AuditLog', 'Session', 'ApiKey', 'InternalMetric']
});
```

### Response Size Limits

Configure response size limits to prevent abuse:

```typescript
const builder = new CascadeBuilder(tracker, null, {
  maxUpdatedEntities: 100,
  maxDeletedEntities: 50,
  maxResponseSizeMb: 1
});
```

### Minimal Metadata in Production

Consider disabling timing metadata in production:

```typescript
const builder = new CascadeBuilder(tracker, null, {
  includeTimingMetadata: process.env.NODE_ENV !== 'production',
  includeTransactionId: process.env.NODE_ENV !== 'production'
});
```

## Dependencies

We regularly audit our dependencies for known vulnerabilities. If you find a vulnerable dependency, please report it through the vulnerability reporting process above.
