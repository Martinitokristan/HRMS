@echo off
REM HRMS Setup Script for PHP 7.4 Devices (Teacher's Version)
REM This script bypasses the PHP 8.2 requirement for use on older machines.

echo.
echo 🚀 Setting up HRMS Project for PHP 7.4...
echo ---------------------------------------

REM Check if .env file exists
if not exist .env (
    echo 📝 Creating .env file from example...
    copy .env.example .env
) else (
    echo ✅ .env file already exists
)

REM Install PHP dependencies with BYPASS
echo 📦 Installing PHP dependencies (Ignoring PHP 8.2 Requirement)...
call composer install --ignore-platform-reqs --no-interaction --prefer-dist --optimize-autoloader

if %errorlevel% neq 0 (
    echo ❌ Composer failed! Check if composer is installed.
    pause
    exit /b %errorlevel%
)

REM Install Node dependencies
echo 📦 Installing Node dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ NPM failed! Check if Node.js is installed.
    pause
    exit /b %errorlevel%
)

REM Generate application key
echo 🔑 Generating application key...
php artisan key:generate

REM Create storage links
echo 🔗 Creating storage links...
php artisan storage:link

REM Clean database setup
echo 🧹 Cleaning database...
php artisan migrate:fresh --seed --force

echo.
echo ✅ Setup complete!
echo 🎯 Running on PHP 7.4 (Bypass Active).
echo.
echo 👤 Default Admin Login:
echo    Email: admin@hrms.com
echo    Password: password
echo.
pause
