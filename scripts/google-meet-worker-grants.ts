/** Explicit operator-only worker grants. Never required to apply the schema,
 * so an ordinary Neon schema migrator needs no cluster-level CREATEROLE. */
export const googleMeetWorkerGrantsSql = `
GRANT USAGE ON SCHEMA public TO learli_meet_worker;
GRANT EXECUTE ON FUNCTION public.google_meet_claim(text,uuid), public.google_meet_prepare(uuid,uuid,text,boolean), public.google_meet_receipt(uuid,uuid,text,text), public.google_meet_install(uuid,uuid,text), public.google_meet_fail(uuid,uuid,text) TO learli_meet_worker;
`;
