# Adding data-testid Attributes

To make visual regression tests more reliable, add the following data-testid attributes to components:

## Components to Update

### 1. SpendingByCategory.tsx

```tsx
<Card data-testid="spending-by-category">
```

### 2. SpendingTrend.tsx

```tsx
<Card data-testid="spending-trend">
```

### 3. SpendingOverview.tsx

```tsx
<Card data-testid="spending-overview">
```

### 4. YearOverYearComparison.tsx

```tsx
<Card data-testid="year-over-year-comparison">
```

### 5. SpendingVelocity.tsx

```tsx
<Card data-testid="spending-velocity">
```

### 6. TransactionList.tsx

```tsx
<div data-testid="transaction-list">
```

### 7. MonthSelector.tsx

```tsx
<Select data-testid="month-selector">
```

### 8. PDFUpload.tsx / CSVUpload.tsx

```tsx
<div data-testid="file-upload">
```

### 9. MobileNav.tsx

```tsx
<button data-testid="mobile-menu-toggle">
```

### 10. Dashboard.tsx

```tsx
<div data-testid="dashboard">
  <header data-testid="dashboard-header">
  <aside data-testid="sidebar">
```

### 11. Skeleton Components

```tsx
<div data-testid="chart-skeleton" className="chart-skeleton">
```

These testids will make the visual tests more maintainable and less brittle to DOM structure changes.
