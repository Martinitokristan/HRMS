import React from 'react';

export const GCashIcon = ({ size = 24, className }) => (
    <img
        src="/Gcash.jpeg"
        alt="GCash"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'cover', borderRadius: 4 }}
    />
);

export const CODIcon = ({ size = 24, className }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <rect width="24" height="24" rx="6" fill="#22c55e"/>
        <path d="M7 11C7 9.89543 7.89543 9 9 9H15C16.1046 9 17 9.89543 17 11V15C17 15.5523 16.5523 16 16 16H8C7.44772 16 7 15.5523 7 15V11Z" fill="white" fillOpacity="0.3"/>
        <circle cx="12" cy="12.5" r="2.5" fill="white"/>
        <path d="M5.5 11.5V13.5C5.5 14.0523 5.94772 14.5 6.5 14.5H7.5V10.5H6.5C5.94772 10.5 5.5 10.9477 5.5 11.5Z" fill="white"/>
        <path d="M18.5 11.5V13.5C18.5 14.0523 18.0523 14.5 17.5 14.5H16.5V10.5H17.5C18.0523 10.5 18.5 10.9477 18.5 11.5Z" fill="white"/>
        <path d="M9.5 7.5H14.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

export default GCashIcon;
