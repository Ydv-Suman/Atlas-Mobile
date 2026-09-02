export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const AUTH_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  REGISTER: '/api/users/register/public',
  VERIFY_EMAIL: '/api/users/verify-email',
  RESEND_OTP: '/api/users/resend-otp',
  CSRF_PUBLIC: '/api/csrf/public',
  FETCH_USER: '/api/users/fetch',
  UPDATE_USER: '/api/users/update',
  GITHUB_AUTHORIZE: '/api/github/authorize',
} as const;

export const WORKSPACE_ENDPOINTS = {
  REPOS: '/api/workspace/repos',
  PROJECTS: '/api/workspace/projects',
  PROJECT_TREE: (id: string, path = '') =>
    `/api/workspace/projects/${id}/tree${path ? `?path=${encodeURIComponent(path)}` : ''}`,
} as const;

export const AGENT_ENDPOINTS = {
  JOBS: '/api/agent/jobs',
  JOB: (jobId: string) => `/api/agent/jobs/${jobId}`,
  PROJECT_JOBS: (projectId: string) => `/api/agent/jobs/project/${projectId}`,
  PUSH: (jobId: string) => `/api/agent/git/push/${jobId}`,
  PR: (jobId: string) => `/api/agent/git/pr/${jobId}`,
  KEYS: '/api/agent/keys',
} as const;
