<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUsersTable extends Migration
{
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('email', 150)->unique()->index();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('email_verification_token', 64)->nullable();
            $table->string('photo')->nullable();
            $table->string('phone', 20)->nullable();
            $table->enum('role', ['admin', 'customer', 'rider'])->default('customer');
            $table->enum('status', ['active', 'pending', 'suspended', 'interview_set'])->default('active');
            $table->string('password');
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('users');
    }
}
