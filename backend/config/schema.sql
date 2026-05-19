-- ============================================================
-- SSID SYSTEM DATABASE SCHEMA
-- Centralized National Social Security Identity Management System
-- ============================================================

CREATE DATABASE IF NOT EXISTS ssid_system;
USE ssid_system;

-- ------------------------------------------------------------
-- 1. CITIZENS — core identity records
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citizens (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nin             VARCHAR(11)  NOT NULL UNIQUE,
  ssid            VARCHAR(20)  NOT NULL UNIQUE,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  middle_name     VARCHAR(100),
  dob             DATE         NOT NULL,
  gender          ENUM('male','female','other') NOT NULL,
  phone           VARCHAR(15)  NOT NULL,
  email           VARCHAR(150),
  state_of_origin VARCHAR(50)  NOT NULL,
  lga             VARCHAR(100) NOT NULL,
  address         TEXT,
  employment_type ENUM('formal','informal','unemployed','retired') DEFAULT 'informal',
  fingerprint_path VARCHAR(255),
  passport_path    VARCHAR(255),
  nin_verified    BOOLEAN      DEFAULT FALSE,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 2. USERS — login accounts (linked to citizens OR standalone for officials/admins)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id   INT          NULL,  -- NULL for officials and admins
  role         ENUM('citizen','official','admin') NOT NULL DEFAULT 'citizen',
  email        VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  agency       VARCHAR(100) NULL,  -- e.g. 'PenCom', 'NSIPA', 'NASSCO'
  is_active    BOOLEAN      DEFAULT TRUE,
  last_login   TIMESTAMP    NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- 3. BENEFIT ELIGIBILITY — per citizen per program
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS benefit_eligibility (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id      INT NOT NULL,
  program         ENUM('CPS','CCT','NPOWER','SCHOOL_FEEDING') NOT NULL,
  status          ENUM('eligible','ineligible','pending','suspended') DEFAULT 'pending',
  notes           TEXT,
  last_verified_at TIMESTAMP NULL,
  verified_by     INT NULL,  -- FK to users (official)
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_citizen_program (citizen_id, program)
);

-- ------------------------------------------------------------
-- 4. VERIFICATION AUDIT LOG — every SSID query is recorded
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  ssid_queried VARCHAR(20)  NOT NULL,
  queried_by   INT          NOT NULL,  -- FK to users (official)
  purpose      VARCHAR(255) NOT NULL,  -- e.g. 'pension_eligibility_check'
  agency       VARCHAR(100) NOT NULL,
  result       ENUM('found','not_found','flagged') NOT NULL,
  ip_address   VARCHAR(45),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (queried_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 5. CONSENT RECORDS — citizen controls who can query their SSID
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consent_records (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id  INT NOT NULL,
  agency      VARCHAR(100) NOT NULL,
  granted     BOOLEAN DEFAULT TRUE,
  granted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at  TIMESTAMP NULL,
  FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE,
  UNIQUE KEY unique_citizen_agency (citizen_id, agency)
);

-- ------------------------------------------------------------
-- INDEXES for fast lookups
-- ------------------------------------------------------------
CREATE INDEX idx_citizens_nin  ON citizens(nin);
CREATE INDEX idx_citizens_ssid ON citizens(ssid);
CREATE INDEX idx_verif_ssid    ON verification_logs(ssid_queried);
CREATE INDEX idx_verif_date    ON verification_logs(created_at);
