# Tutor profile photos (D-15)

- Date: 2026-11-11, Asia/Manila.
- The owner asked for tutor photos on the Tutor workspace's Account settings
  ("Profile settings"), with the current initials as the fallback. This is the
  approved use case that `context/architecture.md` §15 and build-plan D-15
  required before any upload storage.
- Storage: the owner selected "Local now, Neon later". Photos are stored behind
  a small adapter. `TUTOR_PHOTO_STORAGE=local` keeps them on this machine under
  `.local/tutor-photos/<APP_ENV>`, accepted only for `development`/`test` on a
  loopback `APP_URL`; the configuration is refused anywhere else. Hosted
  environments stay `disabled` (initials only) until Neon Object Storage, or
  another store, is separately approved, provisioned and added to the adapter.
  PostgreSQL keeps only the object key and review state (`tutor_photos`).
- Review: the owner selected "After admin approves". A new or replacement photo
  is visible only to its tutor and to an admin who may review that tutor; the
  public keeps the initials, or the previously approved photo, until approval.
  Approval publishes it, replacing the earlier one; rejection deletes it and
  tells the tutor. A tutor can remove their photo at any time. An admin cannot
  review their own photo. Every submission, approval, rejection and removal is
  audited.
- Safety limits: JPG, PNG or WebP stills only, up to 5 MB and at least
  128 × 128 pixels. Every upload is re-encoded to a 512 px square WebP, which
  drops embedded camera and location metadata. Approved photos appear only for
  publicly eligible tutors.
- Not decided here: hosted storage provider and cost, retention for removed or
  replaced photos beyond immediate file deletion, malware scanning for a hosted
  store, and photos for any role other than tutors.
