-- ENVerp Support Backend Foundation V1
-- Source migration only. This script does NOT apply itself to Supabase.
--
-- Security model:
-- - Company users never query these tables directly from anon/authenticated clients.
-- - Server routes authenticate first, then use service-role only within exact server-side scope.
-- - Company reads/writes are locked to the authenticated company session tenant/company.
-- - PLATFORM_SUPER_ADMIN may read support content because users explicitly submit it to Platform support.
-- - Support records/messages/audits are historically retained. Physical DELETE is prohibited.
-- - No customer, measurement, sale or finance content is joined automatically.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS
    erp_user_scope_identity_company_uq
    ON public.erp_user_scopes (
        user_scope_id,
        tenant_id,
        company_id
    );
CREATE TABLE IF NOT EXISTS public.erp_support_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    created_by_user_id TEXT NOT NULL
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    created_by_user_scope_id UUID NOT NULL,
    created_by_role TEXT NOT NULL,
    category TEXT NOT NULL,
    module_code TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    CONSTRAINT erp_support_ticket_company_fk
        FOREIGN KEY (tenant_id, company_id)
        REFERENCES public.erp_companies(tenant_id, company_id)
        ON DELETE RESTRICT,

    CONSTRAINT erp_support_ticket_user_scope_fk
        FOREIGN KEY (
            created_by_user_scope_id,
            tenant_id,
            company_id
        )
        REFERENCES public.erp_user_scopes(
            user_scope_id,
            tenant_id,
            company_id
        )
        ON DELETE RESTRICT,

    CONSTRAINT erp_support_ticket_category_not_blank
        CHECK (BTRIM(category) <> ''),
    CONSTRAINT erp_support_ticket_module_not_blank
        CHECK (BTRIM(module_code) <> ''),
    CONSTRAINT erp_support_ticket_subject_length
        CHECK (CHAR_LENGTH(BTRIM(subject)) BETWEEN 3 AND 160),
    CONSTRAINT erp_support_ticket_description_length
        CHECK (CHAR_LENGTH(BTRIM(description)) BETWEEN 5 AND 5000),
    CONSTRAINT erp_support_ticket_status_valid
        CHECK (
            status IN (
                'NEW',
                'IN_REVIEW',
                'NEEDS_EXPLANATION',
                'SUPPORT_IN_PROGRESS',
                'ARCHITECTURE_REJECTED',
                'ACCEPTED',
                'IN_DEVELOPMENT',
                'RESOLVED',
                'CLOSED'
            )
        ),
    CONSTRAINT erp_support_ticket_resolution_time_valid
        CHECK (resolved_at IS NULL OR resolved_at >= created_at),
    CONSTRAINT erp_support_ticket_closed_time_valid
        CHECK (closed_at IS NULL OR closed_at >= created_at)
);


CREATE UNIQUE INDEX IF NOT EXISTS
    erp_support_ticket_scope_identity_uq
    ON public.erp_support_tickets (
        tenant_id,
        company_id,
        ticket_id
    );

CREATE INDEX IF NOT EXISTS
    erp_support_ticket_company_status_idx
    ON public.erp_support_tickets (
        tenant_id,
        company_id,
        status,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS
    erp_support_ticket_platform_status_idx
    ON public.erp_support_tickets (
        status,
        created_at DESC
    );

CREATE TABLE IF NOT EXISTS public.erp_support_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    sender_user_id TEXT NOT NULL
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    sender_side TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT erp_support_message_ticket_fk
        FOREIGN KEY (tenant_id, company_id, ticket_id)
        REFERENCES public.erp_support_tickets(
            tenant_id,
            company_id,
            ticket_id
        )
        ON DELETE RESTRICT,

    CONSTRAINT erp_support_message_sender_side_valid
        CHECK (sender_side IN ('COMPANY', 'PLATFORM')),
    CONSTRAINT erp_support_message_body_length
        CHECK (CHAR_LENGTH(BTRIM(body)) BETWEEN 1 AND 5000)
);

