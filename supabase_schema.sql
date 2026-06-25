-- Supabase Schema Setup Script for Ölçü ERP
-- Run this script in the Supabase SQL Editor to create the required tables.
-- SECURITY: RLS is enabled on all tables. Data access is restricted to server-side API routes using the Supabase Service Role key.

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    "isActive" BOOLEAN DEFAULT TRUE NOT NULL,
    permissions TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    email TEXT,
    phone TEXT,
    "tcNo" TEXT,
    address TEXT,
    "profileCompletedAt" TIMESTAMP WITH TIME ZONE
);

-- 2. Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    "mapLocation" TEXT,
    notes TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "assignedSalesId" TEXT,
    "assignedSalesName" TEXT,
    "assignedMeasureId" TEXT,
    "assignedMeasureName" TEXT,
    "assignedTailorId" TEXT,
    "assignedTailorName" TEXT,
    "assignedInstallerId" TEXT,
    "assignedInstallerName" TEXT,
    "workflowStatus" TEXT DEFAULT 'YENI',
    "customerCode" TEXT,
    "taxNumber" TEXT,
    "phone2" TEXT,
    "extraDescription" TEXT,
    "generalNote" TEXT,
    "cariType" TEXT DEFAULT 'CUSTOMER' NOT NULL,
    "approvalStatus" TEXT DEFAULT 'APPROVED' NOT NULL,
    "addressPhotos" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "customerId" TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    photos TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    videos TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Create openings table
CREATE TABLE IF NOT EXISTS openings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "roomId" TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    width DOUBLE PRECISION,
    height DOUBLE PRECISION,
    "fieldNotes" TEXT,
    photos TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    videos TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. Create measurements table
CREATE TABLE IF NOT EXISTS measurements (
    id TEXT PRIMARY KEY,
    "openingId" TEXT NOT NULL REFERENCES openings(id) ON DELETE CASCADE,
    "templateType" TEXT NOT NULL,
    "rawValues" JSONB NOT NULL,
    "productId" TEXT,
    "productGroup" TEXT,
    "productType" TEXT,
    "calculatedWidth" DOUBLE PRECISION,
    "calculatedHeight" DOUBLE PRECISION,
    details JSONB,
    notes TEXT NOT NULL,
    status TEXT NOT NULL,
    "measuredBy" TEXT NOT NULL,
    "measuredById" TEXT,
    "createdById" TEXT,
    "measuredDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "notesHistory" JSONB[] DEFAULT '{}'::JSONB[] NOT NULL,
    photos TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    videos TEXT[] DEFAULT '{}'::TEXT[] NOT NULL
);

-- 6. Create media table
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    url TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Note: No public policies are created because database access is strictly
-- server-side only through Next.js API endpoints using the Supabase Service Role.

-- Performance and sync optimization indexes (on updatedAt)
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users("updatedAt");
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers("updatedAt");
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms("updatedAt");
CREATE INDEX IF NOT EXISTS idx_openings_updated_at ON openings("updatedAt");
CREATE INDEX IF NOT EXISTS idx_measurements_updated_at ON measurements("updatedAt");

-- Foreign key lookup indexes
CREATE INDEX IF NOT EXISTS idx_rooms_customer_id ON rooms("customerId");
CREATE INDEX IF NOT EXISTS idx_openings_room_id ON openings("roomId");
CREATE INDEX IF NOT EXISTS idx_measurements_opening_id ON measurements("openingId");

-- ERP V2 type and approval status indexes
CREATE INDEX IF NOT EXISTS idx_customers_cari_type ON customers("cariType");
CREATE INDEX IF NOT EXISTS idx_customers_approval_status ON customers("approvalStatus");

-- Add addressPhotos column to existing customers table if it doesn't exist
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS "addressPhotos" JSONB DEFAULT '[]'::jsonb;
