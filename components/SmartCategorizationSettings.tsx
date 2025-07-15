'use client';

import { Brain, Settings, AlertCircle, Check, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { createLLMService } from '@services/llmService';

import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { toast } from './ui/use-toast';

export default function SmartCategorizationSettings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [model, setModel] = useState('gpt-4o-mini');

  useEffect(() => {
    // Load settings from localStorage or environment
    const savedEnabled = localStorage.getItem('smartCategorization.enabled') === 'true';
    const envApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const savedApiKey = localStorage.getItem('smartCategorization.apiKey') || '';
    const savedModel = localStorage.getItem('smartCategorization.model') || 'gpt-4o-mini';

    setIsEnabled(savedEnabled);
    // Use environment variable if available, otherwise use saved key
    setApiKey(envApiKey || savedApiKey);
    setModel(savedModel);
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('smartCategorization.enabled', isEnabled.toString());
    localStorage.setItem('smartCategorization.apiKey', apiKey);
    localStorage.setItem('smartCategorization.model', model);

    toast({
      title: 'Settings Saved',
      description: 'Smart categorization settings have been updated.',
    });
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your OpenAI API key first.',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingConnection(true);
    try {
      const llmService = createLLMService(apiKey);
      if (!llmService) {
        throw new Error('Failed to create LLM service');
      }

      // Test with a sample transaction
      const result = await llmService.categorizeTransaction({
        description: 'Test transaction - Grocery Store',
        amount: -50,
        date: new Date().toISOString(),
      });

      if (result.category) {
        toast({
          title: 'Connection Successful',
          description: `Test categorization: "${result.category}" (${(result.confidence * 100).toFixed(0)}% confidence)`,
        });
      }
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to OpenAI API. Please check your API key.',
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Brain className='h-5 w-5' />
          Smart Categorization (AI-Powered)
        </CardTitle>
        <CardDescription>
          Use OpenAI to automatically categorize your transactions with high accuracy
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Smart categorization uses OpenAI&apos;s API to analyze transaction descriptions.
            You&apos;ll need an OpenAI API key to enable this feature.
          </AlertDescription>
        </Alert>

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='smart-categorization'>Enable Smart Categorization</Label>
              <p className='text-sm text-muted-foreground'>
                Automatically categorize new transactions using AI
              </p>
            </div>
            <Switch id='smart-categorization' checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          {isEnabled && (
            <>
              <div className='space-y-2'>
                <Label htmlFor='api-key'>OpenAI API Key</Label>
                <div className='flex gap-2'>
                  <Input
                    id='api-key'
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder='sk-...'
                    className='font-mono'
                  />
                  <Button variant='outline' size='sm' onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <X className='h-4 w-4' /> : <Check className='h-4 w-4' />}
                  </Button>
                </div>
                <p className='text-xs text-muted-foreground'>
                  {process.env.NEXT_PUBLIC_OPENAI_API_KEY ? (
                    <span className='text-green-600'>✓ Using API key from environment variable</span>
                  ) : (
                    <>
                      Get your API key from{' '}
                      <a
                        href='https://platform.openai.com/api-keys'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='underline'
                      >
                        OpenAI Platform
                      </a>
                    </>
                  )}
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='model'>Model</Label>
                <select
                  id='model'
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                >
                  <option value='gpt-4o-mini'>GPT-4o Mini (Fastest & Cheapest - Recommended)</option>
                  <option value='gpt-4o'>GPT-4o (Best Performance)</option>
                  <option value='gpt-4-turbo'>GPT-4 Turbo (Legacy)</option>
                  <option value='gpt-3.5-turbo'>GPT-3.5 Turbo (Legacy)</option>
                </select>
                <p className='text-xs text-muted-foreground'>
                  GPT-4o Mini is recommended - 60% cheaper than GPT-3.5 Turbo with better performance
                </p>
              </div>

              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !apiKey}
                >
                  {isTestingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button onClick={handleSaveSettings}>Save Settings</Button>
              </div>
            </>
          )}
        </div>

        <div className='pt-4 border-t'>
          <h4 className='text-sm font-medium mb-2'>How it works:</h4>
          <ul className='text-sm text-muted-foreground space-y-1'>
            <li>• AI analyzes transaction descriptions to determine the best category</li>
            <li>• Works with your existing categories or suggests new ones</li>
            <li>• Learns from patterns in your transaction history</li>
            <li>• Provides confidence scores for each categorization</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
