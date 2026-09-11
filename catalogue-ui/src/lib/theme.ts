import { createTheme } from '@mui/material/styles';

export function createAppTheme() {
  return createTheme({
    cssVariables: true,
    palette: {
      mode: 'dark',
      primary: {
        main: '#f04444',
      },
      background: {
        default: '#090a0c',
        paper: '#15171b',
      },
    },
    typography: {
      fontFamily: 'Roboto, Arial, sans-serif',
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&:not(.Mui-error).Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.7)',
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            '&:not(.Mui-error).Mui-focused': {
              color: 'rgba(255, 255, 255, 0.7)',
            },
          },
        },
      },
    },
  });
}
