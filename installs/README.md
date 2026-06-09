# Installation Gallery (`/installs/`)

Customer-facing, auth-gated library of real Trinity install photos for reps to show
in the home. Categories: **Solar / Roof / Battery**. Free-text **tags** drive search
(snow, racking, flashing, feet, front, back, equipment, happy customer, etc.). High-res
lightbox built for showing on a tablet or laptop at the kitchen table.

Reps can submit their own field photos; **every rep upload is hidden until a manager or
admin approves it.** Seed content (loaded at launch) is pre-vetted and approved.

## Data model (Supabase `qjcozskyopetvigjhlmh`)

**Table `public.install_photos`** -- one row per photo.
- `category` (`Solar|Roof|Battery`), `tags text[]`, `title`, `caption`
- `storage_path` (full-res) + `thumb_path` (500px) in the private bucket
- `status` (`pending|approved|rejected|archived`), `featured`, `sort_order`
- `uploaded_by` / `uploaded_by_name`, `reviewed_by` / `reviewed_at` / `review_note`
- `width`, `height`, `mime_type`, `size_bytes`, `created_at`

**Bucket `install-photos`** -- **private**, 15 MB cap, images only. Layout
`full/<uuid>.<ext>` and `thumb/<uuid>.jpg`. The page reads via short-TTL signed URLs
(`createSignedUrls`), so nothing is publicly hotlinkable.

## Security (RLS + a trigger)

- **Read:** approved photos to any active user; a rep also sees their own pending; managers/admins see everything.
- **Insert:** any active user, only as a `pending` self-owned row.
- **Update** (approve/reject/archive/edit): managers + admins only.
- **Delete:** managers/admins, or a rep removing their own still-pending row.
- **Trigger `install_photos_force_pending`** stamps `uploaded_by = auth.uid()` and forces
  `status = 'pending'` for any logged-in insert, so a rep cannot self-approve even by
  crafting the request. Service-role inserts (the seed importer) have a null `auth.uid()`
  and are left alone, which is how seed rows land as `approved`.

Verified with simulated JWTs: a rep sees 25 approved + only their own pending (not another
rep's), and an `approved` insert attempt is downgraded to `pending`; a manager sees all pending.

## How it works (single file: `index.html`)

Built on the `/auth-gate.js` wrapper (same as `/videos/`): `initApp(profile, session)`,
`window.sb` client, `window.IS_MANAGER` / `window.IS_ADMIN` gate the **Pending** review queue
and any edit. Upload resizes client-side via `createImageBitmap({imageOrientation:'from-image'})`
+ canvas (a ~2000px full + ~500px thumb, EXIF baked in), uploads both, inserts a pending row.

## Registration

A `public.resources` row (`name='Installation Gallery'`, `url='/installs/'`,
`category='Sales Fundamentals'`, `image_type='custom'`) surfaces the card on the home page;
thumbnail at `Index Photos/install-gallery-thumbnail.svg`. Set the row `active=true` once the
page is deployed (it is held `active=false` until then so the card never links to a 404).

## Re-seeding / bulk import

Seed photos came from the OneDrive `Photos/Install Photos` folder via a one-off PowerShell
importer (`System.Drawing` for thumbnails, Storage REST + PostgREST with the service-role key
from `Apps/.env`). To add more in bulk, mirror that: generate a thumb, upload `full/` + `thumb/`,
insert an `approved` row. Day-to-day additions just go through the in-page upload + approve flow.
