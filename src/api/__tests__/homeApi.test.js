import { loadBirdHighlights, loadBirdProfile, loadFeaturedTours } from '../homeApi'

describe('homeApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  test('loads featured tours from immediate homepage data', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tours: [{ id: 1, title: 'Monteverde Quetzal Tour' }],
        },
        meta: {},
      }),
    })

    await expect(loadFeaturedTours()).resolves.toEqual([
      { id: 1, title: 'Monteverde Quetzal Tour' },
    ])
    expect(global.fetch).toHaveBeenCalledWith('/tours')
  })

  test('loads bird highlights from immediate homepage data', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          birds: [{ speciesCode: 'quetz1' }],
        },
        meta: {},
      }),
    })

    await expect(loadBirdHighlights()).resolves.toEqual([
      { speciesCode: 'quetz1' },
    ])
  })

  test('loads bird profile from immediate homepage data', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          bird: {
            speciesCode: 'quetz1',
          },
        },
        meta: {},
      }),
    })

    await expect(loadBirdProfile({ speciesCode: 'quetz1' })).resolves.toEqual({
      speciesCode: 'quetz1',
    })
    expect(global.fetch).toHaveBeenCalledWith('/birds/profile?speciesCode=quetz1')
  })

  test('loads empty featured tours from valid homepage data', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tours: [],
        },
      }),
    })

    await expect(loadFeaturedTours()).resolves.toEqual([])
  })
})
