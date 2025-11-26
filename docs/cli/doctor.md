# cascade doctor

Diagnose GraphQL Cascade issues in your application.

## Usage

```bash
cascade doctor [options]
```

## Options

- `--endpoint <url>` - GraphQL endpoint to analyze (default: http://localhost:4000/graphql)
- `--mutations <mutation1,mutation2>` - Test specific mutations
- `--output <json|text>` - Output format (default: text)

## Examples

Diagnose local server:

```bash
cascade doctor
```

Test specific endpoint:

```bash
cascade doctor --endpoint https://api.example.com/graphql
```

Test specific mutations:

```bash
cascade doctor --mutations createTodo,updateTodo
```

## Checks

### 1. Schema Compliance
- Cascade types are defined
- Mutations return cascade metadata

### 2. Response Validation
- Cascade structure is correct
- Entity references are valid
- Invalidations are properly formatted

### 3. Performance Analysis
- Cascade size distribution
- Over-invalidation patterns
- Missing optimizations

### 4. Best Practices
- Consistent mutation patterns
- Proper error handling
- Entity identification strategy

## Sample Output

```
GraphQL Cascade Doctor
━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Schema Compliance
  • Cascade types defined
  • 12 mutations found
  • All mutations return cascade

⚠ Performance
  • Average cascade size: 45 entities
  • createProject mutation: 127 entities (consider optimization)

✓ Best Practices
  • Consistent naming patterns
  • Proper entity identification

Recommendations:
  1. Consider cascade depth limits for createProject
  2. Add more granular invalidation for searchUsers

Overall: GOOD (1 warning)
```

## Exit Codes

- `0` - No issues found
- `1` - Warnings found
- `2` - Errors found

## Next Steps

- **[Performance Guide](/guide/performance)** - Optimize cascade size
- **[Server Implementation](/server/)** - Improve tracking
