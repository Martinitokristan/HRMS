<?php

namespace App\Services\Settings;

use App\Models\Category;
use Illuminate\Support\Facades\Cache;

class CategoryService
{
    /**
     * Save category (create or update).
     */
    public function saveCategory($data)
    {
        $category = Category::updateOrCreate(
            ['id' => $data['id'] ?? null],
            [
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
            ]
        );

        $this->flushCategoryCache();

        return [
            'data' => $category,
            'status_code' => 200,
        ];
    }

    /**
     * Delete category.
     */
    public function deleteCategory($id)
    {
        Category::destroy($id);
        $this->flushCategoryCache();

        return [
            'status_code' => 200,
        ];
    }

    /**
     * Flush category cache.
     */
    private function flushCategoryCache()
    {
        if (Cache::getStore() instanceof \Illuminate\Cache\TaggableStore) {
            Cache::tags(['categories'])->flush();
        } else {
            Cache::forget('categories:all');
        }
    }
}
