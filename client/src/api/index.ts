import axios from 'axios';
import { message } from 'antd';

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

interface ApiInstance {
  get<T = any>(url: string, config?: any): Promise<T>;
  post<T = any>(url: string, data?: any, config?: any): Promise<T>;
  put<T = any>(url: string, data?: any, config?: any): Promise<T>;
  delete<T = any>(url: string, config?: any): Promise<T>;
  defaults: any;
  interceptors: any;
}

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
}) as unknown as ApiInstance;

api.interceptors.response.use(
  (response: { data: ApiResponse }) => {
    const res = response.data;
    if (res.code !== 0) {
      message.error(res.message || '请求失败');
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    return res.data;
  },
  (error: any) => {
    message.error(error.message || '网络错误');
    return Promise.reject(error);
  }
);

export default api;
