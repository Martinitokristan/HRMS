@echo off
REM HRMS Setup Script for Windows
REM This script ensures clean database setup when cloning the project

echo 🚀 Setting up HRMS Project...

REM Check if .env file exists
if not exist .env (
    echo 📝 Creating .env file from example...
    copy .env.example .env
) else (
    echo ✅ .env file already exists
)

REM Install dependencies
echo 📦 Installing PHP dependencies...
composer install --no-interaction --prefer-dist --optimize-autoloader

echo 📦 Installing Node dependencies...
npm install

REM Generate application key
echo 🔑 Generating application key...
php artisan key:generate

REM Create storage links
echo 🔗 Creating storage links...
php artisan storage:link

REM Clean database setup
echo 🧹 Cleaning database...
php artisan migrate:fresh --seed --force

echo ✅ Setup complete!
echo.
echo 🎯 Next steps:
echo 1. Configure your .env file with database credentials
echo 2. Run 'php artisan serve' to start the development server
echo 3. Visit http://localhost:8000 to access the application
echo.
echo 👤 Default Admin Login:
echo    Email: admin@hrms.com
echo    Password: password
pause
