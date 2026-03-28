import React from 'react';
import { Star } from 'lucide-react';

const RatingStars = ({ rating, size = 'sm', interactive = false, onRatingChange, readonly = true, showCount = true }) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  // Convert rating to number and handle invalid values
  const numericRating = parseFloat(rating);
  const validRating = isNaN(numericRating) ? 0 : numericRating;

  const renderStar = (index) => {
    const filled = index < validRating;
    const className = `${sizeClasses[size]} ${filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} ${interactive && !readonly ? 'cursor-pointer hover:text-yellow-400' : ''}`;
    
    return (
      <Star
        key={index}
        className={className}
        onClick={() => interactive && !readonly && onRatingChange(index + 1)}
      />
    );
  };

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map(renderStar)}
      {showCount && validRating > 0 && (
        <span className="ml-2 text-sm font-medium text-gray-700">
          {validRating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default RatingStars;
