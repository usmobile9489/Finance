-- Mister Abstract Vacation Scheduler Schema

-- Allowed emails table (admin pre-authorizes who can sign up)
CREATE TABLE IF NOT EXISTS vacation_allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  vacation_days_allowed DECIMAL(10,2) DEFAULT 15,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE vacation_allowed_emails ENABLE ROW LEVEL SECURITY;
-- Anyone can read (needed for signup validation)
CREATE POLICY "Anyone can read allowed emails" ON vacation_allowed_emails FOR SELECT USING (true);
-- Only admins can insert/update/delete (enforced via app logic + profile check)
CREATE POLICY "Admins can manage allowed emails" ON vacation_allowed_emails FOR ALL
  USING (EXISTS (
    SELECT 1 FROM vacation_profiles WHERE vacation_profiles.id = auth.uid() AND vacation_profiles.role = 'admin'
  ));

-- User profiles table (linked 1:1 to auth.users)
CREATE TABLE IF NOT EXISTS vacation_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  vacation_days_allowed DECIMAL(10,2) DEFAULT 15,
  manager_id UUID REFERENCES vacation_profiles(id),
  department VARCHAR(100),
  hire_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE vacation_profiles ENABLE ROW LEVEL SECURITY;
-- Users can read all profiles (needed for manager lookups)
CREATE POLICY "Authenticated users can read profiles" ON vacation_profiles FOR SELECT USING (auth.uid() IS NOT NULL);
-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile" ON vacation_profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- Users can update their own profile; admins can update any
CREATE POLICY "Users can update own profile" ON vacation_profiles FOR UPDATE
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM vacation_profiles vp WHERE vp.id = auth.uid() AND vp.role = 'admin'
  ));

-- Vacation requests table
CREATE TABLE IF NOT EXISTS vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES vacation_profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours_per_day DECIMAL(4,2) DEFAULT 8.0,
  total_days DECIMAL(10,2) NOT NULL,
  total_hours DECIMAL(10,2) NOT NULL,
  request_type VARCHAR(50) DEFAULT 'vacation' CHECK (request_type IN ('vacation', 'sick', 'personal')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  reviewed_by UUID REFERENCES vacation_profiles(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;
-- Users can view their own requests; managers/admins can view all
CREATE POLICY "Users can view own requests" ON vacation_requests FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM vacation_profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );
CREATE POLICY "Users can insert own requests" ON vacation_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own pending requests" ON vacation_requests FOR UPDATE
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR EXISTS (SELECT 1 FROM vacation_profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );
CREATE POLICY "Users can delete own pending requests" ON vacation_requests FOR DELETE
  USING (user_id = auth.uid() AND status = 'pending');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vacation_profiles_email ON vacation_profiles(email);
CREATE INDEX IF NOT EXISTS idx_vacation_profiles_role ON vacation_profiles(role);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_user_id ON vacation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON vacation_requests(status);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_dates ON vacation_requests(start_date, end_date);
