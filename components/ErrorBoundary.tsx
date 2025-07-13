'use client';

import { AlertCircle } from 'lucide-react';
import React, { Component, ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className='min-h-[400px] flex items-center justify-center p-4'>
          <Alert variant='destructive' className='max-w-2xl'>
            <AlertCircle className='h-4 w-4' />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className='mt-2'>
              <p className='mb-2'>{this.state.error?.message || 'An unexpected error occurred'}</p>
              {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
                <details className='mt-4'>
                  <summary className='cursor-pointer text-sm font-medium'>Error details</summary>
                  <pre className='mt-2 text-xs overflow-auto bg-gray-100 p-2 rounded'>
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              <Button onClick={this.handleReset} variant='outline' size='sm' className='mt-4'>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
