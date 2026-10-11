-- Skema basis data Explore Solo (MySQL 8.0, utf8mb4).
-- Semua DATETIME disimpan dalam UTC; tampilan dikonversi ke WIB di aplikasi.

CREATE TABLE IF NOT EXISTS users (
  id                VARCHAR(32)  NOT NULL PRIMARY KEY,
  name              VARCHAR(120) NOT NULL,
  email             VARCHAR(190) NOT NULL,
  phone             VARCHAR(20)  NOT NULL,
  password_hash     VARCHAR(100) NOT NULL,
  role              ENUM('wisatawan','pengelola','admin') NOT NULL DEFAULT 'wisatawan',
  active            TINYINT(1)   NOT NULL DEFAULT 1,
  avatar_url        VARCHAR(255) NULL,
  email_verified_at DATETIME     NULL,
  verify_token      VARCHAR(64)  NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_verify_token (verify_token)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS destinations (
  id              VARCHAR(32)   NOT NULL PRIMARY KEY,
  slug            VARCHAR(160)  NOT NULL,
  name            VARCHAR(160)  NOT NULL,
  category        ENUM('sejarah-budaya','religi','alam-taman','belanja-kuliner','edukasi-museum','rekreasi-keluarga') NOT NULL,
  area            VARCHAR(120)  NOT NULL DEFAULT 'Surakarta',
  short           VARCHAR(160)  NOT NULL DEFAULT '',
  description     TEXT          NOT NULL,
  address         VARCHAR(255)  NOT NULL,
  lat             DECIMAL(9,6)  NOT NULL,
  lng             DECIMAL(9,6)  NOT NULL,
  photos          JSON          NOT NULL,
  facilities      JSON          NOT NULL,
  hours_open      CHAR(5)       NOT NULL,
  hours_close     CHAR(5)       NOT NULL,
  closed_days     JSON          NOT NULL,
  holidays        JSON          NOT NULL,
  daily_quota     INT UNSIGNED  NOT NULL,
  status          ENUM('AKTIF','MENUNGGU_VERIFIKASI','DITOLAK','NONAKTIF') NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
  pending_changes JSON          NULL,
  review_note     VARCHAR(500)  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_destinations_slug (slug),
  KEY idx_destinations_status_category (status, category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS destination_managers (
  user_id        VARCHAR(32) NOT NULL,
  destination_id VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, destination_id),
  KEY idx_dm_destination (destination_id),
  CONSTRAINT fk_dm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dm_destination FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_types (
  id             VARCHAR(32)  NOT NULL PRIMARY KEY,
  destination_id VARCHAR(32)  NOT NULL,
  name           VARCHAR(80)  NOT NULL,
  price          INT UNSIGNED NOT NULL,
  description    VARCHAR(160) NOT NULL DEFAULT '',
  position       SMALLINT     NOT NULL DEFAULT 0,
  active         TINYINT(1)   NOT NULL DEFAULT 1,
  KEY idx_tickets_destination (destination_id, active, position),
  CONSTRAINT fk_tickets_destination FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservations (
  id             VARCHAR(32)  NOT NULL PRIMARY KEY,
  code           VARCHAR(12)  NOT NULL,
  user_id        VARCHAR(32)  NOT NULL,
  destination_id VARCHAR(32)  NOT NULL,
  visit_date     DATE         NOT NULL,
  total_qty      INT UNSIGNED NOT NULL,
  total_amount   INT UNSIGNED NOT NULL,
  status         ENUM('MENUNGGU_PEMBAYARAN','LUNAS','SUDAH_DIGUNAKAN','DIBATALKAN') NOT NULL,
  contact_name   VARCHAR(120) NOT NULL,
  contact_email  VARCHAR(190) NOT NULL,
  contact_phone  VARCHAR(20)  NOT NULL,
  expires_at     DATETIME     NOT NULL,
  cancel_reason  VARCHAR(160) NULL,
  checked_in_at  DATETIME     NULL,
  checked_in_by  VARCHAR(32)  NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reservations_code (code),
  KEY idx_res_quota (destination_id, visit_date, status),
  KEY idx_res_user (user_id, created_at),
  KEY idx_res_expiry (status, expires_at),
  CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_res_destination FOREIGN KEY (destination_id) REFERENCES destinations(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservation_items (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reservation_id VARCHAR(32)  NOT NULL,
  ticket_type_id VARCHAR(32)  NOT NULL,
  name           VARCHAR(80)  NOT NULL,
  price          INT UNSIGNED NOT NULL,
  qty            SMALLINT UNSIGNED NOT NULL,
  KEY idx_items_reservation (reservation_id),
  CONSTRAINT fk_items_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_ticket FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id             VARCHAR(32)  NOT NULL PRIMARY KEY,
  reservation_id VARCHAR(32)  NOT NULL,
  order_id       VARCHAR(64)  NOT NULL,
  provider       ENUM('midtrans','simulasi','gratis') NOT NULL,
  method         VARCHAR(40)  NULL,
  status         ENUM('PENDING','BERHASIL','GAGAL') NOT NULL DEFAULT 'PENDING',
  gross_amount   INT UNSIGNED NOT NULL,
  snap_token     VARCHAR(100) NULL,
  transaction_id VARCHAR(80)  NULL,
  raw_response   JSON         NULL,
  paid_at        DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payments_order (order_id),
  KEY idx_payments_reservation (reservation_id),
  CONSTRAINT fk_payments_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id             VARCHAR(32)   NOT NULL PRIMARY KEY,
  reservation_id VARCHAR(32)   NOT NULL,
  destination_id VARCHAR(32)   NOT NULL,
  user_id        VARCHAR(32)   NOT NULL,
  rating         TINYINT UNSIGNED NOT NULL,
  comment        VARCHAR(500)  NOT NULL DEFAULT '',
  visit_date     DATE          NOT NULL,
  reply_text     VARCHAR(500)  NULL,
  reply_by       VARCHAR(120)  NULL,
  replied_at     DATETIME      NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reviews_reservation (reservation_id),
  KEY idx_reviews_destination (destination_id, created_at),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_destination FOREIGN KEY (destination_id) REFERENCES destinations(id),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  sid        VARCHAR(128) NOT NULL PRIMARY KEY,
  data       JSON         NOT NULL,
  user_id    VARCHAR(32)  NULL,
  expires_at DATETIME     NOT NULL,
  KEY idx_sessions_expires (expires_at),
  KEY idx_sessions_user (user_id)
) ENGINE=InnoDB;
