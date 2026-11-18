// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('App', () => {
  it('renders the shell with the privacy promise', () => {
    render(<App />);
    expect(screen.getByText('Spendio')).toBeInTheDocument();
    expect(screen.getByText('Your bank data stays on this device.')).toBeInTheDocument();
  });
});
