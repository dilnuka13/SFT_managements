-- Create profile table linking to auth.users
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Instructor Sessions Table
CREATE TABLE instructor_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE instructor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own instructor sessions"
  ON instructor_sessions
  USING (auth.uid() = user_id);


-- Instructor Classes Table
CREATE TABLE instructor_classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES instructor_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  class_index INT NOT NULL,
  batch TEXT NOT NULL,
  class_type TEXT NOT NULL,
  paper_type TEXT,
  paper_number INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE instructor_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own instructor classes"
  ON instructor_classes
  USING (auth.uid() = user_id);


-- Paper Panel Entries Table
CREATE TABLE paper_panel_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  batch TEXT NOT NULL,
  paper_type TEXT NOT NULL,
  paper_number INT NOT NULL,
  paper_count INT NOT NULL,
  received_date DATE NOT NULL,
  returned_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE paper_panel_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own paper panel entries"
  ON paper_panel_entries
  USING (auth.uid() = user_id);


-- RPC to get next instructor paper number
CREATE OR REPLACE FUNCTION get_next_instructor_paper_number(p_batch TEXT, p_paper_type TEXT)
RETURNS INT AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(paper_number), 0) + 1 INTO next_num
  FROM instructor_classes
  WHERE user_id = auth.uid()
    AND batch = p_batch
    AND paper_type = p_paper_type;
    
  RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to get next panel paper number (max 80 allowed, UI can enforce max 80, but function just returns max + 1)
CREATE OR REPLACE FUNCTION get_next_panel_paper_number(p_batch TEXT, p_paper_type TEXT)
RETURNS INT AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(paper_number), 0) + 1 INTO next_num
  FROM paper_panel_entries
  WHERE user_id = auth.uid()
    AND batch = p_batch
    AND paper_type = p_paper_type;
    
  RETURN next_num;
END;

-- User Devices Table for Persistent Tracking
CREATE TABLE user_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  browser_name TEXT NOT NULL,
  ip_address TEXT,
  location TEXT,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, device_id)
);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own devices"
  ON user_devices
  FOR ALL
  USING (auth.uid() = user_id);

-- Storage Bucket Policies (Run these in the SQL Editor)
/*
-- Create the bucket if it doesn't exist
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Policy for uploading avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy for updating avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy for deleting avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy for viewing avatars (Public)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
*/
