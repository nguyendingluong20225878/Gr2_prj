/**
 * API Client Service
 * Axios-based HTTP client with interceptors for authentication and error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { API_CONFIG } from '../config/api.config';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    // Create axios instance với base config
    this.client = axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // ==========================================
    // REQUEST INTERCEPTOR
    // ==========================================
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication token
        const walletAddress = localStorage.getItem('ndl_wallet_address');
        
        if (walletAddress) {
          config.headers.Authorization = `Bearer ${walletAddress}`;
        }

        // Log request (development only)
        if (import.meta.env.DEV) {
          console.log('🚀 API Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            data: config.data,
          });
        }

        return config;
      },
      (error) => {
        console.error('❌ Request Setup Error:', error);
        return Promise.reject(error);
      }
    );

    // ==========================================
    // RESPONSE INTERCEPTOR
    // ==========================================
    this.client.interceptors.response.use(
      (response) => {
        // Log successful response (development only)
        if (import.meta.env.DEV) {
          console.log('✅ API Response:', {
            url: response.config.url,
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      (error: AxiosError) => {
        // Handle different error scenarios
        if (error.response) {
          // Server responded with error status
          const status = error.response.status;
          
          switch (status) {
            case 401:
              // Unauthorized - User not authenticated
              console.error('🔒 Unauthorized - Please reconnect wallet');
              // TODO: Trigger wallet reconnection
              // window.location.href = '/';
              break;
              
            case 403:
              // Forbidden - User doesn't have permission
              console.error('🚫 Forbidden - Access denied');
              break;
              
            case 404:
              // Resource not found
              console.error('🔍 Not Found:', error.config?.url);
              break;
              
            case 500:
              // Internal server error
              console.error('💥 Server Error - Please try again later');
              break;
              
            default:
              console.error(`❌ API Error (${status}):`, error.response.data);
          }
        } else if (error.request) {
          // Request made but no response received
          console.error('📡 Network Error - No response from server');
          console.error('Check if backend is running at:', API_CONFIG.baseURL);
        } else {
          // Something else happened
          console.error('⚠️ Request Error:', error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  // ==========================================
  // HTTP METHODS
  // ==========================================

  /**
   * GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
