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
  });
}
