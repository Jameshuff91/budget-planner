import { logger } from '@services/logger';

import { CategoryRule } from '../../components/CategoryRules';

export function applyCategoryRules(description: string, rules: CategoryRule[]): string | null {
  // Sort rules by priority (highest first) and filter enabled ones
  const activeRules = rules.filter((rule) => rule.enabled).sort((a, b) => b.priority - a.priority);

  for (const rule of activeRules) {
    if (testRule(rule, description)) {
      logger.info(
        `Category rule matched: "${description}" → ${rule.category} (rule: ${rule.pattern})`,
      );
      return rule.category;
    }
  }

  return null;
}

function testRule(rule: CategoryRule, testString: string): boolean {
  const pattern = rule.pattern.toLowerCase();
  const text = testString.toLowerCase();

  switch (rule.matchType) {
    case 'contains':
      return text.includes(pattern);
    case 'startsWith':
      return text.startsWith(pattern);
    case 'endsWith':
      return text.endsWith(pattern);
    case 'regex':
      try {
        const regex = new RegExp(rule.pattern, 'i');
        return regex.test(testString);
      } catch (error) {
        logger.error(`Invalid regex pattern: ${rule.pattern}`, error);
        return false;
      }
    default:
      return false;
  }
}

export function loadCategoryRules(): CategoryRule[] {
  if (typeof window === 'undefined') return [];

  const saved = localStorage.getItem('budget.categoryRules');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      logger.error('Failed to parse category rules', error);
      return [];
    }
  }

  return [];
}
