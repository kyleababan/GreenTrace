# GreenTrace Project Safety & Development Skill

## Purpose

You are working on **GreenTrace**, an existing capstone waste-reporting application. Your priority is to **add or modify features without breaking the existing project**.

Treat the existing codebase as the source of truth. Do not redesign, migrate, or replace working parts of the application unless explicitly requested.

---

## 1. Project Context

GreenTrace is a waste-reporting application for residents and LGU personnel.

### Main technology

- React Native
- Expo
- Expo Router
- Firebase Authentication
- Firebase Firestore
- Cloudinary for image uploads
- Vercel for web deployment
- JavaScript / JSX

### Important existing configuration

- Expo SDK: approximately `57`
- Web build uses Expo static output
- Web build command:
  `npx expo export --platform web`
- Vercel output directory:
  `dist`
- Firebase configuration is currently in:
  `firebaseConfig.js`
- Firebase Realtime Database is **not** used by GreenTrace.
- Firebase Storage is **not** used by GreenTrace.
- Images are uploaded through Cloudinary.
- Existing routing uses **Expo Router** in the resident side.
- Do not replace Expo Router with a custom SPA/navigation system.

---

## 2. Critical Rule: Do Not Break Existing Features

Before changing code:

1. Inspect the relevant existing files.
2. Understand how the current feature works.
3. Reuse the existing Firebase configuration.
4. Reuse the existing Expo Router structure.
5. Reuse existing components and styling patterns where possible.
6. Make the smallest change necessary.
7. Do not rewrite an entire file just to add one feature.
8. Do not change unrelated code.
9. Do not change Firebase collections or field names unless necessary and explicitly explained.
10. Do not remove existing functionality because it is inconvenient to modify.

If an existing implementation looks unusual but is working, **preserve it unless there is a clear reason to change it**.

---

## 3. Before Installing Anything

Do not immediately install packages.

First determine whether the required functionality can be implemented using:

- existing Expo APIs
- existing React Native APIs
- existing Firebase code
- existing dependencies

If a new package is genuinely required:

1. Check whether the package is compatible with the current Expo SDK.
2. Explain why it is needed.
3. Avoid upgrading Expo or unrelated dependencies.
4. Do not change package versions unnecessarily.
5. Do not replace the current project architecture.

---

## 4. GPS / Location Feature

GreenTrace will use a location system where residents can select or obtain a location using **latitude and longitude**.

The intended flow is:

```text
Resident
   ↓
Location / GPS Map
   ↓
Latitude + Longitude
   ↓
Google Maps
   ↓
Display selected location
   ↓
Save coordinates with the waste report
   ↓
Firestore
```

### Coordinate data

The application should treat latitude and longitude as the primary location data.

Example:

```js
{
  latitude: 10.2965,
  longitude: 123.7436
}
```

Do not rely only on a formatted address string.

A report may contain both:

```js
{
  latitude,
  longitude,
  locationName
}
```

where:

- `latitude` = numeric latitude
- `longitude` = numeric longitude
- `locationName` = human-readable location name, if available

### Google Maps

Google Maps is intended to translate/display the latitude and longitude on a map.

The project may use **Google Maps Platform**.

Do not assume that selecting/enabling Google Maps Platform automatically configures the application. Check the existing Google Cloud configuration and determine which API is actually required.

Do not expose secret API keys in source code if the chosen Google service requires protected credentials.

---

## 5. Location Selection Requirements

When implementing location selection:

- Keep the existing create-post flow intact.
- Do not remove image upload.
- Do not remove caption/description.
- Do not remove existing status handling.
- Do not remove authentication checks.
- Do not change the existing post collection unless required.
- Save coordinates in a predictable field format.
- Validate that latitude and longitude are actual numbers.
- Do not allow invalid coordinates to silently enter Firestore.

Valid ranges:

```text
Latitude:  -90 to 90
Longitude: -180 to 180
```

For GreenTrace's local use case, locations will normally be around the Philippines/Cebu area, but do not hard-code a tiny geographic boundary unless explicitly requested.

---

## 6. Existing Firebase Rules

GreenTrace currently uses Firestore collections including areas such as:

- `users`
- `posts`
- `comments`
- `notifications`
- `post_reactions`
- `volunteer_posts`

Before creating a new collection or field:

- Search the project for existing usage.
- Check whether the same information already exists.
- Reuse existing fields when appropriate.
- Do not create duplicate sources of truth.

### Important points system

The `users` documents contain the user's current points.

Example:

```js
users/{uid}
{
  firstName: "Tiyo",
  lastName: "Jr.",
  points: 1
}
```

Existing `posts` also store a `points` field.

This means the user points and the copied points stored on a post can become out of sync.

**Do not silently "fix" this architecture while working on unrelated features.**

If points synchronization becomes part of the requested work, explicitly identify that it is a separate data-consistency issue.

---

## 7. Existing Routing

GreenTrace uses **Expo Router**.

Use:

```js
import { useRouter } from "expo-router";
```

and navigation such as:

```js
router.push("/some_page");
```

or:

```js
router.push({
  pathname: "/post",
  params: {
    id: post.id,
  },
});
```

