# Auth Feature

Handles Atlas mobile authentication, registration, email OTP verification, session storage, and authenticated user profile API calls.

## Screens

| Screen | Description |
|--------|-------------|
| `LoginScreen` | Username/password login. Stores JWT on success and routes to the main tabs. |
| `RegisterScreen` | Account creation form with first name, last name, username, email, password, and confirm password. |
| `CheckEmailScreen` | 6-box OTP verification after registration, with resend cooldown and success/error popups. |

Profile account updates live in `src/features/profile` but reuse this feature's `authApi` methods.

## Auth Flow

1. Register calls `POST /api/users/register/public`.
2. The app stores `pendingVerificationEmail` and opens `CheckEmailScreen`.
3. OTP verification calls `POST /api/users/verify-email`.
4. Login calls `POST /api/auth/login`.
5. JWT is stored with `expo-secure-store`.
6. `fetchUser` loads the authenticated user with `GET /api/users/fetch`.
7. `AppNavigator` shows main tabs when a JWT exists, otherwise the auth stack.
8. Logout calls `POST /api/auth/logout`, then clears all local secure-store auth values.

## API Methods

| Method | Backend |
|--------|---------|
| `register` | `POST /api/users/register/public` |
| `login` | `POST /api/auth/login` |
| `verifyEmail` | `POST /api/users/verify-email` |
| `resendOtp` | `POST /api/users/resend-otp` |
| `fetchUser` | `GET /api/users/fetch` |
| `updateProfile` | `PUT /api/users/update?v=1.0` with CSRF header |
| `authorizeGithub` | `POST /api/github/authorize?v=1.0` |
| `logout` | `POST /api/auth/logout` |

## Profile Updates

`updateProfile` supports:

- Name update: `firstName`, `middleName`, `lastName`
- Email update: `email`
- Password update: `currentPassword`, `password`

Email changes mark the account as unverified. The Profile screen opens a 6-box OTP modal and verifies the new email with `verifyEmail`.

`/api/users/update` requires a CSRF token. The app first calls `/api/csrf/public?v=1.0`, then sends the returned CSRF header with the update request.

## Store

`useAuthStore` owns:

- `jwt`
- `user`
- `isLoading`
- `error`
- `pendingVerificationEmail`

The store handles login, registration, logout, user fetch, secure-store hydration, error clearing, and pending verification email updates.

## Files

```
auth/
├── api/
│   └── authApi.ts
├── screens/
│   ├── CheckEmailScreen.tsx
│   ├── LoginScreen.tsx
│   └── RegisterScreen.tsx
└── store/
    └── useAuthStore.ts
```