CREATE INDEX IF NOT EXISTS
    erp_support_message_ticket_created_idx
    ON public.erp_support_messages (
        tenant_id,
        company_id,
        ticket_id,
        created_at
    );

CREATE TABLE IF NOT EXISTS public.erp_support_status_audits (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor_user_id TEXT NOT NULL
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    actor_side TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT erp_support_status_audit_ticket_fk
        FOREIGN KEY (tenant_id, company_id, ticket_id)
        REFERENCES public.erp_support_tickets(
            tenant_id,
            company_id,
            ticket_id
        )
        ON DELETE RESTRICT,

    CONSTRAINT erp_support_status_audit_side_valid
        CHECK (actor_side IN ('COMPANY', 'PLATFORM')),
    CONSTRAINT erp_support_status_audit_to_status_valid
        CHECK (
            to_status IN (
                'NEW',
                'IN_REVIEW',
                'NEEDS_EXPLANATION',
                'SUPPORT_IN_PROGRESS',
                'ARCHITECTURE_REJECTED',
                'ACCEPTED',
                'IN_DEVELOPMENT',
                'RESOLVED',
                'CLOSED'
            )
        ),
    CONSTRAINT erp_support_status_audit_from_status_valid
        CHECK (
            from_status IS NULL OR
            from_status IN (
                'NEW',
                'IN_REVIEW',
                'NEEDS_EXPLANATION',
                'SUPPORT_IN_PROGRESS',
                'ARCHITECTURE_REJECTED',
                'ACCEPTED',
                'IN_DEVELOPMENT',
                'RESOLVED',
                'CLOSED'
            )
        )
);

CREATE INDEX IF NOT EXISTS
    erp_support_status_audit_ticket_created_idx
    ON public.erp_support_status_audits (
        tenant_id,
        company_id,
        ticket_id,
        created_at
    );

CREATE OR REPLACE FUNCTION public.set_erp_support_ticket_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_erp_support_ticket_updated_at
    ON public.erp_support_tickets;

CREATE TRIGGER trg_erp_support_ticket_updated_at
    BEFORE UPDATE ON public.erp_support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.set_erp_support_ticket_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_erp_support_physical_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'ERP_SUPPORT_PHYSICAL_DELETE_FORBIDDEN';
END;
$$;

DROP TRIGGER IF EXISTS trg_erp_support_ticket_no_delete
    ON public.erp_support_tickets;
CREATE TRIGGER trg_erp_support_ticket_no_delete
    BEFORE DELETE ON public.erp_support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_erp_support_physical_delete();

DROP TRIGGER IF EXISTS trg_erp_support_message_no_delete
    ON public.erp_support_messages;
CREATE TRIGGER trg_erp_support_message_no_delete
    BEFORE DELETE ON public.erp_support_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_erp_support_physical_delete();

DROP TRIGGER IF EXISTS trg_erp_support_audit_no_delete
    ON public.erp_support_status_audits;
CREATE TRIGGER trg_erp_support_audit_no_delete
    BEFORE DELETE ON public.erp_support_status_audits
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_erp_support_physical_delete();

