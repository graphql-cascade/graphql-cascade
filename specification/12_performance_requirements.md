# Performance Requirements

This document defines the performance requirements and optimization guidelines for GraphQL Cascade implementations.

## Core Performance Metrics

### Response Time Overhead

Cascade processing MUST NOT significantly impact mutation response times:

- **Tracking Overhead**: < 10% increase in mutation execution time
- **Response Construction**: < 5% of total mutation time
- **End-to-End Latency**: < 50ms additional latency for typical mutations

### Memory Usage Limits

Cascade operations MUST be memory-efficient:

- **Peak Memory**: < 50MB additional memory per concurrent cascade
- **Streaming Processing**: Process entities without loading all into memory
- **Garbage Collection**: Clean up tracking data after response construction

### Response Size Constraints

Cascade responses MUST be bounded to prevent network issues:

- **Maximum Updated Entities**: 500 entities per cascade
- **Maximum Deleted Entities**: 100 entities per cascade
- **Maximum Response Size**: 5MB total JSON payload
- **Automatic Truncation**: Reduce depth or paginate when limits exceeded

## Performance Benchmarks

### Baseline Measurements

Implementations SHOULD measure and report these metrics:

```python
class CascadePerformanceMonitor:
    def __init__(self):
        self.metrics = {
            'tracking_time': [],
            'construction_time': [],
            'response_size': [],
            'entity_count': [],
            'memory_peak': []
        }

    def measure_mutation(self, mutation_fn, *args):
        """Measure cascade performance for a mutation."""
        start_time = time.perf_counter()
        start_memory = self._get_memory_usage()

        # Execute mutation with cascade
        result = mutation_fn(*args)

        end_time = time.perf_counter()
        end_memory = self._get_memory_usage()

        # Record metrics
        self.metrics['tracking_time'].append(result.cascade.metadata.tracking_time)
        self.metrics['construction_time'].append(result.cascade.metadata.construction_time)
        self.metrics['response_size'].append(self._calculate_response_size(result))
        self.metrics['entity_count'].append(result.cascade.metadata.affected_count)
        self.metrics['memory_peak'].append(end_memory - start_memory)

        return result

    def report_percentiles(self):
        """Report performance percentiles."""
        return {
            'tracking_p95': percentile(self.metrics['tracking_time'], 95),
            'construction_p95': percentile(self.metrics['construction_time'], 95),
            'size_p95': percentile(self.metrics['response_size'], 95),
            'entity_p95': percentile(self.metrics['entity_count'], 95),
            'memory_p95': percentile(self.metrics['memory_peak'], 95)
        }
```

### Target Performance

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Tracking Overhead | < 5ms | < 10ms | > 20ms |
| Construction Time | < 2ms | < 5ms | > 10ms |
| Response Size | < 1MB | < 5MB | > 10MB |
| Memory Usage | < 10MB | < 50MB | > 100MB |
| Entity Count | < 100 | < 500 | > 1000 |

## Optimization Strategies

### Database Optimizations

#### Query Efficiency
```sql
-- Use indexes for relationship traversal
CREATE INDEX idx_user_company_id ON users(company_id);
CREATE INDEX idx_order_customer_id ON orders(customer_id);

-- Use covering indexes for cascade queries
CREATE INDEX idx_company_with_address ON companies(id, name, address_id);
```

#### Batch Loading
```python
class BatchRelationshipLoader:
    def __init__(self, db_connection):
        self.db = db_connection
        self.pending_loads = {}

    def load_related(self, entity_type, entity_ids, relationship):
        """Batch load related entities."""
        key = (entity_type, relationship)

        if key not in self.pending_loads:
            self.pending_loads[key] = set()

        self.pending_loads[key].update(entity_ids)

    def execute_batch_loads(self):
        """Execute all pending batch loads."""
        for (entity_type, relationship), entity_ids in self.pending_loads.items():
            # Execute single query for all entities
            related_entities = self.db.execute(f"""
                SELECT * FROM {relationship}
                WHERE {entity_type}_id IN ({','.join('?' * len(entity_ids))})
            """, list(entity_ids))

            # Distribute results to waiting entities
            self._distribute_results(entity_type, relationship, related_entities)

        self.pending_loads.clear()
```

#### Connection Pooling
```python
class ConnectionPoolManager:
    def __init__(self, pool_size=10):
        self.pool = Queue(maxsize=pool_size)
        self._initialize_pool()

    def get_connection(self):
        """Get connection from pool."""
        return self.pool.get()

    def return_connection(self, conn):
        """Return connection to pool."""
        self.pool.put(conn)

    def execute_with_pool(self, query, params):
        """Execute query using pooled connection."""
        conn = self.get_connection()
        try:
            return conn.execute(query, params)
        finally:
            self.return_connection(conn)
```

