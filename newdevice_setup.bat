@echo off
REM HRMS Local Integration Setup (PHP 7.4 Bypass)
echo.
echo 🚀 Setting up HRMS for Local Testing...
echo ----------------------------------------

REM 1. Fix the environment file
if not exist .env (
    echo 📝 Creating Local .env from Example...
    copy .env.example .env
)

REM 2. Install PHP dependencies with BYPASS
echo 📦 Installing PHP dependencies...
call composer install --ignore-platform-reqs --no-interaction --prefer-dist --optimize-autoloader

if %errorlevel% neq 0 (
    echo ❌ Composer setup failed.
    pause
    exit /b %errorlevel%
)

REM 3. Install Node dependencies
echo 📦 Installing Node dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ NPM setup failed.
    pause
    exit /b %errorlevel%
)

REM 4. Generate Key & Link (Needed for "serve" to work)
echo 🔑 Refreshing APP_KEY...
php artisan key:generate

echo 🔗 Linking Storage...
php artisan storage:link

echo.
echo ✅ Dependencies and Engine ready!
echo.
echo 🎯 NEXT STEPS FOR YOU:
echo 1. Create a database named 'hrms' in your Local MySQL / phpMyAdmin.
echo 2. Run 'php artisan migrate' to set up the tables.
echo 3. Run 'php artisan serve' to start working.
echo.
pause
