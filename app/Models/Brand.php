<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Brand extends Model
{
    protected $fillable = ['name', 'description', 'supplier_id'];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function supplierProducts()
    {
        return $this->hasMany(SupplierProduct::class);
    }
}
