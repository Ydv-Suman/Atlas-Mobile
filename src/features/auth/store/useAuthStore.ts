import { create } from 'zustand';
import { authApi, LoginResponse, UserDto } from '../api/authApi';
import { saveSecure, getSecure, deleteSecure } from '../../../core/storage/secureStore';
import { STORAGE_KEYS } from '../../../core/constants/storageKeys';
import axios from 'axios';

interface AuthState {
  jwt: string | null;
  user: UserDto | null;
  isLoading: boolean;
  error: string | null;
  pendingVerificationEmail: string | null;

  login: (username: string, password: string) => Promise<void>;
  register: (data: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  clearError: () => void;
  setPendingEmail: (email: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  jwt: null,
  user: null,
  isLoading: false,
  error: null,
  pendingVerificationEmail: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authApi.login({ username, password });
      await saveSecure(STORAGE_KEYS.JWT_TOKEN, data.jwtToken);
      set({ jwt: data.jwtToken, isLoading: false });
      await get().fetchUser();
    } catch (e) {
      set({ isLoading: false, error: extractError(e) });
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.register(data);
      await saveSecure(STORAGE_KEYS.USER_EMAIL, data.email);
      set({ isLoading: false, pendingVerificationEmail: data.email });
      return true;
    } catch (e) {
      set({ isLoading: false, error: extractError(e) });
      return false;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout API failure
    }
    await deleteSecure(STORAGE_KEYS.JWT_TOKEN);
    set({ jwt: null, user: null, error: null });
  },

  fetchUser: async () => {
    try {
      const { data } = await authApi.fetchUser();
      set({ user: data });
    } catch {
      // token invalid
      await deleteSecure(STORAGE_KEYS.JWT_TOKEN);
      set({ jwt: null, user: null });
    }
  },

  loadFromStorage: async () => {
    set({ isLoading: true });
    const token = await getSecure(STORAGE_KEYS.JWT_TOKEN);
    if (token) {
      set({ jwt: token });
      await get().fetchUser();
    }
    const email = await getSecure(STORAGE_KEYS.USER_EMAIL);
    if (email) {
      set({ pendingVerificationEmail: email });
    }
    set({ isLoading: false });
  },

  clearError: () => set({ error: null }),

  setPendingEmail: (email) => set({ pendingVerificationEmail: email }),
}));

function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return e.response?.data?.errorMessage ?? e.response?.data?.message ?? e.message;
  }
  return 'Something went wrong';
}
