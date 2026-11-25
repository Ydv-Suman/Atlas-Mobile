# Atlas Mobile

**Your next commit shouldn’t have to wait for your laptop.**

Atlas is a mobile coding workspace for iOS and Android. Connect a GitHub repository, edit its files, work with an AI agent, and review and push changes from your phone.

[Mobile repository](https://github.com/Ydv-Suman/Atlas-Mobile) · [Backend repository](https://github.com/Ydv-Suman/Atlas-backend)

## Demo

https://github.com/user-attachments/assets/e967ce36-de9d-4d64-9210-8e1faa4d3415


## Features

- **Workspace:** Browse GitHub repositories, open projects, and restore the last active project after an app reload.
- **File explorer:** Navigate an expandable folder tree; create files and folders in the selected directory; long-press an entry to confirm deletion.
- **Editor:** Edit files with automatic saving and resize the editor and chat panels with the divider.
- **AI agent:** Ask questions, request code changes, and follow streamed responses, command output, file updates, and concise errors. Answer agent questions and approve or decline requested operations in the conversation.
- **Persistent work:** Keep account- and project-specific drafts, chat history, cached file listings, and panel sizes in local SQLite storage. Repository files and agent sessions also persist in the backend workspace.
- **Git:** Review file diffs and commit history, create and switch branches, commit, fetch, pull, push, merge, and rebase. Committing and pushing are separate actions.
- **Connect:** Link GitHub and manage AI provider keys. Interactive agent sessions use the backend’s OpenAI Codex or Anthropic Claude runtime.
- **Account:** Register, verify email, sign in, update profile details and password, and sign out.

The floating bottom navigation contains **Workspace**, **Agent**, **Connect**, and **Profile**. Git is available from the editor toolbar inside Agent.

## Mobile Tech Stack

| Area | Technology |
| --- | --- |
| App | React 19, React Native 0.86, Expo SDK 57 |
| Language | TypeScript 6 with strict checking |
| Navigation | React Navigation 7: native stack and bottom tabs |
| State | Zustand |
| API requests | Axios with JWT request interception |
| Agent streaming | Server-Sent Events through `expo/fetch`, with reconnect recovery |
| Local persistence | Expo SQLite key-value storage |
| Credential storage | Expo SecureStore |
| OAuth flow | Expo AuthSession, WebBrowser, and Linking |
| Notifications | Expo Notifications |
| UI | Expo vector icons, safe-area handling, and syntax highlighting |

## How It Works

```text
Atlas Mobile (React Native / Expo)
                |
        Atlas API Gateway
                |
     Auth · Workspace · Agent · Notifications
                |
   Persistent repository and agent runtime
                |
        AI providers · GitHub
```

The app displays and edits the backend workspace. AI execution, command execution, and Git operations run on the backend. Local SQLite preserves device-side work between visits; it complements the persistent backend workspace.

The [backend repository](https://github.com/Ydv-Suman/Atlas-backend) contains the Java / Spring Boot services, Node.js agent bridge, database migrations, and Docker configuration.

## Getting Started

### Prerequisites

- Node.js and npm compatible with [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
- An iOS Simulator, Android emulator, or compatible physical device running Expo Go or a development build.
- [Atlas Backend](https://github.com/Ydv-Suman/Atlas-backend) running with an API gateway reachable from the device.
- A GitHub account and an OpenAI or Anthropic API key for the coding-agent workflow.

### Install and Configure

```bash
git clone https://github.com/Ydv-Suman/Atlas-Mobile.git
cd Atlas-Mobile
npm install
```

Create `.env` in the project root:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://<your-computer-lan-ip>:8080
```

Use the backend’s LAN address when testing on a physical phone. The device must be able to reach that address; `localhost` on the phone refers to the phone itself. For a hosted backend, use its HTTPS API gateway URL.

`EXPO_PUBLIC_API_BASE_URL` is public app configuration. Enter AI provider keys through **Connect**; do not put credentials in `EXPO_PUBLIC_*` variables or commit `.env` files.

### Run

```bash
npm start
```

Open the app through Expo’s device selection or QR code. The repository also provides:

```bash
npm run ios       # Start Expo and open the iOS Simulator through localhost
npm run android   # Build and run the Android app locally
```

The Android build command requires Android tooling; the iOS Simulator requires macOS and Xcode.

## First Project

1. Register, verify your email, and sign in.
2. Open **Connect**, authorize GitHub, and add an AI provider key.
3. Open **Workspace** and create or select a project from a repository you can access.
4. In **Agent**, open the file drawer and select a file, or create a new file or folder.
5. Edit directly or send a prompt, such as: “Implement a function to update an existing task.”
6. Review the code and tool output, then open **Git** to inspect diffs, commit, and explicitly push to GitHub.

## Project Structure

```text
src/
├── core/
│   ├── constants/         # API endpoints and storage keys
│   ├── hooks/             # Shared connection hooks
│   ├── navigation/        # Auth stack, main stack, and floating tabs
│   ├── network/           # Axios client and authentication interceptors
│   ├── storage/           # SecureStore helpers
│   └── theme/             # Colors, spacing, and typography
├── features/
│   ├── agent/             # Editor, file tree, chat, streaming, and Git panel
│   ├── auth/              # Registration, sign-in, and email verification
│   ├── profile/           # Account details and updates
│   ├── settings/          # GitHub and AI provider connections
│   └── workspace/         # Repositories, projects, and active-project restoration
└── shared/
    └── components/        # Reusable inputs, buttons, and feedback
```

## Development Checks

Type checking:

```bash
npx tsc --noEmit
```

Focused regression tests for Git, editor drafts, and project restoration:

```bash
node --test src/features/agent/components/GitPanel.test.cjs src/features/agent/editorDrafts.test.cjs src/features/workspace/store/useWorkspaceStore.test.cjs
```

Additional `.test.cjs` files live alongside the features they verify. Keep generated builds, local configuration, credentials, and temporary files out of Git; the repository’s `.gitignore` covers these files.
