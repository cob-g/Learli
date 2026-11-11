/** Where a stored tutor photo is served; the route decides who may open it. */
export function tutorPhotoUrl(photoId: string) {
  return `/api/tutor-photos/${encodeURIComponent(photoId)}`;
}
