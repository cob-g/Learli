-- Forward-only public discovery continuation; no data, grants or actor checks change.
CREATE OR REPLACE FUNCTION public.valid_admission_selection(p_selection text) RETURNS boolean
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE v_parts text[];v_zone text;v_start timestamptz;v_end timestamptz;
BEGIN
 IF p_selection IS NULL THEN RETURN true;END IF;
 IF char_length(p_selection)>2048 THEN RETURN false;END IF;
 v_parts:=string_to_array(p_selection,'&');
 -- Canonical public discovery precedes learner/slot selection. All other shapes
 -- retain the accepted six-field parser below; never ignore private/extra keys.
 IF cardinality(v_parts)=2 THEN
  RETURN (v_parts[1] ~ '^/bookings/demo[?]tutorSlug=[a-z0-9]+(-[a-z0-9]+)*$'
   AND v_parts[2] ~ '^subjectSlug=[a-z0-9]+(-[a-z0-9]+)*$'
   AND char_length(split_part(v_parts[1],'=',2))<=80
   AND char_length(split_part(v_parts[2],'=',2))<=80) IS TRUE;
 END IF;
 IF cardinality(v_parts)<>6
 OR v_parts[1] !~ '^/bookings/demo[?]tutorSlug=[a-z0-9]+(-[a-z0-9]+)*$'
 OR v_parts[2] !~ '^subjectSlug=[a-z0-9]+(-[a-z0-9]+)*$'
 OR char_length(split_part(v_parts[1],'=',2))>80 OR char_length(split_part(v_parts[2],'=',2))>80
 OR v_parts[3] !~ '^level=(elementary|middle_school|high_school|college_support)$'
 OR v_parts[4] !~ '^displayTimezone=(UTC|[A-Za-z_]+%2F[A-Za-z_/%2FB0-9+-]+)$'
 OR v_parts[5] !~ '^startAtUtc=[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}%3A[0-9]{2}%3A[0-9]{2}[.][0-9]{3}Z$'
 OR v_parts[6] !~ '^endAtUtc=[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}%3A[0-9]{2}%3A[0-9]{2}[.][0-9]{3}Z$'
 THEN RETURN false;END IF;
 v_zone:=replace(replace(split_part(v_parts[4],'=',2),'%2F','/'),'%2B','+');
 IF v_zone ~* '^etc/' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=v_zone) THEN RETURN false;END IF;
 v_start:=replace(split_part(v_parts[5],'=',2),'%3A',':')::timestamptz;
 v_end:=replace(split_part(v_parts[6],'=',2),'%3A',':')::timestamptz;
 RETURN isfinite(v_start) AND isfinite(v_end) AND v_end-v_start=interval '1 hour';
 EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END;
$$;
