import React from 'react';

import { Card } from '@components/ui/card';

const SpendingByCategory = () => {
  return (
    <div data-testid='pie-chart'>
      <div>Food</div>
      <div>Rent</div>
      <div>Transport</div>
    </div>
  );
};

export default SpendingByCategory;
