-- docs/sql/20260716_transfer_receipts_v1.sql
--
-- CEYLİN Ölçü ERP - Transfer Receipt Köprüsü V1
-- KAPSAM: Yalnız MEASUREMENT
--
-- ÖNEMLİ:
-- Bu dosya henüz canlı Supabase'e uygulanmayacaktır.
-- Önce API sözleşmesi ve rol kontrolleri tamamlanacaktır.

BEGIN;

CREATE TABLE IF NOT EXISTS public.transfer_receipts (
    transfer_id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL
        CHECK (entity_type = 'MEASUREMENT'),
    entity_id TEXT NOT NULL,

    sender_user_id TEXT NOT NULL,
    receiver_user_id TEXT,

    sender_device_id TEXT NOT NULL,
    receiver_device_id TEXT,

    status TEXT NOT NULL
        CHECK (
            status IN (
                'SENT',
                'DELIVERED',
                'READ',
                'ACCEPTED',
                'COMPLETED',
                'FAILED'
            )
        ),

    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    failure_reason VARCHAR(100),

    entity_version INTEGER NOT NULL DEFAULT 1
        CHECK (entity_version > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transfer_receipts_entity_id_not_blank
        CHECK (BTRIM(entity_id) <> ''),

    CONSTRAINT transfer_receipts_sender_user_not_blank
        CHECK (BTRIM(sender_user_id) <> ''),

    CONSTRAINT transfer_receipts_sender_device_not_blank
        CHECK (BTRIM(sender_device_id) <> ''),

    CONSTRAINT transfer_receipts_transfer_id_not_blank
        CHECK (BTRIM(transfer_id) <> ''),

    CONSTRAINT transfer_receipts_failure_reason_safe
        CHECK (
            failure_reason IS NULL
            OR failure_reason IN (
                'LOCAL_WRITE_FAILED',
                'INVALID_PAYLOAD',
                'EMPTY_MEASUREMENT',
                'VERSION_CONFLICT',
                'UNAUTHORIZED',
                'UNKNOWN_ERROR'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_transfer_receipts_sender_device_updated
    ON public.transfer_receipts (
        sender_device_id,
        updated_at
    );

CREATE INDEX IF NOT EXISTS idx_transfer_receipts_receiver_device_updated
    ON public.transfer_receipts (
        receiver_device_id,
        updated_at
    );

CREATE INDEX IF NOT EXISTS idx_transfer_receipts_entity
    ON public.transfer_receipts (
        entity_type,
        entity_id
    );

CREATE INDEX IF NOT EXISTS idx_transfer_receipts_status_updated
    ON public.transfer_receipts (
        status,
        updated_at
    );

CREATE OR REPLACE FUNCTION public.set_transfer_receipt_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_receipts_updated_at
ON public.transfer_receipts;

CREATE TRIGGER trg_transfer_receipts_updated_at
BEFORE UPDATE ON public.transfer_receipts
FOR EACH ROW
EXECUTE FUNCTION public.set_transfer_receipt_updated_at();

CREATE OR REPLACE FUNCTION public.validate_transfer_receipt_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    old_rank INTEGER;
    new_rank INTEGER;
BEGIN
    IF NEW.entity_version < OLD.entity_version THEN
        RAISE EXCEPTION
            'Older entity version cannot overwrite newer receipt';
    END IF;

    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'FAILED' THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'FAILED' AND NEW.status = 'SENT' THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'FAILED' THEN
        RAISE EXCEPTION
            'FAILED receipt may only restart as SENT';
    END IF;

    old_rank := CASE OLD.status
        WHEN 'SENT' THEN 1
        WHEN 'DELIVERED' THEN 2
        WHEN 'READ' THEN 3
        WHEN 'ACCEPTED' THEN 4
        WHEN 'COMPLETED' THEN 5
        ELSE 0
    END;

    new_rank := CASE NEW.status
        WHEN 'SENT' THEN 1
        WHEN 'DELIVERED' THEN 2
        WHEN 'READ' THEN 3
        WHEN 'ACCEPTED' THEN 4
        WHEN 'COMPLETED' THEN 5
        ELSE 0
    END;

    IF new_rank <= old_rank THEN
        RAISE EXCEPTION
            'Transfer status cannot move backward';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_transfer_receipt_transition
ON public.transfer_receipts;

CREATE TRIGGER trg_validate_transfer_receipt_transition
BEFORE UPDATE ON public.transfer_receipts
FOR EACH ROW
EXECUTE FUNCTION public.validate_transfer_receipt_transition();

ALTER TABLE public.transfer_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.transfer_receipts
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.transfer_receipts
TO service_role;

COMMIT;