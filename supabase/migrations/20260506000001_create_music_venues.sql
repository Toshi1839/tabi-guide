-- Music Venues Table (1.0.5: Tonight in Tokyo セクション)
--
-- Phase 1 (1.0.5) で 143 会場を投入。spots テーブルとは構造が異なるため別テーブルで運用。
-- 参考: docs/monetization.md セクション 5
-- 元データ: /Volumes/Toshi SSD/開発/収益拡大戦略/import/music_venues_valid.json

-- ============================================================
-- music_venues テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS public.music_venues (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text          NOT NULL CHECK (category IN (
                                'classical',
                                'jazz_live',
                                'vinyl_bar',
                                'live_house',
                                'free_concert',
                                'hougaku'
                              )),
  name          text          NOT NULL,
  name_en       text          NOT NULL,
  address       text,
  ward          text,
  latitude      double precision NOT NULL,
  longitude     double precision NOT NULL,
  geom          geography(Point, 4326)
                                GENERATED ALWAYS AS (
                                  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                                ) STORED,
  official_url  text,
  phone         text,
  cover_min     integer,                   -- 円単位、無料の場合 0、不明 NULL
  cover_max     integer,
  walk_in       text          CHECK (walk_in IN ('high', 'mid', 'low')),
  description_ja text,
  description_en text,
  genre_tags    text,                       -- カンマ区切り（例: 'classical,orchestra,chamber'）
  note          text,                       -- 内部メモ（運営向け、UI 非表示）
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX IF NOT EXISTS music_venues_category_idx
  ON public.music_venues (category);

CREATE INDEX IF NOT EXISTS music_venues_geom_idx
  ON public.music_venues USING GIST (geom);

-- ============================================================
-- RLS（spots と同じポリシー）: SELECT 公開、書き込みは service_role のみ
-- ============================================================
ALTER TABLE public.music_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "music_venues_select_public" ON public.music_venues;
CREATE POLICY "music_venues_select_public"
  ON public.music_venues FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT/UPDATE/DELETE は明示ポリシーなし → service_role のみ書き込み可

-- ============================================================
-- updated_at 自動更新トリガ
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS music_venues_set_updated_at ON public.music_venues;
CREATE TRIGGER music_venues_set_updated_at
  BEFORE UPDATE ON public.music_venues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 距離付き取得 RPC（spots の nearby_spots と同様のインタフェース）
-- ============================================================
CREATE OR REPLACE FUNCTION public.nearby_music_venues(
  user_lat       double precision,
  user_lng       double precision,
  radius_meters  integer DEFAULT 30000,
  categories     text[]  DEFAULT NULL,
  result_limit   integer DEFAULT 100
)
RETURNS TABLE (
  id              uuid,
  category        text,
  name            text,
  name_en         text,
  address         text,
  ward            text,
  latitude        double precision,
  longitude       double precision,
  official_url    text,
  phone           text,
  cover_min       integer,
  cover_max       integer,
  walk_in         text,
  description_ja  text,
  description_en  text,
  genre_tags      text,
  distance_m      double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    mv.id, mv.category, mv.name, mv.name_en, mv.address, mv.ward,
    mv.latitude, mv.longitude, mv.official_url, mv.phone,
    mv.cover_min, mv.cover_max, mv.walk_in,
    mv.description_ja, mv.description_en, mv.genre_tags,
    ST_Distance(
      mv.geom,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) AS distance_m
  FROM public.music_venues mv
  WHERE
    ST_DWithin(
      mv.geom,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    AND (categories IS NULL OR mv.category = ANY (categories))
  ORDER BY distance_m ASC
  LIMIT result_limit;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_music_venues(double precision, double precision, integer, text[], integer)
  TO anon, authenticated;

-- ============================================================
-- コメント
-- ============================================================
COMMENT ON TABLE public.music_venues IS '音楽ライブ会場（Tonight in Tokyo、Phase 1: 143件）';
COMMENT ON COLUMN public.music_venues.walk_in IS 'high=ふらっと入店容易 / mid=要予約推奨 / low=要事前予約・チケット';
COMMENT ON COLUMN public.music_venues.cover_min IS '料金の下限（円）。NULL=不明、0=無料';
COMMENT ON COLUMN public.music_venues.genre_tags IS 'カンマ区切りタグ。例: classical,orchestra,chamber';
COMMENT ON FUNCTION public.nearby_music_venues IS 'ユーザー位置から指定半径内の会場を距離順で返す。categories=NULL で全カテゴリ。';
