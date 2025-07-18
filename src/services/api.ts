// API service for backend communication

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  errors?: Array<{ msg: string }>;
}

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Load tokens from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Add auth header if token exists
      if (this.accessToken) {
        (headers as any)['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401 && data.error === 'Token expired') {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry the request with new token
            return this.request(endpoint, options);
          }
        }
        return { error: data.error || 'Request failed', errors: data.errors };
      }

      return { data };
    } catch (error) {
      console.error('API request error:', error);
      return { error: 'Network error' };
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.accessToken, this.refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
    }

    // Clear tokens if refresh fails
    this.clearTokens();
    return false;
  }

  private setTokens(accessToken: string, refreshToken: string | null) {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }

    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
    }
  }

  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  // Auth endpoints
  async register(email: string, password: string) {
    const response = await this.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: number; email: string };
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }

    return response;
  }

  async login(email: string, password: string) {
    const response = await this.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: number; email: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }

    return response;
  }

  async logout() {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    this.clearTokens();
  }

  // Plaid endpoints
  async createLinkToken() {
    return this.request<{
      link_token: string;
      expiration: string;
    }>('/plaid/link/token', {
      method: 'POST',
    });
  }

  async exchangePublicToken(publicToken: string) {
    return this.request<{
      success: boolean;
      item_id: string;
      institution_name: string;
    }>('/plaid/link/exchange', {
      method: 'POST',
      body: JSON.stringify({ public_token: publicToken }),
    });
  }

  async getAccounts() {
    return this.request<{
      accounts: Array<{
        item_id: string;
        institution_name: string;
        accounts: Array<any>;
      }>;
    }>('/plaid/accounts');
  }

  async syncTransactions(startDate?: string, endDate?: string) {
    return this.request<{
      success: boolean;
      synced: Array<{
        item_id: string;
        institution_name: string;
        transaction_count: number;
      }>;
      errors?: Array<{ item_id: string; error: string }>;
    }>('/plaid/transactions/sync', {
      method: 'POST',
      body: JSON.stringify({ start_date: startDate, end_date: endDate }),
    });
  }

  async removeBank(itemId: string) {
    return this.request(`/plaid/item/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Transaction endpoints
  async getTransactions(params?: {
    page?: number;
    limit?: number;
    start_date?: string;
    end_date?: string;
    category?: string;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return this.request<{
      transactions: Array<any>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/transactions?${queryParams.toString()}`);
  }

  async createTransaction(transaction: {
    amount: number;
    date: string;
    name: string;
    merchant_name?: string;
    category: string;
    subcategory?: string;
    type?: 'income' | 'expense';
  }) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });
  }

  async updateTransaction(
    id: string,
    updates: Partial<{
      amount: number;
      date: string;
      name: string;
      merchant_name: string;
      category: string;
      subcategory: string;
    }>,
  ) {
    return this.request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTransaction(id: string) {
    return this.request(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  async getSpendingAnalytics(startDate?: string, endDate?: string) {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('start_date', startDate);
    if (endDate) queryParams.append('end_date', endDate);

    return this.request<{
      byCategory: Array<{
        category: string;
        transaction_count: number;
        total_spent: number;
        avg_transaction: number;
      }>;
      byMonth: Array<{
        month: string;
        expenses: number;
        income: number;
      }>;
    }>(`/transactions/analytics/spending?${queryParams.toString()}`);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // Get current user from token
  getCurrentUser(): { id: number; email: string } | null {
    if (!this.accessToken) return null;

    try {
      // Decode JWT without verification (verification happens on backend)
      const parts = this.accessToken.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return { id: payload.id, email: payload.email };
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
