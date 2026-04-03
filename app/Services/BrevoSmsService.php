<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class BrevoSmsService
{
    /**
     * iProg SMS API base URL.
     */
    private const API_URL = 'https://sms.iprogtech.com/api/v1/sms_messages';

    /**
     * Send a transactional SMS via iProg SMS API.
     *
     * @param string $recipient Phone number (e.g. 09911876626 or 639911876626)
     * @param string $content SMS message content
     * @return bool
     */
    public static function send(string $recipient, string $content): bool
    {
        $apiToken = trim(config('services.iprogsms.api_token', ''));
        $apiUrl   = trim(config('services.iprogsms.endpoint', 'https://www.iprogsms.com/api/v1/sms_messages'));

        if (!$apiToken) {
            Log::error('IProgSMS: API token not configured. Set IPROG_API_TOKEN in .env');
            return false;
        }

        // Normalize Philippine numbers to 639XX format (iProg accepts both 09XX and 639XX)
        $recipient = self::normalizePhone($recipient);

        if (!$recipient) {
            Log::error('IProgSMS: Invalid phone number provided.');
            return false;
        }

        $data = [
            'api_token'    => $apiToken,
            'phone_number' => $recipient,
            'message'      => $content,
        ];

        try {
            $ch = curl_init($apiUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/x-www-form-urlencoded',
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($curlError) {
                Log::error("IProgSMS: cURL error sending to {$recipient}: {$curlError}");
                return false;
            }

            $result = json_decode($response, true);
            Log::info("IProgSMS: Response for {$recipient}", ['http_code' => $httpCode, 'body' => $result]);

            // iProg returns status 200 in the JSON body for success
            if (isset($result['status']) && (int)$result['status'] === 200) {
                Log::info("IProgSMS: SMS queued for {$recipient}. Message ID: " . ($result['message_id'] ?? 'N/A'));
                return true;
            }

            $errMsg = is_array($result['message'] ?? null) ? implode('; ', $result['message']) : ($result['message'] ?? 'unknown error');
            Log::error("IProgSMS: Failed to send SMS to {$recipient}. Reason: {$errMsg}");
            return false;

        } catch (\Exception $e) {
            Log::error("IProgSMS: Exception sending SMS to {$recipient}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Normalize a Philippine phone number.
     * Accepts 09XX, +639XX, 639XX formats.
     * Returns 09XX format (iProg supports both).
     */
    public static function normalizePhone(?string $phone): ?string
    {
        if (!$phone) return null;

        $phone = preg_replace('/[\s\-\(\)]/', '', $phone);

        // Already 09XX format
        if (preg_match('/^09\d{9}$/', $phone)) {
            return $phone;
        }

        // +639XX -> 09XX
        if (preg_match('/^\+639\d{9}$/', $phone)) {
            return '0' . substr($phone, 3);
        }

        // 639XX -> 09XX
        if (preg_match('/^639\d{9}$/', $phone)) {
            return '0' . substr($phone, 2);
        }

        return null;
    }

    /**
     * Build the GCash payment confirmed SMS template.
     */
    public static function gcashConfirmedMessage(string $customerName, float $amount, string $itemSummary): string
    {
        $formattedAmount = number_format($amount, 2);
        return "Hi {$customerName}! Your payment for {$itemSummary} amounting to P{$formattedAmount} has been successfully received and confirmed.\n\nWe will notify you once your order is being processed.\n\nThank you for your purchase!\n- HRMS";
    }

    /**
     * Build the return approved SMS template.
     */
    public static function returnApprovedMessage(string $returnNumber, float $refundAmount, string $customerName): string
    {
        $formattedAmount = number_format($refundAmount, 2);
        return "HRMS - Return Approved\n\nHi {$customerName}, your return request {$returnNumber} has been approved. A refund of PHP {$formattedAmount} will be processed shortly.\n\nThank you for your patience.";
    }
}
