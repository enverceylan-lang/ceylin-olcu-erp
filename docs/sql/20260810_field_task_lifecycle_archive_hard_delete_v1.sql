-- ENVerp — Field Task Lifecycle Archive + Admin Hard Delete V1
-- SOURCE ONLY. Do not run automatically.
-- Deployment order: this SQL must be applied before application code using these columns/table/RPC.

BEGIN;

ALTER TABLE public.field_tasks
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_id text,
  ADD COLUMN IF NOT EXISTS cancelled_by_name text,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by_id text,
  ADD COLUMN IF NOT EXISTS archived_by_name text;

CREATE INDEX IF NOT EXISTS idx_field_tasks_scope_archived
ON public.field_tasks (
  tenant_id,
  company_id,
  branch_id,
  accounting_period_id,
  archived_at
);

CREATE TABLE IF NOT EXISTS public.field_task_tombstones (
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  accounting_period_id uuid NOT NULL,
  task_id text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by_id text NOT NULL,
  deleted_by_name text NOT NULL,
  deletion_reason text NOT NULL,
  task_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    task_id
  )
);

ALTER TABLE public.field_task_tombstones
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_field_task_tombstones_scope_deleted
ON public.field_task_tombstones (
  tenant_id,
  company_id,
  branch_id,
  accounting_period_id,
  deleted_at DESC
);

CREATE OR REPLACE FUNCTION public.admin_hard_delete_field_task_v1(
  p_tenant_id uuid,
  p_company_id uuid,
  p_branch_id uuid,
  p_accounting_period_id uuid,
  p_task_id text,
  p_actor_id text,
  p_actor_name text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task public.field_tasks%ROWTYPE;
  v_existing_tombstone public.field_task_tombstones%ROWTYPE;
BEGIN
  IF length(trim(coalesce(p_task_id, ''))) = 0 THEN
    RAISE EXCEPTION 'TASK_ID_REQUIRED';
  END IF;

  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'DELETION_REASON_REQUIRED';
  END IF;

  SELECT *
  INTO v_existing_tombstone
  FROM public.field_task_tombstones
  WHERE tenant_id = p_tenant_id
    AND company_id = p_company_id
    AND branch_id = p_branch_id
    AND accounting_period_id = p_accounting_period_id
    AND task_id = p_task_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'deleted', true,
      'alreadyDeleted', true,
      'taskId', p_task_id,
      'deletedAt', v_existing_tombstone.deleted_at
    );
  END IF;

  SELECT *
  INTO v_task
  FROM public.field_tasks
  WHERE id::text = p_task_id
    AND tenant_id = p_tenant_id
    AND company_id = p_company_id
    AND branch_id = p_branch_id
    AND accounting_period_id = p_accounting_period_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  IF v_task.archived_at IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_ARCHIVED';
  END IF;

  IF v_task.status NOT IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'TASK_NOT_TERMINAL';
  END IF;

  INSERT INTO public.field_task_tombstones (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    task_id,
    deleted_at,
    deleted_by_id,
    deleted_by_name,
    deletion_reason,
    task_snapshot
  )
  VALUES (
    p_tenant_id,
    p_company_id,
    p_branch_id,
    p_accounting_period_id,
    p_task_id,
    now(),
    p_actor_id,
    p_actor_name,
    p_reason,
    jsonb_build_object(
      'id', v_task.id,
      'customerId', v_task.customer_id,
      'status', v_task.status,
      'createdAt', v_task.created_at,
      'completedAt', v_task.completed_at,
      'cancelledAt', v_task.cancelled_at,
      'archivedAt', v_task.archived_at
    )
  );

  DELETE FROM public.field_tasks
  WHERE id::text = p_task_id
    AND tenant_id = p_tenant_id
    AND company_id = p_company_id
    AND branch_id = p_branch_id
    AND accounting_period_id = p_accounting_period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_DELETE_RACE';
  END IF;

  RETURN jsonb_build_object(
    'deleted', true,
    'alreadyDeleted', false,
    'taskId', p_task_id
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.admin_hard_delete_field_task_v1(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.admin_hard_delete_field_task_v1(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
TO service_role;

COMMIT;
