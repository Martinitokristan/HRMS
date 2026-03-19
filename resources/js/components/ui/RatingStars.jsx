import React from 'react';
import { Star } from 'lucide-react';

const RatingStars = ({ rating, size = 'sm', interactive = false, onRatingChange, readonly = true }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const renderStar = (index) => {
    const filled = index < rating;
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
      {rating > 0 && (
        <span className="ml-2 text-sm font-medium text-gray-700">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default RatingStars;
