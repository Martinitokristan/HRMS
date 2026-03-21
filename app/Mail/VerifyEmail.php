<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class VerifyEmail extends Mailable
{
    use Queueable, SerializesModels;

    public $name;
    public $url;

    /**
     * Create a new message instance.
     *
     * @param string $name User name
     * @param string $token Verification token
     * @param string $type Role (customer, rider, supplier)
     * @return void
     */
    public function __construct($name, $token, $type)
    {
        $this->name = $name;
        // The URL redirects to frontend SPA route
        $this->url = env('APP_URL') . "/verify-email?token={$token}&type={$type}";
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        return $this->subject('Verify Your Email Address')
                    ->view('emails.verify-email');
    }
}
