
SELECT 'CREATE DATABASE auth_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auth_db')\gexec

SELECT 'CREATE DATABASE customer_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'customer_db')\gexec

SELECT 'CREATE DATABASE menu_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'menu_db')\gexec

SELECT 'CREATE DATABASE order_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'order_db')\gexec

SELECT 'CREATE DATABASE kitchen_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kitchen_db')\gexec

SELECT 'CREATE DATABASE inventory_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'inventory_db')\gexec

SELECT 'CREATE DATABASE analytics_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'analytics_db')\gexec
