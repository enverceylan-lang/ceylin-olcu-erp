-- ==============================================================================
-- CEYLİN Ölçü ERP - Delta Sync UUID to TEXT Fix
-- ==============================================================================
-- Bu script, V1B'de UUID olarak oluşturulan ancak ERP'nin local yapısında 
-- 'user-admin', 'dev-123', 'chg-456' gibi TEXT/String olan identifier'ların 
-- Supabase'e yazılırken "invalid input syntax for type uuid" hatası vermesini önler.
-- 
-- Tüm ID kolonları TEXT tipine dönüştürülecektir.
-- ==============================================================================

-- 1. Yabancı Anahtarları (Foreign Keys) Geçici Olarak Kaldır
ALTER TABLE IF EXISTS public.customers_light DROP CONSTRAINT IF EXISTS customers_light_source_device_id_fkey;
ALTER TABLE IF EXISTS public.measurement_jobs DROP CONSTRAINT IF EXISTS measurement_jobs_customer_id_fkey;
ALTER TABLE IF EXISTS public.measurement_jobs DROP CONSTRAINT IF EXISTS measurement_jobs_assigned_device_id_fkey;
ALTER TABLE IF EXISTS public.measurement_changes DROP CONSTRAINT IF EXISTS measurement_changes_device_id_fkey;
ALTER TABLE IF EXISTS public.draft_changes DROP CONSTRAINT IF EXISTS draft_changes_device_id_fkey;
ALTER TABLE IF EXISTS public.sync_cursors DROP CONSTRAINT IF EXISTS sync_cursors_device_id_fkey;
ALTER TABLE IF EXISTS public.sync_events DROP CONSTRAINT IF EXISTS sync_events_device_id_fkey;

-- 2. Kolon Tiplerini TEXT Olarak Değiştir
-- devices
ALTER TABLE IF EXISTS public.devices ALTER COLUMN device_id TYPE TEXT USING device_id::text;
ALTER TABLE IF EXISTS public.devices ALTER COLUMN device_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.devices ALTER COLUMN assigned_user_id TYPE TEXT USING assigned_user_id::text;

-- customers_light
ALTER TABLE IF EXISTS public.customers_light ALTER COLUMN customer_id TYPE TEXT USING customer_id::text;
ALTER TABLE IF EXISTS public.customers_light ALTER COLUMN source_device_id TYPE TEXT USING source_device_id::text;

-- measurement_jobs
ALTER TABLE IF EXISTS public.measurement_jobs ALTER COLUMN job_id TYPE TEXT USING job_id::text;
ALTER TABLE IF EXISTS public.measurement_jobs ALTER COLUMN job_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.measurement_jobs ALTER COLUMN customer_id TYPE TEXT USING customer_id::text;
ALTER TABLE IF EXISTS public.measurement_jobs ALTER COLUMN assigned_device_id TYPE TEXT USING assigned_device_id::text;
ALTER TABLE IF EXISTS public.measurement_jobs ALTER COLUMN assigned_user_id TYPE TEXT USING assigned_user_id::text;

-- measurement_changes
ALTER TABLE IF EXISTS public.measurement_changes ALTER COLUMN change_id TYPE TEXT USING change_id::text;
ALTER TABLE IF EXISTS public.measurement_changes ALTER COLUMN change_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.measurement_changes ALTER COLUMN device_id TYPE TEXT USING device_id::text;
ALTER TABLE IF EXISTS public.measurement_changes ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE IF EXISTS public.measurement_changes ALTER COLUMN entity_id TYPE TEXT USING entity_id::text;

-- draft_changes
ALTER TABLE IF EXISTS public.draft_changes ALTER COLUMN change_id TYPE TEXT USING change_id::text;
ALTER TABLE IF EXISTS public.draft_changes ALTER COLUMN change_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.draft_changes ALTER COLUMN device_id TYPE TEXT USING device_id::text;
ALTER TABLE IF EXISTS public.draft_changes ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE IF EXISTS public.draft_changes ALTER COLUMN entity_id TYPE TEXT USING entity_id::text;

-- sync_cursors
ALTER TABLE IF EXISTS public.sync_cursors ALTER COLUMN device_id TYPE TEXT USING device_id::text;

-- sync_events
ALTER TABLE IF EXISTS public.sync_events ALTER COLUMN event_id TYPE TEXT USING event_id::text;
ALTER TABLE IF EXISTS public.sync_events ALTER COLUMN event_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.sync_events ALTER COLUMN device_id TYPE TEXT USING device_id::text;
ALTER TABLE IF EXISTS public.sync_events ALTER COLUMN entity_id TYPE TEXT USING entity_id::text;

-- 3. Yabancı Anahtarları (Foreign Keys) Geri Ekle
ALTER TABLE IF EXISTS public.customers_light ADD CONSTRAINT customers_light_source_device_id_fkey FOREIGN KEY (source_device_id) REFERENCES public.devices(device_id);
ALTER TABLE IF EXISTS public.measurement_jobs ADD CONSTRAINT measurement_jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers_light(customer_id);
ALTER TABLE IF EXISTS public.measurement_jobs ADD CONSTRAINT measurement_jobs_assigned_device_id_fkey FOREIGN KEY (assigned_device_id) REFERENCES public.devices(device_id);
ALTER TABLE IF EXISTS public.measurement_changes ADD CONSTRAINT measurement_changes_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(device_id);
ALTER TABLE IF EXISTS public.draft_changes ADD CONSTRAINT draft_changes_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(device_id);
ALTER TABLE IF EXISTS public.sync_cursors ADD CONSTRAINT sync_cursors_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(device_id);
ALTER TABLE IF EXISTS public.sync_events ADD CONSTRAINT sync_events_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(device_id);

-- BAŞARILI!
