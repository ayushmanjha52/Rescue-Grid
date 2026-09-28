// Grants (or revokes) the DMA operator role on an existing Supabase login.
//
//   bun run db:operator -- you@org.in            grant
//   bun run db:operator -- you@org.in --revoke   revoke
//
// The role lives in the user's app_metadata, which only the service key can
// change, so users can't give it to themselves. The app (lib/auth/dmaAccess.ts)
// and the database (is_dma_operator()) both require it. The user must sign
// in again for a change to take effect.

import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.toLowerCase();
const revoke = process.argv.includes("--revoke");
if (!email || !email.includes("@")) {
  console.error("Usage: bun run db:operator -- someone@org.in [--revoke]");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user;
for (let page = 1; !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
  user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(`✗ No login found for ${email}. Create it first (Supabase → Authentication → Users → Add user).`);
  process.exit(1);
}

const { error } = await admin.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, role: revoke ? null : "dma_operator" },
});
if (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
console.log(revoke ? `✓ Operator role removed from ${email}` : `✓ ${email} is now a DMA operator (sign in again to apply)`);
