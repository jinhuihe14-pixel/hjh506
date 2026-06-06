import api from './index';

export interface Product {
  id?: number;
  sku: string;
  name: string;
  category_id?: number;
  category_name?: string;
  unit?: string;
  cost_price?: number;
  retail_price?: number;
  wholesale_price?: number;
  safety_stock?: number;
  shelf_life_days?: number;
  description?: string;
  image_url?: string;
  status?: number;
  stock_quantity?: number;
  avg_cost?: number;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const productApi = {
  list: (params: any) => api.get<PageResult<Product>>('/products', { params }),
  detail: (id: number) => api.get<Product>(`/products/${id}`),
  create: (data: Product) => api.post<Product>('/products', data),
  update: (id: number, data: Product) => api.put<Product>(`/products/${id}`, data),
  remove: (id: number) => api.delete(`/products/${id}`),
  search: (keyword: string) => api.get<Product[]>('/products/search/select', { params: { keyword } })
};

export const categoryApi = {
  list: () => api.get<any[]>('/categories'),
  tree: () => api.get<any[]>('/categories/tree'),
  create: (data: any) => api.post('/categories', data),
  update: (id: number, data: any) => api.put(`/categories/${id}`, data),
  remove: (id: number) => api.delete(`/categories/${id}`)
};

export const inventoryApi = {
  list: (params: any) => api.get<PageResult<any>>('/inventory', { params }),
  logs: (params: any) => api.get<PageResult<any>>('/inventory/logs', { params }),
  overview: () => api.get('/inventory/overview')
};

export const purchaseApi = {
  list: (params: any) => api.get<PageResult<any>>('/purchase', { params }),
  detail: (id: number) => api.get(`/purchase/${id}`),
  create: (data: any) => api.post('/purchase', data)
};

export const salesApi = {
  list: (params: any) => api.get<PageResult<any>>('/sales', { params }),
  detail: (id: number) => api.get(`/sales/${id}`),
  create: (data: any) => api.post('/sales', data)
};

export const memberApi = {
  list: (params: any) => api.get<PageResult<any>>('/members', { params }),
  detail: (id: number) => api.get(`/members/${id}`),
  create: (data: any) => api.post('/members', data),
  update: (id: number, data: any) => api.put(`/members/${id}`, data),
  remove: (id: number) => api.delete(`/members/${id}`),
  search: (keyword: string) => api.get<any[]>('/members/search/select', { params: { keyword } }),
  recommendProducts: (id: number) => api.get(`/members/${id}/recommend-products`),
  consumptionStats: (id: number, months?: number) => api.get(`/members/${id}/consumption-stats`, { params: { months } })
};

export const reportsApi = {
  replenishment: () => api.get<any[]>('/reports/daily/replenishment'),
  expiry: (days?: number) => api.get<any[]>('/reports/daily/expiry', { params: { days } }),
  slowMoving: (days?: number) => api.get<any[]>('/reports/daily/slow-moving', { params: { days } }),
  monthlySummary: (month?: string) => api.get('/reports/monthly/summary', { params: { month } }),
  monthlyProducts: (month?: string) => api.get<any[]>('/reports/monthly/products', { params: { month } }),
  monthlyCategories: (month?: string) => api.get<any[]>('/reports/monthly/categories', { params: { month } }),
  monthlyMembers: (month?: string) => api.get<any[]>('/reports/monthly/members', { params: { month } }),
  monthlyMemberPortrait: (month?: string, limit?: number) => api.get<any[]>('/reports/monthly/member-portrait', { params: { month, limit } }),
  fishingTypes: (month?: string) => api.get<any[]>('/reports/monthly/fishing-types', { params: { month } }),
  categoryPreference: (month?: string, fishingType?: string) => 
    api.get<any[]>('/reports/monthly/category-preference', { params: { month, fishing_type: fishingType } }),
  salesTrend: (months?: number) => api.get<any[]>('/reports/trend/sales', { params: { months } }),
  yoy: (month?: string) => api.get('/reports/trend/yoy', { params: { month } }),
  dailySavedList: (params: any) => api.get('/reports/saved/daily', { params }),
  dailySaved: (date: string) => api.get(`/reports/saved/daily/${date}`),
  monthlySavedList: (params: any) => api.get('/reports/saved/monthly', { params }),
  monthlySaved: (month: string) => api.get(`/reports/saved/monthly/${month}`)
};

export const stocktakeApi = {
  list: (params: any) => api.get<PageResult<any>>('/stocktake', { params }),
  detail: (id: number) => api.get(`/stocktake/${id}`),
  create: (data: any) => api.post('/stocktake', data),
  updateItem: (stocktakeId: number, itemId: number, actual_quantity: number) =>
    api.post(`/stocktake/${stocktakeId}/items/${itemId}`, { actual_quantity }),
  complete: (id: number) => api.post(`/stocktake/${id}/complete`),
  latest: () => api.get('/stocktake/latest'),
  categoryPreview: (categoryId: number | 'all') => api.get(`/stocktake/category-preview/${categoryId}`)
};

export const exportApi = {
  stocktake: (id: number) => `/api/export/stocktake/${id}`,
  inventory: () => `/api/export/inventory`,
  sales: (month: string) => `/api/export/sales/${month}`,
  purchase: (month: string) => `/api/export/purchase/${month}`,
  monthlyReport: (month: string) => `/api/export/monthly-report/${month}`
};
