#!/bin/bash

# HRMS Setup Script
# This script ensures clean database setup when cloning the project

echo "🚀 Setting up HRMS Project..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing PHP dependencies..."
composer install --no-interaction --prefer-dist --optimize-autoloader

echo "📦 Installing Node dependencies..."
npm install

# Generate application key
echo "🔑 Generating application key..."
php artisan key:generate

# Create storage links
echo "🔗 Creating storage links..."
php artisan storage:link

# Clean database setup
echo "🧹 Cleaning database..."
php artisan migrate:fresh --seed --force

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Configure your .env file with database credentials"
echo "2. Run 'php artisan serve' to start the development server"
echo "3. Visit http://localhost:8000 to access the application"
echo ""
echo "👤 Default Admin Login:"
echo "   Email: admin@hrms.com"
echo "   Password: password"
