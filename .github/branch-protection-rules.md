# Branch Protection Rules Documentation

This document outlines the recommended branch protection rules for the Budget Planner repository. These rules should be configured in GitHub Settings → Branches.

## Main/Master Branch Protection

### Basic Settings

- **Require a pull request before merging**
  - ✅ Require approvals: 1
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from CODEOWNERS
  - ✅ Require approval of the most recent reviewable push

- **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Required status checks:
    - `unit-tests` (Node 18)
    - `unit-tests` (Node 20)
    - `e2e-tests` (chromium)
    - `e2e-tests` (firefox)
    - `e2e-tests` (webkit)
    - `code-quality`
    - `performance-budget`
    - `build`

- **Require conversation resolution before merging**
  - ✅ All conversations must be resolved

- **Require signed commits**
  - ✅ All commits must be signed with GPG

- **Require linear history**
  - ✅ Prevent merge commits (squash and rebase only)

- **Include administrators**
  - ❌ Do not include administrators (they should follow the same rules)

- **Restrict who can push to matching branches**
  - ✅ Restrict pushes that create matching branches
  - Allowed users/teams: [Configure based on your team]

### Additional Settings

- **Allow force pushes**
  - ❌ Everyone
  - ✅ Specify who can force push: Administrators only
  - ✅ Allow specified actors to pull request

- **Allow deletions**
  - ❌ Do not allow branch deletion

- **Lock branch**
  - ❌ Do not lock (keep it editable through PRs)

- **Restrict pushes that create matching files**
  - Protected paths:
    - `.github/workflows/*`
    - `package.json`
    - `package-lock.json`
    - `*.config.*`
    - `.env*`

## Development Branch Protection (if applicable)

### Basic Settings

- **Require a pull request before merging**
  - ✅ Require approvals: 1
  - ❌ Dismiss stale pull request approvals when new commits are pushed
  - ❌ Require review from CODEOWNERS

- **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Required status checks:
    - `unit-tests` (at least one Node version)
    - `code-quality`

## Feature Branch Naming Convention

Enforce branch naming patterns:

- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes
- `chore/*` - Maintenance tasks
- `docs/*` - Documentation updates
- `test/*` - Test additions/updates
- `refactor/*` - Code refactoring

## Pull Request Rules

### PR Template

Create `.github/pull_request_template.md`:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing

- [ ] Unit tests pass locally
- [ ] E2E tests pass locally
- [ ] Added new tests for new functionality
- [ ] Manually tested the changes

## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] Any dependent changes have been merged and published
```

## Automated Enforcement

### GitHub Apps to Install

1. **Codecov** - For coverage reports
2. **Dependabot** - For dependency updates
3. **GitHub Actions** - For CI/CD
4. **Semantic Pull Requests** - Enforce conventional commit messages

### Required Webhooks

Configure webhooks for:

- Deployment services (Vercel, Netlify)
- Code quality tools (SonarCloud, CodeClimate)
- Project management tools (Jira, Linear)

## Security Policies

### Secret Scanning

- ✅ Enable secret scanning
- ✅ Push protection for secrets

### Dependabot Security Updates

- ✅ Enable Dependabot security updates
- ✅ Automatically open PRs for vulnerabilities

### Code Scanning

- ✅ Enable CodeQL analysis
- ✅ Schedule: Weekly

## Merge Strategies

### Allowed Merge Methods

- ✅ Squash and merge (recommended for feature branches)
- ✅ Rebase and merge (for clean history)
- ❌ Create a merge commit (disabled to maintain linear history)

### Automatic Deletion

- ✅ Automatically delete head branches after merge

## Implementation Checklist

- [ ] Configure main/master branch protection
- [ ] Set up required status checks
- [ ] Configure CODEOWNERS file
- [ ] Enable security features
- [ ] Set up branch naming rules
- [ ] Configure PR templates
- [ ] Install required GitHub Apps
- [ ] Train team on new workflow
- [ ] Document exceptions process
- [ ] Set up monitoring and alerts
