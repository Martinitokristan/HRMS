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

        // HTML Content (Premium Design)
        $htmlContent = "
            <html>
            <body style='font-family: \"Inter\", Arial, sans-serif; background-color: #f8fafc; padding: 40px; margin: 0;'>
                <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px 24px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>
                    <div style='text-align: center; margin-bottom: 32px;'>
                        <h1 style='color: #0f172a; font-size: 24px; font-weight: 800; margin: 0;'>HRMS</h1>
                        <p style='color: #64748b; font-size: 14px; margin-top: 4px;'>Hardware Retail Management System</p>
                    </div>
                    
                    <h2 style='color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px;'>Verify your email address</h2>
                    <p style='font-size: 16px; color: #475569; line-height: 1.6;'>Hello <strong>{$name}</strong>,</p>
                    <p style='font-size: 16px; color: #475569; line-height: 1.6;'>Welcome to HRMS! To get started with your account, please verify your email address by clicking the button below.</p>
                    
                    <div style='text-align: center; margin-top: 40px; margin-bottom: 40px;'>
                        <a href='{$verificationUrl}' style='display: inline-block; background-color: #FF6B35; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; transition: background-color 0.2s;'>Confirm Email Address</a>
                    </div>
                    
                    <div style='border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 32px;'>
                        <p style='font-size: 13px; color: #94a3b8; line-height: 1.5;'>
                            If you're having trouble clicking the button, <a href='{$verificationUrl}' style='color: #FF6B35; text-decoration: underline;'>click here to verify</a>.
                        </p>
                        <p style='font-size: 12px; color: #cbd5e1; margin-top: 24px;'>
                            If you did not create an account, you can safely ignore this email.
                        </p>
                    </div>
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

    /**
     * Send a password reset email using the Brevo API.
     *
     * @param string $email Recipient email address
     * @param string $name Recipient name
     * @param string $token Reset token
     * @param string $userType 'user' or 'supplier'
     * @return bool
     */
    public static function sendPasswordResetEmail($email, $name, $token, $userType)
    {
        $apiKey = trim(config('services.brevo.api_key'));
        $fromEmail = trim(config('services.brevo.from_email'), '"\' ');
        $fromName = trim(config('services.brevo.from_name'), '"\' ');
        $appUrl = config('app.url');

        if (!$apiKey) {
            Log::error('Brevo API key is not set in config/services.php.');
            return false;
        }

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
        $sendSmtpEmail->setSubject('Reset Your Password');

        // Reset URL
        $resetUrl = $appUrl . '/reset-password?token=' . $token . '&type=' . $userType;

        // HTML Content (Premium Design — matches verification email style)
        $htmlContent = "
            <html>
            <body style='font-family: \"Inter\", Arial, sans-serif; background-color: #f8fafc; padding: 40px; margin: 0;'>
                <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px 24px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>
                    <div style='text-align: center; margin-bottom: 32px;'>
                        <h1 style='color: #0f172a; font-size: 24px; font-weight: 800; margin: 0;'>HRMS</h1>
                        <p style='color: #64748b; font-size: 14px; margin-top: 4px;'>Hardware Retail Management System</p>
                    </div>

                    <h2 style='color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 16px;'>Reset your password</h2>
                    <p style='font-size: 16px; color: #475569; line-height: 1.6;'>Hello <strong>{$name}</strong>,</p>
                    <p style='font-size: 16px; color: #475569; line-height: 1.6;'>We received a request to reset your password. Click the button below to choose a new password.</p>

                    <div style='text-align: center; margin-top: 40px; margin-bottom: 40px;'>
                        <a href='{$resetUrl}' style='display: inline-block; background-color: #FF6B35; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 700; font-size: 16px;'>Reset Password</a>
                    </div>

                    <div style='background-color: #fef3cd; border: 1px solid #ffeeba; border-radius: 8px; padding: 16px; margin-bottom: 24px;'>
                        <p style='font-size: 14px; color: #856404; margin: 0; line-height: 1.5;'>
                            <strong>This link expires in 15 minutes.</strong> If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                        </p>
                    </div>

                    <div style='border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 32px;'>
                        <p style='font-size: 13px; color: #94a3b8; line-height: 1.5;'>
                            If you're having trouble clicking the button, <a href='{$resetUrl}' style='color: #FF6B35; text-decoration: underline;'>click here to reset your password</a>.
                        </p>
                        <p style='font-size: 12px; color: #cbd5e1; margin-top: 24px;'>
                            This is an automated message from HRMS. Please do not reply to this email.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        ";

        $sendSmtpEmail->setHtmlContent($htmlContent);

        try {
            $result = $apiInstance->sendTransacEmail($sendSmtpEmail);
            $msg = "Brevo API: Password reset email sent to {$email}. MessageId: " . ($result->getMessageId() ?? 'N/A');
            Log::info($msg);
            error_log($msg);
            return true;
        } catch (Exception $e) {
            $errorMsg = "Brevo API Error (password reset) for {$email}: " . $e->getMessage();
            Log::error($errorMsg);
            error_log($errorMsg);
            return false;
        }
    }
}
