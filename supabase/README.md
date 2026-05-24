# Supabase migrations

Use `supabase/migrations/` for new production changes. The older dated SQL files in
the root of this folder are historical patches kept for traceability.

Current architecture baseline:

1. Apply the historical files already used in production.
2. Apply `migrations/20260524070000_architecture_hardening.sql`.

The architecture hardening migration adds short-lived manager sessions, backend
maintenance scheduling, and compatibility wrappers for RPCs that previously
validated the raw manager PIN directly.
