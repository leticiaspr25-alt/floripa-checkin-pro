-- Migration: Fix Supabase Security Advisor warnings
-- This migration re-enables RLS and fixes the handle_new_user function

-- =============================================================================
-- 1. Enable RLS on tables (re-enable in case it was disabled)
-- =============================================================================

-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Enable RLS on access_codes table
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Fix handle_new_user function with proper search_path
-- =============================================================================

-- Recreate the function with SECURITY DEFINER and search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- =============================================================================
-- 3. Ensure the trigger exists and uses the correct function
-- =============================================================================

-- Drop and recreate trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
