import React from 'react';

export const useDBContext = jest.fn(() => ({
  addTransaction: jest.fn(),
  getTransactions: jest.fn(),
  deleteTransaction: jest.fn(),
}));

export const DatabaseProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement('div', null, children);
};
