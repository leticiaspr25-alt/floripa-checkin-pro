-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  wifi_ssid TEXT,
  wifi_pass TEXT,
  wifi_img_url TEXT,
  photo_url TEXT,
  photo_img_url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guests table
CREATE TABLE public.guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  checked_in BOOLEAN DEFAULT false,
  checkin_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Users can view their own events" ON public.events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own events" ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own events" ON public.events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own events" ON public.events FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public can view events by ID" ON public.events FOR SELECT USING (true);

-- Guests policies
CREATE POLICY "Users can view guests of their events" ON public.guests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.user_id = auth.uid())
);
CREATE POLICY "Users can create guests for their events" ON public.guests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.user_id = auth.uid())
);
CREATE POLICY "Users can update guests of their events" ON public.guests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.user_id = auth.uid())
);
CREATE POLICY "Users can delete guests of their events" ON public.guests FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.user_id = auth.uid())
);
CREATE POLICY "Public can view guests by event" ON public.guests FOR SELECT USING (true);
CREATE POLICY "Public can create guests (walk-in)" ON public.guests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update guest check-in" ON public.guests FOR UPDATE USING (true);

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for guests
ALTER PUBLICATION supabase_realtime ADD TABLE public.guests;

-- Create storage bucket for event assets
INSERT INTO storage.buckets (id, name, public) VALUES ('event-assets', 'event-assets', true);

-- Storage policies
CREATE POLICY "Anyone can view event assets" ON storage.objects FOR SELECT USING (bucket_id = 'event-assets');
CREATE POLICY "Authenticated users can upload event assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update event assets" ON storage.objects FOR UPDATE USING (bucket_id = 'event-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete event assets" ON storage.objects FOR DELETE USING (bucket_id = 'event-assets' AND auth.role() = 'authenticated');

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();