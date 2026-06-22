import { describe, it, expect, beforeEach } from 'vitest';
import { useShellStore } from './shell.store';

describe('shell.store', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useShellStore.setState({ navbarOpen: true });
  });

  it('default navbarOpen is true', () => {
    expect(useShellStore.getState().navbarOpen).toBe(true);
  });

  it('toggleNavbar inverts navbarOpen from true to false', () => {
    useShellStore.getState().toggleNavbar();
    expect(useShellStore.getState().navbarOpen).toBe(false);
  });

  it('toggleNavbar inverts navbarOpen from false to true', () => {
    useShellStore.setState({ navbarOpen: false });
    useShellStore.getState().toggleNavbar();
    expect(useShellStore.getState().navbarOpen).toBe(true);
  });

  it('setNavbarOpen(false) sets it to false', () => {
    useShellStore.getState().setNavbarOpen(false);
    expect(useShellStore.getState().navbarOpen).toBe(false);
  });

  it('setNavbarOpen(true) sets it to true', () => {
    useShellStore.setState({ navbarOpen: false });
    useShellStore.getState().setNavbarOpen(true);
    expect(useShellStore.getState().navbarOpen).toBe(true);
  });
});