CREATE OR REPLACE FUNCTION public.create_erp_support_ticket_v1(
    p_request JSONB,
    p_actor_user_id TEXT,
    p_user_scope_id UUID,
    p_tenant_id UUID,
    p_company_id UUID,
    p_actor_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ticket_id UUID;
    v_category TEXT;
    v_module_code TEXT;
    v_subject TEXT;
    v_description TEXT;
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:CALLER_ROLE';
    END IF;

    IF p_request IS NULL
       OR jsonb_typeof(p_request) <> 'object' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:REQUEST';
    END IF;

    IF BTRIM(COALESCE(p_actor_user_id, '')) = ''
       OR p_user_scope_id IS NULL
       OR p_tenant_id IS NULL
       OR p_company_id IS NULL
       OR BTRIM(COALESCE(p_actor_role, '')) = '' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:ACTOR_SCOPE';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.erp_user_scopes AS scope
        WHERE scope.user_scope_id = p_user_scope_id
          AND scope.user_id = p_actor_user_id
          AND scope.tenant_id = p_tenant_id
          AND scope.company_id = p_company_id
          AND scope.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:SCOPE_MISMATCH';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.erp_companies AS company
        WHERE company.tenant_id = p_tenant_id
          AND company.company_id = p_company_id
          AND company.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:COMPANY_INACTIVE';
    END IF;

    v_category := BTRIM(COALESCE(p_request ->> 'category', ''));
    v_module_code := BTRIM(COALESCE(p_request ->> 'module_code', ''));
    v_subject := BTRIM(COALESCE(p_request ->> 'subject', ''));
    v_description := BTRIM(COALESCE(p_request ->> 'description', ''));

    IF v_category NOT IN (
        'TECHNICAL',
        'USAGE_SUPPORT',
        'DEVELOPMENT_SUGGESTION',
        'SECURITY',
        'BILLING_LICENSE'
    ) THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:CATEGORY';
    END IF;

    IF CHAR_LENGTH(v_module_code) < 2
       OR CHAR_LENGTH(v_module_code) > 64
       OR v_module_code !~ '^[A-Z0-9_-]+$' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:MODULE';
    END IF;

    IF CHAR_LENGTH(v_subject) < 3
       OR CHAR_LENGTH(v_subject) > 160 THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:SUBJECT';
    END IF;

    IF CHAR_LENGTH(v_description) < 5
       OR CHAR_LENGTH(v_description) > 5000 THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:DESCRIPTION';
    END IF;

    INSERT INTO public.erp_support_tickets (
        tenant_id,
        company_id,
        created_by_user_id,
        created_by_user_scope_id,
        created_by_role,
        category,
        module_code,
        subject,
        description,
        status
    )
    VALUES (
        p_tenant_id,
        p_company_id,
        p_actor_user_id,
        p_user_scope_id,
        p_actor_role,
        v_category,
        v_module_code,
        v_subject,
        v_description,
        'NEW'
    )
    RETURNING ticket_id INTO v_ticket_id;

    INSERT INTO public.erp_support_status_audits (
        ticket_id,
        tenant_id,
        company_id,
        from_status,
        to_status,
        actor_user_id,
        actor_side,
        note
    )
    VALUES (
        v_ticket_id,
        p_tenant_id,
        p_company_id,
        NULL,
        'NEW',
        p_actor_user_id,
        'COMPANY',
        NULL
    );

    RETURN jsonb_build_object(
        'ticket_id', v_ticket_id
    );
END;
$$;

REVOKE ALL
    ON FUNCTION public.create_erp_support_ticket_v1(
        JSONB,
        TEXT,
        UUID,
        UUID,
        UUID,
        TEXT
    )
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.create_erp_support_ticket_v1(
        JSONB,
        TEXT,
        UUID,
        UUID,
        UUID,
        TEXT
    )
    TO service_role;

-- Support V1 message/reply + status transition RPCs.
-- All mutations remain server-only through service_role.
-- Company message creation is exact tenant/company/user-scope scoped.
-- Platform message/status mutations require an active PLATFORM_SUPER_ADMIN.

CREATE OR REPLACE FUNCTION public.add_erp_company_support_message_v1(
    p_ticket_id UUID,
    p_actor_user_id TEXT,
    p_user_scope_id UUID,
    p_tenant_id UUID,
    p_company_id UUID,
    p_actor_role TEXT,
    p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_message_id UUID;
    v_body TEXT := BTRIM(COALESCE(p_body, ''));
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:SERVICE_ROLE_REQUIRED';
    END IF;

    IF CHAR_LENGTH(v_body) < 1 OR CHAR_LENGTH(v_body) > 5000 THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:MESSAGE_BODY';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.erp_user_scopes s
        WHERE s.user_scope_id = p_user_scope_id
          AND s.user_id = p_actor_user_id
          AND s.tenant_id = p_tenant_id
          AND s.company_id = p_company_id
          AND s.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:COMPANY_SCOPE';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.erp_support_tickets t
        WHERE t.ticket_id = p_ticket_id
          AND t.tenant_id = p_tenant_id
          AND t.company_id = p_company_id
    ) THEN
        RAISE EXCEPTION 'ERP_SUPPORT_NOT_FOUND:TICKET';
    END IF;

    INSERT INTO public.erp_support_messages (
        ticket_id,
        tenant_id,
        company_id,
        sender_user_id,
        sender_side,
        sender_role,
        body
    )
    VALUES (
        p_ticket_id,
        p_tenant_id,
        p_company_id,
        p_actor_user_id,
        'COMPANY',
        p_actor_role,
        v_body
    )
    RETURNING message_id INTO v_message_id;

    RETURN jsonb_build_object(
        'message_id', v_message_id,
        'ticket_id', p_ticket_id,
        'tenant_id', p_tenant_id,
        'company_id', p_company_id
    );
END;
$$;

REVOKE ALL
    ON FUNCTION public.add_erp_company_support_message_v1(
        UUID,
        TEXT,
        UUID,
        UUID,
        UUID,
        TEXT,
        TEXT
    )
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.add_erp_company_support_message_v1(
        UUID,
        TEXT,
        UUID,
        UUID,
        UUID,
        TEXT,
        TEXT
    )
    TO service_role;

CREATE OR REPLACE FUNCTION public.add_erp_platform_support_message_v1(
    p_ticket_id UUID,
    p_actor_user_id TEXT,
    p_actor_role TEXT,
    p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_message_id UUID;
    v_tenant_id UUID;
    v_company_id UUID;
    v_body TEXT := BTRIM(COALESCE(p_body, ''));
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:SERVICE_ROLE_REQUIRED';
    END IF;

    IF p_actor_role IS DISTINCT FROM 'PLATFORM_SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:PLATFORM_ROLE';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_actor_user_id
          AND u.role = 'PLATFORM_SUPER_ADMIN'
          AND u."isActive" = TRUE
    ) THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:PLATFORM_ACTOR';
    END IF;

    IF CHAR_LENGTH(v_body) < 1 OR CHAR_LENGTH(v_body) > 5000 THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:MESSAGE_BODY';
    END IF;

    SELECT
        t.tenant_id,
        t.company_id
    INTO
        v_tenant_id,
        v_company_id
    FROM public.erp_support_tickets t
    WHERE t.ticket_id = p_ticket_id;

    IF v_tenant_id IS NULL OR v_company_id IS NULL THEN
        RAISE EXCEPTION 'ERP_SUPPORT_NOT_FOUND:TICKET';
    END IF;

    INSERT INTO public.erp_support_messages (
        ticket_id,
        tenant_id,
        company_id,
        sender_user_id,
        sender_side,
        sender_role,
        body
    )
    VALUES (
        p_ticket_id,
        v_tenant_id,
        v_company_id,
        p_actor_user_id,
        'PLATFORM',
        p_actor_role,
        v_body
    )
    RETURNING message_id INTO v_message_id;

    RETURN jsonb_build_object(
        'message_id', v_message_id,
        'ticket_id', p_ticket_id,
        'tenant_id', v_tenant_id,
        'company_id', v_company_id
    );
END;
$$;

REVOKE ALL
    ON FUNCTION public.add_erp_platform_support_message_v1(
        UUID,
        TEXT,
        TEXT,
        TEXT
    )
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.add_erp_platform_support_message_v1(
        UUID,
        TEXT,
        TEXT,
        TEXT
    )
    TO service_role;

CREATE OR REPLACE FUNCTION public.transition_erp_support_ticket_status_v1(
    p_ticket_id UUID,
    p_actor_user_id TEXT,
    p_actor_role TEXT,
    p_to_status TEXT,
    p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id UUID;
    v_company_id UUID;
    v_from_status TEXT;
    v_to_status TEXT := BTRIM(COALESCE(p_to_status, ''));
    v_note TEXT := NULLIF(BTRIM(COALESCE(p_note, '')), '');
    v_audit_id UUID;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:SERVICE_ROLE_REQUIRED';
    END IF;

    IF p_actor_role IS DISTINCT FROM 'PLATFORM_SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:PLATFORM_ROLE';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_actor_user_id
          AND u.role = 'PLATFORM_SUPER_ADMIN'
          AND u."isActive" = TRUE
    ) THEN
        RAISE EXCEPTION 'ERP_SUPPORT_FORBIDDEN:PLATFORM_ACTOR';
    END IF;

    IF v_to_status NOT IN (
        'NEW',
        'IN_REVIEW',
        'NEEDS_EXPLANATION',
        'SUPPORT_IN_PROGRESS',
        'ARCHITECTURE_REJECTED',
        'ACCEPTED',
        'IN_DEVELOPMENT',
        'RESOLVED',
        'CLOSED'
    ) THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:STATUS';
    END IF;

    IF v_note IS NOT NULL AND CHAR_LENGTH(v_note) > 2000 THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:STATUS_NOTE';
    END IF;

    SELECT
        t.tenant_id,
        t.company_id,
        t.status
    INTO
        v_tenant_id,
        v_company_id,
        v_from_status
    FROM public.erp_support_tickets t
    WHERE t.ticket_id = p_ticket_id
    FOR UPDATE;

    IF v_tenant_id IS NULL OR v_company_id IS NULL THEN
        RAISE EXCEPTION 'ERP_SUPPORT_NOT_FOUND:TICKET';
    END IF;

    IF v_from_status = 'CLOSED' THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:CLOSED_IS_FINAL';
    END IF;

    IF v_from_status = v_to_status THEN
        RAISE EXCEPTION 'ERP_SUPPORT_INVALID:NO_STATUS_CHANGE';
    END IF;

    UPDATE public.erp_support_tickets
    SET
        status = v_to_status,
        resolved_at = CASE
            WHEN v_to_status = 'RESOLVED'
                THEN COALESCE(resolved_at, NOW())
            ELSE resolved_at
        END,
        closed_at = CASE
            WHEN v_to_status = 'CLOSED'
                THEN COALESCE(closed_at, NOW())
            ELSE closed_at
        END
    WHERE ticket_id = p_ticket_id
      AND tenant_id = v_tenant_id
      AND company_id = v_company_id;

    INSERT INTO public.erp_support_status_audits (
        ticket_id,
        tenant_id,
        company_id,
        from_status,
        to_status,
        actor_user_id,
        actor_side,
        note
    )
    VALUES (
        p_ticket_id,
        v_tenant_id,
        v_company_id,
        v_from_status,
        v_to_status,
        p_actor_user_id,
        'PLATFORM',
        v_note
    )
    RETURNING audit_id INTO v_audit_id;

    RETURN jsonb_build_object(
        'audit_id', v_audit_id,
        'ticket_id', p_ticket_id,
        'tenant_id', v_tenant_id,
        'company_id', v_company_id,
        'from_status', v_from_status,
        'to_status', v_to_status
    );
END;
$$;

REVOKE ALL
    ON FUNCTION public.transition_erp_support_ticket_status_v1(
        UUID,
        TEXT,
        TEXT,
        TEXT,
        TEXT
    )
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.transition_erp_support_ticket_status_v1(
        UUID,
        TEXT,
        TEXT,
        TEXT,
        TEXT
    )
    TO service_role;
ALTER TABLE public.erp_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_support_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.erp_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_support_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.erp_support_status_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_support_status_audits FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
    ON TABLE public.erp_support_tickets
    FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES
    ON TABLE public.erp_support_messages
    FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES
    ON TABLE public.erp_support_status_audits
    FROM PUBLIC, anon, authenticated;

COMMIT;