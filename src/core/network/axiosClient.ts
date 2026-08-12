import axios from 'axios';
import { API_BASE_URL } from '../constants/apiConstants';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { getSecure, deleteSecure } from '../storage/secureStore';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosClient.interceptors.request.use(async (config) => {
  const token = await getSecure(STORAGE_KEYS.JWT_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await deleteSecure(STORAGE_KEYS.JWT_TOKEN);
    }
    return Promise.reject(error);
  },
);

export default axiosClient;
