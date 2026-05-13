-- Fix: spatial_ref_sys テーブルの RLS を有効化
--
-- 経緯:
--   2026-05-11 Supabase Security Advisor から "rls_disabled_in_public" 警告
--   PostGIS 拡張が public スキーマに作る spatial_ref_sys は座標系参照データ
--   読み取り専用で運用しているが Linter が RLS を要求するため対応
--
-- 影響:
--   既存動作に変更なし（SELECT は全ユーザーに開放、書き込みは postgres ロールのみ）

DO $$
BEGIN
  -- ALTER TABLE で RLS 有効化（既に有効なら no-op）
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

  -- 全ユーザーに SELECT 許可ポリシー（既存挙動を維持）
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spatial_ref_sys'
      AND policyname = 'spatial_ref_sys_select_public'
  ) THEN
    CREATE POLICY spatial_ref_sys_select_public
      ON public.spatial_ref_sys
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'spatial_ref_sys is owned by extension; skipping RLS change.';
END
$$;
