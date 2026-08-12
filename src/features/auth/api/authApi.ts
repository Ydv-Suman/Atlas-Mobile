import axiosClient from '../../../core/network/axiosClient';
import { AUTH_ENDPOINTS } from '../../../core/constants/apiConstants';

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  username: string;
  email: string;
  jwtToken: string;
}

export interface UserDto {
  firstName: string;
  middleName: string | null;
  lastName: string;
  username: string;
  email: string;
  role: 'ROLE_USER' | 'ROLE_ADMIN';
  tier: 'FREE' | 'PRO';
  emailVerified: boolean;
  githubAuthorized: boolean;
  createdAt: string;
}

interface ApiResponse<T> {
  statusCode: string;
  message: string;
  data: T | null;
}

export const authApi = {
  register: (data: RegisterRequest) =>
    axiosClient.post<ApiResponse<null>>(AUTH_ENDPOINTS.REGISTER, data),

  login: (data: LoginRequest) =>
    axiosClient.post<LoginResponse>(AUTH_ENDPOINTS.LOGIN, data),

  verifyEmail: (email: string, otp: string) =>
    axiosClient.post<ApiResponse<null>>(AUTH_ENDPOINTS.VERIFY_EMAIL, { email, otp }),

  resendOtp: (email: string) =>
    axiosClient.post<ApiResponse<null>>(AUTH_ENDPOINTS.RESEND_OTP, { email }),

  fetchUser: () =>
    axiosClient.get<UserDto>(AUTH_ENDPOINTS.FETCH_USER),

  logout: () =>
    axiosClient.post<ApiResponse<null>>(AUTH_ENDPOINTS.LOGOUT),
};
