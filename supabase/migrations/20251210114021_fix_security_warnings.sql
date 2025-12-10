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

-- =============================================================================
-- 4. Fix UNRESTRICTED_ROLE_ASSIGNMENT - Secure role assignment
-- =============================================================================

-- Create a secure function that validates access code and assigns role
-- This function is SECURITY DEFINER so it runs with elevated privileges
-- but only assigns the role if the access code is valid
CREATE OR REPLACE FUNCTION public.assign_role_with_code(
  _user_id UUID,
  _access_code TEXT
)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
BEGIN
  -- Validate the access code and get the corresponding role
  SELECT role INTO _role
  FROM public.access_codes
  WHERE code = _access_code;

  -- If no matching code found, return NULL
  IF _role IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if user already has a role
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    -- User already has a role, don't allow duplicate
    RETURN NULL;
  END IF;

  -- Insert the role assignment
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role);

  RETURN _role;
END;
$$;

-- Remove the insecure "System can insert roles" policy
DROP POLICY IF EXISTS "System can insert roles" ON public.user_roles;

-- Create a new policy that only allows inserts through the secure function
-- Since the function is SECURITY DEFINER, it bypasses RLS
-- Regular users cannot insert directly
CREATE POLICY "Only secure function can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (false);

-- =============================================================================
-- 5. Fix PUBLIC_SENSITIVE_CREDENTIALS - Hide access codes
-- =============================================================================

-- Remove the policy that exposes access codes publicly
DROP POLICY IF EXISTS "Anyone can read codes for validation" ON public.access_codes;

-- Only admins can view access codes (for management purposes)
CREATE POLICY "Only admins can view access codes"
ON public.access_codes FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
