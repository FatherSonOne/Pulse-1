# Database Backup & Recovery Strategy

## Overview

Comprehensive database backup and disaster recovery strategy for Pulse Messages using Supabase PostgreSQL.

## Backup Strategy

### 3-2-1 Backup Rule
- **3** copies of data (production + 2 backups)
- **2** different storage types (Supabase + external)
- **1** off-site backup (AWS S3 / cloud storage)

---

## Automated Backup Schedule

### Daily Backups (Supabase Automatic)
- **Frequency**: Every 24 hours
- **Retention**: 7 days
- **Storage**: Supabase managed storage
- **Time**: 2:00 AM UTC (lowest traffic period)

### Weekly Backups (Full)
- **Frequency**: Every Sunday at 1:00 AM UTC
- **Retention**: 4 weeks
- **Storage**: AWS S3
- **Includes**: Full database dump + schemas

### Monthly Backups (Archive)
- **Frequency**: First day of month
- **Retention**: 12 months
- **Storage**: AWS S3 Glacier (cold storage)
- **Includes**: Full database + attachments

### Pre-Deployment Backups
- **Trigger**: Before each production deployment
- **Retention**: 30 days
- **Storage**: AWS S3
- **Purpose**: Rollback capability

---

## Backup Types

### 1. Full Database Backup

Complete backup of entire database including schemas, data, and configurations.

```bash
#!/bin/bash
# Full database backup script

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="pulse_messages_full_${TIMESTAMP}.sql"
S3_BUCKET="pulse-backups"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp ${BACKUP_FILE}.gz s3://${S3_BUCKET}/full/${BACKUP_FILE}.gz

# Verify upload
aws s3 ls s3://${S3_BUCKET}/full/${BACKUP_FILE}.gz

echo "Full backup completed: ${BACKUP_FILE}.gz"
```

### 2. Incremental Backup

Backup only changes since last backup (for large databases).

```bash
#!/bin/bash
# Incremental backup using WAL (Write-Ahead Logging)

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/incremental/${TIMESTAMP}"

# Create base backup if first run
if [ ! -f /backups/last_backup_timestamp ]; then
    pg_basebackup -D $BACKUP_DIR -F tar -z -P
    echo $TIMESTAMP > /backups/last_backup_timestamp
fi

# Archive WAL files
pg_receivewal -D /backups/wal_archive --compress=9

# Upload to S3
aws s3 sync /backups/wal_archive s3://${S3_BUCKET}/incremental/

echo "Incremental backup completed"
```

### 3. Schema-Only Backup

Backup database structure without data (for version control).

```bash
#!/bin/bash
# Schema-only backup

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SCHEMA_FILE="schema_${TIMESTAMP}.sql"

# Dump schema only
pg_dump $DATABASE_URL --schema-only > $SCHEMA_FILE

# Commit to git
git add $SCHEMA_FILE
git commit -m "Schema backup: ${TIMESTAMP}"
git push origin main

echo "Schema backup completed: ${SCHEMA_FILE}"
```

### 4. Table-Specific Backup

Backup critical tables separately for faster recovery.

```bash
#!/bin/bash
# Critical tables backup

CRITICAL_TABLES=("users" "messages" "conversations" "workspaces")

for TABLE in "${CRITICAL_TABLES[@]}"; do
    pg_dump $DATABASE_URL -t $TABLE > "backup_${TABLE}_$(date +%Y%m%d).sql"
done

echo "Critical tables backup completed"
```

---

## Backup Automation

### GitHub Actions Workflow

```yaml
# .github/workflows/database-backup.yml
name: Database Backup

on:
  schedule:
    # Daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client

      - name: Create database backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          TIMESTAMP=$(date +%Y%m%d_%H%M%S)
          pg_dump $DATABASE_URL | gzip > backup_${TIMESTAMP}.sql.gz

      - name: Upload to AWS S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws s3 cp backup_*.sql.gz s3://pulse-backups/daily/

      - name: Verify backup
        run: |
          aws s3 ls s3://pulse-backups/daily/ | tail -5

      - name: Cleanup old backups
        run: |
          # Keep only last 7 daily backups
          aws s3 ls s3://pulse-backups/daily/ | \
            sort -r | tail -n +8 | awk '{print $4}' | \
            xargs -I {} aws s3 rm s3://pulse-backups/daily/{}
```

