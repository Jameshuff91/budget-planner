# Security Policy

## Overview

Budget Planner is committed to maintaining the security and privacy of user financial data. This document outlines our security policies and procedures.

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please email security@budgetplanner.com with:

1. Description of the vulnerability
2. Steps to reproduce the issue
3. Potential impact
4. Suggested fix (if available)

Please do not disclose security vulnerabilities publicly until we have addressed them.

## Security Measures

### Authentication & Authorization

- **JWT-based authentication** with secure token generation
- **Password requirements**: Minimum 8 characters, must include uppercase, lowercase, numbers, and special characters
- **Bcrypt hashing** with configurable salt rounds (default: 10)
- **Session management** with refresh tokens (30-day expiry)
- **Rate limiting** on authentication endpoints

### Data Protection

- **Encryption in Transit**: TLS 1.2+ for all API communications
- **Encryption at Rest**: Database encryption for sensitive data
- **Access Tokens**: Plaid access tokens encrypted before storage
- **No Data Sharing**: We never sell or share user financial data

### Infrastructure Security

- **Environment Isolation**: Separate development, staging, and production environments
- **Secret Management**: Environment variables for sensitive configuration
- **Dependency Scanning**: Regular npm audit checks
- **Code Reviews**: All code changes reviewed before deployment

### Monitoring & Logging

- **Audit Logging**: All sensitive operations logged with user, action, and timestamp
- **Error Tracking**: Errors logged without exposing sensitive data
- **Access Logs**: HTTP request logging with IP addresses
- **Security Alerts**: Real-time monitoring for suspicious activities

### Compliance

- **PCI DSS**: We do not store credit card information
- **Plaid Security**: Follow Plaid's security best practices
- **GDPR/CCPA**: User data deletion available upon request
- **SOX**: Audit trails for financial data access

## Security Checklist for Developers

- [ ] Never commit secrets or API keys to version control
- [ ] Use parameterized queries to prevent SQL injection
- [ ] Validate and sanitize all user inputs
- [ ] Keep dependencies up to date
- [ ] Test authentication and authorization thoroughly
- [ ] Review code for security vulnerabilities
- [ ] Use HTTPS for all communications
- [ ] Implement proper error handling without exposing internals

## Incident Response Plan

1. **Identification**: Detect and confirm the security incident
2. **Containment**: Isolate affected systems to prevent spread
3. **Investigation**: Determine the scope and impact
4. **Remediation**: Fix vulnerabilities and restore services
5. **Communication**: Notify affected users if required
6. **Review**: Post-incident analysis and improvements

## Regular Security Activities

- **Weekly**: Dependency vulnerability scanning
- **Monthly**: Security log reviews
- **Quarterly**: Access control audits
- **Annually**: Third-party security assessment

## Contact

Security Team: security@budgetplanner.com
Bug Bounty Program: bounty@budgetplanner.com

Last Updated: 2025-07-15