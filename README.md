# Atlas Mobile

Mobile-first AI coding agent platform. Prompt AI agents to write code, review diffs, and push to GitHub — entirely from your phone.

## Tech Stack

- **Framework:** React Native (Expo SDK 57)
- **Language:** TypeScript (strict)
- **State:** Zustand
- **HTTP:** Axios
- **Navigation:** React Navigation (native stack + bottom tabs)
- **Storage:** expo-secure-store
- **Notifications:** expo-notifications (FCM)
- **OAuth:** expo-auth-session

## Project Structure

```
src/
├── core/                  # Shared infrastructure
│   ├── constants/         # API URLs, storage keys
│   ├── network/           # Axios client + interceptors
│   ├── storage/           # Secure store wrapper
│   ├── navigation/        # App navigator, stacks
│   ├── theme/             # Colors, spacing, typography
│   ├── hooks/             # useWebSocket, useDeepLink
│   └── utils/             # JWT decode, formatters
├── features/              # Feature-first modules
│   ├── auth/              # Login, register, email verify
│   ├── onboarding/        # Email gate, GitHub gate
│   ├── projects/          # Project list, create
│   ├── agent/             # Prompt, job status, diff viewer
│   ├── settings/          # Credits, keys, subscription
│   ├── testing/           # API catalog, request builder
│   └── preview/           # Live preview
└── shared/
    └── components/        # AtlasButton, AtlasTextInput, etc.
```

## Setup

```bash
npm install
npx expo start
```

Create `.env` in root:
```
EXPO_PUBLIC_API_BASE_URL=http://<your-ip>:8080
```

## Backend

Requires [Atlas Backend](../Atlas-backend) running on port 8080 (api-gateway).
