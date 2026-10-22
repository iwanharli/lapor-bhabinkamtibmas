-- Unit beserta seluruh turunannya (satuan aktif). Dipakai sebagai `kolom IN (SELECT unit_subtree($1))`
-- agar query cakupan cukup menerima satu ID: daftar ribuan ID sebagai parameter membuat rencana
-- generik (prepared statement) mencocokkan larik satu per satu untuk setiap baris dan sangat lambat.
CREATE OR REPLACE FUNCTION unit_subtree(root uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  WITH RECURSIVE tree AS (
    SELECT id FROM units WHERE id = root AND deleted_at IS NULL
    UNION ALL
    SELECT u.id FROM units u JOIN tree t ON u.parent_id = t.id WHERE u.deleted_at IS NULL
  )
  SELECT id FROM tree
$$;
