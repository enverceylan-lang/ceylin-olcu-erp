-- CEYLİN ERP - Sales Sync Foundation V1
--
-- DURUM: TASLAK. CANLI SUPABASE'E UYGULANMAYACAKTIR.
-- API sözleşmesi, geri alma planı ve pilot cihaz testi tamamlanmadan çalıştırmayın.
--
-- Güvenlik modeli:
-- - Tarayıcı doğrudan tablo erişimi kullanmaz.
-- - Yalnız sunucu API'si service_role ile erişir.
-- - Satış ana kaydı sürümlüdür.
-- - Tahsilatlar append-only ve idempotenttir.
-- - Fiziksel satış/tahsilat silme bu şemada desteklenmez.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sales_sync_records (
    sale_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    owner_username TEXT,
    customer_id TEXT NOT NULL,
    sale_no TEXT NOT NULL,
    payload JSONB NOT NULL,
    version BIGINT NOT NULL DEFAULT 1
        CHECK (version > 0),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT sales_sync_sale_id_not_blank
        CHECK (BTRIM(sale_id) <> ''),
    CONSTRAINT sales_sync_owner_not_blank
        CHECK (BTRIM(owner_user_id) <> ''),
    CONSTRAINT sales_sync_customer_not_blank
        CHECK (BTRIM(customer_id) <> ''),
    CONSTRAINT sales_sync_sale_no_not_blank
        CHECK (BTRIM(sale_no) <> ''),
    CONSTRAINT sales_sync_delete_consistency
        CHECK (
            (is_deleted = FALSE AND deleted_at IS NULL)
            OR
            (is_deleted = TRUE AND deleted_at IS NOT NULL)
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_sync_sale_no
    ON public.sales_sync_records (sale_no);

CREATE INDEX IF NOT EXISTS idx_sales_sync_owner_updated
    ON public.sales_sync_records (
        owner_user_id,
        updated_at
    );

CREATE INDEX IF NOT EXISTS idx_sales_sync_customer_updated
    ON public.sales_sync_records (
        customer_id,
        updated_at
    );

CREATE TABLE IF NOT EXISTS public.sale_sync_payments (
    payment_id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL
        REFERENCES public.sales_sync_records(sale_id)
        ON DELETE RESTRICT,
    amount NUMERIC(14, 2) NOT NULL
        CHECK (amount > 0),
    paid_at DATE NOT NULL,
    method TEXT NOT NULL
        CHECK (
            method IN (
                'NAKIT',
                'KART',
                'HAVALE',
                'EFT',
                'DIGER'
            )
        ),
    installment_id TEXT,
    note TEXT,
    received_by TEXT,
    payload_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT sale_sync_payment_id_not_blank
        CHECK (BTRIM(payment_id) <> ''),
    CONSTRAINT sale_sync_payment_hash_not_blank
        CHECK (BTRIM(payload_hash) <> '')
);

CREATE INDEX IF NOT EXISTS idx_sale_sync_payments_sale
    ON public.sale_sync_payments (
        sale_id,
        paid_at
    );

CREATE TABLE IF NOT EXISTS public.sales_sync_changes (
    change_id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    operation TEXT NOT NULL
        CHECK (
            operation IN (
                'INSERT',
                'UPDATE',
                'SOFT_DELETE',
                'RESTORE',
                'PAYMENT_APPEND'
            )
        ),
    actor_user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    base_version BIGINT NOT NULL
        CHECK (base_version >= 0),
    resulting_version BIGINT NOT NULL
        CHECK (resulting_version > 0),
    patch JSONB NOT NULL,
    revision BIGINT GENERATED ALWAYS AS IDENTITY,
    conflict_status TEXT NOT NULL DEFAULT 'NONE'
        CHECK (
            conflict_status IN (
                'NONE',
                'CONFLICT',
                'RESOLVED'
            )
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT sales_sync_change_id_not_blank
        CHECK (BTRIM(change_id) <> ''),
    CONSTRAINT sales_sync_change_sale_not_blank
        CHECK (BTRIM(sale_id) <> ''),
    CONSTRAINT sales_sync_change_actor_not_blank
        CHECK (BTRIM(actor_user_id) <> ''),
    CONSTRAINT sales_sync_change_device_not_blank
        CHECK (BTRIM(device_id) <> ''),
    CONSTRAINT sales_sync_version_progression
        CHECK (resulting_version > base_version)
);

CREATE INDEX IF NOT EXISTS idx_sales_sync_changes_revision
    ON public.sales_sync_changes (revision);

CREATE INDEX IF NOT EXISTS idx_sales_sync_changes_sale_revision
    ON public.sales_sync_changes (
        sale_id,
        revision
    );

CREATE OR REPLACE FUNCTION public.set_sales_sync_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_sync_updated_at
ON public.sales_sync_records;

CREATE TRIGGER trg_sales_sync_updated_at
BEFORE UPDATE ON public.sales_sync_records
FOR EACH ROW
EXECUTE FUNCTION public.set_sales_sync_updated_at();

ALTER TABLE public.sales_sync_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_sync_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_sync_changes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sales_sync_records
FROM anon, authenticated;
REVOKE ALL ON TABLE public.sale_sync_payments
FROM anon, authenticated;
REVOKE ALL ON TABLE public.sales_sync_changes
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.sales_sync_records
TO service_role;

GRANT SELECT, INSERT
ON TABLE public.sale_sync_payments
TO service_role;

GRANT SELECT, INSERT
ON TABLE public.sales_sync_changes
TO service_role;

COMMIT;
