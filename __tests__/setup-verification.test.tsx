import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';

describe('React Testing Library Setup Verification', () => {
  test('should render a simple component', () => {
    render(<div>Hello Testing World</div>);

    expect(screen.getByText('Hello Testing World')).toBeInTheDocument();
  });

  test('should work with test-ids', () => {
    render(<div data-testid='test-element'>Test Content</div>);

    expect(screen.getByTestId('test-element')).toBeInTheDocument();
    expect(screen.getByTestId('test-element')).toHaveTextContent('Test Content');
  });

  test('should work with role queries', () => {
    render(<button type='button'>Click Me</button>);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('Click Me');
  });
});
