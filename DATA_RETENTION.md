# Data Retention Policy

Last Updated: 2025-07-15

## Purpose

This policy defines how Budget Planner retains, archives, and deletes user data to ensure compliance with legal requirements and respect user privacy.

## Data Categories and Retention Periods

### 1. User Account Data

- **Data**: Email, password hash, profile information
- **Retention**: Active account lifetime + 30 days after deletion
- **Reason**: Account recovery and security investigations

### 2. Financial Transaction Data

- **Data**: Bank transactions, manual entries, categories
- **Retention**: 7 years from transaction date
- **Reason**: Financial record-keeping requirements, tax purposes

### 3. Authentication Logs

- **Data**: Login attempts, password changes, session data
- **Retention**: 90 days
- **Reason**: Security monitoring and incident investigation

### 4. Audit Logs

- **Data**: User actions, API calls, data access logs
- **Retention**: 1 year
- **Reason**: Security compliance and forensic analysis

### 5. Plaid Connection Data

- **Data**: Access tokens, item IDs, institution information
- **Retention**: Until user disconnects bank or deletes account
- **Reason**: Maintain bank connection functionality

### 6. Support Communications

- **Data**: Email exchanges, support tickets
- **Retention**: 2 years after issue resolution
- **Reason**: Service improvement and dispute resolution

## Data Deletion Procedures

### User-Initiated Deletion

1. User requests account deletion via settings or email
2. Account marked for deletion immediately
3. Data anonymized within 24 hours
4. Complete deletion after 30-day grace period
5. Confirmation email sent to user

### Automatic Deletion

- Inactive accounts (no login for 2 years): Notified then deleted after 30 days
- Expired sessions: Deleted after expiration
- Temporary data: Deleted after 7 days

### Exceptions to Deletion

Data may be retained beyond standard periods for:

- Legal holds or investigations
- Regulatory compliance requirements
- Anonymized analytics (with PII removed)

## Data Archival

### Archive Criteria

- Financial data older than 1 year moved to archive storage
- Archived data encrypted and access-restricted
- Archives maintained for full retention period

### Archive Access

- Users can request archived data via support
- Access logged and monitored
- Retrieved within 5 business days

## Compliance

This policy complies with:

- **GDPR**: Right to erasure (Article 17)
- **CCPA**: Consumer deletion rights
- **Financial Regulations**: 7-year transaction retention
- **Plaid Requirements**: Secure token management

## Implementation

### Technical Controls

```javascript
// Example: Automated deletion job
async function deleteExpiredData() {
  // Delete old auth logs
  await db.run(`
    DELETE FROM audit_logs 
    WHERE created_at < datetime('now', '-90 days')
  `);

  // Archive old transactions
  await db.run(`
    INSERT INTO archived_transactions 
    SELECT * FROM transactions 
    WHERE date < datetime('now', '-1 year')
  `);

  // Delete inactive sessions
  await db.run(`
    DELETE FROM sessions 
    WHERE expires_at < datetime('now')
  `);
}
```

### Administrative Controls

- Quarterly retention policy review
- Annual compliance audit
- Staff training on data handling
- Documented deletion procedures

## User Rights

Users can:

1. Request their data retention status
2. Request early deletion (where legally permitted)
3. Object to extended retention
4. Export their data before deletion

## Backup and Recovery

- Backups follow same retention periods
- Deleted data removed from backups within 30 days
- Disaster recovery copies synchronized with production

## Policy Updates

This policy is reviewed annually and updated as needed for:

- Regulatory changes
- Business requirements
- User feedback
- Security improvements

## Contact

For questions about data retention:

- Email: privacy@budgetplanner.com
- Include "Data Retention" in subject line

## Appendix: Retention Schedule Summary

| Data Type    | Retention Period    | Deletion Method       |
| ------------ | ------------------- | --------------------- |
| Account Data | Active + 30 days    | Hard delete           |
| Transactions | 7 years             | Archive then delete   |
| Auth Logs    | 90 days             | Automated purge       |
| Audit Logs   | 1 year              | Automated purge       |
| Plaid Tokens | Until disconnected  | Secure wipe           |
| Backups      | Same as source data | Synchronized deletion |
