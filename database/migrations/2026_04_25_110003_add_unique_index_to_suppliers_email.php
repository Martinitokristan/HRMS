<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddUniqueIndexToSuppliersEmail extends Migration
{
    public function up()
    {
        $alreadyUnique = collect(DB::select("SHOW INDEX FROM suppliers"))
            ->contains(fn ($i) => $i->Column_name === 'email' && (int) $i->Non_unique === 0);

        if (!$alreadyUnique) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->unique('email', 'suppliers_email_unique');
            });
        }
    }

    public function down()
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropUnique('suppliers_email_unique');
        });
    }
}