---

## Recovery Procedures

### Full Database Restore

```bash
#!/bin/bash
# Full database restoration

BACKUP_FILE="pulse_messages_full_20250119_020000.sql.gz"
S3_BUCKET="pulse-backups"

# Step 1: Download backup from S3
aws s3 cp s3://${S3_BUCKET}/full/${BACKUP_FILE} ./

# Step 2: Decompress backup
gunzip ${BACKUP_FILE}

# Step 3: Restore database
psql $DATABASE_URL < ${BACKUP_FILE%.gz}

# Step 4: Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM messages;"

echo "Database restoration completed"
```

### Point-in-Time Recovery (PITR)

```bash
#!/bin/bash
# Restore database to specific point in time

TARGET_TIME="2025-01-19 14:30:00"
BASE_BACKUP="pulse_messages_base_20250119_020000.tar.gz"

# Step 1: Restore base backup
tar -xzf $BASE_BACKUP -C /var/lib/postgresql/data

# Step 2: Configure recovery
cat > /var/lib/postgresql/data/recovery.conf <<EOF
restore_command = 'cp /backups/wal_archive/%f %p'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'promote'
EOF

# Step 3: Start PostgreSQL
pg_ctl start

# Step 4: Verify recovery
psql $DATABASE_URL -c "SELECT NOW();"

echo "Point-in-time recovery completed"
```

### Table-Specific Restore

```bash
#!/bin/bash
# Restore single table without affecting others

TABLE_NAME="messages"
BACKUP_FILE="backup_messages_20250119.sql"

# Step 1: Backup current table (safety)
pg_dump $DATABASE_URL -t $TABLE_NAME > ${TABLE_NAME}_before_restore.sql

# Step 2: Drop and restore table
psql $DATABASE_URL <<EOF
DROP TABLE IF EXISTS ${TABLE_NAME} CASCADE;
\i $BACKUP_FILE
EOF

# Step 3: Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM ${TABLE_NAME};"

echo "Table ${TABLE_NAME} restored successfully"
```

---

## Backup Verification

### Automated Backup Testing

```bash
#!/bin/bash
# Test backup integrity

BACKUP_FILE="$1"
TEST_DATABASE="pulse_test_restore"

# Create test database
createdb $TEST_DATABASE

# Restore to test database
gunzip -c $BACKUP_FILE | psql $TEST_DATABASE

# Run verification queries
psql $TEST_DATABASE <<EOF
-- Check table counts
SELECT
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Check data integrity
SELECT
    COUNT(*) as total_users,
    COUNT(DISTINCT id) as unique_users
FROM users;

-- Check recent data
SELECT MAX(created_at) as latest_message
FROM messages;
EOF

# Cleanup
dropdb $TEST_DATABASE

echo "Backup verification completed"
```

### Monthly Backup Audit

```bash
#!/bin/bash
# Monthly backup audit

echo "=== Backup Audit Report ==="
echo "Date: $(date)"
echo ""

# Check S3 backups
echo "Daily Backups:"
aws s3 ls s3://pulse-backups/daily/ | wc -l

echo "Weekly Backups:"
aws s3 ls s3://pulse-backups/weekly/ | wc -l

echo "Monthly Backups:"
aws s3 ls s3://pulse-backups/monthly/ | wc -l

# Verify latest backup
echo ""
echo "Latest Backup:"
aws s3 ls s3://pulse-backups/daily/ | sort | tail -1

# Test restore (sample)
echo ""
echo "Testing latest backup restore..."
./test_backup_restore.sh $(aws s3 ls s3://pulse-backups/daily/ | sort | tail -1 | awk '{print $4}')
```

---

## Disaster Recovery Plan

### Recovery Time Objective (RTO)
- **Critical systems**: < 1 hour
- **Full system**: < 4 hours
- **Complete recovery**: < 24 hours

### Recovery Point Objective (RPO)
- **Maximum data loss**: < 24 hours
- **Target data loss**: < 1 hour (via WAL archiving)

### DR Scenario 1: Database Corruption

```bash
# Immediate Actions:
1. Stop application traffic
2. Identify corruption extent
3. Restore from last known good backup
4. Verify data integrity
5. Resume traffic

# Estimated Recovery: 30-60 minutes
```

