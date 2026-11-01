CREATE OR REPLACE FUNCTION public.notify_portal_data_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id bigint;
    entity_id text;
    affected_request_id uuid;
    affected_visibility text;
    event_resource text;
    registrar_only boolean := FALSE;
BEGIN
    IF TG_TABLE_NAME = 'requests' THEN
        IF TG_OP = 'DELETE' THEN
            target_user_id := OLD.requester_id;
            entity_id := OLD.id::text;
        ELSE
            target_user_id := NEW.requester_id;
            entity_id := NEW.id::text;
        END IF;
        event_resource := 'requests';
    ELSIF TG_TABLE_NAME = 'clearance_submissions' THEN
        IF TG_OP = 'DELETE' THEN
            target_user_id := OLD.user_id;
            entity_id := OLD.id::text;
        ELSE
            target_user_id := NEW.user_id;
            entity_id := NEW.id::text;
        END IF;
        event_resource := 'clearances';
    ELSIF TG_TABLE_NAME = 'notifications' THEN
        IF TG_OP = 'DELETE' THEN
            target_user_id := OLD.user_id;
            entity_id := OLD.id::text;
        ELSE
            target_user_id := NEW.user_id;
            entity_id := NEW.id::text;
        END IF;
        event_resource := 'notifications';
    ELSIF TG_TABLE_NAME = 'request_comments' THEN
        IF TG_OP = 'DELETE' THEN
            affected_request_id := OLD.request_id;
            affected_visibility := OLD.visibility;
        ELSE
            affected_request_id := NEW.request_id;
            affected_visibility := NEW.visibility;
        END IF;
        SELECT requester_id INTO target_user_id
        FROM public.requests
        WHERE id = affected_request_id;
        entity_id := affected_request_id::text;
        event_resource := 'comments';
        registrar_only := affected_visibility <> 'requester';
    ELSIF TG_TABLE_NAME = 'request_comment_reads' THEN
        IF TG_OP = 'DELETE' THEN
            target_user_id := OLD.user_id;
            SELECT request_id INTO affected_request_id
            FROM public.request_comments
            WHERE id = OLD.comment_id;
        ELSE
            target_user_id := NEW.user_id;
            SELECT request_id INTO affected_request_id
            FROM public.request_comments
            WHERE id = NEW.comment_id;
        END IF;
        entity_id := affected_request_id::text;
        event_resource := 'comments';
    END IF;

    IF target_user_id IS NOT NULL THEN
        PERFORM pg_notify(
            'portal_data_changed',
            json_build_object(
                'resource', event_resource,
                'userId', target_user_id::text,
                'entityId', entity_id,
                'registrarOnly', registrar_only
            )::text
        );
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER requests_data_change
AFTER INSERT OR UPDATE OR DELETE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.notify_portal_data_change();

CREATE TRIGGER clearance_submissions_data_change
AFTER INSERT OR UPDATE OR DELETE ON public.clearance_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_portal_data_change();

CREATE TRIGGER notifications_data_change
AFTER INSERT OR UPDATE OR DELETE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_portal_data_change();

CREATE TRIGGER request_comments_data_change
AFTER INSERT OR DELETE ON public.request_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_portal_data_change();

CREATE TRIGGER request_comment_reads_data_change
AFTER INSERT OR DELETE ON public.request_comment_reads
FOR EACH ROW EXECUTE FUNCTION public.notify_portal_data_change();
