-- RLS 監査用クエリ（マイグレーション扱いだが、副作用のみで実テーブル変更なし）
-- 適用時に RAISE NOTICE で全 public テーブルの RLS 状態を出力する
-- supabase db push のログから該当テーブルを特定する目的

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'RLS Audit — public schema tables';
  RAISE NOTICE '====================================================';
  FOR r IN
    SELECT
      t.tablename,
      t.rowsecurity AS rls_enabled,
      (SELECT count(*) FROM pg_policies p WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename) AS policy_count
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    ORDER BY t.rowsecurity ASC, t.tablename
  LOOP
    RAISE NOTICE '  table=% rls=% policies=%',
      rpad(r.tablename, 30, ' '), r.rls_enabled, r.policy_count;
  END LOOP;
  RAISE NOTICE '====================================================';
END
$$;
