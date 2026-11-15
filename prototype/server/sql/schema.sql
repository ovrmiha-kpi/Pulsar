CREATE DATABASE IF NOT EXISTS pulsar
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pulsar;

CREATE TABLE IF NOT EXISTS devices (
  id            VARCHAR(32) PRIMARY KEY,
  device_no     VARCHAR(16) NOT NULL UNIQUE,
  display_name  VARCHAR(64) NULL,
  role_label    VARCHAR(64) NOT NULL DEFAULT 'Пристрій',
  battery_pct   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_seen_at  DATETIME(3) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS telemetry (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  device_id   VARCHAR(32) NOT NULL,
  hr          FLOAT NOT NULL,
  spo2        FLOAT NOT NULL,
  temp_c      FLOAT NOT NULL,
  recorded_at DATETIME(3) NOT NULL,
  source      VARCHAR(32) NOT NULL DEFAULT 'udp',
  INDEX idx_dev_time (device_id, recorded_at),
  CONSTRAINT fk_tel_dev FOREIGN KEY (device_id) REFERENCES devices(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS analyses (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  device_id     VARCHAR(32) NOT NULL,
  status        ENUM('critical','warning','normal','pending') NOT NULL,
  alert_text    VARCHAR(512) NOT NULL,
  trends_json   JSON NOT NULL,
  recommendations_json JSON NOT NULL,
  hr            FLOAT NULL,
  spo2          FLOAT NULL,
  temp_c        FLOAT NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_an_dev (device_id, created_at),
  CONSTRAINT fk_an_dev FOREIGN KEY (device_id) REFERENCES devices(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO devices (id, device_no, role_label, battery_pct) VALUES
  ('dev001', 'DEV-001', 'Зап''ястна станція', 0),
  ('dev002', 'DEV-002', 'Зап''ястна станція', 0),
  ('dev003', 'DEV-003', 'Зап''ястна станція', 0),
  ('dev004', 'DEV-004', 'Зап''ястна станція', 0)
ON DUPLICATE KEY UPDATE device_no = VALUES(device_no);
