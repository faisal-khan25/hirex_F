/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scope Tailwind to only affect .interview-container and children
  content: [
    './src/components/interview/**/*.{js,jsx,ts,tsx}',
    './src/pages/*Interview*.{js,jsx,ts,tsx}',
  ],

  // Override defaults for interview scope only
  corePlugins: {
    // Disable preflight to avoid affecting existing app styles
    preflight: false,
  },

  theme: {
    extend: {
      colors: {
        // Interview-specific color palette
        'void': {
          50: '#f0f2f5',
          100: '#e1e5eb',
          500: '#05050a',
          900: '#000000',
        },
        'indigo': {
          core: '#6366f1',
          deep: '#4338ca',
          glow: '#818cf8',
          dark: '#3730a3',
        },
        'accent': {
          cyan: '#22d3ee',
          violet: '#c084fc',
          emerald: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
        },
      },

      fontFamily: {
        display: [
          'Space Grotesk',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        body: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'monospace',
        ],
      },

      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },

      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },

      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        'glow': '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-intense': '0 0 40px rgba(99, 102, 241, 0.5)',
      },

      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '350ms',
      },

      keyframes: {
        'pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'glow': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.5), 0 0 40px rgba(99, 102, 241, 0.3)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.7), 0 0 60px rgba(99, 102, 241, 0.5)',
          },
        },
        'orbit-slow': {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        'orbit-fast': {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        'waveform': {
          '0%, 100%': {
            height: '4px',
            opacity: '0.6',
          },
          '50%': {
            height: '20px',
            opacity: '1',
          },
        },
        'thinking-pulse': {
          '0%, 20%, 50%, 80%, 100%': {
            opacity: '0.4',
            transform: 'translateY(0)',
          },
          '40%': {
            opacity: '1',
            transform: 'translateY(-4px)',
          },
          '60%': {
            opacity: '1',
            transform: 'translateY(-4px)',
          },
        },
        'breathing': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
        },
        'scan': {
          '0%': { top: '-100%' },
          '100%': { top: '100%' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'slide-in-up': {
          'from': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'expand-center': {
          'from': {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          'to': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
      },

      animation: {
        'pulse': 'pulse 1.5s ease-in-out infinite',
        'glow': 'glow 3s ease-in-out infinite',
        'orbit-slow': 'orbit-slow 20s linear infinite',
        'orbit-fast': 'orbit-fast 4s linear infinite',
        'waveform': 'waveform 0.5s ease-in-out infinite',
        'thinking': 'thinking-pulse 1.2s ease-in-out infinite',
        'breathing': 'breathing 2s ease-in-out infinite',
        'scan': 'scan 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'slide-up': 'slide-in-up 0.35s ease-out',
        'fade': 'fade-in 0.25s ease-out',
        'expand': 'expand-center 0.35s ease-out',
      },
    },
  },

  plugins: [
    // Glass morphism plugin
    function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          'glass': (value) => ({
            'background': `rgba(13, 14, 26, ${value})`,
            'backdrop-filter': 'blur(10px)',
            'border': '1px solid rgba(99, 102, 241, 0.1)',
            'border-radius': '12px',
          }),
        },
        {
          values: {
            50: '0.05',
            100: '0.1',
            200: '0.2',
            300: '0.3',
            400: '0.4',
            500: '0.5',
            600: '0.6',
          },
        }
      );
    },

    // Glow effect plugin
    function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          'glow': (value) => ({
            'box-shadow': `0 0 ${value} rgba(99, 102, 241, 0.5)`,
          }),
        },
        {
          values: {
            sm: '10px',
            md: '20px',
            lg: '30px',
            xl: '40px',
            '2xl': '50px',
          },
        }
      );
    },
  ],
};