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