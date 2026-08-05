-- Cache slot for auto-fetched teaching resources (Wikipedia article/image,
-- YouTube video) on each lesson. NULL = not fetched yet; '[]' = fetched, none
-- found; populated array = fetched resources. Fetched once per lesson (by the
-- server, via the service-role client) and reused for every student and every
-- future visit to that lesson — never re-queried per message.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS resources jsonb;
