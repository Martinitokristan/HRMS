<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddIndexToUserActivities extends Migration
{
    private const TABLE = 'user_activities';

    public function up()
    {
        Schema::table(self::TABLE, function (Blueprint $table) {
            if (!$this->indexExists(self::TABLE, 'user_activities_product_created_index')) {
                $table->index(['product_id', 'created_at'], 'user_activities_product_created_index');
            }
        });
    }

    public function down()
    {
        Schema::table(self::TABLE, function (Blueprint $table) {
            if ($this->indexExists(self::TABLE, 'user_activities_product_created_index')) {
                $table->dropIndex('user_activities_product_created_index');
            }
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $indexes = DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName]);
        return count($indexes) > 0;
    }
}
