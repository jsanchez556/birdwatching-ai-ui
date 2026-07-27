import { useEffect, useMemo, useRef, useState } from 'react'
import { useResolvedMedia } from '../../hooks/useResolvedMediaUrl'

const PLANS = [
  {
    name: 'FREE',
    chats: '20 chats/day',
    identifications: '5 bird identifications/day',
    features: ['Birding chat access', 'Starter identification quota'],
  },
  {
    name: 'PRO',
    chats: '500 chats/day',
    identifications: '100 bird identifications/day',
    features: ['Higher daily AI limits', 'Expanded photo identification quota'],
  },
]
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function getDisplayName(user) {
  return user?.name || user?.email?.split('@')[0] || 'Birdwatcher'
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return 'BA'
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function getProfileImage(user) {
  return useResolvedMedia(user?.imageUrl || user?.profileImageUrl || user?.avatarUrl || '').url
}

function AccountAvatar({ imageUrl, initials, size = 'default' }) {
  return (
    <span className={`account-avatar account-avatar-${size}`} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials}</span>}
    </span>
  )
}

function AccountMenu({
  billingError = null,
  isBillingLoading = false,
  onLogout,
  onManageBilling,
  onUpdateProfile,
  onUpdateProfileImage,
  onUpgradePlan,
  user,
}) {
  const initialName = getDisplayName(user)
  const initialImage = getProfileImage(user)
  const [isOpen, setIsOpen] = useState(false)
  const [previewName, setPreviewName] = useState(initialName)
  const [previewImage, setPreviewImage] = useState(initialImage)
  const [profileError, setProfileError] = useState(null)
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [isImageSaving, setIsImageSaving] = useState(false)
  const menuRef = useRef(null)
  const fileInputRef = useRef(null)
  const userPlan = user?.plan || 'FREE'
  const initials = useMemo(() => getInitials(previewName || user?.email), [previewName, user?.email])
  const accountLabel = `Manage account for ${initialName}, ${user?.email || 'email unavailable'}`
  const trimmedPreviewName = previewName.trim()
  const isNameChanged = trimmedPreviewName !== initialName

  useEffect(() => {
    setPreviewName(initialName)
    setPreviewImage(initialImage)
  }, [initialName, initialImage])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!PROFILE_IMAGE_TYPES.has(file.type)) {
      setProfileError('Choose a JPEG, PNG, or WebP image.')
      event.target.value = ''
      return
    }

    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      setProfileError('Profile image must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    setProfileError(null)
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        setPreviewImage(reader.result)
      }
    })
    reader.readAsDataURL(file)

    if (!onUpdateProfileImage) {
      return
    }

    setIsImageSaving(true)

    try {
      const result = await onUpdateProfileImage({ file })
      const updatedImage = getProfileImage(result?.user)

      if (updatedImage) {
        setPreviewImage(updatedImage)
      }
    } catch (error) {
      setPreviewImage(initialImage)
      setProfileError(error.message || 'Unable to update your profile image.')
    } finally {
      setIsImageSaving(false)
      event.target.value = ''
    }
  }

  const handleUpgrade = () => {
    onUpgradePlan?.()
  }

  const handleManageBilling = () => {
    onManageBilling?.()
  }

  const handleChooseImage = () => {
    fileInputRef.current?.click()
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()

    if (!trimmedPreviewName) {
      setProfileError('Display name is required.')
      return
    }

    if (!isNameChanged || !onUpdateProfile) {
      return
    }

    setProfileError(null)
    setIsProfileSaving(true)

    try {
      await onUpdateProfile({ name: trimmedPreviewName })
    } catch (error) {
      setProfileError(error.message || 'Unable to update your profile.')
    } finally {
      setIsProfileSaving(false)
    }
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-label={accountLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <AccountAvatar imageUrl={previewImage} initials={initials} />
      </button>

      {isOpen && (
        <section className="account-popover" role="dialog" aria-label="Manage account">
          <div className="account-popover-profile">
            <button
              type="button"
              className="account-avatar-edit"
              aria-label="Choose profile image"
              disabled={isImageSaving}
              onClick={handleChooseImage}
            >
              <AccountAvatar imageUrl={previewImage} initials={initials} size="large" />
              <span className="account-avatar-camera" aria-hidden="true" />
            </button>
            <input
              ref={fileInputRef}
              className="account-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
            />
            <div>
              <p className="account-popover-name">{previewName}</p>
              <p className="account-popover-email">{user?.email}</p>
              <span className="account-plan-pill">{userPlan}</span>
            </div>
          </div>

          <form className="account-settings-panel" onSubmit={handleProfileSubmit}>
            <h2>Profile</h2>
            <label className="account-field">
              <span>Display name</span>
              <input
                type="text"
                value={previewName}
                onChange={(event) => setPreviewName(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="account-primary-action"
              disabled={!isNameChanged || isProfileSaving || !trimmedPreviewName}
            >
              {isProfileSaving ? 'Saving profile' : 'Save profile'}
            </button>
          </form>

          <div className="pricing-panel" aria-label="Pricing plans">
            {PLANS.map((plan) => {
              const isCurrentPlan = userPlan === plan.name
              const canUpgrade = plan.name === 'PRO' && userPlan !== 'PRO'

              return (
                <article className={isCurrentPlan ? 'pricing-card is-current' : 'pricing-card'} key={plan.name}>
                  <div className="pricing-card-header">
                    <h3>{plan.name}</h3>
                    {isCurrentPlan && <span>Current plan</span>}
                  </div>
                  <dl>
                    <div>
                      <dt>Chats</dt>
                      <dd>{plan.chats}</dd>
                    </div>
                    <div>
                      <dt>Identifications</dt>
                      <dd>{plan.identifications}</dd>
                    </div>
                  </dl>
                  <ul>
                    {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                  {canUpgrade && (
                    <button
                      type="button"
                      className="account-primary-action"
                      disabled={isBillingLoading}
                      onClick={handleUpgrade}
                    >
                      {isBillingLoading ? 'Opening Checkout' : 'Upgrade to PRO'}
                    </button>
                  )}
                  {isCurrentPlan && userPlan === 'PRO' && (
                    <button
                      type="button"
                      className="account-secondary-action"
                      disabled={isBillingLoading}
                      onClick={handleManageBilling}
                    >
                      {isBillingLoading ? 'Opening billing portal' : 'Manage billing'}
                    </button>
                  )}
                </article>
              )
            })}
          </div>

          {(billingError || profileError || isImageSaving) && (
            <p className="account-popover-error" role="status">
              {profileError || billingError || 'Saving profile image'}
            </p>
          )}

          <div className="account-popover-actions">
            <button type="button" className="account-secondary-action" onClick={onLogout}>
              Logout
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

export {
  AccountAvatar,
  getDisplayName,
  getInitials,
  getProfileImage,
}
export default AccountMenu
