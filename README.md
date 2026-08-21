# Eshwe

Next.js 15 boutique storefront for a saree website using a Firebase-only stack: Firebase Hosting, Firestore, and Firebase Storage.

## Stack

- Next.js 15 with the App Router
- TypeScript
- Tailwind CSS
- Firebase Hosting using static export output
- Cloud Firestore for saree catalog documents
- Cloud Storage for Firebase for product images

## SEO and assets

- Favicon assets are served from `public/favicon`
- `robots.txt` is generated from `src/app/robots.ts`
- `sitemap.xml` is generated from `src/app/sitemap.ts`

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Add your Firebase project values to `.env.local`.
   The current project is prefilled for `eshwesareestudio`.
   If you are using the custom domain flow, set:

   ```bash
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=eshwe.com
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

## Firebase-only architecture

- Firebase Hosting serves the exported storefront from `out/`
- Firestore stores product metadata under the `sarees` collection
- Firestore stores homepage content under `siteContent/homepage`
- Firestore stores homepage category cards under `categoryCards`
- Firebase Storage stores product images under `sarees/{sku}/...`
- Firebase Storage stores hero media under `site-content/home/...`
- Firebase Storage stores category media under `categories/{slug}/...`
- Firestore documents store both image URLs and Storage paths so images can be replaced later without losing file references
- `/owner` is a client-side backoffice for catalog management
- Google Authentication protects the owner dashboard

## Firebase deployment

1. Install the Firebase CLI if needed:

   ```bash
   npm install -g firebase-tools
   ```

2. Log in and connect your Firebase project:

   ```bash
   firebase login
   ```

   `.firebaserc` already points to `eshwesareestudio`.

3. Build the static export:

   ```bash
   npm run build
   ```

4. Deploy Hosting, Firestore rules, and Storage rules:

   ```bash
   firebase deploy
   ```

## Owner backoffice

- Route: `/owner`
- Sign-in method: Google Authentication
- Allowed owner email: `ajyghosh@gmail.com`

Before using `/owner`, enable the following in Firebase Console:

1. Authentication
   Enable the Google provider.
2. Authentication > Settings > Authorized domains
   Add your Firebase Hosting domain and any custom domain you use.
   For this project, add `eshwe.com`.
3. Firestore Database
   Create the database if it is not already enabled.
4. Storage
   Create the default bucket if it is not already enabled.

## Custom auth domain setup

If you want the Google sign-in popup to show `eshwe.com` instead of `eshwesareestudio.firebaseapp.com`, complete all three pieces below:

1. Firebase Hosting custom domain
   Add `eshwe.com` in Hosting:
   `https://console.firebase.google.com/project/eshwesareestudio/hosting`
2. Firebase Authentication authorized domains
   Add `eshwe.com` here:
   `https://console.firebase.google.com/project/eshwesareestudio/authentication/settings`
3. Google OAuth redirect URI
   In Google Cloud Console, open Credentials and add this redirect URI to the web OAuth client used by Firebase Auth:
   `https://eshwe.com/__/auth/handler`
   Console URL:
   `https://console.cloud.google.com/apis/credentials?project=eshwesareestudio`

After that, keep this env value in the app:

```bash
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=eshwe.com
```

Then rebuild and redeploy:

```bash
npm run build
firebase deploy
```

## Firestore product model

Each document in the `sarees` collection can store:

- `name`
- `slug`
- `sku`
- `category`
- `fabric`
- `color`
- `description`
- `price`
- `originalPrice`
- `discountPercent`
- `collectionLabel`
- `status`
- `featured`
- `primaryImageUrl`
- `primaryImagePath`
- `galleryImageUrls`
- `galleryImagePaths`
- `createdAt`
- `updatedAt`

## Homepage content model

`siteContent/homepage` can store:

- `heroImageUrl`
- `heroImagePath`
- `heroImagePosition`
- `categoriesHeading`
- `categoriesSubtitle`

Each document in `categoryCards` can store:

- `title`
- `imageUrl`
- `imagePath`
- `backgroundPosition`
- `active`
- `sortOrder`
- `createdAt`
- `updatedAt`

## Storage upload helper

- `src/lib/storage.ts` includes a Firebase Storage helper for browser uploads.
- Uploaded image paths are normalized under the `sarees/` folder and return:
  - `path`
  - `url`

Typical admin flow:

1. Upload the image with `uploadSareeImage(file, sku)`
2. Save the returned `url` and `path` in Firestore
3. Use the Firestore document to render the product card in the storefront

## Security note

Current rules allow:

- public read access for `sarees`
- public read access for `siteContent`
- public read access for `categoryCards`
- public read access for product images
- public read access for hero/category media
- writes only for authenticated Google users whose verified email is `ajyghosh@gmail.com`

This matches the current owner dashboard implementation in `/owner`.