Do not introduce a second navigation architecture.

Do not convert existing Expo Router pages into SPA state navigation unless explicitly requested.

---

## 8. Important Existing Resident Pages

The project has resident-side pages/components including areas such as:

```text
app/
├── home.jsx
├── post.jsx
├── create_post.jsx
├── notification.jsx
├── settings.jsx
└── ...
```

There are also admin-side pages under areas such as:

```text
app/admin/
```

including volunteer and assessment functionality.

Before editing a page, search the repository for:

- imports of that page
- router paths pointing to that page
- Firestore collection names used by that page
- shared components used by that page

This prevents breaking another part of the application.

---

## 9. Known Existing Bugs

There are already known bugs in the project. Do not accidentally introduce regressions while fixing or adding features.

### `home.jsx`

Known issues include:

- React can be spammed, creating duplicate requests.
- Reacting to one post can cause other posts to play the reaction animation.
- User points may not display even when points exist in the `users` document.
- Status can display as `moderate` when viewing On-going/Cleaned reports.
- Search filtering does not always work correctly.

### `create_post.jsx`

Known issues include:

- A post can be created without setting a location.
- The `POST` button can be spammed, creating duplicate requests.

### `post.jsx`

Known issues include:

- React can be spammed, creating duplicate requests.
- Images do not always display in full view correctly.

### `notification.jsx`

Known issues include:

- Notifications can become duplicated instead of being combined.
- LGU delete-notification reason may not display.

### Admin panel

#### `SituationAssessment.jsx`

- Reports are not formatted correctly.
- Random gaps can appear when there are more than four posts.

#### `VolunteerList.jsx`

- LGU Admin can create duplicate volunteer activities for a single post.

#### `PostDetail.jsx`

- Post deletion may not actually delete the post and/or related data.

These bugs are background context. Do not attempt to fix all of them when implementing an unrelated feature.

---

## 10. Testing Before Finishing

After making changes:

### Check the code

Look for:

- undefined variables
- incorrect imports
- incorrect Firestore field names
- incorrect router paths
- missing `await`
- invalid component props
- null/undefined data access
- duplicate event handlers
- accidental changes to existing functionality

### Test the actual flow

For a location feature, test:

1. Open create-post page.
2. Open location picker/map.
3. Select a location.
4. Confirm latitude is captured.
5. Confirm longitude is captured.
6. Confirm the map displays the selected coordinates.
7. Submit the report.
8. Open Firestore.
9. Confirm the report contains the expected coordinates.
10. Open the report again.
11. Confirm the location can still be displayed.

Also test:

- Cancel/back navigation
- missing location
- invalid location data
- repeated button presses
- refreshing the page
- web deployment behavior

---

## 11. Git Safety

Before making significant changes:

```bash
git status
```

If there are uncommitted user changes:

**Do not overwrite them.**

Do not run destructive commands such as:

```bash
git reset --hard
git clean -fd
```

unless the user explicitly requests it.

Do not switch branches, merge branches, rebase, or force-push without the user's explicit instruction.

Prefer small commits when the user is ready to commit.

---

## 12. Change Strategy

Use this order:

```text
1. Inspect
   ↓
2. Understand existing implementation
   ↓
3. Identify the smallest required change
   ↓
4. Make the change
   ↓
5. Check for regressions
   ↓
6. Run/test the feature
   ↓
7. Explain exactly what changed
```

When you need to modify multiple files, explain the reason for each file before making broad changes.

---

## 13. Do Not Assume

If something is missing, do not invent it.

For example, do not assume:

- a Google Maps API key already exists
- a package is already installed
- a Firestore field exists
- a router path exists
- a page has a parent component
- a collection has a particular schema

Search the codebase first.

If the information cannot be confirmed, tell the user what needs to be checked.

---

## 14. Preferred Coding Style

Keep code understandable and consistent with the existing project.

Prefer straightforward React Native/Expo code over complicated abstractions.

Do not introduce unnecessary:

- state-management libraries
- backend frameworks
- new database systems
- complex TypeScript migrations
- architectural rewrites
- dependency upgrades

The goal is a working capstone project, not a complete rewrite.

---

## 15. Agent Communication

When proposing a change, briefly state:

### What you found
Example:

> `create_post.jsx` currently saves `locationName`, but it does not save latitude/longitude.

### What you will change
Example:

> I will add latitude and longitude to the existing post creation flow without changing the existing image upload or Firebase structure.

### What files will change
Example:

```text
app/create_post.jsx
app/location_picker.jsx
```

### What will remain unchanged

Explicitly mention important existing systems that will not be touched.

If a requested change could affect Firebase, routing, dependencies, or deployment, warn the user before making that change.

---

## 16. Priority

When there is a conflict between a new feature and preserving the project:

1. Preserve existing working functionality.
2. Preserve existing data.
3. Preserve existing routing.
4. Preserve existing Firebase structure.
5. Make the smallest safe change.
6. Only then add the new feature.

**Never rewrite the project just because a cleaner architecture is possible.**

The project is an existing capstone application. Stability is more important than architectural perfection.
