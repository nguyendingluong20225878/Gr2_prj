/**
 * API Client Service
 * Axios-based HTTP client with interceptors for authentication and error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { API_CONFIG } from '../config/api.config';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // REQUEST INTERCEPTOR
    this.client.interceptors.request.use(
      (config) => {
        // Log request (development only)
        if (process.env.NODE_ENV === 'development') {
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

    // RESPONSE INTERCEPTOR
    this.client.interceptors.response.use(
      (response) => {
        // Log successful response (development only)
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ API Response:', {
            url: response.config.url,
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;
          
          switch (status) {
            case 401:
              console.error('🔒 Unauthorized - Please reconnect wallet');
              break;
              
            case 403:
              console.error('🚫 Forbidden - Access denied');
              break;
              
            case 404:
              console.error('🔍 Not Found:', error.config?.url);
              break;
              
            case 500:
              console.error('💥 Server Error - Please try again later');
              break;
              
            default:
              console.error(`❌ API Error (${status}):`, error.response.data);
          }
        } else if (error.request) {
          console.error('📡 Network Error - No response from server');
          console.error('Check if backend is running at:', API_CONFIG.baseURL);
        } else {
          console.error('⚠️ Request Error:', error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T, TBody = unknown>(url: string, data?: TBody, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T, TBody = unknown>(url: string, data?: TBody, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T, TBody = unknown>(url: string, data?: TBody, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
