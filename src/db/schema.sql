CREATE DATABASE transport_db;

CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    route_number VARCHAR(10),
    vehicle_number VARCHAR(10),
    latitude FLOAT,
    longitude FLOAT,
    speed FLOAT,
    timestamp TIMESTAMPTZ
);

-- Create B-tree indexes for timestamp, route_number, and vehicle_number
CREATE INDEX idx_vehicles_timestamp ON vehicles (timestamp);
CREATE INDEX idx_vehicles_route_number ON vehicles (route_number);
CREATE INDEX idx_vehicles_vehicle_number ON vehicles (vehicle_number);

-- Create GiST index for geographical queries
CREATE EXTENSION IF NOT EXISTS postgis; -- Enable PostGIS extension if not already enabled
CREATE INDEX idx_vehicles_location ON vehicles USING gist (ST_MakePoint(longitude, latitude));