<?php

namespace App\Http\Controllers;

use App\Http\Requests\AddressRequest;
use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddressController extends Controller
{
    /**
     * Store a new address.
     * Saves both the PSGC code and human-readable name at every level.
     */
    public function store(AddressRequest $request): JsonResponse
    {
        $address = Address::create(
            array_merge($request->validated(), ['user_id' => optional($request->user())->id])
        );

        return response()->json([
            'message' => 'Address saved successfully.',
            'data'    => $address,
        ], 201);
    }

    /**
     * Return all addresses for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $addresses = Address::where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $addresses]);
    }

    /**
     * Update an existing address.
     */
    public function update(AddressRequest $request, Address $address): JsonResponse
    {
        $this->authorize('update', $address);

        $address->update($request->validated());

        return response()->json([
            'message' => 'Address updated successfully.',
            'data'    => $address,
        ]);
    }

    /**
     * Delete an address (soft-delete).
     */
    public function destroy(Address $address): JsonResponse
    {
        $this->authorize('delete', $address);

        $address->delete();

        return response()->json(['message' => 'Address deleted.']);
    }
}
