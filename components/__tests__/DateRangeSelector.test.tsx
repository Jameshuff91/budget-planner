import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import DateRangeSelector from '../DateRangeSelector';

describe('DateRangeSelector', () => {
  const mockOnDateRangeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default month range', () => {
    render(<DateRangeSelector onDateRangeChange={mockOnDateRangeChange} />);
    
    expect(screen.getByText(/This Month:/)).toBeInTheDocument();
  });

  it('opens dropdown when clicked', async () => {
    render(<DateRangeSelector onDateRangeChange={mockOnDateRangeChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('This Quarter')).toBeInTheDocument();
      expect(screen.getByText('This Year')).toBeInTheDocument();
      expect(screen.getByText('All Time')).toBeInTheDocument();
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
      expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
      expect(screen.getByText('Custom Range...')).toBeInTheDocument();
    });
  });

  it('selects quarter range', async () => {
    render(<DateRangeSelector onDateRangeChange={mockOnDateRangeChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const quarterOption = await screen.findByText('This Quarter');
    fireEvent.click(quarterOption);
    
    expect(mockOnDateRangeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'This Quarter',
      })
    );
  });

  it('selects last 30 days range', async () => {
    render(<DateRangeSelector onDateRangeChange={mockOnDateRangeChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const last30Days = await screen.findByText('Last 30 Days');
    fireEvent.click(last30Days);
    
    expect(mockOnDateRangeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Last 30 Days',
      })
    );
  });

  it('opens custom range dialog', async () => {
    render(<DateRangeSelector onDateRangeChange={mockOnDateRangeChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const customOption = await screen.findByText('Custom Range...');
    fireEvent.click(customOption);
    
    await waitFor(() => {
      expect(screen.getByText('Select Custom Date Range')).toBeInTheDocument();
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });
  });

  it('applies custom date range', async () => {
    render(<DateRangeSelector onDateRangeChange={mockOnDateRangeChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const customOption = await screen.findByText('Custom Range...');
    fireEvent.click(customOption);
    
    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');
    
    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-31' } });
    
    const applyButton = screen.getByText('Apply');
    fireEvent.click(applyButton);
    
    expect(mockOnDateRangeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Custom Range',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      })
    );
  });

  it('cancels custom range selection', async () => {
    render(<DateRangeSelector onDateRangeChange={mockOnDateRangeChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const customOption = await screen.findByText('Custom Range...');
    fireEvent.click(customOption);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Select Custom Date Range')).not.toBeInTheDocument();
    });
    
    expect(mockOnDateRangeChange).not.toHaveBeenCalled();
  });

  it('disables apply button when dates are not selected', async () => {
    render(<DateRangeSelector onDateRangeChange={mockOnDateRangeChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const customOption = await screen.findByText('Custom Range...');
    fireEvent.click(customOption);
    
    const applyButton = screen.getByText('Apply');
    expect(applyButton).toBeDisabled();
  });

  it('respects default range prop', () => {
    render(<DateRangeSelector onDateRangeChange={mockOnDateRangeChange} defaultRange="year" />);
    
    expect(screen.getByText(/This Year:/)).toBeInTheDocument();
  });
});