import { useState } from 'react';

export function useFormValidation() {
    const [errors, setErrors] = useState({});

    const validateName = (name) => {
        if (!name) return 'Name is required';
        if (!/^[a-zA-Z\s.-]+$/.test(name)) {
            return 'Name must only contain letters, spaces, dots, or hyphens';
        }
        if (name.trim().split(' ').length < 2) {
            return 'Please enter your full name (first and last name)';
        }
        return null;
    };

    const validateContactName = (name) => {
        if (!name) return 'Contact name is required';
        if (!/^[a-zA-Z\s.-]+$/.test(name)) {
            return 'Contact name must only contain letters, spaces, dots, or hyphens';
        }
        return null;
    };

    const validatePhone = (phone) => {
        if (!phone) return 'Phone number is required';
        if (phone.length !== 10) {
            return 'Phone number must be exactly 10 digits';
        }
        if (!/^\d{10}$/.test(phone)) {
            return 'Phone number must only contain numbers';
        }
        return null;
    };

    const validatePassword = (password) => {
        if (!password) return 'Password is required';
        if (password.length < 8) {
            return 'Password must be at least 8 characters long';
        }
        if (!/(?=.*[a-zA-Z])/.test(password)) {
            return 'Password must contain at least one letter';
        }
        if (!/(?=.*\d)/.test(password)) {
            return 'Password must contain at least one number';
        }
        return null;
    };

    const validateIdFile = (file) => {
        if (!file) return 'Valid ID Document is required';
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            return 'File must be an image (jpg, jpeg, png)';
        }
        if (file.size > 5 * 1024 * 1024) {
            return 'File must be less than 5MB';
        }
        return null;
    };

    const setError = (field, message) => {
        setErrors(prev => ({ ...prev, [field]: message }));
    };

    const clearError = (field) => {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
        });
    };

    const clearAllErrors = () => {
        setErrors({});
    };

    return {
        errors,
        validateName,
        validateContactName,
        validatePhone,
        validatePassword,
        validateIdFile,
        setError,
        clearError,
        clearAllErrors
    };
}