### Memory Optimizations

#### Streaming Entity Processing
```python
class StreamingCascadeBuilder:
    def __init__(self, tracker):
        self.tracker = tracker

    def build_streaming_response(self, primary_result):
        """Build response without loading all entities into memory."""

        def generate_updated_entities():
            """Generator for updated entities."""
            for entity, operation in self.tracker.get_updated_stream():
                yield {
                    '__typename': entity.__typename__,
                    'id': entity.id,
                    'operation': operation.value,
                    'entity': entity.to_dict()
                }

        def generate_deleted_entities():
            """Generator for deleted entities."""
            for typename, entity_id in self.tracker.get_deleted_stream():
                yield {
                    '__typename': typename,
                    'id': entity_id,
                    'deletedAt': self.tracker.transaction_timestamp
                }

        return CascadeResponse(
            success=True,
            data=primary_result,
            cascade={
                'updated': list(generate_updated_entities()),
                'deleted': list(generate_deleted_entities()),
                'invalidations': self.invalidator.compute_invalidations(),
                'metadata': self._build_metadata()
            }
        )
```

#### Entity Caching
```python
class EntityCache:
    def __init__(self, max_size=10000):
        self.cache = LRUCache(max_size)
        self.serializer = EntitySerializer()

    def get(self, typename, entity_id):
        """Get entity from cache."""
        key = f"{typename}:{entity_id}"
        cached = self.cache.get(key)

        if cached:
            return self.serializer.deserialize(cached)

        return None

    def put(self, entity):
        """Put entity in cache."""
        key = f"{entity.__typename__}:{entity.id}"
        serialized = self.serializer.serialize(entity)
        self.cache.put(key, serialized)

    def invalidate_type(self, typename):
        """Invalidate all entities of a type."""
        keys_to_remove = [k for k in self.cache.keys() if k.startswith(f"{typename}:")]
        for key in keys_to_remove:
            self.cache.remove(key)
```

### Network Optimizations

#### Response Compression
```python
class CompressedCascadeResponse:
    def __init__(self, response_data, compression_level=6):
        self.data = response_data
        self.compression = compression_level

    def to_json(self):
        """Serialize with compression hints."""
        json_data = json.dumps(self.data)

        # Add compression headers for HTTP transport
        if len(json_data) > 1024:  # Compress if > 1KB
            compressed = gzip.compress(json_data.encode(), self.compression)
            return {
                'compressed': True,
                'data': base64.b64encode(compressed).decode(),
                'original_size': len(json_data)
            }

        return {
            'compressed': False,
            'data': json_data
        }
```

#### Pagination for Large Cascades
```python
class PaginatedCascadeBuilder:
    def __init__(self, max_entities_per_page=100):
        self.max_entities_per_page = max_entities_per_page

    def build_paginated_response(self, cascade_data):
        """Build paginated cascade response for large datasets."""

        updated_pages = self._paginate_entities(
            cascade_data['updated'],
            'updated'
        )

        deleted_pages = self._paginate_entities(
            cascade_data['deleted'],
            'deleted'
        )

        return {
            'pages': updated_pages + deleted_pages,
            'total_pages': len(updated_pages) + len(deleted_pages),
            'has_next_page': len(updated_pages) + len(deleted_pages) > 1,
            'invalidations': cascade_data['invalidations'],
            'metadata': cascade_data['metadata']
        }

    def _paginate_entities(self, entities, entity_type):
        """Paginate a list of entities."""
        pages = []

        for i in range(0, len(entities), self.max_entities_per_page):
            page_entities = entities[i:i + self.max_entities_per_page]
            pages.append({
                'type': entity_type,
                'entities': page_entities,
                'page': len(pages) + 1,
                'has_next_page': i + self.max_entities_per_page < len(entities)
            })

        return pages
```

## Monitoring and Alerting

### Performance Metrics Collection

