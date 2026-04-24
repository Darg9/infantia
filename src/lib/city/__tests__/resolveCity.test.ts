import { describe, it, expect } from 'vitest';
import { resolveCityId } from '../resolveCity';

describe('resolveCityId', () => {
  it('should prioritize urlCityId over others', () => {
    expect(resolveCityId({
      urlCityId: 'city-url',
      storedCityId: 'city-stored',
      defaultCityId: 'city-default',
    })).toBe('city-url');
  });

  it('should use storedCityId if urlCityId is null or undefined', () => {
    expect(resolveCityId({
      urlCityId: undefined,
      storedCityId: 'city-stored',
      defaultCityId: 'city-default',
    })).toBe('city-stored');

    expect(resolveCityId({
      urlCityId: null,
      storedCityId: 'city-stored',
      defaultCityId: 'city-default',
    })).toBe('city-stored');
  });

  it('should use defaultCityId if both urlCityId and storedCityId are absent', () => {
    expect(resolveCityId({
      urlCityId: null,
      storedCityId: undefined,
      defaultCityId: 'city-default',
    })).toBe('city-default');
  });

  it('should handle only defaultCityId provided', () => {
    expect(resolveCityId({
      defaultCityId: 'city-default',
    })).toBe('city-default');
  });
});
