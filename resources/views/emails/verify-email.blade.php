<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Verify your email address</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            margin-top: 40px;
            text-align: center;
        }
        .header {
            font-size: 24px;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 20px;
        }
        .text {
            font-size: 16px;
            color: #475569;
            line-height: 1.5;
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            background-color: #FF6B35;
            color: #ffffff;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 16px;
        }
        .footer {
            margin-top: 40px;
            font-size: 14px;
            color: #94a3b8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            Hardware Retail Management System
        </div>
        <div class="text">
            Hello {{ $name }},<br><br>
            Thank you for registering with us! Please click the button below to verify your email address and activate your account.
        </div>
        <a href="{{ $url }}" class="button">Verify Email Address</a>
        <div class="text" style="margin-top: 30px; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="{{ $url }}" style="color: #FF6B35; word-break: break-all;">{{ $url }}</a>
        </div>
        <div class="footer">
            If you did not create an account, no further action is required.
        </div>
    </div>
</body>
</html>