```python
class CascadeMetricsCollector:
    def __init__(self):
        self.metrics = {
            'mutation_count': 0,
            'average_tracking_time': 0,
            'average_construction_time': 0,
            'average_response_size': 0,
            'error_count': 0,
            'large_cascade_count': 0
        }

    def record_mutation(self, tracking_time, construction_time, response_size, entity_count):
        """Record metrics for a mutation."""
        self.metrics['mutation_count'] += 1

        # Update running averages
        self._update_average('average_tracking_time', tracking_time)
        self._update_average('average_construction_time', construction_time)
        self._update_average('average_response_size', response_size)

        # Alert on large cascades
        if entity_count > 100:
            self.metrics['large_cascade_count'] += 1
            self._alert_large_cascade(entity_count)

    def _update_average(self, metric_name, new_value):
        """Update running average."""
        current_avg = self.metrics[metric_name]
        count = self.metrics['mutation_count']

        self.metrics[metric_name] = (current_avg * (count - 1) + new_value) / count

    def _alert_large_cascade(self, entity_count):
        """Alert on unusually large cascades."""
        logger.warning(f"Large cascade detected: {entity_count} entities")

        # Could integrate with monitoring systems
        # metrics_client.gauge('cascade.size.large', entity_count)
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Tracking Time | > 10ms | > 20ms |
| Construction Time | > 5ms | > 10ms |
| Response Size | > 2MB | > 5MB |
| Memory Usage | > 25MB | > 50MB |
| Entity Count | > 200 | > 500 |

## Scaling Considerations

### Horizontal Scaling

#### Database Sharding
```python
class ShardedCascadeTracker:
    def __init__(self, shard_manager):
        self.shard_manager = shard_manager

    def track_entity(self, entity):
        """Track entity in appropriate shard."""
        shard = self.shard_manager.get_shard_for_entity(entity)
        shard.tracker.track_entity(entity)

    def get_cascade_data(self):
        """Aggregate cascade data from all shards."""
        all_cascades = []

        for shard in self.shard_manager.get_all_shards():
            cascade = shard.tracker.get_cascade_data()
            all_cascades.append(cascade)

        return self._merge_cascades(all_cascades)
```

#### Load Balancing
```python
class LoadBalancedInvalidator:
    def __init__(self, invalidator_instances):
        self.instances = invalidator_instances
        self.current_index = 0

    def compute_invalidations(self, *args, **kwargs):
        """Distribute invalidation computation across instances."""
        instance = self.instances[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.instances)

        return instance.compute_invalidations(*args, **kwargs)
```

### Caching Strategies

#### Multi-Level Caching
```python
class MultiLevelEntityCache:
    def __init__(self):
        self.l1_cache = LocalMemoryCache(max_size=1000)  # Fast local cache
        self.l2_cache = RedisCache()  # Shared distributed cache
        self.l3_cache = DatabaseCache()  # Database as last resort

    def get(self, typename, entity_id):
        """Get entity with multi-level cache lookup."""
        # Try L1 cache first
        entity = self.l1_cache.get(typename, entity_id)
        if entity:
            return entity

        # Try L2 cache
        entity = self.l2_cache.get(typename, entity_id)
        if entity:
            self.l1_cache.put(entity)  # Warm L1 cache
            return entity

        # Try L3 cache (database)
        entity = self.l3_cache.get(typename, entity_id)
        if entity:
            self.l2_cache.put(entity)  # Warm L2 cache
            self.l1_cache.put(entity)  # Warm L1 cache

        return entity
```

## Testing Performance

### Load Testing

```python
def test_cascade_performance_under_load():
    """Test cascade performance under high load."""

    # Simulate concurrent mutations
    async def run_mutation(worker_id):
        for i in range(100):
            await execute_mutation_with_cascade(f"mutation_{worker_id}_{i}")

    # Run with multiple workers
    workers = [run_mutation(i) for i in range(10)]
    await asyncio.gather(*workers)

    # Analyze performance metrics
    metrics = performance_monitor.get_metrics()

    assert metrics['average_tracking_time'] < 0.010  # 10ms
    assert metrics['p95_tracking_time'] < 0.025  # 25ms
    assert metrics['error_rate'] < 0.01  # 1%
```

### Stress Testing

```python
def test_large_cascade_performance():
    """Test performance with large entity cascades."""

    # Create mutation that affects many entities
    large_mutation = create_large_cascade_mutation(entity_count=1000)

    start_time = time.perf_counter()
    result = execute_mutation(large_mutation)
    end_time = time.perf_counter()

    execution_time = end_time - start_time

    # Should complete within reasonable time
    assert execution_time < 1.0  # 1 second
    assert len(result.cascade.updated) == 1000
    assert result.cascade.metadata.affected_count == 1000
```

These performance requirements and optimization strategies ensure that GraphQL Cascade implementations scale effectively while maintaining fast response times and low resource usage.