-- Create the postgis schema
CREATE EXTENSION IF NOT EXISTS postgis;


-- Output PostGIS version to verify installation
SELECT postgis_version();