-- ENVerp MEDIA STAGE 2 E2E V1
-- RPC + exact scope + immutable audit
-- Requires: MEDIA FOUNDATION V3 already applied and verified.
-- Storage bucket is created through Supabase Storage API, never by mutating storage schema directly.
--
-- BINDING:
-- - service_role only
-- - exact actor user_scope + tenant/company/branch/period
-- - server remains responsible for role/target authorization
-- - PHOTO canonical upload only in this package (image/webp)
-- - VIDEO upload remains fail-closed until a real client-side video compression contract exists
-- - no physical canonical row delete
-- - archive != asset delete
-- - replacement is atomic and reciprocal
-- - idempotency key + semantic hash conflict fails closed

begin;

alter table public.media_upload_intents
    add column replace_link_id uuid null;

alter table public.media_upload_intents
    add constraint media_upload_intents_replace_link_scope_fk
    foreign key (replace_link_id, tenant_id, company_id)
    references public.media_links (id, tenant_id, company_id)
    on delete restrict;

create function public.enverp_media_assert_service_actor_v1(
    p_actor_user_id text,
    p_actor_user_scope_id uuid,
    p_tenant_id uuid,
    p_company_id uuid,
    p_branch_id uuid,
    p_accounting_period_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'ENVERP_MEDIA_FORBIDDEN:SERVICE_ROLE_REQUIRED';
    end if;

    if not exists (
        select 1
        from public.erp_user_scopes s
        where s.user_scope_id = p_actor_user_scope_id
          and s.user_id = p_actor_user_id
          and s.tenant_id = p_tenant_id
          and s.company_id = p_company_id
          and s.branch_id = p_branch_id
          and s.accounting_period_id = p_accounting_period_id
          and s.is_active = true
    ) then
        raise exception 'ENVERP_MEDIA_FORBIDDEN:ACTOR_SCOPE';
    end if;
end;
$$;

create function public.prepare_media_upload_v1(
    p_actor_user_id text,
    p_actor_user_scope_id uuid,
    p_tenant_id uuid,
    p_company_id uuid,
    p_branch_id uuid,
    p_accounting_period_id uuid,
    p_target_type text,
    p_target_id text,
    p_purpose text,
    p_expected_mime_type text,
    p_expected_byte_size bigint,
    p_expected_checksum_sha256 text,
    p_idempotency_key text,
    p_semantic_hash text,
    p_replace_link_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_existing public.media_upload_intents%rowtype;
    v_intent_id uuid;
    v_storage_key text;
begin
    perform public.enverp_media_assert_service_actor_v1(
        p_actor_user_id,
        p_actor_user_scope_id,
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id
    );

    if p_expected_mime_type <> 'image/webp' then
        raise exception 'ENVERP_MEDIA_INVALID:MIME';
    end if;

    if p_expected_byte_size < 1 or p_expected_byte_size > 4194304 then
        raise exception 'ENVERP_MEDIA_INVALID:BYTE_SIZE';
    end if;

    if coalesce(p_expected_checksum_sha256, '') !~ '^[A-Fa-f0-9]{64}$' then
        raise exception 'ENVERP_MEDIA_INVALID:CHECKSUM';
    end if;

    if coalesce(p_semantic_hash, '') !~ '^[A-Fa-f0-9]{64}$' then
        raise exception 'ENVERP_MEDIA_INVALID:SEMANTIC_HASH';
    end if;

    if length(btrim(coalesce(p_idempotency_key, ''))) < 8
       or length(p_idempotency_key) > 200
    then
        raise exception 'ENVERP_MEDIA_INVALID:IDEMPOTENCY_KEY';
    end if;

    select *
    into v_existing
    from public.media_upload_intents i
    where i.tenant_id = p_tenant_id
      and i.company_id = p_company_id
      and i.idempotency_key = p_idempotency_key
    for update;

    if found then
        if lower(v_existing.semantic_hash) <> lower(p_semantic_hash) then
            raise exception 'ENVERP_MEDIA_IDEMPOTENCY_CONFLICT';
        end if;

        return jsonb_build_object(
            'replay', true,
            'intent_id', v_existing.id,
            'status', v_existing.status,
            'storage_bucket', v_existing.temp_storage_bucket,
            'storage_key', v_existing.temp_storage_key,
            'expires_at', v_existing.expires_at,
            'committed_asset_id', v_existing.committed_asset_id,
            'committed_link_id', v_existing.committed_link_id
        );
    end if;

    if p_replace_link_id is not null then
        if not exists (
            select 1
            from public.media_links l
            where l.id = p_replace_link_id
              and l.tenant_id = p_tenant_id
              and l.company_id = p_company_id
              and l.branch_id = p_branch_id
              and l.accounting_period_id = p_accounting_period_id
              and l.target_type = p_target_type
              and l.target_id = p_target_id
              and l.purpose = p_purpose
              and l.status = 'ACTIVE'
        ) then
            raise exception 'ENVERP_MEDIA_REPLACE_LINK_INVALID';
        end if;
    end if;

    v_intent_id := gen_random_uuid();
    v_storage_key :=
        p_tenant_id::text || '/' ||
        p_company_id::text || '/' ||
        p_branch_id::text || '/' ||
        p_accounting_period_id::text || '/' ||
        v_intent_id::text || '.webp';

    insert into public.media_upload_intents (
        id,
        tenant_id,
        company_id,
        branch_id,
        accounting_period_id,
        actor_user_id,
        actor_user_scope_id,
        target_type,
        target_id,
        purpose,
        expected_media_kind,
        expected_mime_type,
        expected_byte_size,
        expected_checksum_sha256,
        idempotency_key,
        semantic_hash,
        temp_storage_bucket,
        temp_storage_key,
        replace_link_id,
        status,
        expires_at
    )
    values (
        v_intent_id,
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id,
        p_actor_user_id,
        p_actor_user_scope_id,
        p_target_type,
        p_target_id,
        p_purpose,
        'PHOTO',
        'image/webp',
        p_expected_byte_size,
        lower(p_expected_checksum_sha256),
        p_idempotency_key,
        lower(p_semantic_hash),
        'enverp-media',
        v_storage_key,
        p_replace_link_id,
        'PREPARED',
        now() + interval '2 hours'
    );

    insert into public.media_audits (
        tenant_id,
        company_id,
        branch_id,
        accounting_period_id,
        actor_user_id,
        actor_user_scope_id,
        event_type,
        operation_id,
        idempotency_key,
        upload_intent_id,
        target_type,
        target_id,
        payload_hash,
        detail
    )
    values (
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id,
        p_actor_user_id,
        p_actor_user_scope_id,
        'UPLOAD_PREPARED',
        v_intent_id,
        p_idempotency_key,
        v_intent_id,
        p_target_type,
        p_target_id,
        lower(p_semantic_hash),
        jsonb_build_object(
            'purpose', p_purpose,
            'mime_type', 'image/webp',
            'byte_size', p_expected_byte_size,
            'replace', p_replace_link_id is not null
        )
    );

    return jsonb_build_object(
        'replay', false,
        'intent_id', v_intent_id,
        'status', 'PREPARED',
        'storage_bucket', 'enverp-media',
        'storage_key', v_storage_key,
        'expires_at', now() + interval '2 hours'
    );
end;
$$;

create function public.inspect_media_upload_intent_v1(
    p_actor_user_id text,
    p_actor_user_scope_id uuid,
    p_tenant_id uuid,
    p_company_id uuid,
    p_branch_id uuid,
    p_accounting_period_id uuid,
    p_intent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_intent public.media_upload_intents%rowtype;
begin
    perform public.enverp_media_assert_service_actor_v1(
        p_actor_user_id,
        p_actor_user_scope_id,
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id
    );

    select *
    into v_intent
    from public.media_upload_intents i
    where i.id = p_intent_id
      and i.tenant_id = p_tenant_id
      and i.company_id = p_company_id
      and i.branch_id = p_branch_id
      and i.accounting_period_id = p_accounting_period_id
      and i.actor_user_id = p_actor_user_id
      and i.actor_user_scope_id = p_actor_user_scope_id;

    if not found then
        raise exception 'ENVERP_MEDIA_INTENT_NOT_FOUND';
    end if;

    return jsonb_build_object(
        'intent_id', v_intent.id,
        'status', v_intent.status,
        'storage_bucket', v_intent.temp_storage_bucket,
        'storage_key', v_intent.temp_storage_key,
        'expected_mime_type', v_intent.expected_mime_type,
        'expected_byte_size', v_intent.expected_byte_size,
        'expected_checksum_sha256', v_intent.expected_checksum_sha256,
        'expires_at', v_intent.expires_at,
        'committed_asset_id', v_intent.committed_asset_id,
        'committed_link_id', v_intent.committed_link_id
    );
end;
$$;

create function public.replace_entity_media_v1(
    p_actor_user_id text,
    p_actor_user_scope_id uuid,
    p_tenant_id uuid,
    p_company_id uuid,
    p_branch_id uuid,
    p_accounting_period_id uuid,
    p_old_link_id uuid,
    p_new_link_id uuid,
    p_operation_id uuid,
    p_idempotency_key text,
    p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_old public.media_links%rowtype;
    v_new public.media_links%rowtype;
begin
    perform public.enverp_media_assert_service_actor_v1(
        p_actor_user_id,
        p_actor_user_scope_id,
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id
    );

    select *
    into v_old
    from public.media_links l
    where l.id = p_old_link_id
      and l.tenant_id = p_tenant_id
      and l.company_id = p_company_id
      and l.branch_id = p_branch_id
      and l.accounting_period_id = p_accounting_period_id
    for update;

    if not found or v_old.status <> 'ACTIVE' then
        raise exception 'ENVERP_MEDIA_REPLACE_OLD_LINK_INVALID';
    end if;

    select *
    into v_new
    from public.media_links l
    where l.id = p_new_link_id
      and l.tenant_id = p_tenant_id
      and l.company_id = p_company_id
      and l.branch_id = p_branch_id
      and l.accounting_period_id = p_accounting_period_id
    for update;

    if not found
       or v_new.status <> 'ACTIVE'
       or v_new.supersedes_link_id is distinct from v_old.id
       or v_new.target_type <> v_old.target_type
       or v_new.target_id <> v_old.target_id
       or v_new.purpose <> v_old.purpose
    then
        raise exception 'ENVERP_MEDIA_REPLACE_NEW_LINK_INVALID';
    end if;

    update public.media_links
    set
        status = 'SUPERSEDED',
        superseded_at = now(),
        superseded_by_user_id = p_actor_user_id,
        superseded_by_link_id = v_new.id
    where id = v_old.id
      and tenant_id = p_tenant_id
      and company_id = p_company_id;

    insert into public.media_audits (
        tenant_id,
        company_id,
        branch_id,
        accounting_period_id,
        actor_user_id,
        actor_user_scope_id,
        event_type,
        operation_id,
        idempotency_key,
        asset_id,
        link_id,
        target_type,
        target_id,
        payload_hash,
        detail
    )
    values (
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id,
        p_actor_user_id,
        p_actor_user_scope_id,
        'LINK_SUPERSEDED',
        p_operation_id,
        p_idempotency_key,
        v_old.asset_id,
        v_old.id,
        v_old.target_type,
        v_old.target_id,
        lower(p_payload_hash),
        jsonb_build_object('superseded_by_link_id', v_new.id)
    )
    on conflict (tenant_id, company_id, operation_id, event_type) do nothing;

    return jsonb_build_object(
        'old_link_id', v_old.id,
        'new_link_id', v_new.id,
        'status', 'SUPERSEDED'
    );
end;
$$;

create function public.finalize_media_upload_v1(
    p_actor_user_id text,
    p_actor_user_scope_id uuid,
    p_tenant_id uuid,
    p_company_id uuid,
    p_branch_id uuid,
    p_accounting_period_id uuid,
    p_intent_id uuid,
    p_actual_mime_type text,
    p_actual_byte_size bigint,
    p_actual_checksum_sha256 text,
    p_width_px integer,
    p_height_px integer,
    p_source_filename text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_intent public.media_upload_intents%rowtype;
    v_asset public.media_assets%rowtype;
    v_link public.media_links%rowtype;
    v_asset_created boolean := false;
    v_link_created boolean := false;
    v_delete_uploaded_duplicate boolean := false;
begin
    perform public.enverp_media_assert_service_actor_v1(
        p_actor_user_id,
        p_actor_user_scope_id,
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id
    );

    select *
    into v_intent
    from public.media_upload_intents i
    where i.id = p_intent_id
      and i.tenant_id = p_tenant_id
      and i.company_id = p_company_id
      and i.branch_id = p_branch_id
      and i.accounting_period_id = p_accounting_period_id
      and i.actor_user_id = p_actor_user_id
      and i.actor_user_scope_id = p_actor_user_scope_id
    for update;

    if not found then
        raise exception 'ENVERP_MEDIA_INTENT_NOT_FOUND';
    end if;

    if v_intent.status = 'COMMITTED' then
        return jsonb_build_object(
            'replay', true,
            'intent_id', v_intent.id,
            'asset_id', v_intent.committed_asset_id,
            'link_id', v_intent.committed_link_id,
            'delete_uploaded_duplicate', false
        );
    end if;

    if v_intent.status <> 'PREPARED' then
        raise exception 'ENVERP_MEDIA_INTENT_STATE_INVALID:%', v_intent.status;
    end if;

    if v_intent.expires_at <= now() then
        update public.media_upload_intents
        set status = 'EXPIRED'
        where id = v_intent.id;
        raise exception 'ENVERP_MEDIA_INTENT_EXPIRED';
    end if;

    if p_actual_mime_type <> v_intent.expected_mime_type
       or p_actual_byte_size <> v_intent.expected_byte_size
       or lower(p_actual_checksum_sha256) <> lower(v_intent.expected_checksum_sha256)
    then
        raise exception 'ENVERP_MEDIA_UPLOAD_VERIFICATION_MISMATCH';
    end if;

    if p_actual_mime_type <> 'image/webp'
       or p_width_px is null or p_width_px < 1 or p_width_px > 2048
       or p_height_px is null or p_height_px < 1 or p_height_px > 2048
    then
        raise exception 'ENVERP_MEDIA_IMAGE_DIMENSIONS_INVALID';
    end if;

    update public.media_upload_intents
    set
        status = 'UPLOADED_TEMP',
        uploaded_temp_at = now()
    where id = v_intent.id;

    insert into public.media_audits (
        tenant_id, company_id, branch_id, accounting_period_id,
        actor_user_id, actor_user_scope_id,
        event_type, operation_id, idempotency_key,
        upload_intent_id, target_type, target_id,
        payload_hash, detail
    )
    values (
        p_tenant_id, p_company_id, p_branch_id, p_accounting_period_id,
        p_actor_user_id, p_actor_user_scope_id,
        'UPLOAD_TEMP_CONFIRMED', v_intent.id, v_intent.idempotency_key,
        v_intent.id, v_intent.target_type, v_intent.target_id,
        lower(v_intent.semantic_hash),
        jsonb_build_object('verified', true)
    );

    update public.media_upload_intents
    set
        status = 'FINALIZING',
        finalizing_at = now()
    where id = v_intent.id;

    insert into public.media_audits (
        tenant_id, company_id, branch_id, accounting_period_id,
        actor_user_id, actor_user_scope_id,
        event_type, operation_id, idempotency_key,
        upload_intent_id, target_type, target_id,
        payload_hash, detail
    )
    values (
        p_tenant_id, p_company_id, p_branch_id, p_accounting_period_id,
        p_actor_user_id, p_actor_user_scope_id,
        'FINALIZE_STARTED', v_intent.id, v_intent.idempotency_key,
        v_intent.id, v_intent.target_type, v_intent.target_id,
        lower(v_intent.semantic_hash),
        '{}'::jsonb
    );

    select *
    into v_asset
    from public.media_assets a
    where a.tenant_id = p_tenant_id
      and a.company_id = p_company_id
      and lower(a.checksum_sha256) = lower(p_actual_checksum_sha256)
      and a.byte_size = p_actual_byte_size
      and a.mime_type = p_actual_mime_type
      and a.asset_state <> 'STORAGE_DELETED'
    limit 1;

    if not found then
        insert into public.media_assets (
            tenant_id,
            company_id,
            storage_bucket,
            storage_key,
            media_kind,
            mime_type,
            byte_size,
            checksum_sha256,
            source_filename,
            width_px,
            height_px,
            created_by_user_id,
            created_by_user_scope_id
        )
        values (
            p_tenant_id,
            p_company_id,
            v_intent.temp_storage_bucket,
            v_intent.temp_storage_key,
            'PHOTO',
            p_actual_mime_type,
            p_actual_byte_size,
            lower(p_actual_checksum_sha256),
            nullif(btrim(coalesce(p_source_filename, '')), ''),
            p_width_px,
            p_height_px,
            p_actor_user_id,
            p_actor_user_scope_id
        )
        returning * into v_asset;

        v_asset_created := true;
    else
        v_delete_uploaded_duplicate :=
            v_asset.storage_bucket <> v_intent.temp_storage_bucket
            or v_asset.storage_key <> v_intent.temp_storage_key;
    end if;

    if v_intent.replace_link_id is not null then
        if exists (
            select 1
            from public.media_links old_l
            where old_l.id = v_intent.replace_link_id
              and old_l.tenant_id = p_tenant_id
              and old_l.company_id = p_company_id
              and old_l.asset_id = v_asset.id
        ) then
            raise exception 'ENVERP_MEDIA_REPLACE_SAME_ASSET';
        end if;

        insert into public.media_links (
            tenant_id,
            company_id,
            branch_id,
            accounting_period_id,
            asset_id,
            target_type,
            target_id,
            purpose,
            status,
            supersedes_link_id,
            created_by_user_id,
            created_by_user_scope_id
        )
        values (
            p_tenant_id,
            p_company_id,
            p_branch_id,
            p_accounting_period_id,
            v_asset.id,
            v_intent.target_type,
            v_intent.target_id,
            v_intent.purpose,
            'ACTIVE',
            v_intent.replace_link_id,
            p_actor_user_id,
            p_actor_user_scope_id
        )
        returning * into v_link;

        v_link_created := true;

        perform public.replace_entity_media_v1(
            p_actor_user_id,
            p_actor_user_scope_id,
            p_tenant_id,
            p_company_id,
            p_branch_id,
            p_accounting_period_id,
            v_intent.replace_link_id,
            v_link.id,
            v_intent.id,
            v_intent.idempotency_key,
            v_intent.semantic_hash
        );
    else
        select *
        into v_link
        from public.media_links l
        where l.tenant_id = p_tenant_id
          and l.company_id = p_company_id
          and l.branch_id = p_branch_id
          and l.accounting_period_id = p_accounting_period_id
          and l.asset_id = v_asset.id
          and l.target_type = v_intent.target_type
          and l.target_id = v_intent.target_id
          and l.purpose = v_intent.purpose
          and l.status = 'ACTIVE'
        limit 1;

        if not found then
            insert into public.media_links (
                tenant_id,
                company_id,
                branch_id,
                accounting_period_id,
                asset_id,
                target_type,
                target_id,
                purpose,
                status,
                created_by_user_id,
                created_by_user_scope_id
            )
            values (
                p_tenant_id,
                p_company_id,
                p_branch_id,
                p_accounting_period_id,
                v_asset.id,
                v_intent.target_type,
                v_intent.target_id,
                v_intent.purpose,
                'ACTIVE',
                p_actor_user_id,
                p_actor_user_scope_id
            )
            returning * into v_link;

            v_link_created := true;
        end if;
    end if;

    insert into public.media_audits (
        tenant_id, company_id, branch_id, accounting_period_id,
        actor_user_id, actor_user_scope_id,
        event_type, operation_id, idempotency_key,
        asset_id, link_id, upload_intent_id,
        target_type, target_id, payload_hash, detail
    )
    values (
        p_tenant_id, p_company_id, p_branch_id, p_accounting_period_id,
        p_actor_user_id, p_actor_user_scope_id,
        'ASSET_COMMITTED', v_intent.id, v_intent.idempotency_key,
        v_asset.id, v_link.id, v_intent.id,
        v_intent.target_type, v_intent.target_id,
        lower(v_intent.semantic_hash),
        jsonb_build_object('asset_created', v_asset_created)
    );

    if v_link_created then
        insert into public.media_audits (
            tenant_id, company_id, branch_id, accounting_period_id,
            actor_user_id, actor_user_scope_id,
            event_type, operation_id, idempotency_key,
            asset_id, link_id, upload_intent_id,
            target_type, target_id, payload_hash, detail
        )
        values (
            p_tenant_id, p_company_id, p_branch_id, p_accounting_period_id,
            p_actor_user_id, p_actor_user_scope_id,
            'LINK_CREATED', v_intent.id, v_intent.idempotency_key,
            v_asset.id, v_link.id, v_intent.id,
            v_intent.target_type, v_intent.target_id,
            lower(v_intent.semantic_hash),
            jsonb_build_object('purpose', v_intent.purpose)
        );
    end if;

    update public.media_upload_intents
    set
        status = 'COMMITTED',
        committed_asset_id = v_asset.id,
        committed_link_id = v_link.id,
        committed_at = now(),
        failure_code = null,
        failure_detail = null,
        failed_at = null
    where id = v_intent.id;

    return jsonb_build_object(
        'replay', false,
        'intent_id', v_intent.id,
        'asset_id', v_asset.id,
        'link_id', v_link.id,
        'asset_created', v_asset_created,
        'link_created', v_link_created,
        'delete_uploaded_duplicate', v_delete_uploaded_duplicate,
        'duplicate_storage_bucket', case when v_delete_uploaded_duplicate then v_intent.temp_storage_bucket else null end,
        'duplicate_storage_key', case when v_delete_uploaded_duplicate then v_intent.temp_storage_key else null end
    );
end;
$$;

create function public.mark_media_upload_failed_v1(
    p_actor_user_id text,
    p_actor_user_scope_id uuid,
    p_tenant_id uuid,
    p_company_id uuid,
    p_branch_id uuid,
    p_accounting_period_id uuid,
    p_intent_id uuid,
    p_failure_code text,
    p_retryable boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_intent public.media_upload_intents%rowtype;
    v_status text;
begin
    perform public.enverp_media_assert_service_actor_v1(
        p_actor_user_id,
        p_actor_user_scope_id,
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id
    );

    select *
    into v_intent
    from public.media_upload_intents i
    where i.id = p_intent_id
      and i.tenant_id = p_tenant_id
      and i.company_id = p_company_id
      and i.branch_id = p_branch_id
      and i.accounting_period_id = p_accounting_period_id
      and i.actor_user_id = p_actor_user_id
      and i.actor_user_scope_id = p_actor_user_scope_id
    for update;

    if not found then
        raise exception 'ENVERP_MEDIA_INTENT_NOT_FOUND';
    end if;

    if v_intent.status = 'COMMITTED' then
        return jsonb_build_object('status', 'COMMITTED', 'ignored', true);
    end if;

    if v_intent.status in ('FAILED','FAILED_RETRYABLE','EXPIRED') then
        return jsonb_build_object('status', v_intent.status, 'replay', true);
    end if;

    v_status := case when p_retryable then 'FAILED_RETRYABLE' else 'FAILED' end;

    update public.media_upload_intents
    set
        status = v_status,
        failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'UNKNOWN'), 120),
        failure_detail = null,
        failed_at = now()
    where id = v_intent.id;

    insert into public.media_audits (
        tenant_id, company_id, branch_id, accounting_period_id,
        actor_user_id, actor_user_scope_id,
        event_type, operation_id, idempotency_key,
        upload_intent_id, target_type, target_id,
        payload_hash, detail
    )
    values (
        p_tenant_id, p_company_id, p_branch_id, p_accounting_period_id,
        p_actor_user_id, p_actor_user_scope_id,
        'UPLOAD_FAILED', v_intent.id, v_intent.idempotency_key,
        v_intent.id, v_intent.target_type, v_intent.target_id,
        lower(v_intent.semantic_hash),
        jsonb_build_object('failure_code', left(coalesce(p_failure_code, 'UNKNOWN'), 120), 'retryable', p_retryable)
    )
    on conflict (tenant_id, company_id, operation_id, event_type) do nothing;

    return jsonb_build_object('status', v_status);
end;
$$;

create function public.list_entity_media_v1(
    p_actor_user_id text,
    p_actor_user_scope_id uuid,
    p_tenant_id uuid,
    p_company_id uuid,
    p_branch_id uuid,
    p_accounting_period_id uuid,
    p_target_type text,
    p_target_id text
)
returns table (
    link_id uuid,
    asset_id uuid,
    purpose text,
    media_kind text,
    mime_type text,
    byte_size bigint,
    width_px integer,
    height_px integer,
    storage_bucket text,
    storage_key text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    perform public.enverp_media_assert_service_actor_v1(
        p_actor_user_id,
        p_actor_user_scope_id,
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id
    );

    return query
    select
        l.id,
        a.id,
        l.purpose,
        a.media_kind,
        a.mime_type,
        a.byte_size,
        a.width_px,
        a.height_px,
        a.storage_bucket,
        a.storage_key,
        l.created_at
    from public.media_links l
    join public.media_assets a
      on a.id = l.asset_id
     and a.tenant_id = l.tenant_id
     and a.company_id = l.company_id
    where l.tenant_id = p_tenant_id
      and l.company_id = p_company_id
      and l.branch_id = p_branch_id
      and l.accounting_period_id = p_accounting_period_id
      and l.target_type = p_target_type
      and l.target_id = p_target_id
      and l.status = 'ACTIVE'
      and a.asset_state = 'ACTIVE'
    order by l.sort_order, l.created_at, l.id;
end;
$$;

create function public.archive_entity_media_link_v1(
    p_actor_user_id text,
    p_actor_user_scope_id uuid,
    p_tenant_id uuid,
    p_company_id uuid,
    p_branch_id uuid,
    p_accounting_period_id uuid,
    p_link_id uuid,
    p_reason text,
    p_operation_id uuid,
    p_idempotency_key text,
    p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_link public.media_links%rowtype;
begin
    perform public.enverp_media_assert_service_actor_v1(
        p_actor_user_id,
        p_actor_user_scope_id,
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id
    );

    select *
    into v_link
    from public.media_links l
    where l.id = p_link_id
      and l.tenant_id = p_tenant_id
      and l.company_id = p_company_id
      and l.branch_id = p_branch_id
      and l.accounting_period_id = p_accounting_period_id
    for update;

    if not found then
        raise exception 'ENVERP_MEDIA_LINK_NOT_FOUND';
    end if;

    if v_link.status = 'ARCHIVED' then
        return jsonb_build_object('link_id', v_link.id, 'status', 'ARCHIVED', 'replay', true);
    end if;

    if v_link.status <> 'ACTIVE' then
        raise exception 'ENVERP_MEDIA_LINK_ARCHIVE_STATE_INVALID:%', v_link.status;
    end if;

    update public.media_links
    set
        status = 'ARCHIVED',
        archived_at = now(),
        archived_by_user_id = p_actor_user_id,
        archive_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = v_link.id
      and tenant_id = p_tenant_id
      and company_id = p_company_id;

    insert into public.media_audits (
        tenant_id, company_id, branch_id, accounting_period_id,
        actor_user_id, actor_user_scope_id,
        event_type, operation_id, idempotency_key,
        asset_id, link_id, target_type, target_id,
        payload_hash, detail
    )
    values (
        p_tenant_id, p_company_id, p_branch_id, p_accounting_period_id,
        p_actor_user_id, p_actor_user_scope_id,
        'LINK_ARCHIVED', p_operation_id, p_idempotency_key,
        v_link.asset_id, v_link.id, v_link.target_type, v_link.target_id,
        lower(p_payload_hash),
        jsonb_build_object('reason_present', length(btrim(coalesce(p_reason, ''))) > 0)
    )
    on conflict (tenant_id, company_id, operation_id, event_type) do nothing;

    return jsonb_build_object('link_id', v_link.id, 'status', 'ARCHIVED');
end;
$$;

create function public.restore_entity_media_link_v1(
    p_actor_user_id text,
    p_actor_user_scope_id uuid,
    p_tenant_id uuid,
    p_company_id uuid,
    p_branch_id uuid,
    p_accounting_period_id uuid,
    p_link_id uuid,
    p_operation_id uuid,
    p_idempotency_key text,
    p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_link public.media_links%rowtype;
begin
    perform public.enverp_media_assert_service_actor_v1(
        p_actor_user_id,
        p_actor_user_scope_id,
        p_tenant_id,
        p_company_id,
        p_branch_id,
        p_accounting_period_id
    );

    select *
    into v_link
    from public.media_links l
    where l.id = p_link_id
      and l.tenant_id = p_tenant_id
      and l.company_id = p_company_id
      and l.branch_id = p_branch_id
      and l.accounting_period_id = p_accounting_period_id
    for update;

    if not found then
        raise exception 'ENVERP_MEDIA_LINK_NOT_FOUND';
    end if;

    if v_link.status = 'ACTIVE' then
        return jsonb_build_object('link_id', v_link.id, 'status', 'ACTIVE', 'replay', true);
    end if;

    if v_link.status <> 'ARCHIVED' then
        raise exception 'ENVERP_MEDIA_LINK_RESTORE_STATE_INVALID:%', v_link.status;
    end if;

    update public.media_links
    set
        status = 'ACTIVE',
        archived_at = null,
        archived_by_user_id = null,
        archive_reason = null
    where id = v_link.id
      and tenant_id = p_tenant_id
      and company_id = p_company_id;

    insert into public.media_audits (
        tenant_id, company_id, branch_id, accounting_period_id,
        actor_user_id, actor_user_scope_id,
        event_type, operation_id, idempotency_key,
        asset_id, link_id, target_type, target_id,
        payload_hash, detail
    )
    values (
        p_tenant_id, p_company_id, p_branch_id, p_accounting_period_id,
        p_actor_user_id, p_actor_user_scope_id,
        'LINK_RESTORED', p_operation_id, p_idempotency_key,
        v_link.asset_id, v_link.id, v_link.target_type, v_link.target_id,
        lower(p_payload_hash),
        '{}'::jsonb
    )
    on conflict (tenant_id, company_id, operation_id, event_type) do nothing;

    return jsonb_build_object('link_id', v_link.id, 'status', 'ACTIVE');
end;
$$;

-- Direct table access remains denied.
-- Only narrow service-role RPC execution is exposed.
revoke all on function public.enverp_media_assert_service_actor_v1(text, uuid, uuid, uuid, uuid, uuid)
    from public, anon, authenticated, service_role;

revoke all on function public.prepare_media_upload_v1(text, uuid, uuid, uuid, uuid, uuid, text, text, text, text, bigint, text, text, text, uuid)
    from public, anon, authenticated;
grant execute on function public.prepare_media_upload_v1(text, uuid, uuid, uuid, uuid, uuid, text, text, text, text, bigint, text, text, text, uuid)
    to service_role;

revoke all on function public.inspect_media_upload_intent_v1(text, uuid, uuid, uuid, uuid, uuid, uuid)
    from public, anon, authenticated;
grant execute on function public.inspect_media_upload_intent_v1(text, uuid, uuid, uuid, uuid, uuid, uuid)
    to service_role;

revoke all on function public.finalize_media_upload_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, text, bigint, text, integer, integer, text)
    from public, anon, authenticated;
grant execute on function public.finalize_media_upload_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, text, bigint, text, integer, integer, text)
    to service_role;

revoke all on function public.mark_media_upload_failed_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean)
    from public, anon, authenticated;
grant execute on function public.mark_media_upload_failed_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean)
    to service_role;

revoke all on function public.list_entity_media_v1(text, uuid, uuid, uuid, uuid, uuid, text, text)
    from public, anon, authenticated;
grant execute on function public.list_entity_media_v1(text, uuid, uuid, uuid, uuid, uuid, text, text)
    to service_role;

revoke all on function public.archive_entity_media_link_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text)
    from public, anon, authenticated;
grant execute on function public.archive_entity_media_link_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text)
    to service_role;

revoke all on function public.restore_entity_media_link_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text)
    from public, anon, authenticated;
grant execute on function public.restore_entity_media_link_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text)
    to service_role;

revoke all on function public.replace_entity_media_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text)
    from public, anon, authenticated;
grant execute on function public.replace_entity_media_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text)
    to service_role;

commit;
