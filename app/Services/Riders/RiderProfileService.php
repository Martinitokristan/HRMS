<?php

namespace App\Services\Riders;

use App\Models\User;
use App\Models\RiderProfile;
use App\Events\DataMutated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class RiderProfileService
{
    /**
     * Update rider profile information.
     */
    public function updateProfile($userId, $data)
    {
        $user = User::findOrFail($userId);

        DB::transaction(function () use ($user, $data) {
            $userFields = [];
            if (isset($data['name'])) {
                $userFields['name'] = $data['name'];
            }
            if (isset($data['email'])) {
                $userFields['email'] = $data['email'];
            }
            if (isset($data['phone'])) {
                $userFields['phone'] = $data['phone'];
            }

            if (!empty($userFields)) {
                $user->update($userFields);
            }

            $profileData = [];
            if (isset($data['name'])) {
                $profileData['name'] = $data['name'];
            }
            if (isset($data['email'])) {
                $profileData['email'] = $data['email'];
            }
            if (isset($data['address'])) {
                $profileData['address'] = $data['address'];
            }

            $user->riderProfile()->updateOrCreate(
                ['user_id' => $user->id],
                $profileData
            );
        });

        broadcast(new DataMutated("private-rider.{$userId}", ['rider_profile', 'rider_dashboard'], 'rider.profile_updated'));

        return [
            'data' => $user->load('riderProfile'),
            'status_code' => 200,
        ];
    }

    /**
     * Update rider profile photo.
     */
    public function updatePhoto($userId, $file)
    {
        $user = User::findOrFail($userId);

        $oldPath = $user->photo;
        $path = $file->store('profile-photos', 'public');

        $user->update(['photo' => $path]);

        if ($oldPath && Storage::disk('public')->exists($oldPath)) {
            Storage::disk('public')->delete($oldPath);
        }

        broadcast(new DataMutated("private-rider.{$userId}", ['rider_profile'], 'rider.photo_updated'));

        return [
            'data' => [
                'photo_url' => asset('storage/' . $path),
                'user' => $user->load('riderProfile'),
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Update rider password/security.
     */
    public function updateSecurity($userId, $newPassword)
    {
        $user = User::findOrFail($userId);

        $user->update([
            'password' => bcrypt($newPassword)
        ]);

        broadcast(new DataMutated("private-rider.{$userId}", ['rider_security'], 'rider.password_changed'));

        return [
            'status_code' => 200,
        ];
    }

    /**
     * Toggle rider availability status (on-duty/off-duty).
     */
    public function toggleStatus($userId)
    {
        $profile = RiderProfile::where('user_id', $userId)->first();

        if ($profile) {
            $profile->availability = $profile->availability === 'off_duty' ? 'available' : 'off_duty';
            $profile->save();
        }

        broadcast(new DataMutated('private-admin', ['admin_riders'], 'rider.availability_changed'));
        broadcast(new DataMutated("private-rider.{$userId}", ['rider_dashboard'], 'rider.availability_changed'));

        return [
            'status_code' => 200,
        ];
    }

    /**
     * Approve/hire a rider from onboarding.
     */
    public function approveRider($riderId)
    {
        $user = User::findOrFail($riderId);
        $user->update(['status' => 'active']);

        broadcast(new DataMutated('private-admin', ['admin_users', 'admin_riders'], 'rider.approved'));
        broadcast(new DataMutated("private-rider.{$user->id}", ['rider_dashboard', 'rider_notifications'], 'rider.approved'));

        return [
            'status_code' => 200,
        ];
    }
}
