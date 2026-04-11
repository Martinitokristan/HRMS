<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'region_code'   => ['required', 'string', 'max:20'],
            'region_name'   => ['required', 'string', 'max:100'],
            'province_code' => ['required', 'string', 'max:20'],
            'province_name' => ['required', 'string', 'max:100'],
            'city_code'     => ['required', 'string', 'max:20'],
            'city_name'     => ['required', 'string', 'max:100'],
            'barangay_code' => ['required', 'string', 'max:20'],
            'barangay_name' => ['required', 'string', 'max:100'],
            'street'        => ['nullable', 'string', 'max:255'],
            'zip_code'      => ['nullable', 'string', 'regex:/^\d{4}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'region_code.required'   => 'Please select a region.',
            'province_code.required' => 'Please select a province.',
            'city_code.required'     => 'Please select a city or municipality.',
            'barangay_code.required' => 'Please select a barangay.',
            'zip_code.regex'         => 'ZIP code must be exactly 4 digits.',
        ];
    }
}
