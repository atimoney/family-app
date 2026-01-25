## Prerequisites

- **Node.js >= 22** (Recommended)
- **pnpm** (managed via Corepack)

Enable Corepack once on your machine:
```sh
corepack enable
```

---

## Installation

This project uses **pnpm** as the package manager.

Install dependencies:
```sh
pnpm install
```

Start the development server:
```sh
pnpm dev
```

By default, Vite will run on `http://localhost:5173`  
(or another port if explicitly configured).

> 💡 If accessing the app from another device or VM, ensure Vite is started with:
> ```sh
> pnpm exec vite --host 0.0.0.0 --port <PORT>
> ```

---

## Build

Create a production build:
```sh
pnpm build
```

Preview the production build locally:
```sh
pnpm preview
```

---

## Mock server

By default, demo data is provided from:

```
https://api-dev-minimal-[version].vercel.app
```

To set up a local mock server:

- **Guide:** https://docs.minimals.cc/mock-server  
- **Resources:** https://www.dropbox.com/scl/fo/bopqsyaatc8fbquswxwww/AKgu6V6ZGmxtu22MuzsL5L4?rlkey=8s55vnilwz2d8nsrcmdo2a6ci&dl=0

---

## Full version

The full Minimals version supports:

- Create React App  
  https://docs.minimals.cc/migrate-to-cra/
- Next.js
- Vite

This repository represents a **standalone Vite + TypeScript reference install**.

---

## Starter version

- A simplified Minimals setup with unnecessary components removed  
  https://starter.minimals.cc/
- Ideal for starting new projects
- Components can be selectively copied from the full version
- **Important:** when copying components, ensure all required dependencies are also installed to match the full version

---

## Notes

> **Important:**  
> When copying folders or features between projects, remember to also copy any required hidden files such as `.env` or `.env.example`.  
> These often contain environment variables required for the app to run correctly.
