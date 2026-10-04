-- niben.no – databaseskjema (MySQL 5.7+/MariaDB 10.3+)
-- api.php oppretter tabellene automatisk første gang du logger inn,
-- men du kan også kjøre denne filen selv.

CREATE TABLE IF NOT EXISTS trips (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  country     VARCHAR(80)  NOT NULL,              -- engelsk navn fra kartdataene, f.eks. 'Italy'
  place       VARCHAR(160) NULL,                  -- by/område
  title       VARCHAR(200) NOT NULL,
  year        SMALLINT     NULL,
  date_from   DATE         NULL,
  date_to     DATE         NULL,
  body        TEXT         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_trips_country (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trip_photos (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  trip_id     INT UNSIGNED NOT NULL,
  path        VARCHAR(255) NOT NULL,              -- relativ sti, f.eks. 'uploads/photos/ab12cd.jpg'
  caption     VARCHAR(255) NULL,
  width       SMALLINT UNSIGNED NULL,
  height      SMALLINT UNSIGNED NULL,
  sort        INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_photos_trip (trip_id),
  CONSTRAINT fk_photos_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS books (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title          VARCHAR(255) NOT NULL,
  author         VARCHAR(255) NULL,
  isbn           VARCHAR(20)  NULL,
  ol_key         VARCHAR(40)  NULL,               -- Open Library-nøkkel, f.eks. '/works/OL27448W'
  cover_url      VARCHAR(255) NULL,
  published_year SMALLINT     NULL,
  pages          SMALLINT UNSIGNED NULL,
  read_on        DATE         NULL,
  rating         TINYINT UNSIGNED NULL,           -- 1–5
  thoughts       TEXT         NULL,
  quote          TEXT         NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recordings (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  guitar       VARCHAR(60)  NOT NULL,             -- "id" til gitaren i data.json, f.eks. 'pacifica'
  title        VARCHAR(200) NOT NULL,
  recorded_on  DATE         NULL,
  youtube      VARCHAR(20)  NULL,                 -- YouTube-video-ID
  audio_path   VARCHAR(255) NULL,                 -- 'uploads/audio/….mp3'
  notes        TEXT         NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rec_guitar (guitar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS songs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, title VARCHAR(200) NOT NULL, artist VARCHAR(200) NULL,
  chords VARCHAR(400) NOT NULL, bpm SMALLINT UNSIGNED NULL, beats TINYINT UNSIGNED NULL, capo TINYINT UNSIGNED NULL,
  ug_url VARCHAR(255) NULL, notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  ip            VARCHAR(45) NOT NULL,
  attempted_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_login_ip (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
