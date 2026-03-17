/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./resources/js/**/*.{js,jsx,ts,tsx}",
    "./resources/views/**/*.blade.php",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'DM Sans',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'sans-serif'
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))'
  			},
  			brand: {
  				DEFAULT: '#FF6B35',
  				light: '#FFF1EB',
  				hover: '#e85d2c'
  			},
  			success: {
  				DEFAULT: '#22C55E',
  				light: '#F0FDF4',
  				foreground: '#15803d'
  			},
  			warning: {
  				DEFAULT: '#F59E0B',
  				light: '#FFFBEB',
  				foreground: '#b45309'
  			},
  			danger: {
  				DEFAULT: '#EF4444',
  				light: '#FEF2F2',
  				foreground: '#dc2626'
  			},
  			info: {
  				DEFAULT: '#3B82F6',
  				light: '#EFF6FF',
  				foreground: '#1d4ed8'
  			},
  			violet: {
  				DEFAULT: '#8B5CF6',
  				light: '#F5F3FF',
  				foreground: '#6d28d9'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			sm: '0 1px 3px rgba(0,0,0,.08)',
  			md: '0 4px 16px rgba(0,0,0,.12)',
  			card: '0 2px 8px rgba(0,0,0,.04)',
  			'card-hover': '0 8px 24px rgba(0,0,0,.08)',
  			modal: '0 20px 60px rgba(0,0,0,.25)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'slide-in-right': {
  				from: {
  					transform: 'translateX(100%)',
  					opacity: '0'
  				},
  				to: {
  					transform: 'translateX(0)',
  					opacity: '1'
  				}
  			},
  			'modal-in': {
  				from: {
  					transform: 'scale(0.95) translateY(-12px)',
  					opacity: '0'
  				},
  				to: {
  					transform: 'scale(1) translateY(0)',
  					opacity: '1'
  				}
  			},
  			'fade-in': {
  				from: {
  					opacity: '0'
  				},
  				to: {
  					opacity: '1'
  				}
  			},
  			'skeleton-loading': {
  				'0%': {
  					backgroundPosition: '200% 0'
  				},
  				'100%': {
  					backgroundPosition: '-200% 0'
  				}
  			},
  			spin: {
  				to: {
  					transform: 'rotate(360deg)'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'slide-in-right': 'slide-in-right 0.3s ease',
  			'modal-in': 'modal-in 0.2s ease',
  			'fade-in': 'fade-in 0.2s ease',
  			'skeleton': 'skeleton-loading 1.5s infinite',
  			spin: 'spin 0.7s linear infinite'
  		},
  		spacing: {
  			'sidebar': '260px',
  			'topbar': '64px'
  		}
  	}
  },
  plugins: [
    require("@tailwindcss/forms")({
      strategy: "class",
    }),
  ],
};
