import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("DUR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(2);
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const bucketId = "enverp-media";

const { data: existing, error: getError } =
  await supabase.storage.getBucket(bucketId);

if (getError && !String(getError.message || "").toLowerCase().includes("not found")) {
  console.error(`DUR: bucket read failed: ${getError.message}`);
  process.exit(3);
}

if (!existing) {
  const { error } = await supabase.storage.createBucket(bucketId, {
    public: false,
    allowedMimeTypes: ["image/webp"],
    fileSizeLimit: 4 * 1024 * 1024,
  });

  if (error) {
    console.error(`DUR: bucket create failed: ${error.message}`);
    process.exit(4);
  }

  console.log("PASS: private enverp-media bucket created");
  process.exit(0);
}

if (existing.public === true) {
  console.error("DUR: enverp-media bucket is PUBLIC");
  process.exit(5);
}

const { error: updateError } =
  await supabase.storage.updateBucket(bucketId, {
    public: false,
    allowedMimeTypes: ["image/webp"],
    fileSizeLimit: 4 * 1024 * 1024,
  });

if (updateError) {
  console.error(`DUR: bucket contract update failed: ${updateError.message}`);
  process.exit(6);
}

console.log("PASS: private enverp-media bucket contract verified");
