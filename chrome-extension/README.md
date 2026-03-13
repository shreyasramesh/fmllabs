# FigureMyLife Labs Chrome Extension

Save nuggets, concepts, and chat with the agent from any webpage.

## Setup

1. **Build the extension**
   ```bash
   cd chrome-extension
   npm install
   npm run build
   ```
   The build reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` from the project root `.env.local`. If the key is missing, Clerk will show "Missing publishableKey" — ensure `.env.local` exists and contains the key, then rebuild.

2. **Build for Chrome Web Store (recommended for submission)**
   ```bash
   cd chrome-extension
   npm run build:store
   ```
   This store build automatically removes localhost host permissions from the packaged `dist/manifest.json`.

3. **Load in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

4. **Configure Clerk** (required for sign-in to work)
   - **Enable Native API**: Clerk Dashboard → [Native applications](https://dashboard.clerk.com/~/native-applications) → turn on Native API. Required for Chrome extensions.
   - **Allowed origins**: Add `chrome-extension://<YOUR_EXTENSION_ID>` to allowed origins. Get the ID from `chrome://extensions` after loading. Include any existing origins (e.g. your web app) in the array — the PATCH replaces the full list:
     ```bash
     curl -X PATCH https://api.clerk.com/v1/instance \
       -H "Authorization: Bearer <CLERK_SECRET_KEY>" \
       -H "Content-type: application/json" \
       -d '{"allowed_origins": ["https://fmllabs.ai", "chrome-extension://<CHROME_EXTENSION_ID>"]}'
     ```
   - **Disable bot protection**: Clerk Dashboard → Configure → Bot protection must be off (Cloudflare challenges don't work in extensions).
   - **Auth methods**: OAuth (Google, GitHub, etc.), SAML, and Email Link are not supported in popup/side panel. Use Email + Password, Email + OTP, or Passkeys.

## Features

- **Sign in** via the popup
- **Save nuggets** from the side panel or by selecting text on any page
- **Save concepts** from selected text (generates and saves to your FML datastore)
- **Ask the agent** about selected text (opens side panel with question pre-filled)

## API

The extension uses `/api/extension/*` as a CORS proxy to the FML API. All requests include `Authorization: Bearer <token>` from Clerk.

## Chrome Web Store Submission

1. Run `npm run build:store`.
2. Zip the `dist` folder contents:
   ```bash
   cd chrome-extension/dist
   zip -r ../figuremylife-labs-extension.zip .
   ```
3. Upload the zip in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
4. Fill listing metadata (description, screenshots, icons, category).
5. Complete privacy disclosures and provide a privacy policy URL.
