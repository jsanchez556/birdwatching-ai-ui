import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CookieConsent from '../CookieConsent'
import { clearConsent, readConsent } from '../../../utils/cookies'

beforeEach(() => {
  clearConsent()
})

test('shows banner when no choice saved and hides after accept all', () => {
  render(<CookieConsent />)
  expect(screen.getByRole('region', { name: /cookie consent/i })).toBeInTheDocument()

  const accept = screen.getByRole('button', { name: /accept all/i })
  fireEvent.click(accept)

  // banner should be removed
  expect(screen.queryByRole('region', { name: /cookie consent/i })).toBeNull()

  const stored = readConsent()
  expect(stored.choice).toBe('accepted')
  expect(stored.categories.analytics).toBe(true)
})

test('decline non-essential saves declined categories', () => {
  render(<CookieConsent />)
  const decline = screen.getByRole('button', { name: /decline non-essential/i })
  fireEvent.click(decline)

  expect(screen.queryByRole('region', { name: /cookie consent/i })).toBeNull()
  const stored = readConsent()
  expect(stored.choice).toBe('declined')
  expect(stored.categories.analytics).toBe(false)
})

test('customize opens dialog and saves custom preferences', () => {
  render(<CookieConsent />)
  const customize = screen.getByRole('button', { name: /customize/i })
  fireEvent.click(customize)

  const dialog = screen.getByRole('dialog', { name: /customize cookie preferences/i })
  expect(dialog).toBeInTheDocument()

  const analytics = screen.getByRole('checkbox', { name: /analytics/i })
  fireEvent.click(analytics)

  const save = screen.getByRole('button', { name: /save preferences/i })
  fireEvent.click(save)

  expect(screen.queryByRole('dialog')).toBeNull()
  const stored = readConsent()
  expect(stored.choice).toBe('customize')
  expect(stored.categories.analytics).toBe(true)
})
