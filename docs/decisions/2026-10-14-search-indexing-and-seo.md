# Search metadata, and indexing that stays closed until launch

On 2026-10-14 the owner asked for the website's search-engine optimisation to
be improved ("work on the SEO of this website, just to improve the SEO of it").
This records what was built and the one rule that was deliberately not changed.

## Decision

Every public page now carries its own title, description, canonical address and
share-card data from one helper (`src/lib/seo/metadata.ts`). The site serves a
`robots.txt`, a `sitemap.xml` and one branded share image, and the home page
states in structured data that this is the Learli website.

**Search indexing stays closed until the approved public launch.** That was the
rule before this work (`robots.ts` disallowed everything, with the note
"indexing waits for the approved public launch") and it is unchanged. Search
engines may index the public pages only when all three hold, checked on every
request in `src/lib/seo/site.ts`:

1. `SEARCH_INDEXING=open`, set by the owner as the launch switch;
2. `APP_ENV=production`;
3. `APP_URL` is an HTTPS address that is not a loopback one.

Anything else, including a production service without the switch, serves
`noindex` on every page, a closed `robots.txt` and an empty sitemap. Setting the
switch is a production environment change and needs the owner's explicit
authorization.

## What search engines are and are not given

- Offered for indexing once open: `/`, `/tutors`, `/get-matched`, `/subjects`,
  `/how-it-works`, `/become-a-tutor`, and one address per tutor that the public
  directory's own read (`readPublicCatalog`) already lists.
- Never offered, in any environment: sign-in and account pages, every private
  workspace, API routes, any address carrying `bookingId=` or `token=`, the
  three draft policies, Contact and Report a concern.
- Filtered and time-selected views of the directory and of matching point to
  the bare page as their canonical address.
- Structured data is a single `WebSite` entry. No `Organization` (the legal
  identity is undecided), no `Offer` or prices (payments are undecided), and no
  `Review` or `AggregateRating` (Learli has no customer reviews; the home
  page's sample reviews never render in production).
- The share image is the kit's reverse wordmark on navy. The site's photographs
  are generated illustrations and are never used to stand for real people.
- The canonical origin comes from `APP_URL` alone. No domain is written into
  the code, because the public domain is not decided.

## Cost

The indexing answer and the origin are read per request so a build made in one
environment cannot carry its answer into another. `/how-it-works`,
`/become-a-tutor`, the three draft policies and the not-found page were
prerendered and are now rendered on request.

## Left to the owner

- When to set `SEARCH_INDEXING=open`, and the final public address to put in
  `APP_URL` first.
- `/how-it-works` and `/become-a-tutor` still describe a "development preview",
  and the directory can show "Local simulation". That wording would be indexed
  as it stands.
- Whether each subject should get its own indexable page and title;
  `/tutors?subject=...` currently points to `/tutors`.
- The share image has the wordmark only; a product line needs Lexend as a font
  file in the repository.
