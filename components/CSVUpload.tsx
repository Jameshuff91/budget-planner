import Papa from 'papaparse';
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { useDBContext } from '@context/DatabaseContext';
import { logger } from '@services/logger';

const CSVUpload: React.FC = () => {
  const { addTransaction } = useDBContext();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        const file = acceptedFiles[0];
        if (!file) return;

        Papa.parse(file, {
          complete: (results) => {
            const transactions = results.data.slice(1).map((row: any) => ({
              date: row[0],
              description: row[1],
              amount: parseFloat(row[2]),
              category: row[3] || 'Uncategorized',
            }));

            transactions.forEach((transaction: any) => {
              if (transaction.date && transaction.amount) {
                addTransaction(transaction);
              }
            });
          },
          header: true,
          error: (error) => {
            logger.error('Error parsing CSV:', error);
          },
        });
      } catch (error) {
        logger.error('Error processing CSV file:', error);
      }
    },
    [addTransaction]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className='border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors'
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the CSV file here...</p>
      ) : (
        <p>Drag and drop a CSV file here, or click to select one</p>
      )}
    </div>
  );
};

export default CSVUpload;
