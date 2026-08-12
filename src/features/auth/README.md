# Auth Feature

Handles user authentication: login, registration, and email verification via OTP.

## Screens

| Screen | Description |
|--------|-------------|
| `LoginScreen` | Username + password login. Error shown in popup modal. |
| `RegisterScreen` | Full registration form (name, username, email, password). Real-time password match validation. |
| `CheckEmailScreen` | 6-box OTP input for email verification. Resend with 60s cooldown. Success/error popups. |

## API Endpoints

| Action | Method | Path |
|--------|--------|------|
| Register | POST | `/api/users/register/public` |
| Login | POST | `/api/auth/login` |
| Verify Email | POST | `/api/users/verify-email` |
| Resend OTP | POST | `/api/users/resend-otp` |
| Fetch User | GET | `/api/users/fetch` |
| Logout | POST | `/api/auth/logout` |

## Store (useAuthStore)

Zustand store managing:
- `jwt` — stored in expo-secure-store
- `user` — fetched after login via `/api/users/fetch`
- `pendingVerificationEmail` — set after register, used by CheckEmailScreen
- `isLoading`, `error` — UI state

## Files

```
auth/
├── api/
│   └── authApi.ts          # API calls + request/response types
├── store/
│   └── useAuthStore.ts     # Zustand auth state
├── screens/
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   └── CheckEmailScreen.tsx
└── components/
    └── AuthInput.tsx        # (planned)
```
