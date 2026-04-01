@echo off
setlocal EnableDelayedExpansion

REM ================================================================
REM  HRMS - New Device Setup (XAMPP + Windows)
REM  Run this once after cloning. Make sure XAMPP MySQL is running.
REM ================================================================

echo.
echo ================================================================
echo   HRMS - New Device Setup
echo ================================================================
echo.

REM ── STEP 1: .env ─────────────────────────────────────────────────
echo [1/9] Setting up .env file...
if not exist .env (
    copy .env.example .env
    echo        .env created from .env.example
) else (
    echo        .env already exists. Skipping.
)
echo.

REM ── STEP 2: PHP Dependencies ─────────────────────────────────────
echo [2/9] Installing PHP dependencies (Composer)...
call composer install --ignore-platform-reqs --no-interaction --prefer-dist --optimize-autoloader
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Composer failed. Make sure PHP is installed and in PATH.
    pause
    exit /b %errorlevel%
)
echo.

REM ── STEP 3: Node Dependencies ────────────────────────────────────
echo [3/9] Installing Node dependencies (npm)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm install failed. Make sure Node.js is installed.
    pause
    exit /b %errorlevel%
)
echo.

REM ── STEP 4: Generate App Key ─────────────────────────────────────
echo [4/9] Generating Laravel APP_KEY...
php artisan key:generate
echo.

REM ── STEP 5: Create Database ──────────────────────────────────────
echo [5/9] Creating MySQL database 'hrms' (if not exists)...
set MYSQL_BIN=mysql
if exist "C:\xampp\mysql\bin\mysql.exe" set MYSQL_BIN="C:\xampp\mysql\bin\mysql.exe"
%MYSQL_BIN% -u root -e "CREATE DATABASE IF NOT EXISTS hrms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Could not auto-create the database.
    echo          Make sure XAMPP MySQL is running, then create
    echo          a database named 'hrms' manually in phpMyAdmin.
    echo          Press any key to continue after doing that...
    pause >nul
) else (
    echo        Database 'hrms' is ready.
)
echo.

REM ── STEP 6: Run Migrations ───────────────────────────────────────
echo [6/9] Running database migrations...
php artisan migrate --force
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Migration failed. Is MySQL running and 'hrms' DB created?
    pause
    exit /b %errorlevel%
)
echo.

REM ── STEP 7: Seed Database ────────────────────────────────────────
echo [7/9] Seeding database (admin, customer, variants, unit types, suppliers, riders)...
php artisan db:seed --force
if %errorlevel% neq 0 (
    echo [WARNING] Seeding failed. Run manually later: php artisan db:seed
)
echo.

REM ── STEP 8: Storage Link + Cache Clear ──────────────────────────
echo [8/9] Linking storage and clearing caches...
php artisan storage:link
php artisan config:clear
php artisan cache:clear
php artisan view:clear
echo.

REM ── STEP 9: Build Frontend Assets ───────────────────────────────
echo [9/9] Building frontend assets (laravel-mix)...
call npm run dev
if %errorlevel% neq 0 (
    echo [WARNING] Asset build failed. Run 'npm run dev' manually.
)
echo.

REM ── Done ─────────────────────────────────────────────────────────
echo ================================================================
echo   Setup Complete!
echo ================================================================
echo.
echo  ACTION REQUIRED - Open .env and fill in your Pusher credentials:
echo.
echo    PUSHER_APP_ID=your_pusher_app_id
echo    PUSHER_APP_KEY=your_pusher_key
echo    PUSHER_APP_SECRET=your_pusher_secret
echo    PUSHER_APP_CLUSTER=ap1
echo    MIX_PUSHER_APP_KEY=your_pusher_key      ^<-- must match PUSHER_APP_KEY
echo    MIX_PUSHER_APP_CLUSTER=ap1
echo.
echo    Get free credentials at: https://pusher.com (free tier is enough)
echo    After editing .env, run: npm run dev
echo.
echo ----------------------------------------------------------------
echo  HOW TO RUN THE APP:
echo    1. Start XAMPP (Apache + MySQL)
echo    2. Open terminal 1 -- run: php artisan serve
echo    3. Open terminal 2 -- run: npm run watch   (hot reload)
echo    4. Open browser:       http://localhost:8000
echo.
echo  DEFAULT LOGIN CREDENTIALS (created by seeder):
echo    Admin:    admin@hrms.com    / password
echo    Customer: customer@hrms.com / password
echo    (Suppliers and riders are also seeded with sample data)
echo.
echo ================================================================
pause
