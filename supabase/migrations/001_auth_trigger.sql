-- ============================================================
-- Trigger: crea un registro en public.users cuando se registra
-- un nuevo usuario en auth.users (Supabase Auth)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_name TEXT;
BEGIN
  -- Obtener nombre: primero de metadata, si no del email
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (
    id,
    supabase_auth_id,
    email,
    name,
    role,
    created_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id::text,
    NEW.email,
    user_name,
    'PARENT',
    NOW()
  )
  ON CONFLICT (supabase_auth_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear trigger que se dispara al insertar en auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
