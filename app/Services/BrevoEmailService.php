<?php

namespace App\Services;

use SendinBlue\Client\Configuration;
use SendinBlue\Client\Api\TransactionalEmailsApi;
use SendinBlue\Client\Model\SendSmtpEmail;
use GuzzleHttp\Client as GuzzleClient;
use Exception;
use Illuminate\Support\Facades\Log;

class BrevoEmailService
{
    /**
     * Send a verification email using the Brevo API.
     *
     * @param string $email Recipient email address
     * @param string $name Recipient name
     * @param string $token Verification token
     * @param string $role User role
     * @return bool
     */
    public static function sendVerificationEmail($email, $name, $token, $role)
    {
        $apiKey = trim(config('services.brevo.api_key'));
        $fromEmail = trim(config('services.brevo.from_email'), '"\' ');
        $fromName = trim(config('services.brevo.from_name'), '"\' ');
        $appUrl = config('app.url');

        if (!$apiKey) {
            Log::error('Brevo API key is not set in config/services.php.');
            return false;
        }

        // Configure API key authorization: api-key
        $config = Configuration::getDefaultConfiguration()->setApiKey('api-key', $apiKey);

        $apiInstance = new TransactionalEmailsApi(new GuzzleClient(), $config);

        $sendSmtpEmail = new SendSmtpEmail();
        
        // Sender
        $sender = new \SendinBlue\Client\Model\SendSmtpEmailSender(['email' => $fromEmail, 'name' => $fromName]);
        $sendSmtpEmail->setSender($sender);
        
        // Recipient
        $recipient = new \SendinBlue\Client\Model\SendSmtpEmailTo(['email' => $email, 'name' => $name]);
        $sendSmtpEmail->setTo([$recipient]);
        
        // Subject
        $sendSmtpEmail->setSubject('Verify Your Email Address');

        // Verification URL
        $verificationUrl = $appUrl . "/verify-email?token={$token}&type={$role}";

        // HTML Content
        $htmlContent = "
            <html>
            <body style='font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px;'>
                <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px;'>
                    <h2 style='color: #0f172a;'>Hardware Retail Management System</h2>
                    <p style='font-size: 16px; color: #475569;'>Hello {$name},</p>
                    <p style='font-size: 16px; color: #475569;'>Thank you for registering with us! Please click the button below to verify your email address and activate your account.</p>
                    <div style='text-align: center; margin-top: 30px;'>
                        <a href='{$verificationUrl}' style='display: inline-block; background-color: #FF6B35; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold;'>Verify Email Address</a>
                    </div>
                    <p style='font-size: 14px; color: #94a3b8; margin-top: 40px;'>If the button doesn't work, copy and paste this link into your browser:<br>{$verificationUrl}</p>
                    <p style='font-size: 14px; color: #94a3b8;'>If you did not create an account, no further action is required.</p>
                </div>
            </body>
            </html>
        ";

        $sendSmtpEmail->setHtmlContent($htmlContent);

        try {
            $result = $apiInstance->sendTransacEmail($sendSmtpEmail);
            $msg = "Brevo API: Email sent successfully to {$email}. MessageId: " . ($result->getMessageId() ?? 'N/A');
            Log::info($msg);
            error_log($msg); // Legacy log to ensure it hits Railway console
            return true;
        } catch (Exception $e) {
            $errorMsg = "Brevo API Error for {$email}: " . $e->getMessage();
            Log::error($errorMsg);
            error_log($errorMsg); // Ensure it shows in Railway console
            return false;
        }
    }
}
