<?php

namespace App\Services\Riders;

use App\Models\User;
use App\Events\DataMutated;

class RiderOnboardingService
{
    /**
     * Schedule an interview for a rider candidate.
     */
    public function scheduleInterview($riderId, $interviewDate)
    {
        $user = User::findOrFail($riderId);
        $user->update(['status' => 'interview_set']);
        $user->riderProfile()->update(['interview_at' => $interviewDate]);

        broadcast(new DataMutated('private-admin', ['admin_users', 'admin_riders'], 'rider.interview_scheduled'));
        broadcast(new DataMutated("private-rider.{$user->id}", ['rider_dashboard', 'rider_notifications'], 'rider.interview_scheduled'));

        return [
            'status_code' => 200,
        ];
    }
}
