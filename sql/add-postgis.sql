-- Set client encoding and suppress verbose messages
SET client_encoding = 'UTF8';
SET client_min_messages = warning;

-- Begin transaction
BEGIN;

-- Create PostGIS schema and extension if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'postgis') THEN
    RAISE NOTICE 'Creating schema postgis...';
    CREATE SCHEMA postgis;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE NOTICE 'Creating extension postgis...';
    CREATE EXTENSION postgis SCHEMA postgis;
  ELSE
    RAISE NOTICE 'PostGIS extension already exists.';
  END IF;
END
$$;

-- Add geom column to tables with longitude and latitude
DO $$
DECLARE
  tbl_name TEXT;
  schema_name TEXT := 'public';
BEGIN
  RAISE NOTICE 'Processing tables for geom column...';
  FOR tbl_name IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = schema_name
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = schema_name AND table_name = tbl_name
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = schema_name AND table_name = tbl_name AND column_name = 'longitude'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = schema_name AND table_name = tbl_name AND column_name = 'latitude'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = schema_name AND table_name = tbl_name AND column_name = 'geom'
    ) THEN
      RAISE NOTICE 'Adding geom column to table %...', tbl_name;
      EXECUTE format('ALTER TABLE %I ADD COLUMN geom geometry(Point, 4326)', tbl_name);
      EXECUTE format(
        'UPDATE %I SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE longitude IS NOT NULL AND latitude IS NOT NULL',
        tbl_name
      );
      RAISE NOTICE 'Creating spatial index for table %...', tbl_name;
      EXECUTE format('CREATE INDEX %I ON %I USING GIST (geom)', tbl_name || '_geom_idx', tbl_name);
    END IF;
  END LOOP;
  RAISE NOTICE 'Geom column processing completed.';
END
$$;

-- Commit transaction
COMMIT;