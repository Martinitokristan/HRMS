<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Insert the 3 master variant types that the entire app depends on.
     * These are FIXED constants, not user-managed data, so they belong
     * in a migration — not a seeder — so migrate:fresh always creates them.
     */
    public function up()
    {
        DB::table('variants')->insert([
            [
                'id'          => 1,
                'name'        => 'Size',
                'status'      => 'active',
                'description' => 'Physical dimensions or measurements (e.g. 1/2 inch, Small)',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'id'          => 2,
                'name'        => 'Color',
                'status'      => 'active',
                'description' => 'Product color, finish, or pattern',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'id'          => 3,
                'name'        => 'Weight',
                'status'      => 'active',
                'description' => 'Product weight or volume class (e.g. grams, kg, ml)',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
        ]);
    }

    public function down()
    {
        DB::table('variants')->whereIn('id', [1, 2, 3])->delete();
    }
};
