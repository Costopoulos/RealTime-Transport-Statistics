CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    route_number VARCHAR(10),
    vehicle_number VARCHAR(10),
    latitude FLOAT,
    longitude FLOAT,
    speed FLOAT,
    timestamp TIMESTAMPTZ
);

-- Create the summary table for route speed
CREATE TABLE route_speed_summary (
    route_number VARCHAR(10) PRIMARY KEY,
    total_speed FLOAT,
    count INT,
    average_speed FLOAT
);

-- Create the trigger function to update the summary table
CREATE OR REPLACE FUNCTION update_route_speed_summary() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO route_speed_summary (route_number, total_speed, count, average_speed)
        VALUES (NEW.route_number, NEW.speed, 1, NEW.speed)
        ON CONFLICT (route_number)
        DO UPDATE SET
            total_speed = route_speed_summary.total_speed + EXCLUDED.total_speed,
            count = route_speed_summary.count + 1,
            average_speed = (route_speed_summary.total_speed + EXCLUDED.total_speed) / (route_speed_summary.count + 1);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to call the function after insert on vehicles table
CREATE TRIGGER insert_route_speed_summary
AFTER INSERT ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_route_speed_summary();

CREATE INDEX idx_route_number ON route_speed_summary (route_number);

-- Create B-tree indexes for timestamp, route_number, and vehicle_number
CREATE INDEX idx_vehicles_timestamp ON vehicles (timestamp);
CREATE INDEX idx_vehicles_route_number ON vehicles (route_number);
CREATE INDEX idx_vehicles_vehicle_number ON vehicles (vehicle_number);

-- Create GiST index for geographical queries
CREATE EXTENSION IF NOT EXISTS postgis; -- Enable PostGIS extension if not already enabled
CREATE INDEX idx_vehicles_location ON vehicles USING gist (ST_MakePoint(longitude, latitude));