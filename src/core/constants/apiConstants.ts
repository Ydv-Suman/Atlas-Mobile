export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const AUTH_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  REGISTER: '/api/users/register/public',
  VERIFY_EMAIL: '/api/users/verify-email',
  RESEND_OTP: '/api/users/resend-otp',
  FETCH_USER: '/api/users/fetch',
} as const;
