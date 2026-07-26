-- ENVERP — Package and Scope Foundation V2 rollback
-- DURUM: TASLAK. YALNIZ V2 STAGING PROVASI İÇİN.
-- Mevcut iş tablolarına dokunmaz; V2 ile oluşturulan boş/pilot tabloları kaldırır.

BEGIN;

DROP TABLE IF EXISTS public.erp_user_scopes;
DROP TABLE IF EXISTS public.erp_package_licenses;
DROP TABLE IF EXISTS public.erp_accounting_periods;
DROP TABLE IF EXISTS public.erp_branches;
DROP TABLE IF EXISTS public.erp_companies;
DROP TABLE IF EXISTS public.erp_tenants;
DROP FUNCTION IF EXISTS public.set_erp_updated_at();

COMMIT;
