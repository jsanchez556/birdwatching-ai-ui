import { useEffect, useRef, useState } from 'react'

const SCROLLED_ENTER_Y = 32
const SCROLLED_EXIT_Y = 8
const ACTIVE_SECTION_OFFSET = 96

function getScrollY() {
  if (typeof window === 'undefined') return 0
  return window.scrollY || window.pageYOffset || 0
}

function useHomeHeaderScroll() {
  const [isScrolled, setIsScrolled] = useState(() => getScrollY() > SCROLLED_ENTER_Y)
  const [activeItem, setActiveItem] = useState('home')
  const frameRef = useRef(null)

  useEffect(() => {
    const update = () => {
      frameRef.current = null
      const scrollY = getScrollY()
      const featuredTours = document.getElementById('featured-tours')
      const exploreTop = featuredTours
        ? featuredTours.offsetTop - ACTIVE_SECTION_OFFSET
        : Number.POSITIVE_INFINITY

      setIsScrolled((wasScrolled) => (
        wasScrolled ? scrollY > SCROLLED_EXIT_Y : scrollY > SCROLLED_ENTER_Y
      ))
      setActiveItem(scrollY >= exploreTop ? 'explore' : 'home')
    }

    const handleScroll = () => {
      if (frameRef.current !== null) return
      frameRef.current = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return { activeItem, isScrolled, setActiveItem }
}

export default useHomeHeaderScroll
