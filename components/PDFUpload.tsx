'use client';

import { Upload, FileType2, Trash2, RefreshCw, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import Papa from 'papaparse';
import { useState, useEffect } from 'react';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';
import { useDBContext } from '../src/context/DatabaseContext';
import { logger } from '../src/services/logger';
import { pdfService } from '../src/services/pdfService';
import type { PDFDocument } from '../src/services/pdfService';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';

interface CSVTransaction {
  date: Date;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
}

export default function PDFUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<PDFDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPDFs, setSelectedPDFs] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { addTransactionsBatch } = useDBContext();

  useEffect(() => {
    loadUploadedFiles();
  }, []);

  const loadUploadedFiles = async () => {
    try {
      const documents = await pdfService.getPDFDocuments();
      setUploadedFiles(documents);
    } catch (error) {
      logger.error('Error loading PDF documents:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    const pdfFiles = files.filter((file) => file.type === 'application/pdf');
    const csvFiles = files.filter((file) => file.type === 'text/csv' || file.name.endsWith('.csv'));
    const invalidFiles = files.filter(
      (file) =>
        file.type !== 'application/pdf' && file.type !== 'text/csv' && !file.name.endsWith('.csv')
    );

    if (invalidFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: `${invalidFiles.length} file(s) were skipped. Please select only PDF or CSV files.`,
        variant: 'destructive',
      });
      if (pdfFiles.length === 0 && csvFiles.length === 0) return;
    }

    setIsProcessing(true);

    try {
      // Process PDF files
      for (const file of pdfFiles) {
        setProgress((prev) => ({ ...prev, [file.name]: 0 }));
        try {
          const extractedData = await pdfService.processPDF(file, (current, total) => {
            const progress = Math.round((current / total) * 100);
            setProgress((prev) => ({ ...prev, [file.name]: progress }));
          });

          // Process extracted transactions
          const transactionsToAdd = [];
          
          // Collect all valid transactions first
          for (const transaction of extractedData) {
            if (transaction.date && transaction.amount && transaction.description) {
              transactionsToAdd.push({
                date: transaction.date,
                amount: transaction.amount,
                description: transaction.description,
                category: transaction.category || 'Uncategorized',
                type: transaction.type,
                isMonthSummary: transaction.isMonthSummary || false,
                accountNumber: transaction.accountNumber,
              });
            }
          }
          
          // Add all transactions in a single batch to avoid multiple re-renders
          let successCount = 0;
          try {
            await addTransactionsBatch(transactionsToAdd);
            successCount = transactionsToAdd.length;
          } catch (err) {
            logger.error('Error adding transactions batch:', err);
          }

          logger.info(
            `Successfully processed ${successCount} of ${extractedData.length} transactions from ${file.name}`
          );

          // Update UI with success message
          toast({
            title: 'Success',
            description: `Processed ${successCount} of ${extractedData.length} transactions from ${file.name}`,
          });
        } catch (error) {
          logger.error(`Error processing PDF ${file.name}:`, error);
          toast({
            title: 'Error',
            description: `Failed to process ${file.name}. Please check the file format.`,
            variant: 'destructive',
          });
        }
      }

      // Process CSV files
      for (const file of csvFiles) {
        setProgress((prev) => ({ ...prev, [file.name]: 0 }));
        await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            complete: async (results) => {
              try {
                const transactions = results.data.map(
                  (row: any): CSVTransaction => ({
                    date: new Date(row.date),
                    description: row.description,
                    amount: parseFloat(row.amount),
                    category: row.category || 'Uncategorized',
                    type: parseFloat(row.amount) >= 0 ? 'income' : 'expense',
                  })
                );

                const validTransactions = transactions.filter((transaction: CSVTransaction) => 
                  transaction.date && transaction.amount
                );
                
                if (validTransactions.length > 0) {
                  await addTransactionsBatch(validTransactions);
                }

                setProgress((prev) => ({ ...prev, [file.name]: 100 }));
                resolve(null);
              } catch (error) {
                reject(error);
              }
            },
            error: (error) => {
              reject(error);
            },
          });
        });
      }

      toast({
        title: 'Success',
        description: `Successfully processed ${pdfFiles.length + csvFiles.length} file(s)`,
      });

      await loadUploadedFiles();
    } catch (error) {
      logger.error('Error processing files:', error);
      toast({
        title: 'Error',
        description: 'Failed to process files. Please check the file format.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProgress({});
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      await processFiles(files);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await pdfService.deletePDFDocument(id);
      setSelectedPDFs(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      toast({
        title: 'Success',
        description: 'PDF document deleted successfully',
      });
      loadUploadedFiles();
    } catch (error) {
      logger.error('Error deleting PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete PDF document',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const selectedIds = Array.from(selectedPDFs);
      await pdfService.deleteDocuments(selectedIds);
      setSelectedPDFs(new Set());
      toast({
        title: 'Success',
        description: `Successfully deleted ${selectedIds.length} PDF documents`,
      });
      loadUploadedFiles();
    } catch (error) {
      logger.error('Error deleting PDFs:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete PDF documents',
        variant: 'destructive',
      });
    }
  };

  const togglePDFSelection = (id: string) => {
    setSelectedPDFs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAllPDFs = () => {
    if (selectedPDFs.size === uploadedFiles.length) {
      setSelectedPDFs(new Set());
    } else {
      setSelectedPDFs(new Set(uploadedFiles.map(doc => doc.id)));
    }
  };

  const getStatusIcon = (status: PDFDocument['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className='h-5 w-5 text-green-500' />;
      case 'error':
        return <XCircle className='h-5 w-5 text-red-500' />;
      case 'processing':
        return <RefreshCw className='h-5 w-5 text-blue-500 animate-spin' />;
      default:
        return <FileType2 className='h-5 w-5 text-gray-500' />;
    }
  };

  return (
    <div className='mb-8 bg-white rounded-lg shadow-md p-6'>
      <h2 className='text-2xl font-semibold mb-4 text-blue-600'>Upload Financial Information</h2>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          isDragging ? 'border-primary bg-primary/10' : 'border-gray-300'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className='flex flex-col items-center gap-4'>
          <Upload className='h-12 w-12 text-gray-400' />
          <div>
            <h3 className='text-lg font-semibold'>Upload PDF or CSV Files</h3>
            <p className='text-sm text-gray-500'>
              Drag and drop your PDF or CSV files here or click to browse
            </p>
          </div>
          <Input
            type='file'
            accept='.pdf,.csv'
            onChange={handleFileChange}
            className='hidden'
            id='file-upload'
            multiple
          />
          <Button asChild variant='secondary' className='mt-2'>
            <label htmlFor='file-upload' className='cursor-pointer'>
              Choose Files
            </label>
          </Button>
        </div>
      </div>

      {isProcessing && Object.keys(progress).length > 0 && (
        <div className='mt-4 space-y-2'>
          <h4 className='font-semibold'>Processing Files:</h4>
          {Object.entries(progress).map(([fileName, percentage]) => (
            <div key={fileName} className='flex items-center gap-2'>
              <FileType2 className='h-4 w-4' />
              <span className='text-sm flex-1'>{fileName}</span>
              <span className='text-sm text-gray-500'>{percentage}%</span>
              <div className='w-24 h-1 bg-gray-200 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-primary transition-all duration-300'
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files List */}
      <Collapsible className="mt-4">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full flex justify-between items-center">
            <span>Show Financial Statements ({uploadedFiles.length})</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-2">
          {uploadedFiles.length > 0 && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedPDFs.size === uploadedFiles.length}
                  onChange={toggleAllPDFs}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">Select All</span>
              </div>
              {selectedPDFs.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Selected ({selectedPDFs.size})
                </Button>
              )}
            </div>
          )}
          {uploadedFiles.map((doc) => (
            <div key={doc.id} className='flex items-center justify-between p-3 bg-gray-50 rounded-md'>
              <div className='flex items-center gap-2'>
                <input
                  type="checkbox"
                  checked={selectedPDFs.has(doc.id)}
                  onChange={() => togglePDFSelection(doc.id)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                {getStatusIcon(doc.status)}
                <span className='text-sm font-medium'>{doc.name}</span>
                {doc.transactionCount && (
                  <span className='text-xs text-gray-500'>({doc.transactionCount} transactions)</span>
                )}
              </div>
              <div className='flex items-center gap-2'>
                {doc.error && <span className='text-xs text-red-500'>{doc.error}</span>}
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => handleDelete(doc.id)}
                  className='text-red-500 hover:text-red-700'
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
