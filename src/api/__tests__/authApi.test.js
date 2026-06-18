import { updateProfile, updateProfileImage } from '../authApi'

describe('authApi profile updates', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  test('updates the current user profile with bearer auth', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            id: 'user-1',
            email: 'ana@example.com',
            name: 'Ana Maria',
            role: 'customer',
            plan: 'PRO',
            imageUrl: '/files/user-profile-images/user-1.png',
          },
        },
        meta: {},
      }),
    })

    await expect(updateProfile({
      token: 'access-token',
      name: 'Ana Maria',
    })).resolves.toEqual({
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Maria',
        role: 'customer',
        plan: 'PRO',
        imageUrl: '/files/user-profile-images/user-1.png',
      },
    })

    expect(global.fetch).toHaveBeenCalledWith('/auth/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({ name: 'Ana Maria' }),
    })
  })

  test('uploads a profile image as raw image bytes', async () => {
    const file = new File(['profile'], 'profile.png', { type: 'image/png' })
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            id: 'user-1',
            email: 'ana@example.com',
            imageUrl: '/files/user-profile-images/user-1.png',
          },
        },
        meta: {},
      }),
    })

    await expect(updateProfileImage({
      token: 'access-token',
      file,
    })).resolves.toMatchObject({
      user: {
        email: 'ana@example.com',
        imageUrl: '/files/user-profile-images/user-1.png',
      },
    })

    expect(global.fetch).toHaveBeenCalledWith('/auth/profile-image', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'image/png',
        'X-Filename': 'profile.png',
      },
      body: file,
    })
  })
})
