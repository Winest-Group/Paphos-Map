-- =====================================================
-- Paphos Projects Map - DB Schema
-- Run this in Supabase SQL Editor (SQL Editor → New query)
-- =====================================================

-- 1. Areas lookup table
CREATE TABLE areas (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0
);

INSERT INTO areas (name, display_order) VALUES
    ('Timi', 1),
    ('Mandria', 2),
    ('Yeroskipou', 3),
    ('Ayia Marinuda', 4),
    ('Universal', 5),
    ('Kato Paphos', 6),
    ('Pano Paphos', 7),
    ('Konia', 8),
    ('Mesogi', 9),
    ('Empa', 10),
    ('Chloraka', 11),
    ('Kisonerga', 12),
    ('Peyia', 13),
    ('Coral Bay', 14),
    ('Sea Caves', 15),
    ('Tala', 16),
    ('Tsada', 17),
    ('Kamares', 18);

-- 2. Main projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    developer TEXT NOT NULL,
    area TEXT NOT NULL REFERENCES areas(name),
    lat DECIMAL(10, 7) NOT NULL,
    lng DECIMAL(10, 7) NOT NULL,

    -- Required links and info
    drive_link TEXT,
    developer_website TEXT NOT NULL,
    notes TEXT NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'sold_out')),

    -- Project phase
    project_phase TEXT CHECK (project_phase IN ('planned', 'construction', 'near_delivery', 'completed')),
    delivery_date TEXT, -- "Q4 2027" style

    -- Building details
    floors INTEGER,
    parking BOOLEAN DEFAULT FALSE,
    pool BOOLEAN DEFAULT FALSE,
    gym BOOLEAN DEFAULT FALSE,
    additional_facilities TEXT,
    distance_from_sea_m INTEGER, -- meters

    -- Contact info
    contact_person_name TEXT,
    contact_person_phone TEXT,
    contact_person_email TEXT,

    -- Financial
    vat_rate INTEGER CHECK (vat_rate IN (5, 19)),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_projects_area ON projects(area);
CREATE INDEX idx_projects_status ON projects(status);

-- 3. Property types per project (one project → many property types)
CREATE TABLE property_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Display name (free text, e.g. "פנטהאוז 3 חדרי שינה")
    type_name TEXT NOT NULL,

    -- Structured for similarity matching
    category TEXT NOT NULL CHECK (category IN ('studio', 'apartment', 'penthouse', 'villa', 'townhouse', 'bungalow')),
    bedrooms INTEGER NOT NULL CHECK (bedrooms >= 0),

    -- Pricing and size
    price INTEGER NOT NULL CHECK (price > 0),
    size_min INTEGER, -- sqm
    size_max INTEGER, -- sqm

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_property_types_project ON property_types(project_id);
CREATE INDEX idx_property_types_match ON property_types(category, bedrooms, price);

-- 4. Auto-update updated_at on projects
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. When property_types change, bump the parent project's updated_at
CREATE OR REPLACE FUNCTION bump_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE projects SET updated_at = NOW()
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER bump_on_property_type_change
    AFTER INSERT OR UPDATE OR DELETE ON property_types
    FOR EACH ROW
    EXECUTE FUNCTION bump_project_updated_at();

-- 6. View that aggregates each project with price/size range
CREATE OR REPLACE VIEW projects_with_summary AS
SELECT
    p.*,
    MIN(pt.price) AS price_min,
    MAX(pt.price) AS price_max,
    MIN(pt.size_min) AS size_min_total,
    MAX(pt.size_max) AS size_max_total,
    COUNT(pt.id) AS property_types_count
FROM projects p
LEFT JOIN property_types pt ON pt.project_id = p.id
GROUP BY p.id;

-- 7. Row Level Security: anyone signed in can read/write
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users have full access to projects"
    ON projects FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to property_types"
    ON property_types FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anyone authenticated can read areas"
    ON areas FOR SELECT
    TO authenticated
    USING (true);
