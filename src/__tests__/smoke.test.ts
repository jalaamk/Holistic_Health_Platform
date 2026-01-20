import { describe, it, expect } from 'vitest';
import { greet, add } from '../utils/helpers';

describe('Smoke Tests', () => {
  describe('greet', () => {
    it('should return a greeting message', () => {
      const result = greet('World');
      expect(result).toBe('Hello, World!');
    });

    it('should handle different names', () => {
      expect(greet('Alice')).toBe('Hello, Alice!');
      expect(greet('Bob')).toBe('Hello, Bob!');
    });
  });

  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(add(1, 2)).toBe(3);
    });

    it('should add negative numbers', () => {
      expect(add(-1, -2)).toBe(-3);
    });

    it('should add zero', () => {
      expect(add(5, 0)).toBe(5);
    });
  });
});
