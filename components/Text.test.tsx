/// <reference types="jest" />
import React from 'react';
import { StyleSheet, Text as RNText } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from './Text';
import { TypographyProvider } from '@/contexts/TypographyContext';

let mockStoredScale: string | null = '1.5';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => mockStoredScale),
    setItem: jest.fn(async () => {}),
  },
}));

/** Renders `element` inside the provider and returns every host Text's resolved style. */
async function renderStyles(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<TypographyProvider>{element}</TypographyProvider>);
  });
  return tree.root.findAllByType(RNText).map((n) => StyleSheet.flatten(n.props.style));
}

beforeEach(() => {
  mockStoredScale = '1.5';
});

describe('scale-aware Text', () => {
  it('multiplies font size and line height by the stored scale', async () => {
    const [style] = await renderStyles(
      <Text style={{ fontSize: 16, lineHeight: 24, color: '#111' }}>Ridely</Text>
    );
    expect(style.fontSize).toBe(24);
    expect(style.lineHeight).toBe(36);
    expect(style.color).toBe('#111'); // untouched
  });

  it('leaves styles alone at the default scale', async () => {
    mockStoredScale = '1';
    const [style] = await renderStyles(<Text style={{ fontSize: 16, lineHeight: 24 }}>Ridely</Text>);
    expect(style.fontSize).toBe(16);
    expect(style.lineHeight).toBe(24);
  });

  it('applies to styles passed as arrays and StyleSheet ids', async () => {
    const sheet = StyleSheet.create({ label: { fontSize: 12 } });
    const [style] = await renderStyles(<Text style={[sheet.label, { fontWeight: '600' }]}>Ridely</Text>);
    expect(style.fontSize).toBe(18);
    expect(style.fontWeight).toBe('600');
  });

  it('does not double-scale a nested Text that inherits its parent size', async () => {
    const styles = await renderStyles(
      <Text style={{ fontSize: 16 }}>
        outer <Text>nested</Text>
      </Text>
    );
    expect(styles).toHaveLength(2);
    expect(styles[0].fontSize).toBe(24); // parent scales once
    expect(styles[1]).toBeUndefined(); // nested gets no override, inherits 24 from the parent
  });

  it('leaves Texts with no text size untouched', async () => {
    const [style] = await renderStyles(<Text style={{ color: '#111' }}>Ridely</Text>);
    expect(style.fontSize).toBeUndefined();
    expect(style.color).toBe('#111');
  });
});