### DR Scenario 2: Complete Data Loss

```bash
# Immediate Actions:
1. Notify incident response team
2. Provision new database instance
3. Restore from most recent full backup
4. Apply incremental backups (WAL)
5. Verify data integrity
6. Update DNS/connection strings
7. Resume operations

# Estimated Recovery: 2-4 hours
```

### DR Scenario 3: Regional Outage

```bash
# Immediate Actions:
1. Activate secondary region
2. Update DNS to failover region
3. Restore database in new region
4. Verify cross-region replication
5. Monitor for issues

# Estimated Recovery: 1-2 hours
```

---

## Backup Monitoring

### Backup Health Checks

```bash
#!/bin/bash
# Check backup health

# Verify daily backup exists
TODAY=$(date +%Y%m%d)
BACKUP_COUNT=$(aws s3 ls s3://pulse-backups/daily/ | grep $TODAY | wc -l)

if [ $BACKUP_COUNT -eq 0 ]; then
    echo "ALERT: No backup found for today!"
    # Send alert to on-call
    curl -X POST $SLACK_WEBHOOK \
        -H 'Content-Type: application/json' \
        -d '{"text":"❌ Database backup failed for '$TODAY'"}'
    exit 1
fi

# Check backup size (should be within expected range)
BACKUP_SIZE=$(aws s3 ls s3://pulse-backups/daily/ | grep $TODAY | awk '{print $3}')
MIN_SIZE=1000000  # 1MB minimum
MAX_SIZE=10000000000  # 10GB maximum

if [ $BACKUP_SIZE -lt $MIN_SIZE ] || [ $BACKUP_SIZE -gt $MAX_SIZE ]; then
    echo "WARNING: Backup size anomaly detected: ${BACKUP_SIZE} bytes"
fi

echo "Backup health check passed"
```

### Backup Alerts

Configure alerts for:
- ❌ **Backup failure**
- ⚠️ **Backup size anomaly** (too small/large)
- ⏰ **Backup delay** (> 1 hour late)
- 📊 **Storage capacity warning** (> 80% full)
- 🔍 **Verification failure**

---

## Backup Retention Policy

| Backup Type | Retention | Storage | Cost |
|-------------|-----------|---------|------|
| Daily | 7 days | S3 Standard | $ |
| Weekly | 4 weeks | S3 Standard | $$ |
| Monthly | 12 months | S3 Glacier | $ |
| Yearly | 7 years | S3 Deep Glacier | $ |

### Cleanup Script

```bash
#!/bin/bash
# Cleanup old backups per retention policy

# Daily: Keep 7 days
aws s3 ls s3://pulse-backups/daily/ | \
    awk '{print $4}' | sort -r | tail -n +8 | \
    xargs -I {} aws s3 rm s3://pulse-backups/daily/{}

# Weekly: Keep 4 weeks
aws s3 ls s3://pulse-backups/weekly/ | \
    awk '{print $4}' | sort -r | tail -n +5 | \
    xargs -I {} aws s3 rm s3://pulse-backups/weekly/{}

# Monthly: Move to Glacier after 1 month
# (Handled automatically by S3 lifecycle policies)

echo "Cleanup completed"
```

---

## Security & Compliance

### Backup Encryption
- **At rest**: AES-256 encryption (S3)
- **In transit**: TLS 1.3
- **Key management**: AWS KMS

### Access Control
- Backups accessible only to:
  - DevOps team
  - Database administrators
  - On-call engineers (during incidents)

### Compliance
- **GDPR**: 30-day deletion after user request
- **SOC 2**: Encrypted backups with audit logging
- **HIPAA**: (if applicable) BAA with backup provider

---

## Testing Schedule

| Test Type | Frequency | Duration |
|-----------|-----------|----------|
| Backup verification | Daily | 5 min |
| Restore drill | Weekly | 30 min |
| Full DR simulation | Monthly | 2 hours |
| Multi-region failover | Quarterly | 4 hours |

---

## Additional Resources

- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
- [Incident Response](./INCIDENT_RESPONSE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Supabase Backup Docs](https://supabase.com/docs/guides/platform/backups)

---

**Last Updated**: 2025-01-19
**Document Owner**: DevOps Team
**Review Frequency**: Quarterly
