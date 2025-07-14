export const pdfService = {
  processPDF: jest.fn(() =>
    Promise.resolve({
      transactions: [],
      metadata: {},
    }),
  ),
  extractText: jest.fn(),
  validatePDF: jest.fn(),
};
