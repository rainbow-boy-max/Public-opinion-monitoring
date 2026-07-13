CREATE DATABASE IF NOT EXISTS opinion_monitor DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'opinion'@'%' IDENTIFIED BY 'opinionpass';
GRANT ALL PRIVILEGES ON opinion_monitor.* TO 'opinion'@'%';
FLUSH PRIVILEGES;
