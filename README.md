# Atlas Mobile

Mobile-first AI coding agent platform. Prompt AI agents to write code, review diffs, and push to GitHub entirely from your phone.

## Tech Stack

- **Framework:** React Native (Expo SDK 57)
- **Language:** TypeScript (strict)
- **State:** Zustand
- **HTTP:** Axios
- **Navigation:** React Navigation (native stack + bottom tabs)
- **Storage:** expo-secure-store
- **Notifications:** expo-notifications (FCM)
- **OAuth:** expo-web-browser / expo-auth-session
- **Icons:** @expo/vector-icons

## Project Structure

```
src/
├── core/                  # Shared infrastructure
│   ├── constants/         # API URLs, storage keys
│   ├── network/           # Axios client + interceptors
│   ├── storage/           # Secure store wrapper
│   ├── navigation/        # Auth stack, app navigator, bottom tabs
│   └── theme/             # Colors, spacing, typography
├── features/              # Feature-first modules
│   ├── auth/              # Login, register, email verification, auth store
│   ├── git/               # GitHub connection screen
│   └── profile/           # Profile details and account updates
└── shared/
    └── components/        # AtlasButton, AtlasTextInput, etc.
```

## Current Auth Features

- Login, registration, logout, and JWT cleanup
- Email verification by OTP after registration
- Profile details with editable name and email
- OTP verification popup after email changes
- Password update with current password confirmation
- GitHub connect flow and connected status
- Main bottom tabs after login: Workspace, Agent, Git, Profile

## Setup

```bash
npm install
npx expo start
```

Create `.env` in root:
```
EXPO_PUBLIC_API_BASE_URL=http://<your-ip>:8080
```

Do not commit `.env` files.

## Backend

Requires [Atlas Backend](../Atlas-backend) running on port 8080 (api-gateway).

## Git Ignore Notes

Keep generated files, local config, credentials, logs, and build outputs out of Git. The repo ignores `node_modules/`, `.expo/`, `.env`, native generated folders, EAS output, editor files, logs, coverage, and temporary files.
